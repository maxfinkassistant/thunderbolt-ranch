/* Where Stripe sends people after the deposit — and where the order
   page sends them in demo mode. Asks the order system whether the
   deposit landed; only then is the share "booked". */

import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SHARES, SEASONS, CURRENT_SEASON, DEPOSIT, seasonOf, money } from "../data/config";
import { getOrder, updateOrderStatus, type Order } from "../lib/store";
import { downloadCutSheet } from "../lib/cutsheetPdf";
import { backendConfigured, checkDeposit } from "../lib/api";
import { refreshAvailability } from "../lib/availability";
import GroupPanel from "../components/GroupPanel";

export default function Booked() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<Order | undefined>(() => getOrder(code));
  const [paid, setPaid] = useState<boolean | null>(null);     // null = checking
  const [depositUrl, setDepositUrl] = useState<string | undefined>();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setError(null);
    if (!backendConfigured()) {
      /* demo: the deposit is assumed */
      const local = getOrder(code);
      if (local && local.status === "pending-deposit") updateOrderStatus(code, "reserved");
      setOrder(getOrder(code));
      setPaid(true);
      return;
    }
    try {
      const r = await checkDeposit(code);
      if (r.order) setOrder(r.order);
      setPaid(r.paid);
      setDepositUrl(r.depositUrl);
      if (r.paid) { updateOrderStatus(code, "reserved"); refreshAvailability(); }
    } catch (e) {
      setError((e as Error).message);
      setPaid(false);
    }
  };

  useEffect(() => { check(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [code]);

  if (!order && paid === null) return <main className="page confirm-wrap"><p className="mute">Checking your deposit…</p></main>;
  if (!order) {
    return (
      <main className="page confirm-wrap">
        <h2 className="d">No order {code.toUpperCase()}.</h2>
        <div className="hero-actions" style={{ justifyContent: "center" }}><Link to="/order" className="btn btn-ghost">Start an order</Link></div>
      </main>
    );
  }

  const season = seasonOf(order);
  const rolled = season.id !== CURRENT_SEASON;

  /* ---------- deposit not seen yet ---------- */
  if (paid === false) {
    const cameFromStripe = params.get("paid") === "1";
    return (
      <main className="page confirm-wrap">
        <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>One step left</div>
        <h2 className="d" style={{ fontSize: "clamp(2rem,5vw,3rem)" }}>
          {cameFromStripe ? "We don't see your deposit yet." : "Your cut sheet is saved — pay the deposit to hold your share."}
        </h2>
        <p style={{ marginTop: "var(--space-md)", color: "var(--ink-2)" }}>
          Order <strong className="mono">{order.code}</strong>. Your {SHARES[order.share].label.toLowerCase()} isn't counted as
          reserved until the {money(DEPOSIT)} deposit is in.
          {cameFromStripe && <> Stripe can take a minute to report a payment — try checking again.</>}
        </p>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          {depositUrl && <a className="btn btn-solid btn-big" href={depositUrl}>Pay {money(DEPOSIT)} deposit</a>}
          <button className="btn btn-ghost" onClick={() => { setPaid(null); check(); }}>I've paid — check again</button>
        </div>
        {error && <p className="small" style={{ color: "var(--rust)", marginTop: "var(--space-md)" }}>{error}</p>}
        <p className="small mute" style={{ marginTop: "var(--space-md)" }}>
          A link to finish this is also in your email, so you can come back any time.
        </p>
      </main>
    );
  }

  /* ---------- booked ---------- */
  return (
    <main className="page confirm-wrap">
      <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>Reserved · {season.label}</div>
      <h2 className="d" style={{ fontSize: "clamp(2.2rem,5vw,3.2rem)" }}>
        {rolled ? `Your beef is booked for ${season.name}.` : "Your beef is booked."}
      </h2>
      {rolled && (
        <p style={{ marginTop: "var(--space-md)", color: "var(--ink-2)" }}>
          Our {SEASONS[CURRENT_SEASON].name} harvest doesn't have a {SHARES[order.share].label.toLowerCase()} left,
          so your share is reserved from our {season.name} harvest — pickup {season.pickupText}.
        </p>
      )}
      <p style={{ marginTop: "var(--space-md)", color: "var(--ink-2)" }}>
        Deposit received. Order <strong className="mono">{order.code}</strong>
        {backendConfigured() ? <> — a confirmation is on its way to {order.email}.</> : <> — save this code.</>}
      </p>

      <div style={{ textAlign: "left", marginTop: "var(--space-lg)" }}>
        <GroupPanel code={order.code} share={order.share} size={order.groupSize ?? 1} email={order.email} />
      </div>

      <div className="next-steps">
        {[
          ["Now", `Your ${money(DEPOSIT)} deposit holds your ${SHARES[order.share].label.toLowerCase()}. You can adjust your cut sheet until your steer goes to the butcher.`],
          [`This ${season.name}`, "Harvest. Your beef dry-ages 14 days at Colorado Custom in Kersey."],
          ["Once weighed", "You'll get an invoice email with your filled-out cut sheet and your exact balance. Pay it by bank (no fee) or card from the link, then sign off."],
          [season.pickup, `Pickup in Kersey — we'll confirm the date. About ${SHARES[order.share].takehome} lb, frozen and boxed, so leave room in the vehicle.`],
        ].map(([k, v]) => (
          <div className="next-step" key={k}><div className="when">{k}</div><div className="what">{v}</div></div>
        ))}
      </div>
      <div className="hero-actions" style={{ justifyContent: "center" }}>
        <button className="btn btn-solid" disabled={pdfBusy}
          onClick={async () => { setPdfBusy(true); try { await downloadCutSheet(order); } finally { setPdfBusy(false); } }}>
          {pdfBusy ? "Building PDF…" : "Download your cut sheet (PDF)"}
        </button>
        <Link className="btn btn-ghost" to={`/track/${order.code}`}>Track this order</Link>
      </div>
    </main>
  );
}
