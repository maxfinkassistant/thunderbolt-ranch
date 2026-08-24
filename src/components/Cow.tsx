/* Interactive beef primal diagram.
   A drawn steer silhouette with the primal regions clipped inside
   it — regions stay simple polygons, the silhouette supplies the
   anatomy. Colors come from CSS custom properties. */

import { useId } from "react";

export const STEER_BODY = `
  M150,152
  C190,138 225,136 262,142
  C360,130 470,128 560,134
  C640,138 700,142 742,152
  C776,158 796,176 800,202
  C805,236 800,270 790,302
  L778,352
  C772,382 768,412 766,438
  L736,438
  C738,406 740,376 734,352
  L712,352
  C660,360 560,368 470,366
  C420,365 380,362 346,357
  C343,382 341,412 339,438
  L301,438
  C303,406 301,376 296,350
  C270,340 252,324 244,304
  C230,288 210,274 190,262
  C160,257 130,254 112,246
  C98,240 93,228 97,216
  C101,199 112,184 126,171
  C134,161 142,154 150,152
  Z`;

export const STEER_EAR = "M168,146 C158,132 143,124 128,127 C140,139 154,147 166,152 Z";
export const STEER_HORN = "M158,152 C138,146 118,136 106,118 C101,110 107,103 116,107 C134,116 150,132 164,148 Z";
export const STEER_HORN2 = "M170,148 C182,136 192,122 194,106 C195,97 187,95 182,102 C174,114 168,130 164,146 Z";
export const STEER_TAIL = "M792,182 C814,208 820,258 812,308 C808,340 803,366 799,386";

interface Region {
  pts: string;
  cx: number;
  cy: number;
  name: string;
  fs?: number; // label font size (default 11)
}

export const REGIONS: Record<string, Region> = {
  chuck:   { pts: "180,118 372,118 372,306 258,306 216,252 180,240", cx: 298, cy: 230, name: "Chuck" },
  rib:     { pts: "372,118 486,118 486,296 372,306", cx: 429, cy: 220, name: "Rib" },
  loin:    { pts: "486,118 596,118 596,290 486,296", cx: 541, cy: 216, name: "Loin" },
  sirloin: { pts: "596,118 690,118 690,288 596,290", cx: 643, cy: 212, name: "Sirloin", fs: 9.5 },
  round:   { pts: "690,118 812,118 812,348 690,348 690,288", cx: 746, cy: 244, name: "Round" },
  brisket: { pts: "228,306 336,306 336,392 228,392", cx: 294, cy: 348, name: "Brisket", fs: 9.5 },
  plate:   { pts: "336,306 452,300 452,400 336,392", cx: 394, cy: 344, name: "Plate" },
  flank:   { pts: "452,300 596,290 596,372 452,400", cx: 524, cy: 334, name: "Flank" },
  shank:   { pts: "228,392 340,392 340,450 228,450", cx: 320, cy: 416, name: "Shank", fs: 8 },
};

const SHANK2 = "690,348 782,348 782,450 690,450";

const FILL = "var(--paper-2)";
const LINE = "var(--line-strong)";
const HOT = "var(--rust)";
const MUTE = "var(--mute)";

export default function Cow({
  active,
  onPick,
}: {
  active: string | null;
  onPick?: (k: string) => void;
}) {
  const clip = useId();
  const clickable = !!onPick;
  return (
    <svg viewBox="60 90 800 390" role="img" aria-label="Beef primal diagram" style={{ width: "100%", height: "auto" }}>
      <defs>
        <clipPath id={clip}>
          <path d={STEER_BODY} />
        </clipPath>
      </defs>

      {/* tail, horns + ear behind the body */}
      <path d={STEER_TAIL} fill="none" stroke={LINE} strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="799" cy="394" rx="9" ry="16" fill={LINE} />
      <path d={STEER_HORN} fill="var(--card)" stroke={LINE} strokeWidth="1.5" />
      <path d={STEER_HORN2} fill="var(--card)" stroke={LINE} strokeWidth="1.5" />
      <path d={STEER_EAR} fill={FILL} stroke={LINE} strokeWidth="1.5" />

      {/* body base (head, neck, hooves show through) */}
      <path d={STEER_BODY} fill={FILL} />

      {/* primal regions clipped to the silhouette */}
      <g clipPath={`url(#${clip})`}>
        <polygon
          points={SHANK2}
          fill={active === "shank" ? HOT : FILL}
          opacity={active === "shank" ? 0.94 : 1}
          onClick={() => onPick?.("shank")}
          style={{ cursor: clickable ? "pointer" : "default", transition: "fill .18s, opacity .18s" }}
        />
        {Object.entries(REGIONS).map(([k, r]) => {
          const on = active === k;
          return (
            <polygon
              key={k}
              points={r.pts}
              fill={on ? HOT : FILL}
              stroke="var(--card)"
              strokeWidth="2.5"
              opacity={on ? 0.94 : 1}
              onClick={() => onPick?.(k)}
              style={{ cursor: clickable ? "pointer" : "default", transition: "fill .18s, opacity .18s" }}
            />
          );
        })}
      </g>

      {/* outline on top */}
      <path d={STEER_BODY} fill="none" stroke={LINE} strokeWidth="2" />

      {/* eye + nostril */}
      <circle cx="137" cy="196" r="4" fill={MUTE} />
      <circle cx="108" cy="228" r="2.5" fill={MUTE} />

      {/* labels */}
      {Object.entries(REGIONS).map(([k, r]) => (
        <text
          key={k}
          x={r.cx} y={r.cy} textAnchor="middle"
          fontFamily="var(--font-mono)" fontSize={r.fs ?? 11} fontWeight="600"
          letterSpacing={r.fs && r.fs < 10 ? "0.04em" : "0.08em"}
          fill={active === k ? "oklch(97% 0.01 60)" : MUTE}
          style={{ pointerEvents: "none", textTransform: "uppercase" }}
        >
          {r.name}
        </text>
      ))}
      <text
        x="736" y="416" textAnchor="middle"
        fontFamily="var(--font-mono)" fontSize="8" fontWeight="600"
        letterSpacing="0.04em"
        fill={active === "shank" ? "oklch(97% 0.01 60)" : MUTE}
        style={{ pointerEvents: "none", textTransform: "uppercase" }}
      >
        Shank
      </text>
      <text x="90" y="300" fontFamily="var(--font-mono)" fontSize="10" fill={MUTE}>FRONT</text>
      <text x="800" y="466" fontFamily="var(--font-mono)" fontSize="10" fill={MUTE}>HIND</text>
    </svg>
  );
}
