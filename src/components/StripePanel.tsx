/* The Ranch Office's view of Stripe: the same payments and payouts the
   Stripe dashboard shows, each payment tied to the order it paid for,
   and a deposit check on top — who's paid, who's paid twice, and whose
   deposit the invoice can't credit. Read-only; refunds happen in Stripe. */

import { useEffect, useMemo, useState } from "react";
import { money2 } from "../data/config";
import type { Order } from "../lib/store";
import { fetchStripeActivity, type StripeActivity, type StripePayment, type StripePayout } from "../lib/api";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
/* a payout's arrival is a calendar date Stripe sends as UTC midnight */
const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const STATUS_LABEL: Record<StripePayment["status"], string> = {
  succeeded: "Succeeded", pending: "Pending", failed: "Failed", refunded: "Refunded",
  "partially-refunded": "Partially refunded", reversed: "Reversed", disputed: "Disputed", uncaptured: "Uncaptured",
};
const statusTone = (s: StripePayment["status"] | StripePayout["status"]) =>
  s === "succeeded" || s === "paid" ? " done" : s === "failed" || s === "disputed" ? " hot" : "";

const PAYOUT_LABEL: Record<StripePayout["status"], string> = {
  paid: "Paid", pending: "Pending", in_transit: "In transit", canceled: "Canceled", failed: "Failed",
};

function methodLabel(m: StripePayment["method"]): string {
  if (m.type === "card") {
    const brand = m.brand ? m.brand[0].toUpperCase() + m.brand.slice(1) : "Card";
    const wallet = m.wallet === "apple_pay" ? "Apple Pay · " : m.wallet === "google_pay" ? "Google Pay · " : "";
    return `${wallet}${brand} •••• ${m.last4}`;
  }
  if (m.type === "bank") return `${m.brand || "Bank"} •••• ${m.last4}`;
  if (m.type === "link") return "Link";
  return m.type || "—";
}

/* money still held by the ranch: not refunded, not failed */
const kept = (p: StripePayment) =>
  p.status === "succeeded" || p.status === "pending" || p.status === "partially-refunded" || p.status === "uncaptured";

type Filter = "all" | "succeeded" | "refunded" | "disputed" | "failed";
const FILTERS: { id: Filter; label: string; match: (p: StripePayment) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "succeeded", label: "Succeeded", match: (p) => p.status === "succeeded" },
  { id: "refunded", label: "Refunded", match: (p) => p.status === "refunded" || p.status === "partially-refunded" || p.status === "reversed" },
  { id: "disputed", label: "Disputed", match: (p) => p.status === "disputed" },
  { id: "failed", label: "Failed", match: (p) => p.status === "failed" },
];

