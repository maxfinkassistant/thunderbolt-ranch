import { useState } from "react";
import { Link } from "react-router-dom";
import SteerMap from "../components/SteerMap";
import CutDialog from "../components/CutDialog";
import {
  SHARES, DEPOSIT, HANGING_RATE, TAKEHOME_RATE_EST,
  USDA_CHOICE, HARVEST, PROCESSOR, PAYABLE_TO, RANCH_CONTACT,
  LIVE_TYP, HANGING_TYP, TAKEHOME_TYP,
  STORY, QUALITY, IMAGES, PRIMALS, balanceAtPickup,
  money, money2,
} from "../data/config";

export default function Landing() {
  const [active, setActive] = useState("chuck");
  const [openPrimal, setOpenPrimal] = useState<string | null>(null);
  const open = openPrimal ? PRIMALS.find((p) => p.id === openPrimal) ?? null : null;

  return (
    <main>
      {/* hero */}
      <section className="page hero wide">
        <div className="rise">
          <div className="tag hero-kicker">Colorado cattle · Colorado ranch · Colorado butcher</div>
          <h1 className="d">Ranch to table.<br />One Angus at a&nbsp;time.</h1>
          <p className="lede" style={{ marginTop: "var(--space-lg)" }}>{STORY}</p>
          <div className="hero-actions">
            <Link to="/order" className="btn btn-solid btn-big">Order beef</Link>
            <Link to="/how-it-works" className="btn btn-ghost btn-big">How it works</Link>
          </div>
          <div className="hero-fine">
            <span>{money2(HANGING_RATE)}/LB HANGING WEIGHT</span>
            <span>≈ {money2(TAKEHOME_RATE_EST)}/LB TAKE-HOME</span>
            <span>{money(DEPOSIT)} DEPOSIT, ANY SIZE</span>
          </div>
        </div>
        <div className="diagram-card rise rise-1">
          <SteerMap active={active} onPick={(k) => { setActive(k); setOpenPrimal(k); }} />
          <p className="diagram-hint">Tap a section to see what it yields in a quarter, half, or whole.</p>
        </div>
      </section>

      {/* one price strip */}
      <section className="page" style={{ paddingBottom: "var(--space-2xl)" }}>
        <div className="wide dark-panel">
          <div>
            <span className="tag">Your price, everything included</span>
            <div className="d" style={{ fontSize: "clamp(2rem,3.5vw,2.8rem)", lineHeight: 1 }}>
              ≈ {money2(TAKEHOME_RATE_EST)}/lb
            </div>
            <p className="dim">
              Take-home estimate at {money2(HANGING_RATE)}/lb hanging weight. No processing
              fees, no hidden costs.
            </p>
          </div>
          <div>
            <span className="tag">The grocery store</span>
            <div className="d" style={{ fontSize: "clamp(2rem,3.5vw,2.8rem)", lineHeight: 1 }}>
              {money2(USDA_CHOICE)}/lb
            </div>
            <p className="dim">
              USDA-reported national retail average for Choice beef (April 2026) — a blend of
              cuts, and a blend of animals.
            </p>
          </div>
          <div>
            <span className="tag">The quality</span>
            <div className="d" style={{ fontSize: "clamp(1.6rem,2.6vw,2rem)", lineHeight: 1.1 }}>
              Choice or Prime
            </div>
            <p className="dim">{QUALITY}</p>
          </div>
        </div>
      </section>

      {/* colorado photo band */}
      <section className="photo-band" style={{ backgroundImage: `url(${IMAGES.heroPlains})` }}>
        <div className="photo-band-inner wide" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div style={{ padding: "0 var(--page-x)" }}>
            <span className="tag">Grain finished · Pasture raised</span>
            <h2 className="d" style={{ marginTop: "var(--space-sm)" }}>
              All of it happens in Colorado.
            </h2>
            <p>
              Pasture-raised on our Colorado ranch, grain-finished on our Colorado pens for
              rich marbling, and processed locally at Colorado Custom in Kersey. We maintain
              ownership from conception to harvest — no sale barns, no middlemen.
            </p>
          </div>
        </div>
      </section>

      {/* from pasture to freezer */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">From pasture to freezer</h2>
            <p>Three weights, one animal — here's what each one means for you.</p>
          </div>
          <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)", alignItems: "center" }}>
            <div className="weights">
              <div className="weight-row">
                <div className="weight-label">
                  <span className="tag" style={{ color: "var(--ink-2)" }}>Live weight</span>
                  <span className="sub">The animal on the hoof</span>
                </div>
                <div className="weight-bar">{LIVE_TYP.toLocaleString()} lb animal</div>
              </div>
              <div className="weight-row">
                <div className="weight-label">
                  <span className="tag" style={{ color: "var(--ink-2)" }}>Hanging weight</span>
                  <span className="sub">60% of live weight · your price basis</span>
                </div>
                <div className="weight-bar b2">{HANGING_TYP} lb</div>
              </div>
              <div className="weight-row">
                <div className="weight-label">
                  <span className="tag" style={{ color: "var(--ink-2)" }}>Take-home weight</span>
                  <span className="sub">70% of hanging weight</span>
                </div>
                <div className="weight-bar b3">{TAKEHOME_TYP} lb</div>
              </div>
            </div>
            <div className="three" style={{ background: "var(--card)" }}>
              <div className="num">GOOD TO KNOW</div>
              <h3 className="d">Every animal is different</h3>
              <p>
                These numbers are close estimates based on a typical {LIVE_TYP.toLocaleString()} lb
                animal — your actual animal may run somewhat above or below. Use them as a
                reliable guide, not an exact promise. You pay on your animal's actual hanging weight.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="page section section-tint">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Pricing &amp; deposits</h2>
            <p>
              {money2(HANGING_RATE)}/lb hanging weight, every share size. {money(DEPOSIT)} deposit
              holds your beef and applies to your total; the balance is due at pickup.
            </p>
          </div>
          <div className="share-grid">
            {Object.values(SHARES).map((s) => (
              <div className="share-card" key={s.id} style={{ cursor: "default" }}>
                {s.id === "half" && <span className="share-badge">Most popular</span>}
                <div className="d">{s.label}</div>
                <div className="d" style={{ fontSize: "2.2rem", marginTop: 6, color: "var(--rust)" }}>{money(s.total)}</div>
                <div className="share-specs">
                  <span>{s.hanging} LBS HANGING</span>
                  <span>{s.takehome} LBS TAKE-HOME (EST)</span>
                  <span className="hot">FREEZER {s.freezer}</span>
                </div>
                <p className="share-feeds">Feeds {s.feeds}.</p>
                <div className="share-price">
                  <span className="mute small">{money(DEPOSIT)} deposit</span>
                  <strong>{money(balanceAtPickup(s))} at pickup</strong>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "var(--space-lg)", display: "flex", gap: "var(--space-md)", alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/order" className="btn btn-dark">Start an order</Link>
            <span className="small mute">Order by {HARVEST.orderBy} for the {HARVEST.label} harvest.</span>
          </div>
        </div>
      </section>

      {/* choosing your cuts */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Your beef, your way</h2>
            <p>
              A guided cut sheet walks you through every decision — steak thickness, roast
              sizes, ground beef ratio, and more — and we fill out the butcher's official
              form for you. Every question comes with a plain-English explanation.
            </p>
          </div>
          <div className="cut-strip">
            {PRIMALS.filter((p) => ["rib", "loin", "brisket", "plate", "chuck", "flank"].includes(p.id)).map((p) => (
              <figure className="cut-tile" key={p.id}>
                <img src={p.photo} alt={p.photoAlt} loading="lazy" />
                <figcaption>{p.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* timeline + pickup/payment */}
      <section className="page section section-tint">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Timeline &amp; pickup — {HARVEST.label}</h2>
            <p>One harvest this fall. Reserve by {HARVEST.orderBy}.</p>
          </div>
          <div className="cal-grid" style={{ marginBottom: "var(--space-xl)" }}>
            {[
              { d: "Sept 16", t: "Cattle harvested" },
              { d: "Sept 16–30", t: "14-day hang — dry aging & tenderizing" },
              { d: "Sept 30", t: "Processed & packaged into your custom cuts" },
              { d: "Week of Oct 1", t: "Ready for pickup in Kersey" },
            ].map((x) => (
              <div className="cal-card" key={x.d} style={{ cursor: "default" }}>
                <div className="d" style={{ color: "var(--rust)" }}>{x.d}</div>
                <div className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>{x.t}</div>
              </div>
            ))}
          </div>

          <div className="dark-panel">
            <div>
              <span className="tag">Pickup</span>
              <p>{PROCESSOR.name}<br />{PROCESSOR.address}<br />{PROCESSOR.phone}</p>
              <p className="dim">{HARVEST.storageNote}</p>
            </div>
            <div>
              <span className="tag">Who you pay</span>
              <p>
                Colorado Custom processes your beef and is where you'll pick it up — but they
                are not who you pay. Your {money(DEPOSIT)} deposit and final balance are paid
                directly to {PAYABLE_TO}.
              </p>
              <p className="dim">Checks payable to {PAYABLE_TO}.</p>
            </div>
            <div>
              <span className="tag">Questions?</span>
              <p>Call or text {RANCH_CONTACT.name} — {RANCH_CONTACT.phone}.</p>
              <p className="dim">Pickup only — everything comes frozen, vacuum-sealed, and labeled. Bring coolers.</p>
            </div>
          </div>
        </div>
      </section>

      <CutDialog primal={open} onClose={() => setOpenPrimal(null)} />
    </main>
  );
}
