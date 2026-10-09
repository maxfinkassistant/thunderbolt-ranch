/* Turn cut-sheet answers into a human-readable estimated box,
   and the money math. All counts are estimates for a typical
   1,000 lb-hanging animal, scaled by share and steak thickness. */

import {
  SHARES, MAIN_CUTS, EXTRA_GROUPS, THICKNESS_OPTIONS,
  RIB_CHOICES, LOIN_CHOICES, RIB_YIELD, RIB_ROAST_LBS,
  TBONE_YIELD, STRIP_YIELD, FILET_YIELD,
  steakCount, roastCount,
  DEPOSIT, HANGING_RATE, TAKEHOME_RATE_EST, HANGING_TYP, PATTY_RATE, PATTY_MIN_LBS, money,
  SHARE_RATES, tierFor, rateFor, flatRateSeason,
  type ShareId, type SeasonId,
} from "../data/config";
import { effectiveExtra, type CutSheetAnswers, type Order, type Steer } from "./store";

const inches = (id?: string) =>
  THICKNESS_OPTIONS.find((t) => t.id === id)?.inches ?? 1;

const range = ([lo, hi]: [number, number]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

export interface BoxLine {
  name: string;
  detail: string;
}

/** The estimated contents of the box, one line per decision. */
export function boxSummary(a: CutSheetAnswers, share: ShareId): BoxLine[] {
  const frac = SHARES[share].frac;
  const lines: BoxLine[] = [];
  let groundLbs: [number, number] = [
    Math.round(60 * frac),  // trim that always grinds, typical whole ≈ 60–90 lb
    Math.round(90 * frac),
  ];
  const addGround = (lbs: [number, number]) => {
    groundLbs = [groundLbs[0] + Math.round(lbs[0] * frac), groundLbs[1] + Math.round(lbs[1] * frac)];
  };

  /* rib */
  const ribChoice = RIB_CHOICES.find((c) => c.id === a.rib.choice)!;
  if (a.rib.choice === "prime") {
    lines.push({ name: "Rib", detail: share === "whole" ? "2 prime rib roasts" : share === "half" ? "1 prime rib roast" : "1 small prime rib roast" });
  } else {
    const [lo, hi] = steakCount(RIB_YIELD, frac, inches(a.rib.thickness));
    lines.push({ name: "Rib", detail: `${range([lo, hi])} ${ribChoice.label.toLowerCase()} · ${a.rib.thickness}" · ${a.rib.perPackage}/pack` });
  }

  /* loin */
  if (a.loin.choice === "tbone") {
    const c = steakCount(TBONE_YIELD, frac, inches(a.loin.thickness));
    lines.push({ name: "Short loin", detail: `${range(c)} T-bones · ${a.loin.thickness}" · ${a.loin.perPackage}/pack` });
  } else {
    const s = steakCount(STRIP_YIELD, frac, inches(a.loin.thickness));
    const f = steakCount(FILET_YIELD, frac, inches(a.filetThickness ?? "1 1/2"));
    lines.push({ name: "Short loin", detail: `${range(s)} NY strips · ${a.loin.thickness}" + ${range(f)} filets · ${a.filetThickness ?? '1 1/2'}"` });
  }

  /* main cuts */
  for (const cut of MAIN_CUTS) {
    const ans = a.main[cut.id];
    if (!ans) continue;
    if (ans.mode === "grind") {
      if (cut.roastLbs) addGround(cut.roastLbs);
      lines.push({ name: cut.name, detail: "Ground" });
    } else if (ans.mode === "roast" && cut.roastLbs) {
      const lb = parseInt(ans.roastSize ?? "3") || 3;
      lines.push({ name: cut.name, detail: `${range(roastCount(cut.roastLbs, frac, lb))} roasts · ${ans.roastSize ?? "3 lb"}` });
    } else if (ans.mode === "steak" && cut.yield) {
      const c = steakCount(cut.yield, frac, inches(ans.thickness));
      lines.push({ name: cut.name, detail: `${range(c)} steaks · ${ans.thickness}" · ${ans.perPackage}/pack` });
    }
  }

  /* extras */
  const kept: string[] = [];
  for (const g of EXTRA_GROUPS) {
    for (const c of g.cuts) {
      if (effectiveExtra(a, c.id) === "yes") kept.push(c.name);
      else addGround([2, 5]);
    }
  }
  if (kept.length) lines.push({ name: "Kept whole", detail: kept.join(", ") });

  /* ground */
  lines.push({
    name: "Ground beef",
    detail: `≈ ${groundLbs[0]}–${groundLbs[1]} lb · ${a.groundPack} lb packs${a.patties ? ` · ${a.pattyLbs ?? "40 lb"} as ${a.pattySize} patties` : ""}`,
  });

  if (a.organs.length) {
    lines.push({ name: "Organs & bones", detail: a.organs.join(", ") });
  }
  if (a.tallow) {
    lines.push({ name: "Fat for tallow", detail: "Requested" });
  }

  return lines;
}

/** Pounds of ground left loose after the patty run, for the ground
    beef question. Returns null when no patties were asked for. */
export function looseGround(a: CutSheetAnswers, share: ShareId): [number, number] | null {
  if (!a.patties) return null;
  const [lo, hi] = groundEstimate(a, share);
  const patty = parseInt(a.pattyLbs ?? "40") || 40;
  return [Math.max(0, lo - patty), Math.max(0, hi - patty)];
}

/** Rough ground-beef total, for the wizard's running tally. */
export function groundEstimate(a: CutSheetAnswers, share: ShareId): [number, number] {
  const line = boxSummary(a, share).find((l) => l.name === "Ground beef")!;
  const m = line.detail.match(/(\d+)–(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2])] : [0, 0];
}

