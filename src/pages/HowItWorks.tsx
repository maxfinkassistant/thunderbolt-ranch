import { useState } from "react";
import { Link } from "react-router-dom";
import SteerMap from "../components/SteerMap";
import ColoradoMap from "../components/ColoradoMap";
import {
  SHARES, DEPOSIT, HANGING_RATE, TAKEHOME_RATE_EST,
  SEASONS, CURRENT_SEASON, NEXT_SEASON, STORAGE_NOTE,
  PROCESSOR, PAYABLE_TO, RANCH_CONTACT,
  PRIMALS, savingsFor, money, money2, type ShareId,
} from "../data/config";

const SEASON = SEASONS[CURRENT_SEASON];
const NEXT = SEASONS[NEXT_SEASON];

const STEPS = [
  {
    when: "Today",
    t: "Reserve your share",
    b: `Pick a quarter, half, or whole. A ${money(DEPOSIT)} deposit holds your beef — same deposit for every size, and it applies to your total. We harvest a set number of steers each season; once this ${SEASON.name}'s are reserved, new orders are placed in our ${NEXT.name} harvest (pickup ${NEXT.pickupText}).`,
  },
  {
    when: "Before harvest",
    t: "Build your cut sheet",
    b: "A guided walk-through asks one question at a time — steak thickness, roast sizes, ground beef ratio — with plain-English explanations of every cut. We fill out the butcher's official cutting form from your answers. Your beef, your way.",
  },
  {
    when: `This ${SEASON.name}`,
    t: "Harvest",
    b: `Your animal is processed at ${PROCESSOR.name} in Kersey — a Colorado butcher, twenty minutes up the road from the ranch.`,
  },
  {
    when: "14 days",
    t: "The 14-day hang",
    b: "Your beef dry-ages for two weeks — the old-fashioned tenderizing step most store beef never gets. Then it's cut to your sheet, vacuum-sealed, and labeled.",
  },
  {
    when: "After the hang",
    t: "Your invoice",
    b: "Once your animal is weighed you get an email with your filled-out cut sheet and your exact balance. Review it, pay by bank (no fee) or card from the link, and sign off — that sends your cut sheet to the butcher.",
  },
  {
    when: SEASON.pickup,
    t: "Pick up in Kersey",
    b: `Collect your beef at Colorado Custom — frozen, vacuum-sealed, boxed and ready to load. Your balance was invoiced and paid before this, figured on your animal's actual hanging weight, so the number is real, not an estimate. ${STORAGE_NOTE}`,
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState<string | null>("chuck");
  const [share, setShare] = useState<ShareId>("half");

  /* tapping the steer lights the card up and, on a phone, brings it into view */
  const pick = (id: string) => {
    setActive(id);
    if (window.matchMedia("(max-width: 980px)").matches) {
      document.getElementById(`primal-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

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
                covers ribeyes and burger alike, with cutting and wrapping included rather than
                billed on at the end.
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
            <p>
              Nine sections, nine decisions on your cut sheet. Tap the steer or a card to see
              what each one turns into — and switch the size to see your share.
            </p>
          </div>
          <div className="primal-grid">
            <div className="primal-map">
              <div className="diagram-card">
                <SteerMap active={active} onPick={pick} />
                <p className="diagram-hint">Tap a section of the steer.</p>
              </div>
            </div>
            <div>
              <div className="primal-head">
                <span className="tag">What's in a</span>
                <div className="chips" role="group" aria-label="Share size">
                  {Object.values(SHARES).map((s) => (
                    <button key={s.id} className={"chip" + (share === s.id ? " on" : "")} onClick={() => setShare(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="primal-list">
                {PRIMALS.map((p) => (
                  <button
                    key={p.id}
                    id={`primal-${p.id}`}
                    className={"primal-row" + (active === p.id ? " on" : "")}
                    onClick={() => setActive(p.id)}
                    onMouseEnter={() => setActive(p.id)}
                    aria-pressed={active === p.id}
                  >
                    <img src={p.photo} alt={p.photoAlt} loading="lazy" />
                    <div>
                      <div className="name">{p.name}</div>
                      <p className="where">{p.where}</p>
                      <div className="yield">{p.counts[share]}</div>
                    </div>
                  </button>
                ))}
              </div>
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
            <p className="dim">Pickup only, {SEASON.pickupText}. {STORAGE_NOTE}</p>
          </div>
          <div>
            <span className="tag">Questions?</span>
            <p>Call or text {RANCH_CONTACT.name} — {RANCH_CONTACT.phone}.</p>
            <p className="dim">Happy to talk cuts, freezer space, or which size fits your family.</p>
          </div>
        </div>
      </section>

      {/* where it all happens */}
      <section className="page section section-tint">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Where it all happens</h2>
            <p>
              Ranch, butcher, and your freezer — all along the Front Range. Pickup is at
              Colorado Custom in Kersey, about an hour up the road from the Denver area.
            </p>
          </div>
          <div className="co-map-grid">
            <ColoradoMap />
            <ol className="co-legend">
              <li>
                <span className="co-legend-num">1</span>
                <div>
                  <b>Ranch to butcher.</b> Your steer goes from our pens in northeast Colorado to
                  {" "}{PROCESSOR.name} in Kersey, where it hangs 14 days and is cut to your sheet.
                </div>
              </li>
              <li>
                <span className="co-legend-num">2</span>
                <div>
                  <b>You drive up.</b> When your beef is ready, head to {PROCESSOR.address}.
                  Frozen, vacuum-sealed, labeled, and loaded.
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

    </main>
  );
}
