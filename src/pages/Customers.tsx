/* Back office at /customers — the built-in CRM. Reads the same
   orders store the storefront writes. Passcode gate is a
   placeholder until real auth lands. */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  SHARES, SEASONS, CURRENT_SEASON, DEPOSIT, HANGING_RATE, SHARE_RATES, seasonOf, tierFor, groupTier, targetQuarters, money, money2, type Season,
  type SeasonId,
} from "../data/config";
import {
  listOrders, updateOrder, updateOrderStatus, getNotes, setNote, STATUS_STEPS,
  listSteers, saveSteer, deleteSteer, getSettings, saveSettings, reservedSteers,
  DEFAULT_SETTINGS,
  type Order, type OrderStatus, type Steer, type SeasonSettings,
} from "../lib/store";
import { downloadCutSheet, buildFilledCutSheet, bytesToBase64 } from "../lib/cutsheetPdf";
import { finalPrice } from "../lib/estimate";
import {
  backendConfigured, checkAdminKey, fetchOffice, pushStatus,
  pushSteer, removeSteer, pushAssignment, pushSettings, sendInvoice, checkStripe, checkDeposit, type Office,
} from "../lib/api";
import { refreshAvailability, steerCount } from "../lib/availability";
import SteerTracker from "../components/SteerTracker";

type Tab = "roster" | "groups" | "steers" | "customers";

/** What the order actually costs once its steer has been weighed —
    at that animal's rate, which may sit under the standard one. */
