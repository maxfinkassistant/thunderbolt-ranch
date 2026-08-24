import { useState } from "react";
import { Link } from "react-router-dom";
import SteerMap from "../components/SteerMap";
import CowMeter from "../components/CowMeter";
import CutDialog from "../components/CutDialog";
import {
  SHARES, DATES, DECISIONS, PROCESSOR, IMAGES, STORE_COMPARE, money, money2,
} from "../data/config";
import { effectivePerLb } from "../lib/yield";

const THREE_THINGS = [
  {
    n: "01",
    t: "Every pound in your box is dinner",
    b: "Beef is priced on hanging weight — the carcass on the rail. Then 14 days of dry aging concentrates the flavor, and the butcher trims away everything you wouldn't eat. A 400 lb half becomes roughly 260 lb of vacuum-sealed, ready-to-cook cuts: no water weight, no waste, no packaging tricks. Denser, better beef in every package.",
  },
  {
    n: "02",
    t: "Pay only for what you actually get",
    b: "A deposit holds your animal today — that's it. Every steer yields a slightly different amount, so the rest of your bill is set after butchering, based on your animal's actual weight. You never pay for estimated pounds, only real ones. We show you the full estimated cost before you put any money down.",
  },
];

const FAQS = [
  {
    q: "Where does the beef actually come from?",
    a: "Our own herd, born and raised on the ranch in northeast Colorado. It grazes our shortgrass pasture, finishes on Colorado corn, and is butchered at Colorado Custom in Kersey — about twenty miles from the ranch. Your beef never crosses a state line and never passes through an auction barn or packing plant.",
  },
  {
    q: "How much freezer space do I actually need?",
    a: "A quarter fits in about 4 cubic feet — most standing freezers or a large fridge-freezer combo can take it. A half wants a small chest freezer (8 cu ft). A whole beef needs a real chest freezer, around 16 cu ft. Measure before you order; it's the thing people underestimate.",
  },
  {
    q: "What does it work out to per pound?",
    a: "About $9 a pound all-in on a half — animal, dry aging, cutting, and processing. Every pound in the box costs the same, and roughly a third of it is steaks and roasts the store sells for $15–25 a pound. The exact estimate for each share size is shown before you pay anything.",
  },
  {
    q: "How is the beef cut?",
    a: "To our standard cut sheet — the list our butcher has refined over twenty seasons: 1-inch steaks two to a pack, 3 lb roasts, halved brisket, bone-in short ribs, and the rest as 1½ lb packs of ground. It's the mix most families actually cook through. Organ meats and soup bones are free on request at pickup.",
  },
  {
    q: "What if I can't eat a whole quarter?",
    a: "Split a cow with people you know. One person starts a group, shares the link, and friends claim quarters until the animal is spoken for. Everyone pays separately for their own share — and once the cow completes, every member gets the whole-beef price.",
  },
  {
    q: "Do you deliver or ship?",
    a: "We don't ship — frozen beef and parcel shipping don't mix well enough for us to stand behind it. Pickup is at Colorado Custom in Kersey, and they can deliver locally for a $100 fee.",
  },
  {
    q: "Is the deposit refundable?",
    a: "Fully refundable until your harvest month's order deadline, because that's when we commit your animal to the butcher. After the deadline it converts to a credit toward a future harvest.",
  },
];

