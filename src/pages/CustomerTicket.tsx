/* Printable ticket for one order, plus the filled CCMC PDF
   download. Print hides the site chrome. */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SHARES, DEPOSIT, HANGING_RATE, PAYABLE_TO, RANCH_CONTACT, seasonOf, money, money2 } from "../data/config";
import { getOrder, listSteers, type Order, type Steer } from "../lib/store";
import { boxSummary, finalPrice, rateNote } from "../lib/estimate";
import { downloadCutSheet } from "../lib/cutsheetPdf";
import { backendConfigured, fetchOrder, fetchOffice } from "../lib/api";

export default function CustomerTicket() {
  const { code = "" } = useParams();
  const [order, setOrder] = useState<Order | undefined>(() => getOrder(code));
  const [steers, setSteers] = useState<Steer[]>(() => (backendConfigured() ? [] : listSteers()));
  const [pdfBusy, setPdfBusy] = useState(false);

  /* the order sheet is the source of truth; the office key (kept for
     this browser session by the Ranch Office login) also brings the steers */
  useEffect(() => {
    if (!backendConfigured()) return;
    const key = sessionStorage.getItem("tr.admin.key");
    if (key) {
      fetchOffice(key)
        .then((office) => {
          const o = office.orders.find((x) => x.code.toUpperCase() === code.toUpperCase());
          if (o) setOrder(o);
          setSteers(office.steers ?? []);
        })
        .catch(() => {});
    } else {
      fetchOrder(code).then((o) => { if (o) setOrder(o); }).catch(() => {});
    }
  }, [code]);

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
  const season = seasonOf(order);
  const steer = steers.find((s) => s.id === order.steer);
  /* real money once the steer has been weighed, the estimate until then */
  const price = finalPrice(order.share, steer);
  const note = rateNote(price);
  const total = price?.total ?? SHARES[order.share].total;
  const readyOn = steer?.readyDate
    ? new Date(steer.readyDate + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;

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
        <div className="ticket-row"><span className="k">Harvest</span><span className="v">{season.label}</span></div>
        <div className="ticket-row">
          <span className="k">Steer</span>
          <span className="v">
            {order.steer
              ? `${order.steer}${steer?.hangingWeight ? ` · ${steer.hangingWeight} lb hanging` : ""}`
              : "Not assigned yet"}
          </span>
        </div>
        <div className="ticket-row"><span className="k">Pickup</span><span className="v">{readyOn ? `Est. ${readyOn}` : season.pickup}, Kersey</span></div>
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
        {price ? (
          <>
            <div className="ticket-row">
              <span className="k">Your share of the hang</span>
              <span className="v">{price.shareLbs} lb</span>
            </div>
            <div className="ticket-row">
              <span className="k">Price per pound</span>
              <span className="v">
                {money2(price.rate)}
                {price.adjusted && <> · was {money2(price.standardRate)}</>}
              </span>
            </div>
          </>
        ) : (
          <div className="ticket-row"><span className="k">Price per pound</span><span className="v">{money2(HANGING_RATE)}</span></div>
        )}
        <div className="ticket-row"><span className="k">Total{price ? "" : " (est.)"}</span><span className="v">{money(total)}</span></div>
        <div className="ticket-row"><span className="k">Deposit</span><span className="v">{money(DEPOSIT)} · paid to {PAYABLE_TO}</span></div>
        <div className="ticket-total">
          <span>BALANCE AT PICKUP</span>
          <span className="v">{money(total - DEPOSIT)}</span>
        </div>
      </div>

      {note && (
        <div className="rate-note">
          <span className="tag">Why your price per pound went down</span>
          <p>{note}</p>
        </div>
      )}

      <p className="small mute" style={{ marginTop: "var(--space-md)" }}>
        Ranch questions: {RANCH_CONTACT.name}, {RANCH_CONTACT.phone}.{" "}
        {price === null
          ? "Balance is estimated on typical weights — final number follows the animal's actual hanging weight."
          : `Balance is figured on this steer's actual hanging weight at ${money2(price.rate)}/lb.`}
      </p>
    </main>
  );
}