/* ---------------- money ---------------- */

export interface Cost {
  total: number;
  deposit: number;
  balance: number;
  hangingLbs: number;
  takehomeLbs: number;
  rate: number;       // $/lb hanging this order pays, at its tier
  tier: ShareId;      // the rate tier — bigger than the share when a group earned it
}

export function shareCost(share: ShareId, groupFrac?: number, deposit = DEPOSIT): Cost {
  const s = SHARES[share];
  const tier = tierFor(share, groupFrac);
  const rate = rateFor(share, groupFrac);
  const total = Math.round(s.hanging * rate);
  return { total, deposit, balance: total - deposit, hangingLbs: s.hanging, takehomeLbs: s.takehome, rate, tier };
}

export { HANGING_RATE, TAKEHOME_RATE_EST };

/* ============================================================
   FINAL PRICING
   Until a steer is weighed, an order is priced off the typical
   animal (SHARES[...].total). Once it's on the hook the real
   number is hanging weight × share × the rate for that animal —
   which may be below standard when the carcass came in heavy.

   Every surface that shows money after the harvest — the order
   ticket, the invoice email, the customer's tracking page — reads
   this one function, so they can't drift apart.
   ============================================================ */

export interface FinalPrice {
  rate: number;          // $/lb actually charged
  standardRate: number;  // this tier's list rate
  tier: ShareId;         // rate tier paid — bigger than the share when a group earned it
  groupFrac: number;     // confirmed steers' worth in the group
  groupUnlocked: boolean;
  adjusted: boolean;     // rate came in under standard
  heavy: boolean;        // and the carcass is why
  hangingLbs: number;    // the whole animal
  shareLbs: number;      // this customer's portion of it
  beefTotal: number;     // shareLbs × rate
  pattyLbs: number;      // 0 when they didn't ask for patties
  pattyCharge: number;   // the butcher's patty fee, which we collect and pass on
  total: number;         // beefTotal + pattyCharge — the whole bill
  deposit: number;
  balance: number;       // what's left after the deposit — invoiced, paid online before pickup
  saved: number;         // versus the standard rate, 0 when not adjusted
}

