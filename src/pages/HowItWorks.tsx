import { useState } from "react";
import { Link } from "react-router-dom";
import SteerMap from "../components/SteerMap";
import CutDialog from "../components/CutDialog";
import {
  SHARES, DEPOSIT, HANGING_RATE, TAKEHOME_RATE_EST,
  HARVEST, PROCESSOR, PAYABLE_TO, RANCH_CONTACT,
  PRIMALS, savingsFor, money, money2,
} from "../data/config";

const STEPS = [
  {
    when: "Today",
    t: "Reserve your share",
    b: `Pick a quarter, half, or whole. A ${money(DEPOSIT)} deposit holds your beef — same deposit for every size, and it applies to your total.`,
  },
  {
    when: `By ${HARVEST.orderBy}`,
    t: "Build your cut sheet",
    b: "A guided walk-through asks one question at a time — steak thickness, roast sizes, ground beef ratio — with plain-English explanations of every cut. We fill out the butcher's official cutting form from your answers. Your beef, your way.",
  },
  {
    when: "Sept 16",
    t: "Harvest",
    b: `Your animal is processed at ${PROCESSOR.name} in Kersey — a Colorado butcher, twenty minutes up the road from the ranch.`,
  },
  {
    when: "Sept 16–30",
    t: "The 14-day hang",
    b: "Your beef dry-ages for two weeks — the old-fashioned tenderizing step most store beef never gets. Then it's cut to your sheet, vacuum-sealed, and labeled.",
  },
  {
    when: HARVEST.ready,
    t: "Pick up in Kersey",
    b: `Grab coolers and collect your beef at Colorado Custom. Your balance is due to ${PAYABLE_TO} — you pay on your animal's actual hanging weight, so the number is real, not an estimate. ${HARVEST.storageNote}`,
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState<string | null>(null);
  const [openPrimal, setOpenPrimal] = useState<string | null>(null);
  const open = openPrimal ? PRIMALS.find((p) => p.id === openPrimal) ?? null : null;

  return (
    <main>
      {/* intro */}
      <section className="page section" style={{ paddingBottom: "var(--space-xl)" }}>
        <div className="wide">
          <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>How it works</div>
          <h1 className="d" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)", maxWidth: "20ch" }}>
            Get to know your beef. From ranch to table.
          </h1>
          <p className="lede" style={{ marginTop: "var(--space-lg)" }}>
            One Angus animal, raised in Colorado and cut exactly the way you ask —
            at {money2(HANGING_RATE)}/lb hanging weight, about {money2(TAKEHOME_RATE_EST)}/lb
            in your freezer. Here's the whole process, start to finish.
          </p>
        </div>
      </section>

      {/* the 5 steps */}
      <section className="page section section-tint">
        <div className="wide" style={{ maxWidth: 780 }}>
          <div style={{ display: "grid", gap: 0 }}>
            {STEPS.map((s, i) => (
              <div className="tl-step done" key={s.t} style={{ gridTemplateColumns: "28px 1fr" }}>
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
            <Link to="/order" className="btn btn-solid btn-big">Order beef</Link>
          </div>
        </div>
      </section>

      {/* why this beats the grocery store */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Why this beats the grocery store</h2>
            <p>Three reasons, and none of them require a spreadsheet.</p>
          </div>
          <div className="threes">
            <div className="three">
              <div className="num">01 · THE MONEY</div>
              <h3 className="d">About {money(savingsFor("half").totals.saved)} back on a half</h3>
              <p>
                Roughly {money(savingsFor("quarter").totals.saved)} on a quarter
                and {money(savingsFor("whole").totals.saved)} on a whole, measured against what the
                same cuts cost on the shelf. One price — {money2(TAKEHOME_RATE_EST)}/lb take-home —
                covers ribeyes and burger alike, with no processing fees tacked on at the end.
              </p>
            </div>
            <div className="three">
              <div className="num">02 · THE QUALITY</div>
              <h3 className="d">One animal, dry-aged 14 days</h3>
              <p>
                Angus genetics, pasture-raised and grain-finished for marbling, typically grading
                Choice or Prime. Store ground beef is a blend of dozens of animals; yours is one.
                And it hangs two full weeks before it's cut — the tenderizing step supermarket
                beef almost never gets.
              </p>
            </div>
            <div className="three">
              <div className="num">03 · THE SOURCE</div>
              <h3 className="d">American beef, and you know the ranch</h3>
              <p>
                Born, raised, and harvested in Colorado, processed by a Colorado butcher twenty
                minutes up the road. We keep ownership from conception to harvest — no sale
                barns, no middlemen, no imported trim blended in. You can call Josh and ask
                about your animal.
              </p>
            </div>
          </div>
          <div className="hero-actions">
            <Link to="/order" className="btn btn-solid">Reserve a share</Link>
            <Link to="/track/TR-SAMPLE1" className="btn btn-ghost">See a finished cut sheet</Link>
          </div>
        </div>
      </section>

      {/* what's in the box */}
      <section className="page section section-tint">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">What comes out of one animal</h2>
            <p>Tap a section of the steer — every one of these is a question on your cut sheet, with the trade-offs explained as you go.</p>
          </div>
          <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)", alignItems: "start" }}>
            <div className="diagram-card">
              <SteerMap active={active} onPick={(k) => { setActive(k); setOpenPrimal(k); }} />
            </div>
            <div className="ticket">
              <div className="ticket-head">
                <span className="tag">Typical half, at the defaults</span>
              </div>
              {PRIMALS.map((p) => (
                <div className="ticket-row" key={p.id}>
                  <span className="k">{p.name}</span>
                  <span className="v">{p.counts.half}</span>
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
            <span className="tag">Sizes &amp; freezer space</span>
            <p>
              Quarter: ~{SHARES.quarter.takehome} lb ({SHARES.quarter.freezer}) ·
              Half: ~{SHARES.half.takehome} lb ({SHARES.half.freezer}) ·
              Whole: ~{SHARES.whole.takehome} lb ({SHARES.whole.freezer}).
            </p>
            <p className="dim">{money(DEPOSIT)} deposit for any size, applied to your total.</p>
          </div>
          <div>
            <span className="tag">Pickup &amp; payment</span>
            <p>{PROCESSOR.name}, {PROCESSOR.address}. Deposit and balance paid to {PAYABLE_TO}.</p>
            <p className="dim">Pickup only, {HARVEST.ready}. {HARVEST.storageNote}</p>
          </div>
          <div>
            <span className="tag">Questions?</span>
            <p>Call or text {RANCH_CONTACT.name} — {RANCH_CONTACT.phone}.</p>
            <p className="dim">Happy to talk cuts, freezer space, or which size fits your family.</p>
          </div>
        </div>
      </section>

      <CutDialog primal={open} onClose={() => setOpenPrimal(null)} />
    </main>
  );
}
