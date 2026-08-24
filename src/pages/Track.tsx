import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SHARES, DECISIONS, STANDARD_CUT } from "../data/config";
import {
  getOrder, listOrders, STATUS_STEPS, statusIndex, harvestFor,
} from "../lib/store";
import { computeTotals } from "../lib/yield";

export default function Track() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const order = code ? getOrder(code) : undefined;
  const mine = listOrders();

  /* ---------- lookup screen ---------- */
  if (!code || !order) {
    return (
      <main className="page order-main" style={{ maxWidth: 760 }}>
        <div className="section-head">
          <h2 className="d">Track your order</h2>
          <p>Enter the order code from your confirmation email — it looks like CR-4F7K2M.</p>
        </div>

        {code && !order && (
          <p className="small" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>
            No order found for <span className="mono">{code.toUpperCase()}</span>. Check the code and try again.
          </p>
        )}

        <form
          className="lookup"
          onSubmit={(e) => { e.preventDefault(); if (query.trim()) navigate(`/track/${query.trim().toUpperCase()}`); }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="CR-______"
            aria-label="Order code"
          />
          <button className="btn btn-solid" type="submit">Look up</button>
        </form>

        {mine.length > 0 && (
          <div style={{ marginTop: "var(--space-2xl)" }}>
            <h3 className="d" style={{ marginBottom: "var(--space-md)" }}>Orders on this device</h3>
            <div className="member-list">
              {mine.map((o) => (
                <Link key={o.code} to={`/track/${o.code}`} className="member" style={{ textDecoration: "none" }}>
                  <span className="who">{o.name}{o.sample ? " · sample" : ""}</span>
                  <span className="what">
                    {o.code} · {SHARES[o.share].label.toUpperCase()} · {harvestFor(o.dateId)?.month.toUpperCase()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    );
  }

  /* ---------- order detail ---------- */
  const d = harvestFor(order.dateId)!;
  const idx = statusIndex(order.status);
  const totals = computeTotals(order.picks, SHARES[order.share].frac);
  const whenFor = (stepId: string): string => {
    switch (stepId) {
      case "reserved": return new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      case "locked": return d.deadline;
      case "processing": return d.drop;
      case "aging": return d.drop + " +";
      case "ready": return d.ready;
      default: return "";
    }
  };

  return (
    <main className="page order-main">
      <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--space-md)", maxWidth: "none" }}>
        <div>
          <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-xs)" }}>Order {order.code}</div>
          <h2 className="d">{SHARES[order.share].label} beef · {d.month}</h2>
          <p className="mute" style={{ marginTop: "var(--space-xs)" }}>
            {order.name}
            {order.groupCode && <> · part of <Link to={`/split/${order.groupCode}`}>a split-a-cow group</Link></>}
            {order.sample && " · sample order for demonstration"}
          </p>
        </div>
        <Link to="/track" className="btn btn-ghost">Different order</Link>
      </div>

      <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)" }}>
        {/* timeline */}
        <div>
          <div className="timeline">
            {STATUS_STEPS.map((s, i) => {
              const state = i < idx ? "done" : i === idx ? "now" : "";
              return (
                <div className={"tl-step " + state} key={s.id}>
                  <div className="tl-marker">
                    <div className="tl-dot" />
                    {i < STATUS_STEPS.length - 1 && <div className="tl-line" />}
                  </div>
                  <div className="tl-body">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-md)", alignItems: "baseline" }}>
                      <h4>{s.label}</h4>
                      <span className="tl-when">{whenFor(s.id)}</span>
                    </div>
                    <p>{s.blurb}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {order.status === "reserved" && (
            <div className="group-note" style={{ marginTop: "var(--space-sm)", marginBottom: 0 }}>
              <span className="tag">Held</span>
              <span>Fully refundable until <strong>{d.deadline}</strong>. Questions? Call {`970-645-1339`} or reply to your confirmation email.</span>
            </div>
          )}
        </div>

        {/* ticket */}
        <div style={{ display: "grid", gap: "var(--space-md)", alignSelf: "start" }}>
          <div className="ticket">
            <div className="ticket-head">
              <span className="tag">Your estimated box</span>
              <span className="mute">{order.code}</span>
            </div>
            <div className="ticket-row"><span className="k">Share</span><span className="v">{SHARES[order.share].label} beef</span></div>
            <div className="ticket-row"><span className="k">Harvest</span><span className="v">{d.month}</span></div>
            <div className="ticket-row"><span className="k">Pickup window</span><span className="v">{d.ready}</span></div>
            <hr className="ticket-sep" />
            {DECISIONS.map((dec) => (
              <div className="ticket-row" key={dec.id}>
                <span className="k">{dec.name}</span>
                <span className="v">{dec.counts[order.share]}</span>
              </div>
            ))}
            <div className="ticket-total">
              <span>ESTIMATED TAKE-HOME</span>
              <span className="v">{totals.all} LB</span>
            </div>
          </div>

          <div className="ticket">
            <div className="ticket-head">
              <span className="tag">How it's cut — the ranch standard</span>
            </div>
            {STANDARD_CUT.map((r) => (
              <div className="ticket-row" key={r.k}>
                <span className="k">{r.k}</span>
                <span className="v">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
