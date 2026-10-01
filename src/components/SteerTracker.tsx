/* "3 of 7 steers already reserved" — one small steer per animal in
   the season, each filling up as its shares are spoken for. */

import { useId } from "react";
import { SEASONS, CURRENT_SEASON, NEXT_SEASON } from "../data/config";
import { useAvailability, seasonFull, steerCount } from "../lib/availability";

/* A horned steer in profile, drawn for ~40–60px wide: long legs, a
   withers hump, a dewlap, lyre horns. Facing left; 100 × 62 box. */
const BODY = `M 26 20
  C 31 15 39 16 47 17 C 64 15 78 16 86 19 C 91 20 93 26 92 32
  L 90 40 L 92 60 L 87 60 L 84 48 L 81 60 L 76 60 L 75 44
  C 64 47 52 47 43 43
  L 43 60 L 38 60 L 36 48 L 34 60 L 29 60 L 27 43
  C 23 43 20 40 19 36 C 16 37 11 37 6 35 C 2 33 1 29 2 25 C 4 20 9 17 14 15
  C 9 12 5 8 6 2 C 8 7 11 11 16 13 L 20 13 C 24 11 28 7 29 2 C 28 8 26 12 24 15
  C 25 16 26 18 26 20 Z`;
const EAR = "M 19 14 C 23 14 26 15 28 19 C 24 20 21 18 19 14 Z";
const TAIL = "M 90 23 C 95 30 96 42 93 50";
const BOX = { x: -2, y: -2, w: 104, h: 66 };

function SteerIcon({ fill }: { fill: number }) {
  const clip = useId();
  return (
    <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
          <path d={EAR} />
        </clipPath>
      </defs>
      <path className="ts-tail" d={TAIL} />
      <ellipse className="ts-tuft" cx="93" cy="51" rx="2" ry="3.5" />
      <g className="ts-open">
        <path d={EAR} />
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
        : <><b>{count}</b> of {capacity} steers already reserved</>;

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
