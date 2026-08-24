/* Photo-based primal map: a real steer side profile with the cut
   regions overlaid as translucent, clickable SVG polygons.

   Base photo: "Hereford bull large.jpg", Wikimedia Commons,
   public domain — swap for a ranch photo at launch.           */

export const STEER_PHOTO =
  "https://upload.wikimedia.org/wikipedia/commons/f/f3/Hereford_bull_large.jpg";

/* Coordinates are in the photo's native 550 × 369 pixel space. */
export const VIEW = { w: 550, h: 369 };

interface Region {
  pts: string;
  cx: number;
  cy: number;
  name: string;
  fs?: number;
}

export const PHOTO_REGIONS: Record<string, Region> = {
  chuck:   { pts: "140,34 186,56 215,56 215,196 160,188 128,152 131,96", cx: 178, cy: 122, name: "Chuck", fs: 10 },
  rib:     { pts: "215,56 300,70 300,152 215,148", cx: 257, cy: 112, name: "Rib", fs: 10 },
  loin:    { pts: "300,70 360,77 360,158 300,152", cx: 330, cy: 118, name: "Loin", fs: 9 },
  sirloin: { pts: "360,77 420,68 420,162 360,158", cx: 390, cy: 118, name: "Sirloin", fs: 7.5 },
  round:   { pts: "420,68 464,62 515,68 530,125 520,185 502,240 448,248 420,165", cx: 472, cy: 140, name: "Round", fs: 10 },
  brisket: { pts: "131,175 215,192 215,230 152,208", cx: 178, cy: 207, name: "Brisket", fs: 7.5 },
  plate:   { pts: "215,148 300,152 300,238 215,230", cx: 257, cy: 196, name: "Plate", fs: 8.5 },
  flank:   { pts: "300,152 420,162 420,230 300,238", cx: 356, cy: 197, name: "Flank", fs: 9 },
  shank:   { pts: "197,232 238,240 233,345 201,345", cx: 218, cy: 300, name: "Shank", fs: 7 },
};

const SHANK2 = "448,248 500,240 495,350 456,350";

export default function SteerMap({
  active,
  onPick,
}: {
  active: string | null;
  onPick?: (k: string) => void;
}) {
  const clickable = !!onPick;
  return (
    <div className="steer-map">
      <img src={STEER_PHOTO} alt="" aria-hidden="true" />
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        role="img"
        aria-label="Beef primal map over a steer photo"
      >
        <polygon
          points={SHANK2}
          className={"sm-region" + (active === "shank" ? " on" : "") + (clickable ? " click" : "")}
          onClick={() => onPick?.("shank")}
        />
        {Object.entries(PHOTO_REGIONS).map(([k, r]) => (
          <polygon
            key={k}
            points={r.pts}
            className={"sm-region" + (active === k ? " on" : "") + (clickable ? " click" : "")}
            onClick={() => onPick?.(k)}
          />
        ))}
        {Object.entries(PHOTO_REGIONS).map(([k, r]) => (
          <text
            key={k}
            x={r.cx} y={r.cy} textAnchor="middle"
            className="sm-label"
            fontSize={r.fs ?? 11}
          >
            {r.name}
          </text>
        ))}
        <text x={474} y={300} textAnchor="middle" className="sm-label" fontSize={7}>
          Shank
        </text>
      </svg>
    </div>
  );
}
