/* Turn cut-sheet answers into a human-readable estimated box,
   and the money math. All counts are estimates for a typical
   1,500 lb animal, scaled by share and steak thickness. */

import {
  SHARES, MAIN_CUTS, EXTRA_GROUPS, THICKNESS_OPTIONS,
  RIB_CHOICES, LOIN_CHOICES, RIB_YIELD, RIB_ROAST_LBS,
  TBONE_YIELD, STRIP_YIELD, FILET_YIELD,
  steakCount, roastCount,
  DEPOSIT, HANGING_RATE, TAKEHOME_RATE_EST,
  type ShareId,
} from "../data/config";
import type { CutSheetAnswers } from "./store";

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
      if (a.extras[c.id] === "yes") kept.push(c.name);
      else addGround([2, 5]);
    }
  }
  if (kept.length) lines.push({ name: "Kept whole", detail: kept.join(", ") });

  /* ground */
  lines.push({
    name: "Ground beef",
    detail: `≈ ${groundLbs[0]}–${groundLbs[1]} lb · ${a.groundPack} lb packs${a.patties ? ` · some as ${a.pattySize} patties` : ""}`,
  });

  if (a.organs.length) {
    lines.push({ name: "Organs & bones", detail: a.organs.join(", ") });
  }

  return lines;
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
}

export function shareCost(share: ShareId): Cost {
  const s = SHARES[share];
  return {
    total: s.total,
    deposit: DEPOSIT,
    balance: s.total - DEPOSIT,
    hangingLbs: s.hanging,
    takehomeLbs: s.takehome,
  };
}

export { HANGING_RATE, TAKEHOME_RATE_EST };
