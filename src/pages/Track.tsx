import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SHARES, HARVEST } from "../data/config";
import { getOrder, listOrders, STATUS_STEPS, statusIndex, type Order } from "../lib/store";
import { boxSummary } from "../lib/estimate";
import { downloadCutSheet } from "../lib/cutsheetPdf";
import { backendConfigured, fetchOrder } from "../lib/api";

export default function Track() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [order, setOrder] = useState<Order | undefined>(() => (code ? getOrder(code) : undefined));
  const [loading, setLoading] = useState(false);
  const mine = listOrders();

  /* local cache first; then the ranch's order system if configured */
  useEffect(() => {
    if (!code) return;
    const local = getOrder(code);
    setOrder(local);
    if (!backendConfigured()) return;
    let alive = true;
    setLoading(true);
    fetchOrder(code)
      .then((remote) => { if (alive && remote) setOrder(remote); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [code]);

  /* ---------- lookup ---------- */
  if (!code || !order) {
    if (code && loading) {
      return (
        <main className="page order-main" style={{ maxWidth: 760 }}>
          <p className="mute">Looking up {code.toUpperCase()}…</p>
        </main>
      );
    }
    return (
      <main className="page order-main" style={{ maxWidth: 760 }}>
        <div className="section-head">
          <h2 className="d">Track your order</h2>
          <p>Enter the order code from your confirmation email — it looks like TR-4F7K2M.</p>
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="TR-______" aria-label="Order code" />
          <button className="btn btn-solid" type="submit">Look up</button>
        </form>

        {mine.length > 0 && (
          <div style={{ marginTop: "var(--space-2xl)" }}>
            <h3 className="d" style={{ marginBottom: "var(--space-md)" }}>Orders on this device</h3>
            <div className="member-list">
              {mine.map((o) => (
                <Link key={o.code} to={`/track/${o.code}`} className="member" style={{ textDecoration: "none" }}>
                  <span className="who">{o.name}{o.sample ? " · sample" : ""}</span>
                  <span className="what">{o.code} · {SHARES[o.share].label.toUpperCase()} · {HARVEST.label.toUpperCase()}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    );
  }

  /* ---------- order detail ---------- */
  const idx = statusIndex(order.status);
  const lines = boxSummary(order.cutSheet, order.share);
  const whenFor = (stepId: string): string => {
    switch (stepId) {
      case "reserved": return new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      case "locked": return "Sept 30";
      case "processing": return "Sept 16–30";
      case "ready": return HARVEST.ready;
      default: return "";
    }
  };

  return (
    <main className="page order-main">
      <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--space-md)", maxWidth: "none" }}>
        <div>
          <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-xs)" }}>Order {order.code}</div>
          <h2 className="d">{SHARES[order.share].label} beef · {HARVEST.label}</h2>
          <p className="mute" style={{ marginTop: "var(--space-xs)" }}>
            {order.name}{order.sample && " · sample order for demonstration"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
          <button
            className="btn btn-ghost"
            disabled={pdfBusy}
            onClick={async () => { setPdfBusy(true); try { await downloadCutSheet(order); } finally { setPdfBusy(false); } }}
          >
            {pdfBusy ? "Building…" : "Cut sheet PDF"}
          </button>
          <Link to="/track" className="btn btn-ghost">Different order</Link>
        </div>
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
              <span>Your cut sheet can be adjusted until <strong>{HARVEST.orderBy}</strong>. Call or text Josh at 402-245-8195.</span>
            </div>
          )}
        </div>

        {/* estimated box */}
        <div className="ticket" style={{ alignSelf: "start" }}>
          <div className="ticket-head">
            <span className="tag">Your estimated box</span>
            <span className="mute">{order.code}</span>
          </div>
          <div className="ticket-row"><span className="k">Share</span><span className="v">{SHARES[order.share].label} beef</span></div>
          <div className="ticket-row"><span className="k">Harvest</span><span className="v">{HARVEST.label}</span></div>
          <div className="ticket-row"><span className="k">Pickup</span><span className="v">{HARVEST.ready}</span></div>
          <hr className="ticket-sep" />
          {lines.map((l) => (
            <div className="ticket-row" key={l.name}>
              <span className="k">{l.name}</span>
              <span className="v">{l.detail}</span>
            </div>
          ))}
          <div className="ticket-total">
            <span>ESTIMATED TAKE-HOME</span>
            <span className="v">≈ {SHARES[order.share].takehome} LB</span>
          </div>
        </div>
      </div>
    </main>
  );
}
