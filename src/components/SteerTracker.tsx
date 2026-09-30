/* "3 of 7 steers already reserved" — one small steer per animal in
   the season, each filling up as its shares are spoken for. */

import { useId } from "react";
import { STEER_BODY, STEER_EAR, STEER_HORN, STEER_HORN2, STEER_TAIL } from "./Cow";
import { SEASONS, CURRENT_SEASON, NEXT_SEASON } from "../data/config";
import { useAvailability, seasonFull, steerCount } from "../lib/availability";

/* the silhouette's bounding box in Cow.tsx coordinates */
const BOX = { x: 90, y: 92, w: 734, h: 352 };

function SteerIcon({ fill }: { fill: number }) {
  const clip = useId();
  return (
    <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={STEER_BODY} />
          <path d={STEER_EAR} />
          <path d={STEER_HORN} />
          <path d={STEER_HORN2} />
        </clipPath>
      </defs>
      <path className="ts-tail" d={STEER_TAIL} />
      <g className="ts-open">
        <path d={STEER_HORN} />
        <path d={STEER_HORN2} />
        <path d={STEER_EAR} />
        <path d={STEER_BODY} />
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
