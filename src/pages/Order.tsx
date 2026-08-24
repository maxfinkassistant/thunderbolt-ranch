import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  SHARES, DATES, DECISIONS, STANDARD_CUT,
  money, money2, PROCESSING_PER_LB,
  type ShareId,
} from "../data/config";
import { computeTotals, estimateCost, effectivePerLb } from "../lib/yield";
import { createOrder, getGroup, groupFill, type Order as OrderRow } from "../lib/store";

/* Every share is cut to the ranch's standard cut sheet. */
const DEFAULT_PICKS = Object.fromEntries(DECISIONS.map((d) => [d.id, d.def]));
const DEFAULT_THICKNESS = { rib: "1", loin: "1", sirloin: "1" };

export default function Order() {
  const [params] = useSearchParams();
  const groupCode = params.get("group")?.toUpperCase() || undefined;
  const group = groupCode ? getGroup(groupCode) : undefined;
  const quartersOpen = group ? Math.max(0, 4 - groupFill(group)) : 4;

  const [step, setStep] = useState<1 | 2>(1);
  const [share, setShare] = useState<ShareId | null>(group ? "quarter" : null);
  const [dateId, setDateId] = useState<string | null>(group ? group.dateId : null);
  const [who, setWho] = useState({ name: "", email: "", phone: "" });
  const [placed, setPlaced] = useState<OrderRow | null>(null);

  const frac = share ? SHARES[share].frac : 0.5;
  const totals = useMemo(() => computeTotals(DEFAULT_PICKS, frac), [frac]);
  const est = share ? estimateCost(share, !!group) : null;

  const place = () => {
    const order = createOrder({
      share: share!, dateId: dateId!,
      picks: DEFAULT_PICKS, thickness: DEFAULT_THICKNESS,
      pkg: "1.5", patties: false, pattySize: "5oz",
      organs: [], notes: "", ...who, groupCode: group?.code,
    });
    setPlaced(order);
    window.scrollTo({ top: 0 });
  };

  /* ---------- confirmation ---------- */
  if (placed) {
    const d = DATES.find((x) => x.id === placed.dateId)!;
    return (
      <main className="page confirm-wrap">
        <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>Reserved</div>
        <h2 className="d" style={{ fontSize: "clamp(2.2rem,5vw,3.2rem)" }}>Your beef is booked.</h2>
        <p style={{ marginTop: "var(--space-md)", color: "var(--ink-2)" }}>
          Order <strong className="mono">{placed.code}</strong> — a confirmation is on its way to{" "}
          {placed.email}.
        </p>
        <div className="next-steps">
          {[
            ["Now", "You'll get a confirmation email with your order. Fully refundable until the order deadline."],
            [d.drop, "We deliver your animal to Colorado Custom in Kersey."],
            ["About a week later", "We'll email your animal's actual weight and the exact balance — you pay only for the pounds your steer yields."],
            [d.ready, `Colorado Custom calls you to set a pickup time. Bring coolers — you're picking up about ${totals.all} lb.`],
          ].map(([k, v]) => (
            <div className="next-step" key={k}>
              <div className="when">{k}</div>
              <div className="what">{v}</div>
            </div>
          ))}
        </div>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Link className="btn btn-solid" to={`/track/${placed.code}`}>Track this order</Link>
          {placed.groupCode && (
            <Link className="btn btn-ghost" to={`/split/${placed.groupCode}`}>Back to your group</Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="page order-main">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-xl)" }}>
        <div className="steps">
          {(["Share & date", "Review & deposit"] as const).map((s, i) => (
            <span key={s} className={step === i + 1 ? "on" : step > i + 1 ? "done" : ""}>
              {i + 1} · {s}
            </span>
          ))}
        </div>
      </div>

      {group && (
        <div className="group-note">
          <span className="tag">Split a cow</span>
          <span>
            You're claiming a share of <strong>{group.name}</strong> ({quartersOpen} of 4 quarters
            still open, {DATES.find((d) => d.id === group.dateId)?.month}). When the cow completes,
            everyone pays the whole-beef rate.
          </span>
        </div>
      )}

      {/* ============ STEP 1 — SHARE + DATE ============ */}
      {step === 1 && (
        <>
          <div className="section-head">
            <h2 className="d">How much beef?</h2>
            <p>Check your freezer before you decide. The bigger the share, the lower your price per pound.</p>
          </div>

          <div className="share-grid" style={{ marginBottom: "var(--space-2xl)" }}>
            {Object.values(SHARES).map((s) => {
              const disabled = !!group && s.quarters > quartersOpen;
              const on = share === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => !disabled && setShare(s.id)}
                  className={"share-card" + (on ? " on" : "")}
                  disabled={disabled}
                  style={disabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                >
                  {s.id === "half" && !group && <span className="share-badge">Most popular</span>}
                  <div className="d">{s.label} beef</div>
                  <div className="share-specs">
                    <span>HANGING {s.hanging}</span>
                    <span>YOU TAKE HOME {s.takehome}</span>
                    <span className="hot">FREEZER {s.freezer}</span>
                  </div>
                  <p className="share-feeds">Feeds {s.feeds}.</p>
                  <div className="share-price">
                    <span className="small" style={{ opacity: 0.75 }}>
                      ≈ {money2(effectivePerLb(s.id, !!group))}/lb all-in
                    </span>
                    <strong>{money(s.deposit)} deposit</strong>
                  </div>
                </button>
              );
            })}
          </div>

          <h3 className="d" style={{ marginBottom: "var(--space-md)" }}>
            {group ? "Harvest month" : "Pick your harvest month"}
          </h3>
          <div className="cal-grid" style={{ marginBottom: "var(--space-2xl)" }}>
            {DATES.map((d) => {
              const locked = !!group && d.id !== group.dateId;
              const on = dateId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => !locked && setDateId(d.id)}
                  className={"cal-card" + (on ? " on" : "")}
                  disabled={locked}
                  style={locked ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                >
                  <div className="d">{d.month}</div>
                  <div className="cal-rows">
                    <span>PICKUP <b>{d.ready}</b></span>
                    <span>ORDER BY <b>{d.deadline}</b> · {d.left} LEFT</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link to="/" className="btn btn-ghost">Back</Link>
            <button className="btn btn-solid" disabled={!share || !dateId} onClick={() => { setStep(2); window.scrollTo({ top: 0 }); }}>
              Review your order
            </button>
          </div>
        </>
      )}

      {/* ============ STEP 2 — REVIEW ============ */}
      {step === 2 && share && est && (
        <>
          <div className="section-head">
            <h2 className="d">Check it over</h2>
            <p>Every share is cut to our standard cut sheet — the list our butcher has refined over twenty seasons. No homework, no wrong answers.</p>
          </div>

          <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)" }}>
            <div style={{ display: "grid", gap: "var(--space-md)", alignContent: "start" }}>
              {/* estimated box */}
              <div className="ticket">
                <div className="ticket-head">
                  <span className="tag">Your estimated box</span>
                  <span className="mute">{SHARES[share].label.toUpperCase()} BEEF</span>
                </div>
                {DECISIONS.map((d) => (
                  <div className="ticket-row" key={d.id}>
                    <span className="k">{d.name}</span>
                    <span className="v">{d.counts[share]}</span>
                  </div>
                ))}
                <div className="ticket-total">
                  <span>ESTIMATED TAKE-HOME</span>
                  <span className="v">{totals.all} LB</span>
                </div>
              </div>

              {/* standard cut */}
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

            {/* money + contact */}
            <div style={{ display: "grid", gap: "var(--space-md)", alignContent: "start" }}>
              <div className="pay-panel">
                <span className="tag">What you'll pay</span>
                <div className="pay-row">
                  <span>Deposit today<span className="sub">Refundable until the order deadline.</span></span>
                  <b>{money(est.deposit)}</b>
                </div>
                <div className="pay-row">
                  <span>
                    Balance after butchering
                    <span className="sub">
                      Your animal's actual weight × {money2(est.ratePerLb)}/lb
                      {est.groupRate && " (whole-beef group rate)"} − deposit. Estimated:
                    </span>
                  </span>
                  <b>≈ {money(est.beefBalance)}</b>
                </div>
                <div className="pay-row">
                  <span>Processing at pickup<span className="sub">Paid to Colorado Custom · ≈ {money2(PROCESSING_PER_LB)}/lb</span></span>
                  <b>≈ {money(est.processing)}</b>
                </div>
                <div className="pay-row total">
                  <span>Estimated all-in</span>
                  <b>≈ {money(est.total)}</b>
                </div>
                <p className="pay-fine">
                  Every steer yields a little differently — you pay for the pounds your animal
                  actually produces, never the estimate. Works out to
                  ≈ {money2(effectivePerLb(share, !!group))}/lb in your freezer.
                </p>
              </div>

              <div className="decision" style={{ display: "grid", gap: "var(--space-sm)" }}>
                <div className="field">
                  <label htmlFor="o-name">Your name</label>
                  <input id="o-name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} autoComplete="name" />
                </div>
                <div className="field">
                  <label htmlFor="o-email">Email</label>
                  <input id="o-email" type="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} autoComplete="email" />
                </div>
                <div className="field">
                  <label htmlFor="o-phone">Phone</label>
                  <input id="o-phone" type="tel" value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} autoComplete="tel" />
                </div>
                <button className="btn btn-dark btn-wide" disabled={!who.name || !who.email} onClick={place}>
                  Pay {money(est.deposit)} deposit
                </button>
                <p className="small mute" style={{ textAlign: "center" }}>
                  Card payment at launch — this preview records the reservation without charging.
                </p>
              </div>

              <button className="btn btn-ghost btn-wide" onClick={() => { setStep(1); window.scrollTo({ top: 0 }); }}>
                Change share or month
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
