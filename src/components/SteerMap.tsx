/* Photo-based primal map: an Angus steer side profile with the
   cut regions overlaid as translucent, clickable SVG polygons.

   Base photo: public-domain Aberdeen Angus conformation photo
   (DPLA / Wikimedia Commons), warm-toned to the brand palette.
   Lives in /public — swap for a ranch photo when available.    */

export const STEER_PHOTO = "/angus-steer.jpg";

/* Coordinates in the photo's 864 × 609 pixel space. */
export const VIEW = { w: 864, h: 609 };

interface Region {
  pts: string;
  cx: number;
  cy: number;
  name: string;
  fs?: number;
}

export const PHOTO_REGIONS: Record<string, Region> = {
  chuck:   { pts: "195,155 320,150 320,330 230,330 195,240", cx: 262, cy: 245, name: "Chuck" },
  rib:     { pts: "320,150 425,148 425,330 320,330", cx: 372, cy: 240, name: "Rib" },
  loin:    { pts: "425,148 520,148 520,325 425,330", cx: 472, cy: 236, name: "Loin" },
  sirloin: { pts: "520,148 600,150 600,320 520,325", cx: 560, cy: 234, name: "Sirloin", fs: 9.5 },
  round:   { pts: "600,150 700,150 775,168 800,220 795,300 760,380 700,400 600,320", cx: 700, cy: 262, name: "Round" },
  brisket: { pts: "230,330 320,330 320,420 250,402 218,360", cx: 276, cy: 372, name: "Brisket", fs: 8.5 },
  plate:   { pts: "320,330 425,330 425,415 320,420", cx: 372, cy: 374, name: "Plate", fs: 9.5 },
  flank:   { pts: "425,330 600,320 600,400 425,415", cx: 512, cy: 366, name: "Flank" },
  shank:   { pts: "250,402 318,420 312,568 256,562", cx: 286, cy: 480, name: "Shank", fs: 8 },
};

const SHANK2 = "662,398 748,386 738,568 672,568";

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
        aria-label="Beef primal map over an Angus steer photo"
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
            fontSize={r.fs ?? 12}
          >
            {r.name}
          </text>
        ))}
        <text x={706} y={480} textAnchor="middle" className="sm-label" fontSize={8}>
          Shank
        </text>
      </svg>
    </div>
  );
}
