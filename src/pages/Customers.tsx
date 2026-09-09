/* Back office at /customers — the built-in CRM. Reads the same
   orders/groups tables the storefront writes; no third-party
   CRM, no sync pipeline. Passcode gate is a placeholder until
   real auth lands with Supabase. */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  SHARES, DATES, ADMIN_PASSCODE, money,
} from "../data/config";
import {
  listOrders, listGroups, groupFill, updateOrderStatus,
  getNotes, setNote, STATUS_STEPS,
  type Order, type OrderStatus,
} from "../lib/store";
import { computeTotals } from "../lib/yield";

type Tab = "roster" | "groups" | "customers";

const AUTH_KEY = "cr.admin.v1";

function estLbs(o: Order): number {
  return computeTotals(o.picks, SHARES[o.share].frac).all;
}

function exportCsv(orders: Order[]) {
  const head = ["code", "status", "name", "email", "phone", "share", "harvest", "group", "est_lbs", "deposit", "created"];
  const rows = orders.map((o) => [
    o.code, o.status, o.name, o.email, o.phone,
    o.share, DATES.find((d) => d.id === o.dateId)?.month ?? o.dateId,
    o.groupCode ?? "", estLbs(o), SHARES[o.share].deposit,
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
  const [tab, setTab] = useState<Tab>("roster");
  const [harvest, setHarvest] = useState<string>("all");
  const [tick, setTick] = useState(0); // bump to re-read the store

  const orders = useMemo(() => listOrders(), [tick]);
  const groups = useMemo(() => listGroups(), [tick]);
  const notes = useMemo(() => getNotes(), [tick]);

  const filtered = harvest === "all" ? orders : orders.filter((o) => o.dateId === harvest);

  /* ---------- gate ---------- */
  if (!authed) {
    return (
      <main className="page confirm-wrap" style={{ maxWidth: 420 }}>
        <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>Back office</div>
        <h2 className="d">Ranch hands only.</h2>
        <form
          className="decision"
          style={{ display: "grid", gap: "var(--space-sm)", marginTop: "var(--space-lg)", textAlign: "left" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().toUpperCase() === ADMIN_PASSCODE) {
              sessionStorage.setItem(AUTH_KEY, "1");
              setAuthed(true);
            } else setBad(true);
          }}
        >
          <div className="field">
            <label htmlFor="pc">Passcode</label>
            <input id="pc" type="password" value={code} onChange={(e) => { setCode(e.target.value); setBad(false); }} autoFocus />
          </div>
          {bad && <p className="small" style={{ color: "var(--rust)" }}>That's not it. Ask Max.</p>}
          <button className="btn btn-solid btn-wide" type="submit">Open the books</button>
        </form>
      </main>
    );
  }

  /* ---------- customers rollup ---------- */
  const customers = Object.values(
    orders.reduce<Record<string, { name: string; email: string; phone: string; orders: Order[] }>>((acc, o) => {
      const k = o.email.toLowerCase();
      acc[k] ??= { name: o.name, email: o.email, phone: o.phone, orders: [] };
      acc[k].orders.push(o);
      return acc;
    }, {}),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const sortedGroups = [...groups].sort((a, b) => {
    const fa = groupFill(a), fb = groupFill(b);
    const openA = fa < 4 ? 0 : 1, openB = fb < 4 ? 0 : 1;
    return openA - openB || fb - fa;
  });

  return (
    <main className="page order-main" style={{ maxWidth: 1100 }}>
      <div className="admin-bar">
        <div>
          <div className="tag" style={{ color: "var(--rust)" }}>Back office</div>
          <h2 className="d" style={{ fontSize: "2rem" }}>Customers &amp; orders</h2>
        </div>
        <div className="admin-actions">
          <select className="admin-select" value={harvest} onChange={(e) => setHarvest(e.target.value)} aria-label="Harvest filter">
            <option value="all">All harvests</option>
            {DATES.map((d) => <option key={d.id} value={d.id}>{d.month}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={() => exportCsv(filtered)}>Export CSV</button>
          <button
            className="btn btn-ghost"
            onClick={() => { sessionStorage.removeItem(AUTH_KEY); setAuthed(false); }}
          >
            Lock up
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        {(["roster", "groups", "customers"] as Tab[]).map((t) => (
          <button key={t} className={"admin-tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "roster" ? `Harvest roster (${filtered.length})` : t === "groups" ? `Groups (${groups.length})` : `Customers (${customers.length})`}
          </button>
        ))}
      </div>

      {/* ============ ROSTER ============ */}
      {tab === "roster" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Share</th><th>Harvest</th>
                <th>Group</th><th>Est. lbs</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.code}>
                  <td className="mono">{o.code}{o.sample && <span className="admin-chip">sample</span>}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div className="small mute">{o.email}{o.phone && ` · ${o.phone}`}</div>
                  </td>
                  <td>{SHARES[o.share].label}</td>
                  <td>{DATES.find((d) => d.id === o.dateId)?.month.replace(" 2026", "")}</td>
                  <td className="mono">{o.groupCode ? <Link to={`/split/${o.groupCode}`}>{o.groupCode}</Link> : "—"}</td>
                  <td className="mono">{estLbs(o)}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={o.status}
                      onChange={(e) => { updateOrderStatus(o.code, e.target.value as OrderStatus); setTick((x) => x + 1); }}
                      aria-label={`Status for ${o.code}`}
                    >
                      {STATUS_STEPS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <Link className="small" to={`/customers/ticket/${o.code}`}>Ticket</Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="mute" style={{ textAlign: "center", padding: "var(--space-xl)" }}>No orders for this harvest yet.</td></tr>
              )}
            </tbody>
          </table>
          <p className="small mute" style={{ marginTop: "var(--space-sm)" }}>
            Changing a status updates the customer's tracking page immediately.
          </p>
        </div>
      )}

      {/* ============ GROUPS ============ */}
      {tab === "groups" && (
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          {sortedGroups.map((g) => {
            const fill = groupFill(g);
            const hot = fill === 3;
            return (
              <div key={g.code} className="admin-group" style={hot ? { borderColor: "var(--rust)" } : undefined}>
                <div>
                  <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong>{g.name}</strong>
                    <span className="mono small mute">{g.code} · {DATES.find((d) => d.id === g.dateId)?.month}</span>
                    {hot && <span className="admin-chip hot">1 quarter from complete — call them</span>}
                    {fill >= 4 && <span className="admin-chip done">complete</span>}
                  </div>
                  <div className="small mute" style={{ marginTop: 4 }}>
                    {g.members.length > 0
                      ? g.members.map((m) => `${m.name} (${SHARES[m.share].label.toLowerCase()})`).join(" · ")
                      : "No members yet"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center" }}>
                  <span className="mono" style={{ fontWeight: 600, color: fill >= 4 ? "var(--sage)" : "var(--rust)" }}>{Math.min(fill, 4)}/4</span>
                  <Link className="small" to={`/split/${g.code}`}>Open</Link>
                </div>
              </div>
            );
          })}
          {groups.length === 0 && <p className="mute">No groups yet.</p>}
        </div>
      )}

      {/* ============ CUSTOMERS ============ */}
      {tab === "customers" && (
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          {customers.map((c) => (
            <div key={c.email} className="admin-customer">
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div className="small mute">{c.email}{c.phone && ` · ${c.phone}`}</div>
                <div className="small" style={{ marginTop: 6 }}>
                  {c.orders.map((o) => (
                    <span key={o.code} className="admin-chip">
                      {SHARES[o.share].label} · {DATES.find((d) => d.id === o.dateId)?.month.replace(" 2026", "")} · {o.code}
                    </span>
                  ))}
                  <span className="mono mute" style={{ marginLeft: 6 }}>
                    ≈ {c.orders.reduce((s, o) => s + estLbs(o), 0)} lb ·{" "}
                    {money(c.orders.reduce((s, o) => s + SHARES[o.share].deposit, 0))} deposits
                  </span>
                </div>
              </div>
              <div className="field" style={{ minWidth: 260 }}>
                <label htmlFor={`note-${c.email}`}>Notes</label>
                <textarea
                  id={`note-${c.email}`}
                  rows={2}
                  defaultValue={notes[c.email.toLowerCase()] ?? ""}
                  placeholder="Wants extra oxtail, referred the Shahs…"
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
