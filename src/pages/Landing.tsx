import { useState } from "react";
import { Link } from "react-router-dom";
import SteerMap from "../components/SteerMap";
import CutDialog from "../components/CutDialog";
import {
  SHARES, DEPOSIT, HANGING_RATE, TAKEHOME_RATE_EST,
  USDA_CHOICE, HARVEST, PROCESSOR, PAYABLE_TO, RANCH_CONTACT,
  LIVE_TYP, STORY, QUALITY, IMAGES, PRIMALS, balanceAtPickup,
  savingsFor, money, money2, moneySigned, type ShareId,
} from "../data/config";

const SAMPLE_CODE = "TR-SAMPLE1";

export default function Landing() {
  const [active, setActive] = useState("chuck");
  const [openPrimal, setOpenPrimal] = useState<string | null>(null);
  const [savingsShare, setSavingsShare] = useState<ShareId>("half");
  const open = openPrimal ? PRIMALS.find((p) => p.id === openPrimal) ?? null : null;
  const sv = savingsFor(savingsShare);

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

      {/* what you take home */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">What you actually take home</h2>
            <p>
              Forget live weight and hanging weight. The only number that matters is the
              beef that goes in your freezer — cut, wrapped, labeled, and paid for.
            </p>
          </div>
          <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)", alignItems: "start" }}>
            <div className="takehome-grid">
              {Object.values(SHARES).map((s) => (
                <div className="takehome" key={s.id}>
                  <span className="tag">{s.label}</span>
                  <div className="d takehome-num">≈ {s.takehome} lb<sup>*</sup></div>
                  <p className="small mute">of finished beef · fills about {s.freezer} of freezer</p>
                  <div className="takehome-rate">≈ {money2(TAKEHOME_RATE_EST)}/lb all in</div>
                </div>
              ))}
            </div>
            <div className="three" style={{ background: "var(--card)" }}>
              <div className="num">GOOD TO KNOW</div>
              <h3 className="d">Every animal is different</h3>
              <p>
                <sup>*</sup>These are close estimates from a typical {LIVE_TYP.toLocaleString()} lb
                animal — yours may run somewhat above or below. Use them as a reliable guide,
                not an exact promise. You pay {money2(HANGING_RATE)}/lb on your animal's actual
                hanging weight, so the final number is real.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* versus the grocery store */}
      <section className="page section section-tint">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Versus the grocery store</h2>
            <p>
              Your beef costs the same {money2(TAKEHOME_RATE_EST)}/lb whether it comes out as
              ribeyes or burger. The store charges you a different price for every cut — here's
              what that difference is worth.
            </p>
          </div>

          <div className="savings-switch" role="group" aria-label="Share size">
            {Object.values(SHARES).map((s) => (
              <button key={s.id} className={"chip" + (savingsShare === s.id ? " on" : "")}
                onClick={() => setSavingsShare(s.id)}>{s.label}</button>
            ))}
          </div>

          <div className="savings-headline">
            <div>
              <span className="tag">You save, versus the shelf</span>
              <div className="d savings-big">{money(sv.totals.saved)}</div>
              <p className="small mute">
                on a {SHARES[savingsShare].label.toLowerCase()} — about {money2(sv.totals.store / sv.totals.lbs - TAKEHOME_RATE_EST)}/lb
                across roughly {sv.totals.lbs} lb of beef.
              </p>
            </div>
            <div>
              <span className="tag">Same beef at the store</span>
              <div className="d savings-strike">{money(sv.totals.store)}</div>
              <p className="small mute">
                blended shelf price ≈ {money2(sv.totals.storePerLb)}/lb, against a USDA Choice
                national average of {money2(USDA_CHOICE)}/lb.
              </p>
            </div>
          </div>

          <div className="savings-table-wrap">
            <table className="savings-table">
              <thead>
                <tr>
                  <th>Cut</th>
                  <th className="n">Lbs</th>
                  <th className="n">Your $/lb</th>
                  <th className="n">Store $/lb</th>
                  <th className="n">You save</th>
                </tr>
              </thead>
              <tbody>
                {sv.rows.map((r) => (
                  <tr key={r.cut.id}>
                    <td>
                      <span className="cut-name">{r.cut.name}</span>
                      <span className="cut-store">vs. {r.cut.store}</span>
                    </td>
                    <td className="n mono">{r.lbs}</td>
                    <td className="n mono">{money2(TAKEHOME_RATE_EST)}</td>
                    <td className="n mono">{money2(r.cut.retail)}</td>
                    <td className={"n mono" + (r.saved >= 10 ? " save" : " even")}>{moneySigned(r.saved)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total, {SHARES[savingsShare].label.toLowerCase()} beef</td>
                  <td className="n mono">{sv.totals.lbs}</td>
                  <td className="n mono">{money(sv.totals.yours)}</td>
                  <td className="n mono">{money(sv.totals.store)}</td>
                  <td className="n mono save">{money(sv.totals.saved)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="small mute" style={{ marginTop: "var(--space-md)", maxWidth: "70ch" }}>
            Pound estimates are for a typical animal. Store prices are surveyed Front Range
            shelf prices for comparable USDA Choice cuts and move with the market — treat this
            as a guide, not a quote.
          </p>
        </div>
      </section>

      {/* pricing */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Pricing &amp; deposits</h2>
            <p>
              {money2(HANGING_RATE)}/lb hanging weight, every share size. {money(DEPOSIT)} deposit
              holds your beef and applies to your total; the balance is due at pickup. Every
              figure marked <sup>*</sup> is an estimate for a typical animal.
            </p>
          </div>
          <div className="share-grid">
            {Object.values(SHARES).map((s) => (
              <div className="share-card" key={s.id} style={{ cursor: "default" }}>
                {s.id === "half" && <span className="share-badge">Most popular</span>}
                <div className="d">{s.label}</div>
                <div className="d" style={{ fontSize: "2.2rem", marginTop: 6, color: "var(--rust)" }}>{money(s.total)}<sup>*</sup></div>
                <div className="share-specs">
                  <span>≈ {s.takehome} LBS TAKE-HOME<sup>*</sup></span>
                  <span className="hot">FREEZER {s.freezer}</span>
                </div>
                <p className="share-feeds">Feeds {s.feeds}.</p>
                <Link className="share-sample" to={`/track/${SAMPLE_CODE}?share=${s.id}`}>
                  See the estimated cut sheet for a {s.label.toLowerCase()} →
                </Link>
                <div className="share-price">
                  <span className="mute small">{money(DEPOSIT)} deposit</span>
                  <strong>{money(balanceAtPickup(s))} at pickup<sup>*</sup></strong>
                </div>
              </div>
            ))}
          </div>
          <p className="small mute" style={{ marginTop: "var(--space-md)", maxWidth: "70ch" }}>
            <sup>*</sup>Prices and weights are estimates for a typical {LIVE_TYP.toLocaleString()} lb
            animal. You pay {money2(HANGING_RATE)}/lb on your animal's actual hanging weight, so your
            final total moves with the animal.
          </p>
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

          <div className="sample-band">
            <div>
              <span className="tag">See one before you build one</span>
              <h3 className="d" style={{ marginTop: "var(--space-xs)" }}>A finished cut sheet, start to finish</h3>
              <p className="small">
                This is a real sample order — the same page you'll get after you reserve. Every
                steak, roast, and pound of ground beef a half yields, laid out the way it lands
                in your freezer.
              </p>
            </div>
            <Link to={`/track/${SAMPLE_CODE}`} className="btn btn-on-dark btn-big">
              View the sample order
            </Link>
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
