import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CowMeter from "../components/CowMeter";
import { DATES, SHARES, money2, money } from "../data/config";
import { createGroup, listGroups, groupFill } from "../lib/store";

const HOW = [
  {
    n: "01", t: "Start a group",
    b: "Name it, pick a harvest month, and you get a link. You're not committing to anything yet — the link is just a claim sheet for one animal.",
  },
  {
    n: "02", t: "Share the link",
    b: "Text it to the neighbors, drop it in the family thread, pin it in the office Slack. Anyone with the link can claim a quarter or a half in about a minute.",
  },
  {
    n: "03", t: "The cow completes",
    b: "When all four quarters are spoken for, the animal is committed to your harvest month — and every member's price drops to the whole-beef rate. Everyone pays separately. Nobody fronts money for anybody.",
  },
];

export default function Split() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [by, setBy] = useState("");
  const [dateId, setDateId] = useState<string | null>(null);
  const groups = listGroups();

  const savings = Math.round((SHARES.quarter.pricePerLb - SHARES.whole.pricePerLb) * SHARES.quarter.hangingMid);

  const start = () => {
    const g = createGroup(name.trim(), dateId!, by.trim());
    navigate(`/split/${g.code}`);
  };

  return (
    <main>
      <section className="page hero wide" style={{ paddingBottom: "var(--space-2xl)" }}>
        <div className="rise">
          <div className="tag hero-kicker" style={{ color: "var(--sage)" }}>Split a cow</div>
          <h1 className="d" style={{ fontSize: "clamp(2.4rem,5.5vw,4rem)" }}>
            Four households.<br />One animal.
          </h1>
          <p className="lede" style={{ marginTop: "var(--space-lg)" }}>
            A whole beef is the best price we offer — and more meat than most families can use.
            Split one. Everyone claims a quarter or a half, pays their own bill, and gets the
            whole-beef rate when the cow completes.
          </p>
          <div className="hero-fine">
            <span>WHOLE-BEEF RATE {money2(SHARES.whole.pricePerLb)}/LB</span>
            <span>VS QUARTER ALONE {money2(SHARES.quarter.pricePerLb)}/LB</span>
            <span>≈ {money(savings)} BACK PER QUARTER</span>
          </div>
        </div>
        <div className="diagram-card rise rise-1">
          <CowMeter filled={2} />
          <p className="cowmeter-caption">Each claim fills a quarter. Four quarters make a cow.</p>
        </div>
      </section>

      <section className="page section section-tint">
        <div className="wide">
          <div className="threes">
            {HOW.map((x) => (
              <article className="three" key={x.n}>
                <div className="num" style={{ color: "var(--sage)" }}>{x.n}</div>
                <h3 className="d">{x.t}</h3>
                <p>{x.b}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page section">
        <div className="wide" style={{ maxWidth: 760 }}>
          <div className="section-head">
            <h2 className="d">Start your group</h2>
            <p>Takes thirty seconds. You can claim your own share right after.</p>
          </div>

          <div className="decision" style={{ display: "grid", gap: "var(--space-md)" }}>
            <div className="field">
              <label htmlFor="g-name">Group name</label>
              <input
                id="g-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="The Maple Street Cow"
              />
            </div>
            <div className="field">
              <label htmlFor="g-by">Your name</label>
              <input id="g-by" value={by} onChange={(e) => setBy(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <div className="field" style={{ marginBottom: "var(--space-xs)" }}><label>Harvest month</label></div>
              <div className="chips">
                {DATES.map((d) => (
                  <button key={d.id} className={"chip" + (dateId === d.id ? " on" : "")} onClick={() => setDateId(d.id)}>
                    {d.month}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-solid btn-wide" disabled={!name.trim() || !by.trim() || !dateId} onClick={start}>
              Create group &amp; get my link
            </button>
          </div>

          {groups.length > 0 && (
            <div style={{ marginTop: "var(--space-2xl)" }}>
              <h3 className="d" style={{ marginBottom: "var(--space-md)" }}>Open groups</h3>
              <div className="member-list">
                {groups.map((g) => {
                  const fill = groupFill(g);
                  return (
                    <Link
                      key={g.code} to={`/split/${g.code}`} className="member"
                      style={{ textDecoration: "none" }}
                    >
                      <span className="who">{g.name}{g.sample ? " · sample" : ""}</span>
                      <span className="what">
                        {DATES.find((d) => d.id === g.dateId)?.month} · {Math.min(fill, 4)}/4 QUARTERS
                        {fill >= 4 ? " · COMPLETE" : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