function actualTotal(o: Order, steer?: Steer): number | null {
  return finalPrice(o.share, steer, o.cutSheet, o.groupFrac, o.depositAmount ?? DEPOSIT)?.total ?? null;
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

const AUTH_KEY = "tr.admin.v1";
const KEY_KEY = "tr.admin.key";
/* Local demo mode only (no backend). With a backend, the key is
   validated server-side and never lives in this code. */
const DEMO_PASSCODE = "KERSEY";

/* ---------------- exports, one harvest at a time ----------------
   Three files because three people want them: the roster for the
   ranch, the cut sheets for the butcher, the invoices for the books. */

function csvDownload(name: string, head: string[], rows: (string | number)[][]) {
  const csv = [head, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? "").split('"').join('""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function exportCustomers(orders: Order[], steers: Steer[], season: Season) {
  csvDownload(`thunderbolt-${slug(season.label)}-customers.csv`,
    ["code", "status", "name", "email", "phone", "address", "share", "harvest", "steer", "steer_hanging_lbs", "kill_date", "est_ready", "created"],
    orders.map((o) => {
      const st = steers.find((x) => x.id === o.steer);
      return [o.code, o.status, o.name, o.email, o.phone, o.address, SHARES[o.share].label, season.label,
        o.steer ?? "", st?.hangingWeight ?? "", st?.killDate ?? "", st?.readyDate ?? "", new Date(o.createdAt).toISOString().slice(0, 10)];
    }));
}

function exportInvoices(orders: Order[], steers: Steer[], season: Season) {
  csvDownload(`thunderbolt-${slug(season.label)}-invoices.csv`,
    ["code", "name", "email", "share", "steer", "hanging_lbs", "share_lbs", "rate_per_lb", "beef_total", "patty_lbs", "patty_charge", "total", "deposit", "balance", "priced_on", "status"],
    orders.map((o) => {
      const st = steers.find((x) => x.id === o.steer);
      const p = finalPrice(o.share, st, o.cutSheet, o.groupFrac, o.depositAmount ?? DEPOSIT);
      return p
        ? [o.code, o.name, o.email, SHARES[o.share].label, o.steer ?? "", p.hangingLbs, p.shareLbs, p.rate.toFixed(2), p.beefTotal, p.pattyLbs, p.pattyCharge, p.total, p.deposit, p.balance, "actual weight", o.status]
        : [o.code, o.name, o.email, SHARES[o.share].label, o.steer ?? "", "", SHARES[o.share].hanging, HANGING_RATE.toFixed(2), SHARES[o.share].total, "", "", SHARES[o.share].total, DEPOSIT, SHARES[o.share].total - DEPOSIT, "estimate", o.status];
    }));
}

/** Every filled cut sheet for the harvest, stapled into one PDF in
    roster order — what actually goes to the butcher. */
async function exportCutSheets(orders: Order[], steers: Steer[], season: Season) {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const o of orders) {
    const st = steers.find((x) => x.id === o.steer) ?? null;
    const bytes = await buildFilledCutSheet(o, st);
    const doc = await PDFDocument.load(bytes);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    for (const pg of pages) out.addPage(pg);
  }
  const url = URL.createObjectURL(new Blob([await out.save() as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url; a.download = `thunderbolt-${slug(season.label)}-cut-sheets.pdf`; a.click();
  URL.revokeObjectURL(url);
}

/* One steer, editable in place. `steer` undefined = the blank "add" row. */
function SteerRow({
  steer, linked, taken, onSave, onRemove,
}: {
  steer?: Steer;
  linked: Order[];
  taken: string[];                 // ids already in use by other steers
  onSave: (next: Steer, originalId?: string) => Promise<void> | void;
  onRemove?: () => void;
}) {
  const blank = { id: "", season: CURRENT_SEASON as SeasonId, hangingWeight: "", readyDate: "", rate: "", killDate: "" };
  const from = (s?: Steer) =>
    s ? {
      id: s.id, season: s.season,
      hangingWeight: s.hangingWeight ? String(s.hangingWeight) : "",
      readyDate: s.readyDate ?? "",
      rate: s.rate ? String(s.rate) : "",
      killDate: s.killDate ?? "",
    } : blank;
  const [d, setD] = useState(() => from(steer));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setD(from(steer)); }, [steer?.id, steer?.season, steer?.hangingWeight, steer?.readyDate, steer?.rate, steer?.killDate]);

  const id = d.id.trim();
  const dirty = JSON.stringify(d) !== JSON.stringify(from(steer));
  const clash = taken.includes(id);
  const weight = d.hangingWeight.trim() === "" ? undefined : Number(d.hangingWeight);
  const weightBad = weight !== undefined && !(weight > 0);
  const rate = d.rate.trim() === "" ? undefined : Number(d.rate);
  const rateBad = rate !== undefined && !(rate > 0);
  const rateCut = rate !== undefined && rate < HANGING_RATE;
  const claimed = linked.reduce((t, o) => t + SHARES[o.share].frac, 0);
  const label = steer ? `steer ${steer.id}` : "new steer";

  const save = async () => {
    setBusy(true);
    try {
      await onSave({ id, season: d.season, hangingWeight: weight, readyDate: d.readyDate || undefined, rate, killDate: d.killDate || undefined }, steer?.id);
      if (!steer) setD(blank);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <input className="admin-input mono" value={d.id} placeholder={steer ? "" : "Tag or ID"}
          aria-label={`ID for ${label}`} onChange={(e) => setD({ ...d, id: e.target.value })} />
        {clash && <span className="admin-sub" style={{ color: "var(--rust)" }}>Already used</span>}
      </td>
      <td>
        <select className="admin-select" value={d.season} aria-label={`Harvest for ${label}`}
          onChange={(e) => setD({ ...d, season: e.target.value as SeasonId })}>
          {Object.values(SEASONS).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </td>
      <td>
        <input className="admin-input mono" type="number" min="0" step="1" inputMode="decimal"
          value={d.hangingWeight} placeholder="lb" aria-label={`Hanging weight for ${label}`}
          onChange={(e) => setD({ ...d, hangingWeight: e.target.value })} />
      </td>
      <td>
        <input className="admin-input mono" type="number" min="0" step="0.05" inputMode="decimal"
          value={d.rate} placeholder={HANGING_RATE.toFixed(2)} aria-label={`Price per pound for ${label}`}
          onChange={(e) => setD({ ...d, rate: e.target.value })} />
        {rateBad
          ? <span className="admin-sub" style={{ color: "var(--rust)" }}>Must be above 0</span>
          : rateCut
            ? <span className="admin-sub" style={{ color: "var(--sage)" }}>
                {money2(HANGING_RATE - rate!)}/lb off standard
              </span>
            : rate !== undefined && rate > HANGING_RATE
              ? <span className="admin-sub" style={{ color: "var(--rust)" }}>Above standard</span>
              : <span className="admin-sub">Whole-share $/lb · half +{(SHARE_RATES.half - SHARE_RATES.whole).toFixed(2)}, quarter +{(SHARE_RATES.quarter - SHARE_RATES.whole).toFixed(2)}</span>}
      </td>
      <td>
        <input className="admin-input" type="date" value={d.killDate} aria-label={`Kill date for ${label}`}
          onChange={(e) => setD({ ...d, killDate: e.target.value })} />
      </td>
      <td>
        <input className="admin-input" type="date" value={d.readyDate} aria-label={`Estimated ready date for ${label}`}
          onChange={(e) => setD({ ...d, readyDate: e.target.value })} />
      </td>
      <td>
        {steer && (
          <>
            <span className={"admin-chip" + (claimed > 1 ? " hot" : claimed === 1 ? " done" : "")}>
              {claimed === 0 ? "No orders linked" : `${steerCount(claimed)} of 1 claimed`}
            </span>
            {linked.map((o) => (
              <span key={o.code} className="admin-chip">{SHARES[o.share].label} · {o.name}</span>
            ))}
          </>
        )}
      </td>
      <td>
        <div className="row-actions">
          <button className="btn btn-ghost" disabled={busy || !id || clash || weightBad || rateBad || !dirty} onClick={save}>
            {busy ? "Saving…" : steer ? "Save" : "Add steer"}
          </button>
          {onRemove && (
            <button className="small" style={{ textDecoration: "underline" }} onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* The two numbers behind the front-page tracker. */
function SettingsForm({
  settings, online, disabled, onSave,
}: {
  settings: SeasonSettings;
  online: number;                  // steers' worth ordered on the site
  disabled: boolean;
  onSave: (next: SeasonSettings) => Promise<void> | void;
}) {
  const [capacity, setCapacity] = useState(String(settings.capacity));
  const [offline, setOffline] = useState(String(settings.offline));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCapacity(String(settings.capacity));
    setOffline(String(settings.offline));
  }, [settings.capacity, settings.offline]);

  const next: SeasonSettings = {
    capacity: Math.round(Number(capacity)),
    offline: Math.round(Number(offline) * 4) / 4,   // shares come in quarters
  };
  const valid = next.capacity >= 1 && next.offline >= 0;
  const dirty = next.capacity !== settings.capacity || next.offline !== settings.offline;
  const season = SEASONS[CURRENT_SEASON].name;

  return (
    <div className="steer-settings-form">
      <span className="tag" style={{ color: "var(--rust)" }}>Front-page tracker</span>
      <div className="pair">
        <div className="field">
          <label htmlFor="ss-cap">Steers this {season}</label>
          <input id="ss-cap" type="number" min="1" step="1" inputMode="numeric" value={capacity}
            disabled={disabled} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ss-off">Reserved off the site</label>
          <input id="ss-off" type="number" min="0" step="0.25" inputMode="decimal" value={offline}
            disabled={disabled} onChange={(e) => setOffline(e.target.value)} />
        </div>
      </div>
      <p className="small mute">
        The tracker counts {season} orders placed on the site — {steerCount(online)} steers' worth
        right now — plus whatever you've promised off the site. Enter that in steers: a half
        is 0.5, a quarter is 0.25.
      </p>
      <div>
        <button
          className="btn btn-dark"
          disabled={disabled || busy || !valid || !dirty}
          onClick={async () => { setBusy(true); try { await onSave(next); } finally { setBusy(false); } }}
        >
          {busy ? "Saving…" : "Save tracker"}
        </button>
      </div>
    </div>
  );
}

export default function Customers() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === "1");
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<Tab>("roster");
  const [tick, setTick] = useState(0);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState<string | null>(null);
  const [exportSeason, setExportSeason] = useState<SeasonId>(CURRENT_SEASON);
  const [stripeNote, setStripeNote] = useState<string | null>(null);
  const testStripe = async () => {
    setStripeNote("Checking…");
    try {
      const r = await checkStripe(adminKey);
      setStripeNote(
        `Stripe OK — ${r.keyType} key, ${r.livemode ? "LIVE" : "test"} mode, ACH ${r.ach === "on" ? "on" : r.ach === "off" ? "OFF (Stripe → Settings → Payment methods)" : "unknown"}.`,
      );
    } catch (e) {
      setStripeNote((e as Error).message);
    }
  };
  const [exportBusy, setExportBusy] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState<Record<string, boolean>>({});
  const [remote, setRemote] = useState<Office | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const adminKey = sessionStorage.getItem(KEY_KEY) ?? "";
  const live = backendConfigured();
  const local = useMemo(() => listOrders(), [tick]);
  const orders = remote?.orders ?? local;
  /* money and tracker math only count orders whose deposit is in */
  const paidOrders = orders.filter((o) => o.status !== "pending-deposit");
  /* a group is every order sharing a root code; one member alone isn't a group */
  const groups = useMemo(() => {
    const by: Record<string, Order[]> = {};
    for (const o of orders) { if (o.sample) continue; const root = o.group ?? o.code; (by[root] ??= []).push(o); }
    return Object.entries(by).filter(([, m]) => m.length > 1).map(([root, members]) => ({ root, members }));
  }, [orders]);
  const assignGroup = async (members: Order[], steer: string) => {
    for (const o of members) if ((o.steer ?? "") !== steer) await assign(o, { steer });
  };
  const exportOrders = useMemo(
    () => orders.filter((o) => !o.sample && seasonOf(o).id === exportSeason),
    [orders, exportSeason],
  );
  const steers = useMemo(() => (live ? remote?.steers ?? [] : listSteers()), [live, remote, tick]);
  const settings = useMemo(() => (live ? remote?.settings ?? DEFAULT_SETTINGS : getSettings()), [live, remote, tick]);
  /* an Apps Script from before steer tracking answers without these */
  const steersReady = !live || !remote || remote.steers !== undefined;
  const notes = useMemo(() => getNotes(), [tick]);

  /* pull the roster from the ranch's order system */
  useEffect(() => {
    if (!authed || !live) return;
    let alive = true;
    fetchOffice(adminKey)
      .then((office) => { if (alive) { setRemote(office); setLoadError(null); } })
      .catch((e) => { if (alive) setLoadError((e as Error).message); });
    return () => { alive = false; };
  }, [authed, adminKey, tick, live]);

  /* Apply a change here right away, send it to the order system, then
     re-read so the screen shows what was actually saved. */
  const commit = async (apply: () => void, send: () => Promise<unknown>, optimistic?: (o: Office) => Office) => {
    if (live) {
      if (optimistic) setRemote((o) => (o ? optimistic(o) : o));
      try { await send(); setLoadError(null); } catch (e) { setLoadError((e as Error).message); }
    } else {
      apply();
    }
    refreshAvailability();
    setTick((x) => x + 1);
  };

  const patchOrder = (code: string, patch: Partial<Order>) => (o: Office): Office =>
    ({ ...o, orders: o.orders.map((x) => (x.code === code ? { ...x, ...patch } : x)) });

  const changeStatus = (o: Order, status: OrderStatus) =>
    commit(() => updateOrderStatus(o.code, status), () => pushStatus(adminKey, o.code, status), patchOrder(o.code, { status }));

  const assign = (o: Order, patch: { steer?: string; season?: SeasonId }) =>
    commit(() => updateOrder(o.code, patch), () => pushAssignment(adminKey, o.code, patch), patchOrder(o.code, patch));

  const storeSteer = (next: Steer, originalId?: string) =>
    commit(() => saveSteer(next, originalId), () => pushSteer(adminKey, next, originalId));

  const dropSteer = (steer: Steer) => {
    if (!window.confirm(`Remove steer ${steer.id}? Orders linked to it go back to unassigned.`)) return;
    commit(() => deleteSteer(steer.id), () => removeSteer(adminKey, steer.id));
  };

  const storeSettings = (next: SeasonSettings) =>
    commit(() => saveSettings(next), () => pushSettings(adminKey, next), (o) => ({ ...o, settings: next }));

  /* The final invoice goes out from here, not automatically — Josh
     decides when a steer's numbers are settled enough to bill on. */
  const emailInvoice = async (o: Order) => {
    const steer = steers.find((x) => x.id === o.steer);
    const price = finalPrice(o.share, steer, o.cutSheet, o.groupFrac, o.depositAmount ?? DEPOSIT);
    if (!price) return;
    const ask = price.adjusted
      ? `Email ${o.name} their final invoice? ${money(price.balance)} due at ${money2(price.rate)}/lb `
        + `(down from ${money2(price.standardRate)}), and they'll be told why.`
      : `Email ${o.name} their final invoice? ${money(price.balance)} due at ${money2(price.rate)}/lb.`;
    if (!window.confirm(ask)) return;
    setInvoiceBusy(o.code);
    setLoadError(null);
    try {
      /* the filled sheet rides along as the attachment */
      const pdf = bytesToBase64(await buildFilledCutSheet(o, steer));
      const r = await sendInvoice(adminKey, o.code, pdf);
      setInvoiceSent((m) => ({ ...m, [o.code]: true }));
      if (r.warning) setLoadError(r.warning);
      setTick((t) => t + 1);
    } catch (e) {
      setLoadError(`Couldn't send ${o.code}'s invoice: ${(e as Error).message}`);
    } finally {
      setInvoiceBusy(null);
    }
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = code.trim();
    if (backendConfigured()) {
      setChecking(true);
      setUnreachable(false);
      const result = await checkAdminKey(key);
      setChecking(false);
      if (result === "unreachable") { setUnreachable(true); return; }
      if (result === "bad") { setBad(true); return; }
      sessionStorage.setItem(KEY_KEY, key);
    } else if (key.toUpperCase() !== DEMO_PASSCODE) {
      setBad(true);
      return;
    }
    sessionStorage.setItem(AUTH_KEY, "1");
    setAuthed(true);
  };

  if (!authed) {
    return (
      <main className="page confirm-wrap" style={{ maxWidth: 420 }}>
        <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>Back office</div>
        <h2 className="d">Ranch hands only.</h2>
        <form
          className="decision"
          style={{ display: "grid", gap: "var(--space-sm)", marginTop: "var(--space-lg)", textAlign: "left" }}
          onSubmit={unlock}
        >
          <div className="field">
            <label htmlFor="pc">Passcode</label>
            <input id="pc" type="password" value={code} onChange={(e) => { setCode(e.target.value); setBad(false); setUnreachable(false); }} autoFocus />
          </div>
          {bad && <p className="small" style={{ color: "var(--rust)" }}>That's not it. Ask Max or Josh.</p>}
          {unreachable && <p className="small" style={{ color: "var(--rust)" }}>Couldn't reach the order system. Give it a minute and try again.</p>}
          <button className="btn btn-solid btn-wide" type="submit" disabled={checking}>
            {checking ? "Checking…" : "Open the books"}
          </button>
        </form>
      </main>
    );
  }

  const customers = Object.values(
    orders.reduce<Record<string, { name: string; email: string; phone: string; orders: Order[] }>>((acc, o) => {
      const k = o.email.toLowerCase();
      acc[k] ??= { name: o.name, email: o.email, phone: o.phone, orders: [] };
      acc[k].orders.push(o);
      return acc;
    }, {}),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const totals = paidOrders.reduce(
    (t, o) => ({
      hanging: t.hanging + SHARES[o.share].hanging,
      revenue: t.revenue + SHARES[o.share].total,
      deposits: t.deposits + DEPOSIT,
    }),
    { hanging: 0, revenue: 0, deposits: 0 },
  );

  return (
    <main className="page order-main office">
      <div className="admin-bar">
        <div>
          <div className="tag" style={{ color: "var(--rust)" }}>Back office · {SEASONS[CURRENT_SEASON].label}</div>
          <h2 className="d" style={{ fontSize: "2rem" }}>Customers &amp; orders</h2>
          <p className="small mute" style={{ marginTop: 4 }}>
            {orders.length} orders · ~{totals.hanging.toLocaleString()} lb hanging committed ·
            {" "}{money(totals.revenue)} booked ({money(totals.deposits)} in deposits)
            {live && !remote && !loadError && " · loading from the order sheet…"}
            {!live && " · local demo mode"}
          </p>
          {loadError && <p className="small" style={{ color: "var(--rust)" }}>Order system: {loadError}</p>}
          {stripeNote && <p className="small" style={{ color: stripeNote.startsWith("Stripe OK") ? "var(--sage)" : "var(--rust)" }}>{stripeNote}</p>}
        </div>
        <div className="admin-actions">
          <button className="btn btn-ghost" onClick={() => setTick((x) => x + 1)}>Refresh</button>
          <span className="export-bar">
            <select className="admin-select" value={exportSeason} aria-label="Harvest to export"
              onChange={(e) => setExportSeason(e.target.value as SeasonId)}>
              {Object.values(SEASONS).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            {live && <button className="btn btn-ghost" onClick={testStripe}>Test Stripe</button>}
            <button className="btn btn-ghost" onClick={() => exportCustomers(exportOrders, steers, SEASONS[exportSeason])}>Customers CSV</button>
            <button className="btn btn-ghost" onClick={() => exportInvoices(exportOrders, steers, SEASONS[exportSeason])}>Invoices CSV</button>
            <button className="btn btn-ghost" disabled={exportBusy || !exportOrders.length}
              onClick={async () => { setExportBusy(true); try { await exportCutSheets(exportOrders, steers, SEASONS[exportSeason]); } finally { setExportBusy(false); } }}>
              {exportBusy ? "Building…" : `Cut sheets PDF (${exportOrders.length})`}
            </button>
          </span>
          <button className="btn btn-ghost" onClick={() => { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(KEY_KEY); setAuthed(false); }}>
            Lock up
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        {(["roster", "groups", "steers", "customers"] as Tab[]).map((t) => (
          <button key={t} className={"admin-tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "roster" ? `Harvest roster (${orders.length})`
              : t === "groups" ? `Groups (${groups.length})`
              : t === "steers" ? `Steers (${steers.length})`
              : `Customers (${customers.length})`}
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <div className="admin-table-wrap">
          <table className="admin-table roster">
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Share</th><th>Harvest &amp; steer</th><th>Total</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const steer = steers.find((x) => x.id === o.steer);
                const price = finalPrice(o.share, steer, o.cutSheet, o.groupFrac, o.depositAmount ?? DEPOSIT);
                const actual = price?.total ?? null;
                return (
                <tr key={o.code} className={o.status === "pending-deposit" ? "row-pending" : ""}>
                  <td className="mono">{o.code}{o.sample && <span className="admin-chip">sample</span>}{o.status === "pending-deposit" && <span className="admin-chip hot">no deposit</span>}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div className="small mute">{o.email}{o.phone && ` · ${o.phone}`}</div>
                  </td>
                  <td>{SHARES[o.share].label} · ~{SHARES[o.share].takehome} lb</td>
                  <td>
                    <select
                      className="admin-select"
                      value={seasonOf(o).id}
                      disabled={!steersReady}
                      onChange={(e) => assign(o, { season: e.target.value as SeasonId })}
                      aria-label={`Harvest for ${o.code}`}
                    >
                      {Object.values(SEASONS).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                    <select
                      className="admin-select"
                      style={{ display: "block", marginTop: 6 }}
                      value={o.steer ?? ""}
                      disabled={!steersReady}
                      onChange={(e) => assign(o, { steer: e.target.value })}
                      aria-label={`Steer for ${o.code}`}
                    >
                      <option value="">No steer yet</option>
                      {o.steer && !steer && <option value={o.steer}>{o.steer} (removed)</option>}
                      {steers.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}
                    </select>
                    {steer?.readyDate && <span className="admin-sub">ready ≈ {fmtDate(steer.readyDate)}</span>}
                  </td>
                  <td className="mono">
                    {money(actual ?? SHARES[o.share].total)}
                    <span className="admin-sub">
                      {price
                        ? `${price.shareLbs} lb × ${money2(price.rate)}`
                        : "estimate"}
                    </span>
                    {price?.adjusted && (
                      <span className="admin-chip done">rate cut · saves {money(price.saved)}</span>
                    )}
                    {(o.groupSize ?? 1) > 1 && (
                      <span className="admin-chip">group · {steerCount(o.groupFrac ?? SHARES[o.share].frac)} steer · {price ? price.tier : tierFor(o.share, o.groupFrac)}-steer rate</span>
                    )}
                    {o.depositKind === "group" && <span className="admin-chip done">$600 group deposit</span>}
                    {o.depositKind === "covered" && <span className="admin-chip">deposit covered by group</span>}
                  </td>
                  <td>
                    <select
                      className="admin-select"
                      value={o.status}
                      onChange={(e) => changeStatus(o, e.target.value as OrderStatus)}
                      aria-label={`Status for ${o.code}`}
                    >
                      <option value="pending-deposit">Awaiting deposit</option>
                      {STATUS_STEPS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                    <button
                      className="small" style={{ textDecoration: "underline" }}
                      disabled={pdfBusy === o.code}
                      onClick={async () => { setPdfBusy(o.code); try { await downloadCutSheet(o, steer); } finally { setPdfBusy(null); } }}
                    >
                      {pdfBusy === o.code ? "…" : "CCMC PDF"}
                    </button>
                    <Link className="small" to={`/customers/ticket/${o.code}`}>Ticket</Link>
                    {o.status === "pending-deposit" && live && (
                      <button className="small" style={{ textDecoration: "underline" }}
                        onClick={async () => { setLoadError(null); try { const r = await checkDeposit(o.code); setLoadError(r.paid ? `${o.code}: deposit found — now reserved.` : `${o.code}: Stripe shows no deposit yet.`); setTick((t) => t + 1); } catch (e) { setLoadError((e as Error).message); } }}>
                        Check deposit
                      </button>
                    )}
                    <button
                      className="small" style={{ textDecoration: "underline" }}
                      disabled={!price || !live || invoiceBusy === o.code}
                      title={
                        !price ? "Weigh this order's steer first"
                          : !live ? "Needs the live backend"
                            : `Email the final invoice to ${o.email}`
                      }
                      onClick={() => emailInvoice(o)}
                    >
                      {invoiceBusy === o.code ? "Sending…" : (invoiceSent[o.code] || o.invoicedAt) ? "Re-send invoice" : "Email invoice"}
                    </button>
                    {(o.invoicedAt || o.signedAt) && (
                      <span className="flow-chips">
                        {o.invoicedAt && <span className="admin-chip">invoiced {fmtDate(o.invoicedAt)}</span>}
                        {o.signedAt && <span className="admin-chip done">signed · {o.signedBy}</span>}
                        {o.paidAt && <span className="admin-chip done">paid</span>}
                        {o.signedAt && !o.paidAt && o.payState === "pending" && <span className="admin-chip">ACH clearing</span>}
                        {o.signedAt && !o.paidAt && o.payState !== "pending" && <span className="admin-chip hot">no payment found</span>}
                        {o.butcherSentAt && <span className="admin-chip done">sent to CCMC</span>}
                      </span>
                    )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={7} className="mute" style={{ textAlign: "center", padding: "var(--space-xl)" }}>No orders yet.</td></tr>
              )}
            </tbody>
          </table>
          <p className="small mute" style={{ marginTop: "var(--space-sm)" }}>
            "CCMC PDF" downloads the customer's filled cutting-instructions form, ready to email
            to order@ccmeatco.com. Status changes update the customer's tracking page immediately.
            Link an order to a steer and, once that steer's hanging weight is in, the total
            switches from the estimate to the real number. "Email invoice" sends the customer
            that final number — including the lower price per pound, if you set one on the steer.
          </p>
        </div>
      )}

      {tab === "groups" && (
        <div>
          <p className="small mute" style={{ marginBottom: "var(--space-md)", maxWidth: "80ch" }}>
            Friends who ordered with the same code. Each member has their own cut sheet, invoice and
            sign-off; what they share is the steer and the rate. Assign the whole group to one steer
            here and every member's cut sheet carries that tag.
          </p>
          {groups.length === 0 && <p className="mute">No groups yet — a group appears once a second person orders with someone's code.</p>}
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            {groups.map(({ root, members }) => {
              const frac = members.reduce((t, o) => t + SHARES[o.share].frac, 0);
              const confirmed = members.filter((o) => o.status !== "pending-deposit");
              const confirmedFrac = confirmed.reduce((t, o) => t + SHARES[o.share].frac, 0);
              const steerIds = [...new Set(members.map((o) => o.steer).filter(Boolean))] as string[];
              const current = steerIds.length === 1 && members.every((o) => o.steer === steerIds[0]) ? steerIds[0] : "";
              const rootOrder = members.find((o) => o.code === root) ?? members[0];
              const target = rootOrder.groupTarget ?? "whole";
              const tier = groupTier(confirmedFrac);
              return (
                <div className="admin-group" key={root} style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                      <b className="mono">Group {root}</b>
                      <span className="admin-chip">filling a {target}</span>
                      <span className="admin-chip done">{steerCount(confirmedFrac)} steer confirmed · {tier}-steer rate</span>
                      <span className={"admin-chip" + (Math.abs(frac - SHARES[target].frac) < 1e-6 ? " done" : frac > SHARES[target].frac ? " hot" : "")}>{Math.round(frac * 4)} of {targetQuarters(target)} quarters spoken for</span>
                      <span className="admin-chip">{rootOrder.depositKind === "group" ? "$600 group deposit" : "$300 each"}</span>
                      {steerIds.length > 1 && <span className="admin-chip hot">split across {steerIds.length} steers</span>}
                    </div>
                    <div style={{ display: "grid", gap: 4, marginTop: "var(--space-sm)" }}>
                      {members.map((o) => (
                        <div key={o.code} className="small" style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                          <span className="mono">{o.code}</span>
                          <span>{o.name}</span>
                          <span className="mute">{SHARES[o.share].label}</span>
                          {o.status === "pending-deposit" && <span className="admin-chip hot">no deposit</span>}
                          {o.steer && <span className="admin-chip">steer {o.steer}</span>}
                          <Link className="small" to={`/customers/ticket/${o.code}`}>Ticket</Link>
                          <button className="small" style={{ textDecoration: "underline" }}
                            onClick={async () => { setPdfBusy(o.code); try { await downloadCutSheet(o, steers.find((x) => x.id === o.steer)); } finally { setPdfBusy(null); } }}>
                            {pdfBusy === o.code ? "…" : "Cut sheet"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                    <label className="tag" style={{ color: "var(--mute)" }} htmlFor={`g-${root}`}>Whole group on steer</label>
                    <select id={`g-${root}`} className="admin-select" value={current} disabled={!steersReady}
                      onChange={(e) => assignGroup(members, e.target.value)}>
                      <option value="">{steerIds.length > 1 ? "Mixed — pick one to unify" : "No steer yet"}</option>
                      {steers.map((x) => <option key={x.id} value={x.id}>{x.id}{x.hangingWeight ? ` · ${x.hangingWeight} lb` : ""}</option>)}
                    </select>
                    <span className="small mute">Sets every member's steer at once. Cut sheets stay separate.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "steers" && (
        <div>
          {!steersReady && (
            <div className="group-note">
              <span className="tag">Setup</span>
              <span>
                Steer tracking needs the updated order script. Paste the new
                <span className="mono"> apps-script/Code.gs</span> into the Apps Script project and
                deploy a new version — steps are in docs/SETUP-TODAY.md.
              </span>
            </div>
          )}

          <div className="steer-settings">
            <SteerTracker compact />
            <SettingsForm
              settings={settings}
              online={reservedSteers(orders, { ...settings, offline: 0 })}
              disabled={!steersReady}
              onSave={storeSettings}
            />
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table steers">
              <thead>
                <tr>
                  <th>Steer ID</th><th>Harvest</th><th>Hanging weight</th><th>Price per lb</th><th>Kill date</th><th>Est. ready date</th><th>Orders</th><th></th>
                </tr>
              </thead>
              <tbody>
                {steers.map((st) => (
                  <SteerRow
                    key={st.id}
                    steer={st}
                    linked={orders.filter((o) => o.steer === st.id)}
                    taken={steers.filter((x) => x.id !== st.id).map((x) => x.id)}
                    onSave={storeSteer}
                    onRemove={() => dropSteer(st)}
                  />
                ))}
                {steers.length === 0 && (
                  <tr><td colSpan={8} className="mute" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
                    No steers entered yet. Add the first one below.
                  </td></tr>
                )}
              </tbody>
              {steersReady && (
                <tfoot>
                  <SteerRow linked={[]} taken={steers.map((x) => x.id)} onSave={storeSteer} />
                </tfoot>
              )}
            </table>
          </div>
          <p className="small mute" style={{ marginTop: "var(--space-sm)" }}>
            Enter each steer as you know it — the ID first, hanging weight and ready date when you
            have them. Link orders to a steer from the Harvest roster tab.
          </p>
        </div>
      )}

      {tab === "customers" && (
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          {customers.map((c) => (
            <div key={c.email} className="admin-customer">
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div className="small mute">{c.email}{c.phone && ` · ${c.phone}`}</div>
                <div className="small" style={{ marginTop: 6 }}>
                  {c.orders.map((o) => (
                    <span key={o.code} className="admin-chip">{SHARES[o.share].label} · {o.code}</span>
                  ))}
                  <span className="mono mute" style={{ marginLeft: 6 }}>
                    {money(c.orders.reduce((s, o) => s + SHARES[o.share].total, 0))} lifetime
                  </span>
                </div>
              </div>
              <div className="field" style={{ minWidth: 260 }}>
                <label htmlFor={`note-${c.email}`}>Notes</label>
                <textarea
                  id={`note-${c.email}`} rows={2}
                  defaultValue={notes[c.email.toLowerCase()] ?? ""}
                  placeholder="Wants extra soup bones, referred the Shahs…"
                  onBlur={(e) => setNote(c.email.toLowerCase(), e.target.value)}
                />
              </div>
            </div>
          ))}
          {customers.length === 0 && <p className="mute">No customers yet.</p>}
        </div>
      )}
    </main>
  );
}
