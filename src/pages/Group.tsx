import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import CowMeter from "../components/CowMeter";
import { DATES, SHARES, money2, money } from "../data/config";
import { getGroup, groupFill, groupComplete } from "../lib/store";

export default function GroupPage() {
  const { code = "" } = useParams();
  const group = getGroup(code);
  const [copied, setCopied] = useState(false);

  if (!group) {
    return (
      <main className="page confirm-wrap">
        <h2 className="d">No group at this link.</h2>
        <p style={{ marginTop: "var(--space-md)", color: "var(--ink-2)" }}>
          The code <span className="mono">{code.toUpperCase()}</span> doesn't match an open group.
          Check the link you were sent, or start a fresh one.
        </p>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Link to="/split" className="btn btn-solid">Start a group</Link>
        </div>
      </main>
    );
  }

  const fill = groupFill(group);
  const complete = groupComplete(group);
  const open = Math.max(0, 4 - fill);
  const date = DATES.find((d) => d.id === group.dateId);
  const url = `${window.location.origin}/split/${group.code}`;
  const savings = Math.round((SHARES.quarter.pricePerLb - SHARES.whole.pricePerLb) * SHARES.quarter.hangingMid);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable; the input is selectable */
    }
  };

  return (
    <main>
      <section className="page group-hero">
        <div className="tag" style={{ color: "var(--sage)", marginBottom: "var(--space-sm)" }}>
          Split a cow · {date?.month}
        </div>
        <h1 className="d" style={{ fontSize: "clamp(2rem,4.5vw,3.2rem)" }}>{group.name}</h1>
        <p className="mute" style={{ marginTop: "var(--space-xs)" }}>
          Started by {group.createdBy} · group code <span className="mono">{group.code}</span>
          {group.sample && " · sample group for demonstration"}
        </p>
      </section>

      <section className="page group-grid" style={{ paddingBottom: "var(--space-3xl)" }}>
        <div>
          <div className="diagram-card">
            <CowMeter filled={fill} />
            <p className="cowmeter-caption">
              {complete
                ? <><b>Complete.</b> All four quarters are spoken for — whole-beef rate locked for everyone.</>
                : <><b>{fill} of 4 quarters</b> claimed — {open === 1 ? "one more share completes" : `${open} quarters still open on`} this cow</>}
            </p>
          </div>

          <div className="member-list" style={{ marginTop: "var(--space-md)" }}>
            {group.members.map((m) => (
              <div className="member" key={m.orderCode}>
                <span className="who">{m.name}</span>
                <span className="what">{SHARES[m.share].label.toUpperCase()} · {SHARES[m.share].takehome}</span>
              </div>
            ))}
            {Array.from({ length: open }).map((_, i) => (
              <div className="member member-open" key={i}>
                <span className="what">QUARTER OPEN — CLAIM IT BELOW</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "var(--space-md)", alignContent: "start" }}>
          {!complete ? (
            <div className="pay-panel">
              <span className="tag">Claim a share</span>
              <p className="small" style={{ marginBottom: "var(--space-md)" }}>
                Claim a quarter{open >= 2 ? " or a half" : ""} and pay your own deposit — takes
                about a minute. When the cow completes, every member pays the whole-beef rate —{" "}
                <b style={{ color: "var(--brass)" }}>{money2(SHARES.whole.pricePerLb)}/lb</b> instead
                of {money2(SHARES.quarter.pricePerLb)}/lb. About {money(savings)} back on a quarter.
              </p>
              <Link to={`/order?group=${group.code}`} className="btn btn-on-dark btn-wide">
                Claim your share
              </Link>
              <p className="pay-fine">
                Deadline for this cow: {date?.deadline}. Pickup {date?.ready} in Kersey.
              </p>
            </div>
          ) : (
            <div className="pay-panel">
              <span className="tag">Cow complete</span>
              <p className="small">
                This animal is committed to the {date?.month} harvest. Every member pays the
                whole-beef rate — locked in for the group.
              </p>
            </div>
          )}

          <div className="decision">
            <h3 className="d" style={{ marginBottom: "var(--space-xs)" }}>Share this link</h3>
            <p className="small mute">
              Anyone with it can claim an open share — the family thread, the neighbors, the office.
            </p>
            <div className="share-link-box">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Group link" />
              <button className="btn btn-dark" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>

          <div className="decision">
            <h3 className="d" style={{ fontSize: "1.1rem", marginBottom: "var(--space-xs)" }}>How the money works</h3>
            <p className="small" style={{ color: "var(--ink-2)" }}>
              Nobody fronts money for the group. Each member pays their own deposit when they claim,
              their own beef balance after hanging weight, and their own processing bill at pickup.
              If the cow doesn't complete by the order deadline, deposits are refunded in full.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
