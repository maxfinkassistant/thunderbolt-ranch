/* Parity check: finalPrice() in src/lib/estimate.ts must match priceFor_() in apps-script/Code.gs.
   Run with `bun run parity` after any pricing change. Also pins the legacy fall-2026 deal. */
import { readFileSync } from "node:fs";
import { finalPrice, depositCredit } from "../src/lib/estimate";
const code = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const gs = new Function(code + "\n;return { priceFor_, orderFromRow_, DEPOSIT, CURRENT_SEASON };")() as any;
const shares = ["quarter", "half", "whole"] as const;
const steers = [null, { hangingWeight: 1000, rate: 0 }, { hangingWeight: 1000, rate: 5.75 }, { hangingWeight: 1100, rate: 6.25 }, { hangingWeight: 900, rate: 5.5 }];
const seasons = ["fall-2026", "winter-2027", "spring-2027"] as const;
const fracs = [undefined, 0.25, 0.5, 1];
const deposits = [250, 300, 600];
let n = 0, bad = 0;
const pick = (p: any) => p && { rate: p.rate, tier: p.tier, total: p.total, deposit: p.deposit, balance: p.balance, saved: p.saved, standardRate: p.standardRate };
/* a deposit only comes off the bill once it's on file — paid and unpaid both */
for (const season of seasons) for (const share of shares) for (const st of steers) for (const f of fracs) for (const dep of deposits) for (const paid of [true, false]) {
  n++;
  const order = { share, season, depositAmount: dep, depositPaidAt: paid ? "2026-10-04" : undefined, cutSheet: null };
  const site = pick(finalPrice(share, st, null, f, depositCredit(order), season));
  const script = pick(gs.priceFor_(order, st, f));
  const a = JSON.stringify(site), b = JSON.stringify(script);
  if (a !== b) { bad++; if (bad <= 5) console.log("MISMATCH", { season, share, st, f, dep, paid, site, script }); }
  if (st && script.deposit !== (paid ? dep : 0)) { bad++; if (bad <= 10) console.log("CREDIT", { dep, paid, script }); }
  /* legacy expectation: fall orders pay the steer's manual rate (or $6.00) flat, no tiers */
  if (season === "fall-2026" && st) {
    const want = st.rate > 0 ? st.rate : 6.0;
    if (site?.rate !== want || site?.tier !== share) { bad++; if (bad <= 10) console.log("LEGACY", { share, st, f, site }); }
  }
}
/* fall row with blank new-deposit column: deposit falls back to the row's original $250 */
const row = new Array(40).fill(""); row[2] = "reserved"; row[8] = 1500; row[9] = 250; row[10] = 1250; row[13] = JSON.stringify({ code: "TR-FALL1", share: "quarter", season: "fall-2026" }); row[15] = "fall-2026";
const o = gs.orderFromRow_(row);
if (o.depositAmount !== 250) { bad++; console.log("DEPOSIT fallback", o.depositAmount); }
/* ...but a fall row with nothing in "Deposit paid at" credits nothing; one with a date credits its $250 */
if (o.depositCredit !== 0) { bad++; console.log("DEPOSIT unpaid credit", o.depositCredit); }
row[31] = "2026-10-04T15:25:00Z";
if (gs.orderFromRow_(row).depositCredit !== 250) { bad++; console.log("DEPOSIT paid credit", gs.orderFromRow_(row).depositCredit); }
console.log(`${n} cases, ${bad} mismatches`);