export default function Landing() {
  const [active, setActive] = useState("chuck");
  const [openPrimal, setOpenPrimal] = useState<string | null>(null);
  const openDecision = openPrimal
    ? DECISIONS.find((d) => d.primal === openPrimal) ?? null
    : null;

  return (
    <main>
      {/* hero */}
      <section className="page hero wide">
        <div className="rise">
          <div className="tag hero-kicker">Colorado born · Colorado raised · Colorado butchered</div>
          <h1 className="d">Ribeye, at a rancher's&nbsp;price.</h1>
          <p className="lede" style={{ marginTop: "var(--space-lg)" }}>
            Buy a quarter, half, or whole beef straight from our pastures in northeast
            Colorado — every cut in the box, filets to ground, works out to about{" "}
            <strong>{money2(effectivePerLb("half", false))} a pound all-in</strong>. The
            grocery store charges twice that for the ribeye alone. Our butcher handles
            the cutting; all you pick is how much.
          </p>
          <div className="hero-actions">
            <Link to="/order" className="btn btn-solid btn-big">Reserve your beef</Link>
            <Link to="/how-it-works" className="btn btn-ghost btn-big">How it works</Link>
          </div>
          <div className="hero-fine">
            <span>≈ {money2(effectivePerLb("half", false))}/LB, EVERYTHING INCLUDED</span>
            <span>VS {money2(STORE_COMPARE[0].store)}/LB STORE RIBEYE</span>
            <span>DEPOSIT FROM {money(SHARES.quarter.deposit)}</span>
          </div>
        </div>
        <div className="diagram-card rise rise-1">
          <SteerMap active={active} onPick={(k) => { setActive(k); setOpenPrimal(k); }} />
          <p className="diagram-hint">Tap a section to see what it yields in a quarter, half, or whole.</p>
        </div>
      </section>

      <CutDialog decision={openDecision} onClose={() => setOpenPrimal(null)} />

      {/* one price strip */}
      <section className="page" style={{ paddingBottom: "var(--space-2xl)" }}>
        <div className="wide dark-panel">
          <div>
            <span className="tag">One price for everything</span>
            <div className="d" style={{ fontSize: "clamp(2rem,3.5vw,2.8rem)", lineHeight: 1 }}>
              ≈ {money2(effectivePerLb("half", false))}/lb
            </div>
            <p className="dim">
              All-in on a half — animal, dry aging, cutting, processing. Filets cost the
              same as ground.
            </p>
          </div>
          <div>
            <span className="tag">The meat counter</span>
            <div className="d" style={{ fontSize: "clamp(2rem,3.5vw,2.8rem)", lineHeight: 1 }}>
              {money2(STORE_COMPARE[0].store)}–{money2(STORE_COMPARE[1].store)}/lb
            </div>
            <p className="dim">
              What the store charges for ribeye and filet — and a third of your box is
              cuts like these.
            </p>
          </div>
          <div>
            <span className="tag">Split with friends</span>
            <div className="d" style={{ fontSize: "clamp(2rem,3.5vw,2.8rem)", lineHeight: 1 }}>
              ≈ {money2(effectivePerLb("quarter", true))}/lb
            </div>
            <p className="dim">
              Fill a cow as a group and every quarter gets the whole-beef rate —
              about {money(Math.round((SHARES.quarter.pricePerLb - SHARES.whole.pricePerLb) * SHARES.quarter.hangingMid))} back each.
            </p>
          </div>
        </div>
      </section>

      {/* colorado photo band */}
      <section className="photo-band" style={{ backgroundImage: `url(${IMAGES.heroPlains})` }}>
        <div className="photo-band-inner wide" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div style={{ padding: "0 var(--page-x)" }}>
            <span className="tag">Farm to table, all of it in Colorado</span>
            <h2 className="d" style={{ marginTop: "var(--space-sm)" }}>
              Your steak never crosses a state line.
            </h2>
            <p>
              Born on the ranch, grazed on shortgrass prairie, finished on Colorado corn,
              and butchered at Colorado Custom in Kersey. One animal, one family, one
              short drive — not a feedlot, a packing plant, and two thousand miles of cold trucks.
            </p>
          </div>
        </div>
      </section>

      {/* three things */}
      <section id="how" className="page section section-tint">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Two things to understand first</h2>
            <p>These are the questions we get on the phone every single season. Here they are up front.</p>
          </div>
          <div className="threes">
            {THREE_THINGS.map((x) => (
              <article className="three" key={x.n}>
                <div className="num">{x.n}</div>
                <h3 className="d">{x.t}</h3>
                <p>{x.b}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* farm to table journey */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">From our pasture to your table</h2>
            <p>Most beef changes hands six times before it reaches you. Ours changes hands once — from us to the butcher, and then to you.</p>
          </div>
          <div className="journey">
            <div className="journey-stop">
              <img src={IMAGES.cattleField} alt="Cattle grazing on open Colorado plains" loading="lazy" />
              <div className="num">01 · RAISED</div>
              <h3 className="d">On our grass, under our eye</h3>
              <p>
                Every animal is born and raised on the ranch — shortgrass prairie in
                summer, our own hay in winter, finished on Colorado corn. No auctions,
                no feedlots, no mystery months.
              </p>
            </div>
            <div className="journey-stop">
              <img src={IMAGES.rancher} alt="Rancher at the pasture fence at dawn" loading="lazy" />
              <div className="num">02 · BUTCHERED</div>
              <h3 className="d">Twenty miles, not two thousand</h3>
              <p>
                We trailer each animal to Colorado Custom in Kersey ourselves — a
                family butcher we've worked with for years. USDA inspected, dry aged
                14 days, and cut to the standard list our butcher has refined over
                twenty seasons.
              </p>
            </div>
            <div className="journey-stop">
              <img src={IMAGES.dinner} alt="Sliced steak on a serving board at a family dinner" loading="lazy" />
              <div className="num">03 · ON YOUR TABLE</div>
              <h3 className="d">Colorado raised, Colorado eaten</h3>
              <p>
                You pick it up frozen, boxed, and labeled in Kersey. The whole chain —
                pasture, butcher, freezer, dinner table — fits inside one county line
                and one afternoon's drive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* shares */}
      <section className="page section section-tint">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">How much beef?</h2>
            <p>Check your freezer before you decide. All prices are on hanging weight; the per-pound figure is what it works out to in your freezer, processing included.</p>
          </div>
          <div className="share-grid">
            {Object.values(SHARES).map((s) => (
              <div className="share-card" key={s.id} style={{ cursor: "default" }}>
                {s.id === "half" && <span className="share-badge">Most popular</span>}
                <div className="d">{s.label} beef</div>
                <div className="share-specs">
                  <span>HANGING {s.hanging}</span>
                  <span>YOU TAKE HOME {s.takehome}</span>
                  <span className="hot">FREEZER {s.freezer}</span>
                </div>
                <p className="share-feeds">Feeds {s.feeds}.</p>
                <div className="share-price">
                  <span className="mute small">≈ {money2(effectivePerLb(s.id, false))}/lb all-in</span>
                  <strong>{money(s.deposit)} deposit</strong>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "var(--space-lg)" }}>
            <Link to="/order" className="btn btn-dark">Start an order</Link>
          </div>
        </div>
      </section>

      {/* the cuts */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">What comes out of one animal</h2>
            <p>Ribeyes to soup bones — all of it in your box at the same honest per-pound price.</p>
          </div>
          <div className="cut-strip">
            {DECISIONS.filter((d) => ["rib", "loin", "brisket", "shortrib", "chuck", "flank"].includes(d.id)).map((d) => (
              <figure className="cut-tile" key={d.id}>
                <img src={d.photo} alt={d.photoAlt} loading="lazy" />
                <figcaption>{d.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* split a cow */}
      <section className="page section section-tint">
        <div className="wide split-promo">
          <div>
            <div className="tag" style={{ color: "var(--sage)", marginBottom: "var(--space-md)" }}>Split a cow</div>
            <h2 className="d">Get the whole-beef price without the whole cow.</h2>
            <p className="measure" style={{ marginTop: "var(--space-md)", color: "var(--ink-2)" }}>
              Start a group, share your link, and let friends and neighbors claim quarters
              until the animal is spoken for. Everyone builds their own cut sheet and pays
              for their own share — and when the cow completes, <strong>every member pays the
              whole-beef rate of {money2(SHARES.whole.pricePerLb)}/lb</strong> instead of the
              quarter rate of {money2(SHARES.quarter.pricePerLb)}/lb. That's roughly{" "}
              {money(Math.round((SHARES.quarter.pricePerLb - SHARES.whole.pricePerLb) * SHARES.quarter.hangingMid))} back
              in your pocket on a quarter.
            </p>
            <div className="hero-actions">
              <Link to="/split" className="btn btn-solid">Start a group</Link>
              <Link to="/split/HNDRSN" className="btn btn-ghost">See a live group</Link>
            </div>
          </div>
          <div className="diagram-card">
            <CowMeter filled={3} />
            <p className="cowmeter-caption"><b>3 of 4 quarters</b> claimed — one more neighbor completes this cow</p>
          </div>
        </div>
      </section>

      {/* calendar */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">When beef is available</h2>
            <p>We deliver cattle to Colorado Custom on the 15th of each month. Processing and dry aging take about two weeks.</p>
          </div>
          <div className="cal-grid">
            {DATES.map((d) => (
              <div className="cal-card" key={d.id} style={{ cursor: "default" }}>
                <div className="d">{d.month}</div>
                <div className="cal-rows">
                  <span>ORDER BY <b>{d.deadline}</b></span>
                  <span>TO BUTCHER <b>{d.drop}</b></span>
                  <span className="hot">PICKUP <b>{d.ready}</b></span>
                </div>
                <div className="cal-left">
                  {d.left <= 3 ? <span className="low">{d.left} shares left</span> : <span>{d.left} shares left</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* pickup */}
      <section className="page section" style={{ paddingTop: 0 }}>
        <div className="wide dark-panel">
          <div>
            <span className="tag">Pickup</span>
            <p>
              {PROCESSOR.name}<br />
              {PROCESSOR.address}<br />
              {PROCESSOR.phone}
            </p>
            <p className="dim">They'll call you directly when your beef is ready to arrange a time.</p>
          </div>
          <div>
            <span className="tag">Storage</span>
            <p>Colorado Custom holds your beef free for 7 days after it's ready. After that it's $10 per day.</p>
            <p className="dim">Have freezer space cleared before pickup day.</p>
          </div>
          <div>
            <span className="tag">Can't get there?</span>
            <p>Colorado Custom can deliver locally for a $100 fee.</p>
            <p className="dim">We don't ship. Frozen beef and parcel shipping don't mix well enough for us to stand behind it.</p>
          </div>
        </div>
      </section>

      {/* faq */}
      <section className="page section">
        <div className="wide">
          <div className="section-head">
            <h2 className="d">Fair questions</h2>
          </div>
          <div className="faq">
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div className="a">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