export default function StripePanel({ adminKey, orders, tick }: { adminKey: string; orders: Order[]; tick: number }) {
  const [data, setData] = useState<StripeActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"payments" | "payouts">("payments");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchStripeActivity(adminKey)
      .then((r) => { if (alive) setData(r); })
      .catch((e) => {
        if (!alive) return;
        const msg = (e as Error).message;
        setError(msg === "unknown action" || msg === "bad key"
          ? "The order script doesn't have the Stripe view yet — paste the new apps-script/Code.gs and deploy a new version."
          : msg);
      });
    return () => { alive = false; };
  }, [adminKey, tick]);

  const dash = data?.livemode === false ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com";

  /* the deposit check: every order that should have a deposit, against what Stripe holds */
  const check = useMemo(() => {
    if (!data) return null;
    const deposits: Record<string, StripePayment[]> = {};
    for (const p of data.payments) if (p.order && p.kind === "deposit" && kept(p)) (deposits[p.order] ??= []).push(p);
    const due = orders.filter((o) => !o.sample && o.depositKind !== "covered");
    return {
      twice: due.filter((o) => (deposits[o.code]?.length ?? 0) > 1).map((o) => ({ o, pays: deposits[o.code] })),
      missing: due.filter((o) => o.status !== "pending-deposit" && !deposits[o.code]),
      unrecorded: due.filter((o) => deposits[o.code] && !o.depositPaidAt).map((o) => ({ o, pays: deposits[o.code] })),
      unmatched: data.payments.filter((p) => !p.order && kept(p)),
      ok: due.filter((o) => deposits[o.code]?.length === 1 && o.depositPaidAt).length,
    };
  }, [data, orders]);

  if (error) return <p className="small" style={{ color: "var(--rust)" }}>Stripe: {error}</p>;
  if (!data || !check) return <p className="mute">Asking Stripe…</p>;

  const collected = data.payments.filter((p) => kept(p)).reduce((t, p) => t + p.amount - p.refunded, 0);
  const shown = data.payments.filter(FILTERS.find((f) => f.id === filter)!.match);
  const clean = !check.twice.length && !check.missing.length && !check.unrecorded.length && !check.unmatched.length;

  return (
    <div className="stripe-panel">
      <div className="stripe-summary">
        <div><span className="tag">Available</span><b className="mono">{money2(data.balance.available)}</b></div>
        <div><span className="tag">On the way</span><b className="mono">{money2(data.balance.pending)}</b></div>
        <div><span className="tag">Collected</span><b className="mono">{money2(collected)}</b></div>
        <div className="small mute" style={{ alignSelf: "end" }}>
          {data.livemode ? "Live" : "TEST"} mode · <a href={`${dash}/payments`} target="_blank" rel="noreferrer">Open Stripe ↗</a>
        </div>
      </div>

      <section className="stripe-check">
        <div className="tag" style={{ color: "var(--rust)" }}>Deposit check</div>
        {clean
          ? <p style={{ margin: "6px 0 0" }}>Every order's deposit matches one payment in Stripe ({plural(check.ok, "order")}).</p>
          : <p className="small mute" style={{ margin: "6px 0 var(--space-sm)" }}>{plural(check.ok, "order")} {check.ok === 1 ? "matches" : "match"} one deposit in Stripe. These don't:</p>}

        {check.twice.length > 0 && (
          <div className="stripe-issue">
            <b>Charged twice for one order</b>
            <span className="small mute">Ask whether they meant a second share; if not, refund the extra charge in Stripe.</span>
            {check.twice.map(({ o, pays }) => (
              <div key={o.code} className="small">
                <span className="mono">{o.code}</span> {o.name} —{" "}
                {pays.map((p, i) => (
                  <span key={p.id}>{i > 0 && ", "}<a href={`${dash}/payments/${p.paymentIntent}`} target="_blank" rel="noreferrer">{money2(p.amount)} on {when(p.created)}</a></span>
                ))}
              </div>
            ))}
          </div>
        )}
        {check.missing.length > 0 && (
          <div className="stripe-issue">
            <b>No deposit in Stripe</b>
            <span className="small mute">Their invoice bills the full amount unless a deposit is on file in the sheet ("Deposit paid at").</span>
            {check.missing.map((o) => (
              <div key={o.code} className="small">
                <span className="mono">{o.code}</span> {o.name} · {o.email}
                {o.depositPaidAt ? <span className="admin-chip">on file {o.depositPaidAt.slice(0, 10)} — paid outside Stripe</span> : <span className="admin-chip hot">billed in full</span>}
                {o.invoicedAt && <span className="admin-chip">invoiced {o.invoicedAt.slice(0, 10)}</span>}
              </div>
            ))}
          </div>
        )}
        {check.unrecorded.length > 0 && (
          <div className="stripe-issue">
            <b>Paid in Stripe, not on file</b>
            <span className="small mute">The invoice won't credit these until "Deposit paid at" is filled in on the order sheet.</span>
            {check.unrecorded.map(({ o, pays }) => (
              <div key={o.code} className="small"><span className="mono">{o.code}</span> {o.name} — {money2(pays[0].amount)} on {when(pays[0].created)}</div>
            ))}
          </div>
        )}
        {check.unmatched.length > 0 && (
          <div className="stripe-issue">
            <b>Payments with no order</b>
            {check.unmatched.map((p) => (
              <div key={p.id} className="small">
                <a href={`${dash}/payments/${p.paymentIntent}`} target="_blank" rel="noreferrer">{money2(p.amount)}</a> from {p.email || p.name || "unknown"} on {when(p.created)}
              </div>
            ))}
          </div>
        )}
      </section>

      <div>
        <div className="stripe-views">
          <button className={"admin-tab" + (view === "payments" ? " on" : "")} onClick={() => setView("payments")}>Payments ({data.payments.length})</button>
          <button className={"admin-tab" + (view === "payouts" ? " on" : "")} onClick={() => setView("payouts")}>Payouts ({data.payouts.length})</button>
        </div>

        {view === "payments" && (
          <>
            <div className="stripe-filters">
              {FILTERS.map((f) => (
                <button key={f.id} className={filter === f.id ? "on" : ""} onClick={() => setFilter(f.id)}>
                  {f.label} <span className="mute">{data.payments.filter(f.match).length}</span>
                </button>
              ))}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table stripe">
                <thead>
                  <tr><th>Amount</th><th>Status</th><th>Payment method</th><th>Order</th><th>Customer</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">
                        <a href={`${dash}/payments/${p.paymentIntent}`} target="_blank" rel="noreferrer"><b>{money2(p.amount)}</b></a> <span className="mute">{p.currency}</span>
                        {p.net != null && <span className="admin-sub">net {money2(p.net)} after {money2(p.fee ?? 0)} fee</span>}
                      </td>
                      <td>
                        <span className={"admin-chip" + statusTone(p.status)}>{STATUS_LABEL[p.status]}</span>
                        {p.refunded > 0 && p.status !== "reversed" && <span className="admin-sub">{money2(p.refunded)} refunded</span>}
                        {p.failure && <span className="admin-sub">{p.failure}</span>}
                      </td>
                      <td>{methodLabel(p.method)}</td>
                      <td>
                        {p.order
                          ? <><span className="mono">{p.order}</span><span className="admin-sub">{p.kind === "deposit" ? "deposit" : p.kind === "balance" ? "balance" : "payment"}{p.matchedBy === "email" ? " · matched by email" : ""}</span></>
                          : <span className={"admin-chip" + (kept(p) ? " hot" : "")}>no order</span>}
                      </td>
                      <td>
                        <div>{p.orderName || p.name || "—"}</div>
                        <div className="small mute">{p.email}</div>
                      </td>
                      <td className="small">{when(p.created)}</td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr><td colSpan={6} className="mute" style={{ textAlign: "center", padding: "var(--space-xl)" }}>No payments here.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === "payouts" && (
          <div className="admin-table-wrap">
            <table className="admin-table stripe">
              <thead>
                <tr><th>Amount</th><th>Status</th><th>Arrive by</th><th>Type</th><th>Destination</th></tr>
              </thead>
              <tbody>
                {data.payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">
                      <a href={`${dash}/payouts/${p.id}`} target="_blank" rel="noreferrer"><b>{money2(p.amount)}</b></a> <span className="mute">{p.currency}</span>
                    </td>
                    <td>
                      <span className={"admin-chip" + statusTone(p.status)}>{PAYOUT_LABEL[p.status] ?? p.status}</span>
                      {p.failure && <span className="admin-sub">{p.failure}</span>}
                    </td>
                    <td className="small">{day(p.arrival)}</td>
                    <td>{p.type}{p.method === "instant" ? " · instant" : ""}</td>
                    <td className="mono">{p.destination.bank && `${p.destination.bank} `}•••• {p.destination.last4}</td>
                  </tr>
                ))}
                {data.payouts.length === 0 && (
                  <tr><td colSpan={5} className="mute" style={{ textAlign: "center", padding: "var(--space-xl)" }}>No payouts yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
