/* "3 of 7 steers already reserved" — one small steer per animal in
   the season, each filling up as its shares are spoken for. */

import { useId } from "react";
import { SEASONS, CURRENT_SEASON, NEXT_SEASON } from "../data/config";
import { useAvailability, seasonFull, steerCount } from "../lib/availability";
import SteerCount from "./SteerCount";

/* A deep-chested steer in profile, drawn with straight edges and
   horns swept up like the emblem. Facing left; 100 × 62 box. */
const BODY = "M " + [
  "4,4", "8,9", "16,13", "21,13", "27,9", "33,3", "30,10", "24,15",          // horns
  "27,19", "32,15", "50,16", "86,15", "94,21", "95,31", "91,41",            // neck, back, rump
  "93,60", "87,60", "85,48", "81,60", "75,60", "75,45",                     // hind legs
  "60,48", "42,46",                                                         // belly
  "42,60", "36,60", "35,49", "33,60", "27,60", "26,45",                     // front legs
  "21,43", "18,37", "13,35", "6,36", "1,32", "2,25", "9,18", "13,16", "7,11", // dewlap, muzzle, face
].join(" L ") + " Z";
const TAIL = "M 93 22 L 97 34 L 95 48";
const TUFT = "M 93 46 L 97 46 L 95 54 Z";
const BOX = { x: -1, y: -1, w: 101, h: 63 };

function SteerIcon({ fill }: { fill: number }) {
  const clip = useId();
  return (
    <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path className="ts-tail" d={TAIL} />
      <path className="ts-tuft" d={TUFT} />
      <g className="ts-open">
        <path d={BODY} />
      </g>
      <rect className="ts-fill" clipPath={`url(#${clip})`} x={BOX.x} y={BOX.y} width={BOX.w * fill} height={BOX.h} />
    </svg>
  );
}

export default function SteerTracker({ compact = false }: { compact?: boolean }) {
  const a = useAvailability();
  const season = SEASONS[CURRENT_SEASON];
  const next = SEASONS[NEXT_SEASON];
  const full = seasonFull(a);
  const capacity = Math.max(1, Math.round(a.capacity));
  const reserved = Math.min(a.reserved, capacity);
  const count = steerCount(reserved);

  const headline = !a.known
    ? <>{capacity} steers this {season.name}</>
    : full
      ? <>All {capacity} {season.name} steers are reserved</>
      : reserved === 0
        ? <>{capacity} steers this {season.name} — be the first</>
        : <><b><SteerCount n={reserved} /></b> of {capacity} steers already reserved</>;

  return (
    <div className={"tracker" + (compact ? " compact" : "")}>
      <span className="tag">{season.label} harvest · pickup est. {season.pickupShort}</span>
      <div className="d tracker-count">{headline}</div>
      <div
        className="tracker-herd"
        role="img"
        aria-label={a.known ? `${count} of ${capacity} steers reserved` : `${capacity} steers this season`}
        style={{ gridTemplateColumns: `repeat(${capacity}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: capacity }, (_, i) => (
          <SteerIcon key={i} fill={a.known ? Math.max(0, Math.min(1, reserved - i)) : 0} />
        ))}
      </div>
      <p className="tracker-note">
        {full ? (
          <>
            New orders are reserved from our <b>{next.name} harvest</b> — pickup {next.pickupText}.
          </>
        ) : (
          <>
            <b>Get yours today.</b> Once all {capacity} are spoken for, new orders are reserved
            from our {next.name} harvest — pickup {next.pickupText}.
          </>
        )}
      </p>
    </div>
  );
}
