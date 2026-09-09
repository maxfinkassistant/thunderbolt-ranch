/* The split-a-cow progress meter: the steer photo fills up
   quarter by quarter as neighbors claim shares — each claim
   lights up a real anatomical quarter of the animal. */

import { STEER_PHOTO, VIEW, PHOTO_REGIONS } from "./SteerMap";

const SHANK2 = "448,248 500,240 495,350 456,350";

/* Front-to-back quarters as groups of primal regions. */
const QUARTERS: { keys: string[]; extra?: string; mx: number; my: number }[] = [
  { keys: ["chuck", "brisket", "shank"], mx: 178, my: 128 },
  { keys: ["rib", "plate"], mx: 258, my: 118 },
  { keys: ["loin", "sirloin", "flank"], mx: 360, my: 122 },
  { keys: ["round"], extra: SHANK2, mx: 472, my: 140 },
];

export default function CowMeter({ filled, size = "100%" }: { filled: number; size?: string }) {
  return (
    <div className="steer-map" style={{ width: size }}>
      <img src={STEER_PHOTO} alt="" aria-hidden="true" />
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        role="img"
        aria-label={`${filled} of 4 quarters claimed`}
      >
        {QUARTERS.map((q, i) => {
          const on = i < filled;
          return (
            <g key={i} className={on ? "sm-quarter on" : "sm-quarter"}>
              {q.keys.map((k) => (
                <polygon key={k} points={PHOTO_REGIONS[k].pts} className={"sm-region" + (on ? " on" : "")} />
              ))}
              {q.extra && <polygon points={q.extra} className={"sm-region" + (on ? " on" : "")} />}
              <text
                x={q.mx} y={q.my} textAnchor="middle"
                className="sm-label" fontSize={on ? 20 : 15}
              >
                {on ? "✓" : "¼"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
