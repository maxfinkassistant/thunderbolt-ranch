import {
  DECISIONS, GROUND_BASE, THICKNESS, SHARES,
  PROCESSING_PER_LB, GROUP_RATE,
  type ShareId,
} from "../data/config";

export interface Totals {
  ground: number;
  whole: number;
  all: number;
}

export function computeTotals(picks: Record<string, string>, frac: number): Totals {
  let ground = GROUND_BASE * frac;
  let whole = 0;
  DECISIONS.forEach((d) => {
    const o = d.options.find((x) => x.id === picks[d.id]);
    const w = d.weight * frac;
    if (!o) return;
    if (o.ground) ground += w;
    else if (picks[d.id] === "mix" || picks[d.id] === "split") {
      ground += w * 0.45;
      whole += w * 0.55;
    } else whole += w;
  });
  return { ground: Math.round(ground), whole: Math.round(whole), all: Math.round(ground + whole) };
}

export function steakCount(
  id: string,
  picks: Record<string, string>,
  thickness: Record<string, string>,
  frac: number,
): number | null {
  const d = DECISIONS.find((x) => x.id === id);
  if (!d) return null;
  const o = d.options.find((x) => x.id === picks[id]);
  if (!o?.steak) return null;
  const t = THICKNESS.find((x) => x.id === thickness[id]);
  if (!t) return null;
  let w = d.weight * frac;
  if (picks[id] === "split") w *= 0.62;
  return Math.max(1, Math.round(w / t.per));
}

export interface Estimate {
  deposit: number;
  beefBalance: number;   // hanging mid × rate − deposit
  processing: number;    // hanging mid × processing rate
  total: number;
  ratePerLb: number;
  hangingMid: number;
  groupRate: boolean;
}

/** Full estimated cost. Group members get the whole-beef rate. */
export function estimateCost(share: ShareId, inGroup: boolean): Estimate {
  const s = SHARES[share];
  const rate = inGroup ? GROUP_RATE : s.pricePerLb;
  const beef = s.hangingMid * rate;
  const processing = s.hangingMid * PROCESSING_PER_LB;
  return {
    deposit: s.deposit,
    beefBalance: Math.round(beef - s.deposit),
    processing: Math.round(processing),
    total: Math.round(beef + processing),
    ratePerLb: rate,
    hangingMid: s.hangingMid,
    groupRate: inGroup,
  };
}

/** $/lb of take-home beef, the number people actually compare to the store. */
export function effectivePerLb(share: ShareId, inGroup: boolean): number {
  const s = SHARES[share];
  const est = estimateCost(share, inGroup);
  return est.total / s.takehomeMid;
}
