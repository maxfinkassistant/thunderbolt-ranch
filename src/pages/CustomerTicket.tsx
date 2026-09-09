/* Printable butcher ticket for one order — hand it to Colorado
   Custom with the animal. Print hides the site chrome. */

import { Link, useParams } from "react-router-dom";
import { SHARES, DATES, DECISIONS, STANDARD_CUT, RANCH_PHONE } from "../data/config";
import { getOrder } from "../lib/store";
import { computeTotals } from "../lib/yield";

export default function CustomerTicket() {
  const { code = "" } = useParams();
  const order = getOrder(code);

  if (!order) {
    return (
      <main className="page confirm-wrap">
        <h2 className="d">No order {code.toUpperCase()}.</h2>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Link to="/customers" className="btn btn-ghost">Back to the office</Link>
        </div>
      </main>
    );
  }

  const d = DATES.find((x) => x.id === order.dateId)!;
  const totals = computeTotals(order.picks, SHARES[order.share].frac);

  return (
    <main className="page order-main" style={{ maxWidth: 680 }}>
      <div className="admin-bar no-print">
        <div className="tag" style={{ color: "var(--rust)" }}>Butcher ticket</div>
        <div className="admin-actions">
          <button className="btn btn-solid" onClick={() => window.print()}>Print</button>
          <Link to="/customers" className="btn btn-ghost">Back</Link>
        </div>
      </div>

      <div className="ticket" style={{ marginTop: "var(--space-md)" }}>
        <div className="ticket-head">
          <span className="tag">Thunderbolt Ranch · Cutting order</span>
          <span className="mute">{order.code}</span>
        </div>
        <div className="ticket-row"><span className="k">Customer</span><span className="v">{order.name}</span></div>
        <div className="ticket-row"><span className="k">Phone</span><span className="v">{order.phone || "—"}</span></div>
        <div className="ticket-row"><span className="k">Email</span><span className="v">{order.email}</span></div>
        <hr className="ticket-sep" />
        <div className="ticket-row"><span className="k">Share</span><span className="v">{SHARES[order.share].label} beef</span></div>
        <div className="ticket-row"><span className="k">Harvest</span><span className="v">{d.month} · to butcher {d.drop}</span></div>
        <div className="ticket-row"><span className="k">Pickup window</span><span className="v">{d.ready}</span></div>
        <div className="ticket-row"><span className="k">Tag #</span><span className="v">— (assign at drop-off)</span></div>
        <hr className="ticket-sep" />
        {STANDARD_CUT.map((r) => (
          <div className="ticket-row" key={r.k}>
            <span className="k">{r.k}</span>
            <span className="v">{r.v}</span>
          </div>
        ))}
        <hr className="ticket-sep" />
        <div className="ticket-row">
          <span className="k">Expected yield</span>
          <span className="v">{DECISIONS.length} sections · ≈ {totals.whole} lb cuts + {totals.ground} lb ground</span>
        </div>
        <div className="ticket-total">
          <span>ESTIMATED TAKE-HOME</span>
          <span className="v">{totals.all} LB</span>
        </div>
      </div>

      <p className="small mute" style={{ marginTop: "var(--space-md)" }}>
        Ranch questions: {RANCH_PHONE}. Standard cut for all shares — call before deviating.
      </p>
    </main>
  );
}
