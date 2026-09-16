/* Back office at /customers — the built-in CRM. Reads the same
   orders store the storefront writes. Passcode gate is a
   placeholder until real auth lands. */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SHARES, HARVEST, DEPOSIT, money } from "../data/config";
import {
  listOrders, updateOrderStatus, getNotes, setNote, STATUS_STEPS,
  type Order, type OrderStatus,
} from "../lib/store";
import { downloadCutSheet } from "../lib/cutsheetPdf";
import { backendConfigured, checkAdminKey, fetchOrders, pushStatus } from "../lib/api";

type Tab = "roster" | "customers";

const AUTH_KEY = "tr.admin.v1";
const KEY_KEY = "tr.admin.key";
/* Local demo mode only (no backend). With a backend, the key is
   validated server-side and never lives in this code. */
const DEMO_PASSCODE = "KERSEY";

function exportCsv(orders: Order[]) {
  const head = ["code", "status", "name", "email", "phone", "address", "share", "harvest", "est_takehome_lbs", "total", "deposit", "balance", "created"];
  const rows = orders.map((o) => [
    o.code, o.status, o.name, o.email, o.phone, o.address,
    o.share, HARVEST.label, SHARES[o.share].takehome,
    SHARES[o.share].total, DEPOSIT, SHARES[o.share].total - DEPOSIT,
    new Date(o.createdAt).toISOString().slice(0, 10),
  ]);
  const csv = [head, ...rows]
    .map((r) => r.map((c) => `"${String(c).split('"').join('""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "thunderbolt-orders.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Customers() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === "1");
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<Tab>("roster");
  const [tick, setTick] = useState(0);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [remote, setRemote] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const adminKey = sessionStorage.getItem(KEY_KEY) ?? "";
  const local = useMemo(() => listOrders(), [tick]);
  const orders = remote ?? local;
  const notes = useMemo(() => getNotes(), [tick]);

  /* pull the roster from the ranch's order system */
  useEffect(() => {
    if (!authed || !backendConfigured()) return;
    let alive = true;
    fetchOrders(adminKey)
      .then((rows) => { if (alive) { setRemote(rows); setLoadError(null); } })
      .catch((e) => { if (alive) setLoadError((e as Error).message); });
    return () => { alive = false; };
  }, [authed, adminKey, tick]);

  const changeStatus = async (o: Order, status: OrderStatus) => {
    updateOrderStatus(o.code, status);
    if (backendConfigured()) {
      try { await pushStatus(adminKey, o.code, status); } catch (e) { setLoadError((e as Error).message); }
    }
    setTick((x) => x + 1);
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = code.trim();
    if (backendConfigured()) {
      setChecking(true);
      const ok = await checkAdminKey(key);
      setChecking(false);
      if (!ok) { setBad(true); return; }
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
            <input id="pc" type="password" value={code} onChange={(e) => { setCode(e.target.value); setBad(false); }} autoFocus />
          </div>
          {bad && <p className="small" style={{ color: "var(--rust)" }}>That's not it. Ask Max or Josh.</p>}
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

  const totals = orders.reduce(
    (t, o) => ({
      hanging: t.hanging + SHARES[o.share].hanging,
      revenue: t.revenue + SHARES[o.share].total,
      deposits: t.deposits + DEPOSIT,
    }),
    { hanging: 0, revenue: 0, deposits: 0 },
  );

  return (
    <main className="page order-main" style={{ maxWidth: 1100 }}>
      <div className="admin-bar">
        <div>
          <div className="tag" style={{ color: "var(--rust)" }}>Back office · {HARVEST.label}</div>
          <h2 className="d" style={{ fontSize: "2rem" }}>Customers &amp; orders</h2>
          <p className="small mute" style={{ marginTop: 4 }}>
            {orders.length} orders · ~{totals.hanging.toLocaleString()} lb hanging committed ·
            {" "}{money(totals.revenue)} booked ({money(totals.deposits)} in deposits)
            {backendConfigured() && !remote && !loadError && " · loading from the order sheet…"}
            {!backendConfigured() && " · local demo mode"}
          </p>
          {loadError && <p className="small" style={{ color: "var(--rust)" }}>Order system: {loadError}</p>}
        </div>
        <div className="admin-actions">
          <button className="btn btn-ghost" onClick={() => setTick((x) => x + 1)}>Refresh</button>
          <button className="btn btn-ghost" onClick={() => exportCsv(orders)}>Export CSV</button>
          <button className="btn btn-ghost" onClick={() => { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(KEY_KEY); setAuthed(false); }}>
            Lock up
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        {(["roster", "customers"] as Tab[]).map((t) => (
          <button key={t} className={"admin-tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "roster" ? `Harvest roster (${orders.length})` : `Customers (${customers.length})`}
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Share</th><th>Total</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.code}>
                  <td className="mono">{o.code}{o.sample && <span className="admin-chip">sample</span>}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div className="small mute">{o.email}{o.phone && ` · ${o.phone}`}</div>
                  </td>
                  <td>{SHARES[o.share].label} · ~{SHARES[o.share].takehome} lb</td>
                  <td className="mono">{money(SHARES[o.share].total)}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={o.status}
                      onChange={(e) => changeStatus(o, e.target.value as OrderStatus)}
                      aria-label={`Status for ${o.code}`}
                    >
                      {STATUS_STEPS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="small" style={{ textDecoration: "underline", marginRight: 10 }}
                      disabled={pdfBusy === o.code}
                      onClick={async () => { setPdfBusy(o.code); try { await downloadCutSheet(o); } finally { setPdfBusy(null); } }}
                    >
                      {pdfBusy === o.code ? "…" : "CCMC PDF"}
                    </button>
                    <Link className="small" to={`/customers/ticket/${o.code}`}>Ticket</Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="mute" style={{ textAlign: "center", padding: "var(--space-xl)" }}>No orders yet.</td></tr>
              )}
            </tbody>
          </table>
          <p className="small mute" style={{ marginTop: "var(--space-sm)" }}>
            "CCMC PDF" downloads the customer's filled cutting-instructions form, ready to email
            to order@ccmeatco.com. Status changes update the customer's tracking page immediately.
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
