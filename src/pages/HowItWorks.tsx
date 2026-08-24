import { useState } from "react";
import { Link } from "react-router-dom";
import SteerMap from "../components/SteerMap";
import CutDialog from "../components/CutDialog";
import {
  SHARES, DATES, DECISIONS, STANDARD_CUT, STORE_COMPARE, PROCESSOR,
  money, money2,
} from "../data/config";
import { effectivePerLb } from "../lib/yield";

const STEPS = [
  {
    n: "01", when: "Today",
    t: "Reserve your share",
    b: "Pick a quarter, half, or whole, and a harvest month. A deposit holds your animal — fully refundable until that month's order deadline. That's the only decision you have to make.",
  },
  {
    n: "02", when: "Until harvest",
    t: "We finish raising your animal",
    b: "Your steer grazes our shortgrass pasture and finishes on Colorado corn, the same way we've done it for years. It never sees an auction barn or a feedlot.",
  },
  {
    n: "03", when: "The 15th",
    t: "One short trailer ride to Kersey",
    b: "We deliver your animal to Colorado Custom Meat Co ourselves — a USDA-inspected family butcher twenty miles from the ranch. Then it dry ages for 14 days, which concentrates the flavor.",
  },
  {
    n: "04", when: "About a week later",
    t: "You pay for the actual pounds",
    b: "Every steer yields a little differently. Once your animal is weighed, we email you the real number and the exact balance — you pay for the beef your animal actually produced, never an estimate.",
  },
  {
    n: "05", when: "About 2 weeks after harvest",
    t: "Pick up your beef in Kersey",
    b: "Colorado Custom calls you to set a time. Everything comes frozen, vacuum-sealed, and labeled. Bring coolers, clear your freezer, and settle the processing bill with them at the counter.",
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState<string | null>(null);
  const [openPrimal, setOpenPrimal] = useState<string | null>(null);
  const openDecision = openPrimal
    ? DECISIONS.find((d) => d.primal === openPrimal) ?? null
    : null;
  const ourRate = effectivePerLb("half", false);

  return (
    <main>
      {/* intro */}
      <section className="page section" style={{ paddingBottom: "var(--space-xl)" }}>
        <div className="wide">
          <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>How it works</div>
          <h1 className="d" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)", maxWidth: "18ch" }}>
            One decision. One price. A freezer full of beef.
          </h1>
          <p className="lede" style={{ marginTop: "var(--space-lg)" }}>
            No cut sheets to fill out, no per-cut markups, no shipping games. You reserve a
            share, we raise and butcher it in Colorado, and you pick up restaurant-grade beef
            at about {money2(ourRate)}/lb all-in — less than the store charges for ribeye alone.
          </p>
        </div>
      </section>

      {/* the 5 steps */}
      <section className="page section section-tint">
        <div className="wide" style={{ maxWidth: 780 }}>
          <div style={{ display: "grid", gap: 0 }}>
            {STEPS.map((s, i) => (
              <div className="tl-step done" key={s.n} style={{ gridTemplateColumns: "28px 1fr" }}>
                <div className="tl-marker">
                  <div className="tl-dot" style={{ background: "var(--rust)", borderColor: "var(--rust)" }} />
                  {i < STEPS.length - 1 && <div className="tl-line" style={{ background: "var(--line-strong)" }} />}
                </div>
                <div className="tl-body" style={{ paddingBottom: "var(--space-xl)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-md)", alignItems: "baseline", flexWrap: "wrap" }}>
                    <h3 className="d" style={{ color: "var(--ink)" }}>{s.t}</h3>
                    <span className="tl-when">{s.when}</span>
                  </div>
                  <p style={{ maxWidth: "58ch", color: "var(--ink-2)" }}>{s.b}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link to="/order" className="btn btn-solid btn-big">Reserve your share</Link>
            <Link to="/split" className="btn btn-ghost btn-big">Split a cow with friends</Link>
          </div>
        </div>
      </section>

      {/* the price math */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">The math that makes this worth it</h2>
            <p>
              One price per pound covers everything in the box — the filets cost you the same
              as the ground beef. Compare that to the meat counter.
            </p>
          </div>
          <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "start" }}>
            <div className="ticket">
              <div className="ticket-head">
                <span className="tag">Grocery store, per cut</span>
                <span className="mute">TYPICAL</span>
              </div>
              {STORE_COMPARE.map((r) => (
                <div className="ticket-row" key={r.cut}>
                  <span className="k">{r.cut}</span>
                  <span className="v">{money2(r.store)}/lb</span>
                </div>
              ))}
            </div>
            <div className="pay-panel">
              <span className="tag">Thunderbolt Ranch, everything</span>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem,4vw,3.4rem)", lineHeight: 1, margin: "var(--space-sm) 0" }}>
                ≈ {money2(ourRate)}<span style={{ fontSize: "1.2rem" }}>/lb</span>
              </div>
              <p className="small" style={{ color: "var(--on-dark-mute)" }}>
                All-in on a half beef — animal, dry aging, cutting, and processing. Roughly a
                third of your box is steaks and roasts you'd pay {money2(15)}–{money2(25)}/lb
                for at the counter.
              </p>
              <p className="small" style={{ marginTop: "var(--space-sm)", color: "var(--on-dark-mute)" }}>
                Split a cow with friends and the whole-beef rate drops it further —
                ≈ {money2(effectivePerLb("quarter", true))}/lb on a quarter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* what's in the box */}
      <section className="page section section-tint">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">What's in the box</h2>
            <p>
              Every share is cut to our standard cut sheet — the list our butcher has refined
              over twenty seasons. Tap a section of the steer to see what it yields.
            </p>
          </div>
          <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)", alignItems: "start" }}>
            <div className="diagram-card">
              <SteerMap active={active} onPick={(k) => { setActive(k); setOpenPrimal(k); }} />
            </div>
            <div className="ticket">
              <div className="ticket-head">
                <span className="tag">The ranch standard cut</span>
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
      </section>

      {/* logistics */}
      <section className="page section">
        <div className="wide dark-panel">
          <div>
            <span className="tag">Sizes & freezer space</span>
            <p>
              Quarter: {SHARES.quarter.takehome} ({SHARES.quarter.freezer}) ·
              Half: {SHARES.half.takehome} ({SHARES.half.freezer}) ·
              Whole: {SHARES.whole.takehome} ({SHARES.whole.freezer}).
            </p>
            <p className="dim">Deposits {money(SHARES.quarter.deposit)} / {money(SHARES.half.deposit)} / {money(SHARES.whole.deposit)}, refundable until the deadline.</p>
          </div>
          <div>
            <span className="tag">Harvest calendar</span>
            <p>
              {DATES.map((d) => d.month.replace(" 2026", "")).join(" · ")} — cattle go to the
              butcher on the 15th, pickup about two weeks later.
            </p>
            <p className="dim">Order deadlines are the 8th of each harvest month. Real dates on the order page.</p>
          </div>
          <div>
            <span className="tag">Pickup</span>
            <p>{PROCESSOR.name}<br />{PROCESSOR.address}<br />{PROCESSOR.phone}</p>
            <p className="dim">Local delivery available for $100. We don't ship.</p>
          </div>
        </div>
      </section>

      <CutDialog decision={openDecision} onClose={() => setOpenPrimal(null)} />
    </main>
  );
}