/** Pounds of ground going to patties, from the cut sheet's "40 lb". */
function pattyPounds(a?: CutSheetAnswers | null): number {
  if (!a?.patties) return 0;
  const lbs = parseInt(a.pattyLbs ?? "", 10);
  return Number.isFinite(lbs) && lbs > 0 ? lbs : PATTY_MIN_LBS;
}

/** What a bill takes off for the deposit: only a deposit on file.
    Orders from before the deposit gate were reserved whether or not
    anyone paid, so the amount they were placed with proves nothing.
    Mirrors depositCredit_() in apps-script/Code.gs. */
export function depositCredit(o: Pick<Order, "depositPaidAt" | "depositAmount">): number {
  return o.depositPaidAt ? (o.depositAmount ?? DEPOSIT) : 0;
}

/** Null until the steer has been weighed — there's no real number
    before that, only the estimate. */
export function finalPrice(
  share: ShareId,
  steer?: Pick<Steer, "hangingWeight" | "rate"> | null,
  cutSheet?: CutSheetAnswers | null,
  groupFrac?: number,
  deposit = DEPOSIT,
  season?: SeasonId | null,
): FinalPrice | null {
  const hangingLbs = steer?.hangingWeight;
  if (!hangingLbs || hangingLbs <= 0) return null;

  /* Seasons sold before tiers: the steer's rate (or $6.00) is the rate,
     flat, for every share — the deal those customers were quoted. */
  const flat = flatRateSeason(season);
  /* the tier sets the list rate; a heavy-steer discount (entered on the
     steer as a whole-share rate) comes off every tier by the same amount */
  const tier = flat ? share : tierFor(share, groupFrac);
  const standardRate = flat ? HANGING_RATE : SHARE_RATES[tier];
  const steerRate = steer?.rate && steer.rate > 0 ? steer.rate : 0;
  const steerDiscount = flat ? 0 : steerRate ? Math.max(0, Math.round((SHARE_RATES.whole - steerRate) * 100) / 100) : 0;
  const rate = flat ? (steerRate || HANGING_RATE) : Math.round((standardRate - steerDiscount) * 100) / 100;
  const shareLbs = Math.round(hangingLbs * SHARES[share].frac);
  const total = Math.round(shareLbs * rate);
  const adjusted = flat ? rate < standardRate : steerDiscount > 0;

  /* The patty fee is the butcher's, but it reaches them through us —
     the customer writes one check, to the ranch. */
  const pattyLbs = pattyPounds(cutSheet);
  const pattyCharge = Math.round(pattyLbs * PATTY_RATE);
  const billTotal = total + pattyCharge;

  return {
    rate,
    standardRate,
    tier,
    groupFrac: flat ? SHARES[share].frac : (groupFrac ?? SHARES[share].frac),
    groupUnlocked: tier !== share,
    adjusted,
    /* only call the weight the reason when the weight actually is one */
    heavy: adjusted && hangingLbs > HANGING_TYP,
    hangingLbs,
    shareLbs,
    beefTotal: total,
    pattyLbs,
    pattyCharge,
    total: billTotal,
    deposit,
    balance: billTotal - deposit,
    saved: adjusted ? Math.round(shareLbs * (standardRate - rate)) : 0,
  };
}

/** The customer-facing explanation for a reduced rate. Null when
    there's nothing to explain. */
export function rateNote(p: FinalPrice | null): string | null {
  if (!p || !p.adjusted) return null;
  const from = `$${p.standardRate.toFixed(2)}`;
  const to = `$${p.rate.toFixed(2)}`;
  return p.heavy
    ? `Your steer came in at ${p.hangingLbs} lb hanging — heavier than our typical animal. `
      + `Because of that we've brought your price down from ${from} to ${to} per pound, `
      + `which saves you ${money(p.saved)} against our standard rate.`
    : `We've brought your price down from ${from} to ${to} per pound on this animal, `
      + `which saves you ${money(p.saved)} against our standard rate.`;
}
