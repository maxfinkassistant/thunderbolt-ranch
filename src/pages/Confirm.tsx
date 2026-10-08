/* The customer's "everything looks good and I've paid" page, reached
   only from the button in their invoice email (the link carries a
   token). They review the sheet and the money, pay through Stripe if
   they haven't, type their name as a signature, and submit. The signed
   cut sheet goes to the ranch inbox; if Stripe shows the balance paid
   it goes straight on to the butcher as well. */

import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SHARES, DEPOSIT, PROCESSOR, RANCH_CONTACT, PAYABLE_TO, PATTY_RATE, seasonOf, money, money2 } from "../data/config";
import { boxSummary, finalPrice, rateNote } from "../lib/estimate";
import { buildSignedCutSheet, bytesToBase64 } from "../lib/cutsheetPdf";
import { backendConfigured, fetchConfirm, submitConfirm, type ConfirmView } from "../lib/api";
import type { Steer } from "../lib/store";

export default function Confirm() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [view, setView] = useState<ConfirmView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [paid, setPaid] = useState(params.get("paid") === "1");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ paid: boolean; pending: boolean; sentToButcher: boolean } | null>(null);

  useEffect(() => {
    if (!backendConfigured()) { setError("demo"); return; }
    if (!token) { setError("This link is missing its key — open it from your invoice email."); return; }
    fetchConfirm(code, token)
      .then(setView)
      .catch((e) => setError((e as Error).message));
  }, [code, token]);

  if (error === "demo") {
    return <main className="page confirm-wrap"><h2 className="d">This page needs the live order system.</h2></main>;
  }
  if (error) {
    return (
      <main className="page confirm-wrap">
        <h2 className="d">We couldn't open that.</h2>
        <p className="mute" style={{ marginTop: "var(--space-md)" }}>{error}</p>
        <p className="small mute" style={{ marginTop: "var(--space-md)" }}>Email {RANCH_CONTACT.email}.</p>
      </main>
    );
  }
  if (!view) {
    return <main className="page confirm-wrap"><p className="mute">Opening your order…</p></main>;
  }

  const { order, pricing, payUrl, cardUrl, cardAmount, cardFeePct } = view;
  const steer: Steer | undefined = pricing
    ? { id: pricing.steerId ?? order.steer ?? "", season: seasonOf(order).id, hangingWeight: pricing.hangingWeight, rate: pricing.rate, readyDate: pricing.readyDate, killDate: pricing.killDate }
    : undefined;
  const price = finalPrice(order.share, steer, order.cutSheet, order.groupFrac, order.depositAmount ?? DEPOSIT);
  const note = rateNote(price);
  const lines = boxSummary(order.cutSheet, order.share);
  const alreadySigned = !!order.signedAt;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !paid) return;
    setBusy(true);
    setError(null);
    try {
      const pdf = bytesToBase64(await buildSignedCutSheet(order, steer, name.trim()));
      const r = await submitConfirm(code, token, name.trim(), pdf);
      setDone({ paid: r.paid, pending: r.pending, sentToButcher: r.sentToButcher });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- after submitting ---------- */
  if (done || alreadySigned) {
    const sent = done?.sentToButcher ?? !!order.butcherSentAt;
    const isPaid = done?.paid ?? !!order.paidAt;
    const pending = done?.pending ?? order.payState === "pending";
    return (
      <main className="page confirm-wrap">
        <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>Signed</div>
        <h2 className="d" style={{ fontSize: "clamp(2rem,5vw,3rem)" }}>
          {sent ? "Your cut sheet is with the butcher." : "Got it — thank you."}
        </h2>
        <p style={{ marginTop: "var(--space-md)", color: "var(--ink-2)" }}>
          {sent
            ? <>Payment confirmed and your signed cut sheet has gone to {PROCESSOR.name}. Nothing else to do until pickup.</>
            : isPaid
              ? <>Your signed cut sheet is with the ranch and on its way to the butcher.</>
              : pending
                ? <>Your bank payment is processing — ACH usually clears in about four business days. Your signed cut sheet is with the ranch and goes to the butcher as soon as it does.</>
                : <>Your signed cut sheet is with the ranch. We couldn't see your payment in Stripe yet — that can take a few minutes. {RANCH_CONTACT.name} will match it up and send your sheet on to the butcher.</>}
        </p>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Link to={`/track/${order.code}`} className="btn btn-ghost">Track your order</Link>
        </div>
      </main>
    );
  }

  /* ---------- review + sign ---------- */
  return (
    <main className="page order-main" style={{ maxWidth: 760 }}>
      <div className="section-head">
        <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-xs)" }}>Order {order.code} · {SHARES[order.share].label} beef</div>
        <h2 className="d">Check it over, then sign.</h2>
        <p>Three things: look over the cut sheet, pay the balance, and tell us it's right.</p>
      </div>

      <div className="confirm-steps">
        <div className="confirm-step">
          <span className="confirm-num">1</span>
          <div>
            <b>Review your cut sheet.</b> It's attached to the email, and summarized below.
            Want something changed? Reply to the email — don't sign yet.
          </div>
        </div>
        <div className="confirm-step">
          <span className="confirm-num">2</span>
          <div>
            <b>Pay your balance{price ? ` of ${money(price.balance)}` : ""}.</b>
            {(payUrl || cardUrl) ? (
              <div className="pay-choices">
                {payUrl && (
                  <div>
                    <a className="btn btn-solid" href={payUrl} target="_blank" rel="noreferrer">Pay {price ? money(price.balance) : ""} by bank — no fee</a>
                    <span className="small mute">Bank (ACH) takes a few business days to clear.</span>
                  </div>
                )}
                {cardUrl && (
                  <div>
                    <a className="btn btn-ghost" href={cardUrl} target="_blank" rel="noreferrer">Pay {cardAmount ? money(cardAmount) : ""} by card</a>
                    <span className="small mute">Includes a {Math.round((cardFeePct ?? 0.03) * 100)}% card fee{price && cardAmount ? ` (${money(cardAmount - price.balance)})` : ""}.</span>
                  </div>
                )}
              </div>
            ) : (
              <> No pay link on this order yet — email {RANCH_CONTACT.email} and we'll sort payment by bank or card.</>
            )}
          </div>
        </div>
        <div className="confirm-step">
          <span className="confirm-num">3</span>
          <div><b>Sign below.</b> That sends your sheet to the butcher.</div>
        </div>
      </div>

      <div className="callout" style={{ marginTop: "var(--space-lg)" }}>
        <span className="tag">Questions about cuts?</span>
        <p>
          The people cutting your beef are the best ones to ask. <b>{PROCESSOR.name} — <a href={`tel:${PROCESSOR.phone}`}>{PROCESSOR.phone}</a></b>.
          Questions about your order or the bill: {RANCH_CONTACT.email}.
        </p>
      </div>

      <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)", marginTop: "var(--space-lg)" }}>
        <div className="ticket" style={{ alignSelf: "start" }}>
          <div className="ticket-head"><span className="tag">Your cut sheet</span><span className="mute">{order.code}</span></div>
          {lines.map((l) => (
            <div className="ticket-row" key={l.name}><span className="k">{l.name}</span><span className="v">{l.detail}</span></div>
          ))}
          {order.cutSheet.notes && <div className="ticket-row"><span className="k">Notes</span><span className="v">{order.cutSheet.notes}</span></div>}
        </div>

        <div style={{ display: "grid", gap: "var(--space-md)", alignContent: "start" }}>
          {price && (
            <div className="pay-panel">
              <span className="tag">Your balance</span>
              <div className="pay-row"><span>Beef<span className="sub">{price.shareLbs} lb × {money2(price.rate)}/lb</span></span><b>{money(price.beefTotal)}</b></div>
              {price.pattyCharge > 0 && (
                <div className="pay-row"><span>Patties<span className="sub">{price.pattyLbs} lb × {money2(PATTY_RATE)}/lb</span></span><b>{money(price.pattyCharge)}</b></div>
              )}
              <div className="pay-row"><span>Deposit paid</span><b>− {money(price.deposit)}</b></div>
              <div className="pay-row total"><span>Balance</span><b>{money(price.balance)}</b></div>
              {note && <p className="pay-fine">{note}</p>}
            </div>
          )}

          <form className="decision" style={{ display: "grid", gap: "var(--space-sm)" }} onSubmit={submit}>
            <span className="tag" style={{ color: "var(--rust)" }}>Sign off</span>
            <div className="field">
              <label htmlFor="sig">Your full name</label>
              <input id="sig" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={order.name} />
            </div>
            <label className="confirm-check">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              <span>The cut sheet is right and I've paid the balance.</span>
            </label>
            <button className="btn btn-dark btn-wide" type="submit" disabled={busy || !name.trim() || !paid}>
              {busy ? "Signing…" : "Sign & send to the butcher"}
            </button>
            {error && <p className="small" style={{ color: "var(--rust)" }}>{error}</p>}
            <p className="small mute">
              Typing your name here is your electronic signature on the cut sheet, dated now.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
