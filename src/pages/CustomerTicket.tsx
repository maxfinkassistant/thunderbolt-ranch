/* Printable ticket for one order, plus the filled CCMC PDF
   download. Print hides the site chrome. */

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SHARES, HARVEST, DEPOSIT, PAYABLE_TO, RANCH_CONTACT, money } from "../data/config";
import { getOrder } from "../lib/store";
import { boxSummary } from "../lib/estimate";
import { downloadCutSheet } from "../lib/cutsheetPdf";

export default function CustomerTicket() {
  const { code = "" } = useParams();
  const order = getOrder(code);
  const [pdfBusy, setPdfBusy] = useState(false);

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

  const lines = boxSummary(order.cutSheet, order.share);

  return (
    <main className="page order-main" style={{ maxWidth: 680 }}>
      <div className="admin-bar no-print">
        <div className="tag" style={{ color: "var(--rust)" }}>Order ticket</div>
        <div className="admin-actions">
          <button
            className="btn btn-solid"
            disabled={pdfBusy}
            onClick={async () => { setPdfBusy(true); try { await downloadCutSheet(order); } finally { setPdfBusy(false); } }}
          >
            {pdfBusy ? "Building…" : "CCMC cut sheet PDF"}
          </button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
          <Link to="/customers" className="btn btn-ghost">Back</Link>
        </div>
      </div>

      <div className="ticket" style={{ marginTop: "var(--space-md)" }}>
        <div className="ticket-head">
          <span className="tag">Thunderbolt Ranch · Order</span>
          <span className="mute">{order.code}</span>
        </div>
        <div className="ticket-row"><span className="k">Customer</span><span className="v">{order.name}</span></div>
        <div className="ticket-row"><span className="k">Phone</span><span className="v">{order.phone || "—"}</span></div>
        <div className="ticket-row"><span className="k">Email</span><span className="v">{order.email}</span></div>
        <div className="ticket-row"><span className="k">Address</span><span className="v">{order.address || "—"}</span></div>
        <hr className="ticket-sep" />
        <div className="ticket-row"><span className="k">Share</span><span className="v">{SHARES[order.share].label} beef · ~{SHARES[order.share].hanging} lb hanging</span></div>
        <div className="ticket-row"><span className="k">Harvest</span><span className="v">{HARVEST.label} · kill {HARVEST.killDate}</span></div>
        <div className="ticket-row"><span className="k">Pickup</span><span className="v">{HARVEST.ready}, Kersey</span></div>
        <hr className="ticket-sep" />
        {lines.map((l) => (
          <div className="ticket-row" key={l.name}>
            <span className="k">{l.name}</span>
            <span className="v">{l.detail}</span>
          </div>
        ))}
        {order.cutSheet.notes && (
          <div className="ticket-row"><span className="k">Notes</span><span className="v">{order.cutSheet.notes}</span></div>
        )}
        <hr className="ticket-sep" />
        <div className="ticket-row"><span className="k">Total</span><span className="v">{money(SHARES[order.share].total)}</span></div>
        <div className="ticket-row"><span className="k">Deposit</span><span className="v">{money(DEPOSIT)} · paid to {PAYABLE_TO}</span></div>
        <div className="ticket-total">
          <span>BALANCE AT PICKUP</span>
          <span className="v">{money(SHARES[order.share].total - DEPOSIT)}</span>
        </div>
      </div>

      <p className="small mute" style={{ marginTop: "var(--space-md)" }}>
        Ranch questions: {RANCH_CONTACT.name}, {RANCH_CONTACT.phone}. Balance is estimated on
        typical weights — final number follows the animal's actual hanging weight.
      </p>
    </main>
  );
}
