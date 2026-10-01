/* A stylized Front Range: the mountains along the left edge, the
   plains running east, the Denver area down by the foothills, the
   butcher in Kersey, and the ranch up in the northeast. Roughly to
   scale — Kersey is an hour northeast of Denver. */

import { ASSET } from "../data/config";

const RANCH = { x: 630, y: 96 };
const BUTCHER = { x: 430, y: 196 };
const DENVER = { x: 196, y: 352 };

const STEER_ROUTE = `M ${RANCH.x - 34} ${RANCH.y + 16} C 560 118 500 150 ${BUTCHER.x + 30} ${BUTCHER.y - 2}`;
const DRIVE = `M ${DENVER.x + 14} ${DENVER.y - 10} C 250 300 330 250 ${BUTCHER.x - 6} ${BUTCHER.y + 28}`;

/* the mountains, as a wall of peaks down the left edge */
const FRONT_RANGE = [
  "M 0 60 L 22 24 L 40 52 L 62 14 L 84 50 L 104 30 L 126 70 L 142 48 L 160 92",
  "M 0 150 L 18 118 L 36 140 L 58 100 L 80 136 L 100 112 L 120 158 L 138 134 L 150 170",
  "M 0 240 L 24 206 L 44 232 L 66 194 L 88 230 L 108 214 L 128 252 L 146 230 L 156 264",
  "M 0 330 L 20 300 L 40 324 L 62 282 L 84 322 L 104 300 L 122 340 L 140 318 L 150 350",
  "M 0 420 L 24 392 L 44 414 L 66 376 L 88 412 L 108 394 L 130 436 L 148 414 L 158 446",
  "M 0 100 L 12 84 L 24 104",
  "M 0 200 L 14 182 L 28 204",
  "M 0 290 L 12 272 L 26 294",
  "M 0 380 L 14 362 L 28 384",
];

/* a hint of plains: short horizon strokes thinning toward the mountains */
const PLAINS = [
  [250, 80, 40], [330, 60, 60], [480, 50, 34], [560, 36, 50],
  [300, 150, 30], [560, 160, 56], [640, 190, 30],
  [250, 250, 36], [330, 290, 54], [430, 300, 40], [540, 270, 60], [640, 300, 44],
  [280, 400, 50], [380, 410, 32], [470, 380, 60], [560, 420, 44], [650, 390, 30],
];

export default function ColoradoMap() {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <svg className="co-map" viewBox="0 0 720 460" role="img"
      aria-label="Map of Colorado's Front Range: mountains to the west, the ranch in the northeast, Colorado Custom Meat Co in Kersey, and the drive up from the Denver area">
      <defs>
        <marker id="co-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 Z" className="co-arrowhead" />
        </marker>
        <path id="co-drive" d={DRIVE} />
      </defs>

      <rect className="co-state" x="0" y="0" width="720" height="460" />
      <g className="co-plains">
        {PLAINS.map(([x, y, w]) => <line key={`${x}-${y}`} x1={x} y1={y} x2={x + w} y2={y} />)}
      </g>
      <g className="co-ranges">
        {FRONT_RANGE.map((d) => <path key={d} d={d} />)}
      </g>

      {/* north arrow */}
      <g className="co-north" transform="translate(680 420)">
        <path d="M 0 -16 L 7 10 L 0 4 L -7 10 Z" />
        <text y="26">N</text>
      </g>

      {/* 1 · the steer goes to the butcher */}
      <path className="co-route" d={STEER_ROUTE} markerEnd="url(#co-arrow)" />
      <g className="co-num" transform="translate(548 108)">
        <circle r="11" /><text y="4">1</text>
      </g>

      {/* 2 · the drive up from the Denver area */}
      <path className="co-road" d={DRIVE} />
      <path className="co-road-center" d={DRIVE} markerEnd="url(#co-arrow)" />
      <g className="co-num" transform="translate(320 308)">
        <circle r="11" /><text y="4">2</text>
      </g>

      {/* ranch */}
      <image href={ASSET("thunderbolt-mark.png")} x={RANCH.x - 28} y={RANCH.y - 56} width="56" height="102" />
      <text className="co-label" x={RANCH.x} y={RANCH.y + 66} textAnchor="middle">THUNDERBOLT RANCH</text>

      {/* butcher */}
      <g transform={`translate(${BUTCHER.x} ${BUTCHER.y})`} className="co-shop">
        <path d="M -18 2 L -18 -12 L 0 -26 L 18 -12 L 18 2 Z" />
        <rect x="-18" y="2" width="36" height="20" />
        <rect className="co-door" x="-5" y="8" width="10" height="14" />
        <path className="co-awning" d="M -20 -2 L 20 -2 L 22 5 L -22 5 Z" />
      </g>
      <text className="co-label" x={BUTCHER.x} y={BUTCHER.y - 42} textAnchor="middle">COLORADO CUSTOM MEAT CO</text>
      <text className="co-label co-sub" x={BUTCHER.x} y={BUTCHER.y - 28} textAnchor="middle">KERSEY · PICKUP HERE</text>

      {/* the Denver area, deliberately unlabeled */}
      <circle className="co-city-ring" cx={DENVER.x} cy={DENVER.y} r="18" />
      <circle className="co-city" cx={DENVER.x} cy={DENVER.y} r="7" />

      {/* the car, driving up to collect the beef */}
      <g className="co-car">
        <g transform="scale(1.5) translate(-15 2)">
          <path d="M 0 0 L 0 -6 L 5 -6 L 9 -12 L 19 -12 L 24 -6 L 30 -6 L 30 0 Z" className="co-car-body" />
          <rect x="10" y="-11" width="8" height="5" className="co-car-glass" />
          <circle cx="7" cy="0" r="3.5" className="co-car-wheel" />
          <circle cx="23" cy="0" r="3.5" className="co-car-wheel" />
        </g>
        {reduced ? (
          <animateMotion dur="1s" fill="freeze" keyPoints="0.5;0.5" keyTimes="0;1" rotate="auto">
            <mpath href="#co-drive" />
          </animateMotion>
        ) : (
          <animateMotion dur="8s" repeatCount="indefinite" rotate="auto" keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear">
            <mpath href="#co-drive" />
          </animateMotion>
        )}
      </g>
    </svg>
  );
}
