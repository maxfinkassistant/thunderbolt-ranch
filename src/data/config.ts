/* ============================================================
   Thunderbolt Ranch — product & pricing configuration
   Source of truth: Thunderbolt_Ranch_Beef_Order_Info one-pager
   + the CCMC beef cutting instructions form.

   Processor/pickup: Colorado Custom Meat Co, Kersey CO.
   Payment: Thunderbolt Ranch LLC (deposit + balance).
   ============================================================ */

export type ShareId = "quarter" | "half" | "whole";

/* One price for every share size. */
export const HANGING_RATE = 6.0;        // $/lb hanging weight
export const TAKEHOME_RATE_EST = 8.57;  // $/lb take-home estimate
export const DEPOSIT = 250;             // flat, all share sizes

/* Typical 1,500 lb animal (one-pager: estimates, not promises). */
export const LIVE_TYP = 1500;
export const HANGING_TYP = 900;   // 60% of live
export const TAKEHOME_TYP = 630;  // 70% of hanging

/* USDA national retail averages, April 2026 (one-pager). */
export const USDA_CHOICE = 10.47;
export const USDA_ALL_FRESH = 9.64;

export interface Share {
  id: ShareId;
  label: string;
  frac: number;
  hanging: number;   // lbs, typical
  takehome: number;  // lbs, typical
  total: number;     // $ = hanging × $6
  freezer: string;
  feeds: string;
}

export const SHARES: Record<ShareId, Share> = {
  quarter: {
    id: "quarter", label: "Quarter", frac: 0.25,
    hanging: 225, takehome: 157, total: 1350,
    freezer: "≈ 5 cu ft", feeds: "2–3 people for about 6 months",
  },
  half: {
    id: "half", label: "Half", frac: 0.5,
    hanging: 450, takehome: 315, total: 2700,
    freezer: "≈ 10 cu ft", feeds: "a family of 4 for about a year",
  },
  whole: {
    id: "whole", label: "Whole", frac: 1,
    hanging: 900, takehome: 630, total: 5400,
    freezer: "≈ 20 cu ft", feeds: "a large family, or two households",
  },
};

export const balanceAtPickup = (s: Share) => s.total - DEPOSIT;

/* ---------------- this harvest ---------------- */

export const HARVEST = {
  label: "October 2026",
  orderBy: "September 30",
  killDate: "September 16, 2026",
  hangWindow: "Sept 16 – 30",
  processed: "September 30",
  ready: "Week of October 1",
  storageNote: "Please plan to pick up during the week of Oct 1 — a $10/day storage fee applies after that grace period.",
};

export const PROCESSOR = {
  name: "Colorado Custom Meat Co",
  address: "443 4th Street, Kersey CO 80644",
  phone: "970-356-2333",
  cutSheetEmail: "order@ccmeatco.com",
};

export const RANCH_CONTACT = { name: "Josh", phone: "402-245-8195", email: "thunderboltbeef@gmail.com" };
export const PAYABLE_TO = "Thunderbolt Ranch LLC";

/* ---------------- brand copy (substantiated only) ----------------
   Approved claims: Colorado cattle / ranch / butcher; Angus;
   pasture-raised in Colorado; grain-finished; ownership from
   conception to harvest; no sale barns, no middlemen; one animal;
   Choice or Prime typical grading; Ranch to Table.               */

export const TAGLINE = "Ranch to Table";
export const STORY =
  "Most beef at the store is a blend of dozens of different animals. When you buy from Thunderbolt Ranch, your steaks, roasts, and ground beef all come from one Angus animal — pasture-raised right here in Colorado, then grain-finished for rich marbling and flavor. We maintain ownership from conception to harvest — no sale barns, no middlemen. Just our ranch, straight to your freezer.";
export const QUALITY =
  "Typically grades Choice or Prime. Angus genetics, pasture-raised on our ranch and grain-finished on our Colorado pens, processed locally.";

/* ---------------- photography ----------------
   Royalty-free stand-ins (Unsplash hotlinks + a public-domain
   Angus conformation photo, warm-toned, in /public). Swap for
   ranch photos when available.                                 */

const u = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

export const IMAGES = {
  heroPlains: u("photo-1774029991779-0654d1da02f1", 1600),
  cattleField: u("photo-1655313849536-38b4ae42bfab", 1200),
  dinner: u("photo-1546964124-0cce460f38ef", 1000),
};

/* ============================================================
   THE CUT SHEET WIZARD
   Mirrors the CCMC cutting-instructions form, one decision at a
   time. Counts are estimates for a typical animal; steak counts
   scale with thickness. Everything is vacuum packed.
   ============================================================ */

export const THICKNESS_OPTIONS = [
  { id: "3/4", label: '3/4"', inches: 0.75, note: "Thin and fast-cooking — easy to overcook." },
  { id: "1", label: '1"', inches: 1, note: "The default. Hard to get wrong." },
  { id: "1 1/4", label: '1 1/4"', inches: 1.25, note: "Steakhouse thickness — best sear-to-center ratio." },
  { id: "1 1/2", label: '1 1/2"', inches: 1.5, note: "Thick. Sear then finish over low heat." },
  { id: "2", label: '2"', inches: 2, note: "A showpiece to share. Reverse-sear it." },
];

export const PER_PACKAGE_OPTIONS = ["1", "2", "3", "4"];
export const ROAST_SIZE_OPTIONS = ["2 lb", "3 lb", "4 lb"];

/* A steak-capable cut: lbs available from a WHOLE animal (range)
   and roughly how many lbs one 1"-thick steak weighs. */
export interface SteakYield {
  lbsWhole: [number, number];
  lbPerInch: number;
}

export function steakCount(y: SteakYield, frac: number, inches: number): [number, number] {
  const lo = Math.max(1, Math.floor((y.lbsWhole[0] * frac) / (y.lbPerInch * inches)));
  const hi = Math.max(lo, Math.ceil((y.lbsWhole[1] * frac) / (y.lbPerInch * inches)));
  return [lo, hi];
}

export function roastCount(lbsWhole: [number, number], frac: number, roastLb = 3): [number, number] {
  const lo = Math.max(1, Math.floor((lbsWhole[0] * frac) / roastLb));
  const hi = Math.max(lo, Math.ceil((lbsWhole[1] * frac) / roastLb));
  return [lo, hi];
}

/* ---------------- wizard steps ---------------- */

export type CutMode = "roast" | "steak" | "grind";

export interface MainCutDef {
  id: string;              // key in answers
  name: string;
  where: string;           // plain-language anatomy
  help: string;            // the friendly explainer
  modes: CutMode[];        // which of roast/steak/grind apply
  yield?: SteakYield;      // for steak mode counts
  roastLbs?: [number, number]; // lbs whole for roast counts
  defMode: CutMode;
  popular: CutMode;        // gets the "Most popular" badge
}

export const MAIN_CUTS: MainCutDef[] = [
  {
    id: "chuck", name: "Chuck",
    where: "The front shoulder — the biggest working muscle on the animal.",
    help: "Chuck roast is the pot-roast, birria, and shredded-beef cut: slow heat melts it into the most useful roast in your freezer. Chuck steaks are the budget grilling option. Ground, it makes the best-tasting burger there is — but you give up the roasts to get it.",
    modes: ["roast", "steak", "grind"],
    yield: { lbsWhole: [55, 75], lbPerInch: 1.3 },
    roastLbs: [55, 75],
    defMode: "roast", popular: "roast",
  },
  {
    id: "arm", name: "Arm",
    where: "Just below the chuck, on the front leg.",
    help: "A dense, beefy roast that shines in the slow cooker or cut into stew. Most folks send this one to the grinder and let the chuck cover their roasts.",
    modes: ["roast", "grind"],
    roastLbs: [10, 16],
    defMode: "grind", popular: "grind",
  },
  {
    id: "sirloin", name: "Sirloin",
    where: "Behind the loin, ahead of the hip.",
    help: "The weeknight steak — leaner than a ribeye, takes a marinade beautifully, and you won't feel guilty tossing it on a Tuesday grill. Sirloin roasts slice thin for sandwiches.",
    modes: ["steak", "roast"],
    yield: { lbsWhole: [18, 26], lbPerInch: 1.4 },
    roastLbs: [18, 26],
    defMode: "steak", popular: "steak",
  },
  {
    id: "sirlointip", name: "Sirloin Tip",
    where: "The front of the hind leg.",
    help: "Lean and fine-grained. As a steak it wants a marinade; as a roast it makes excellent thin-sliced roast beef.",
    modes: ["steak", "roast"],
    yield: { lbsWhole: [10, 15], lbPerInch: 0.9 },
    roastLbs: [10, 15],
    defMode: "steak", popular: "steak",
  },
  {
    id: "topround", name: "Top Round",
    where: "The inside of the hind leg — big and lean.",
    help: "The classic roast-beef and London-broil cut. Roasted and sliced thin it's a deli counter in your freezer. Most folks grind it — it's the fastest way to build a real burger pile.",
    modes: ["roast", "steak", "grind"],
    yield: { lbsWhole: [20, 30], lbPerInch: 1.5 },
    roastLbs: [20, 30],
    defMode: "grind", popular: "grind",
  },
  {
    id: "btmround", name: "Bottom Round",
    where: "The outside of the hind leg.",
    help: "A little tougher than top round — made for pot roast, rump roast, and jerky. Most folks grind it and keep their roasts coming from the chuck.",
    modes: ["roast", "grind"],
    roastLbs: [18, 26],
    defMode: "grind", popular: "grind",
  },
];

/* Rib section: three ways, pick one. */
export const RIB_CHOICES = [
  {
    id: "prime", label: "Prime rib roast",
    gives: "The holiday centerpiece — a standing rib roast that feeds a crowd.",
    costs: "No rib steaks. Every one of them is inside that roast.",
  },
  {
    id: "ribsteak", label: "Rib steaks (bone-in)",
    gives: "Ribeyes with the bone still on — more flavor at the grill, great presentation.",
    costs: "No prime rib roast, and the bone takes up freezer space.",
  },
  {
    id: "ribeye", label: "Ribeyes (boneless)",
    gives: "The classic. Marbled, forgiving, the steak most people picture.",
    costs: "No prime rib roast, no bone-in drama.",
  },
] as const;

export const RIB_YIELD: SteakYield = { lbsWhole: [16, 24], lbPerInch: 0.85 };
export const RIB_ROAST_LBS: [number, number] = [14, 20];

/* Loin: T-bone or NY strip (+ freed tenderloin). */
export const LOIN_CHOICES = [
  {
    id: "tbone", label: "T-bones",
    gives: "Two steaks in one — strip on one side of the bone, filet on the other.",
    costs: "No separate NY strips or filet mignon; they're inside the T-bone.",
  },
  {
    id: "strip", label: "NY strips + filets, separated",
    gives: "Clean boneless strips, plus true filet mignon cut from the tenderloin.",
    costs: "No T-bones, ever.",
  },
] as const;

export const TBONE_YIELD: SteakYield = { lbsWhole: [18, 26], lbPerInch: 1.1 };
export const STRIP_YIELD: SteakYield = { lbsWhole: [12, 18], lbPerInch: 0.85 };
export const FILET_YIELD: SteakYield = { lbsWhole: [4, 7], lbPerInch: 0.45 };

/* Keep-or-grind cuts (the CCMC Yes/Grind list), grouped. */
export interface ExtraCutDef {
  id: string;         // maps to PDF field suffix
  name: string;
  help: string;
  popular: "yes" | "grind";   // badged, but never pre-selected
}

export interface ExtraGroup {
  id: string;
  title: string;
  intro: string;
  cuts: ExtraCutDef[];
}

export const EXTRA_GROUPS: ExtraGroup[] = [
  {
    id: "bbq", title: "The barbecue cuts",
    intro: "The low-and-slow projects. Keep them if you smoke or braise; grind them if you don't.",
    cuts: [
      { id: "brisket", name: "Brisket", help: "The chest. Twelve hours of smoke turns it into the best thing you'll cook all year — or it makes exceptional burger.", popular: "yes" },
      { id: "shortribs", name: "Short ribs (English cut)", help: "Thick, bone-in braising ribs. Fall-apart tender in a Dutch oven.", popular: "yes" },
      { id: "koreanribs", name: "Korean ribs (flanken cut)", help: "The same ribs cut thin across the bone for kalbi — quick on a hot grill.", popular: "grind" },
      { id: "shanks", name: "Shanks", help: "Cross-cut with the marrow bone — osso buco, and the backbone of real broth.", popular: "yes" },
    ],
  },
  {
    id: "fast", title: "The fast-cooking cuts",
    intro: "Thin, grainy, full of flavor — fajitas, carne asada, stir-fry. Hot fire, sliced across the grain.",
    cuts: [
      { id: "flank", name: "Flank steak", help: "The fajita cut. One per side of beef.", popular: "yes" },
      { id: "skirtsteak", name: "Skirt steak", help: "The carne asada cut — the most flavor per ounce on the animal.", popular: "yes" },
      { id: "tritip", name: "Tri-tip", help: "The Santa Maria roast — grills like a giant steak, slices like a roast.", popular: "yes" },
      { id: "flatiron", name: "Flat iron", help: "Cut from the shoulder — surprisingly tender, great on a grill.", popular: "yes" },
    ],
  },
  {
    id: "workhorse", title: "The workhorse cuts",
    intro: "Not glamorous — just dinner, prepped and ready. Most folks send these to the grinder.",
    cuts: [
      { id: "cubesteak", name: "Cube steak", help: "Round steak run through the tenderizer — chicken-fried steak night, solved.", popular: "grind" },
      { id: "stewmeat", name: "Stew meat", help: "Pre-cubed for chili and stew. No knife work on a weeknight.", popular: "grind" },
      { id: "eyeofround", name: "Eye of round", help: "A very lean little roast — best sliced thin, or ground if lean roasts aren't your thing.", popular: "grind" },
    ],
  },
];

export const GROUND_PACK_OPTIONS = [
  { id: "1", label: "1 lb", note: "Two burgers, or taco night for two.", popular: true },
  { id: "1.5", label: "1 1/2 lb", note: "Meatloaf or chili for four.", popular: false },
  { id: "2", label: "2 lb", note: "Big-batch cooking, fewer packages to thaw.", popular: false },
];

/* Patty sizes, spelled out in pounds so nobody has to do the math. */
export const PATTY_SIZES = [
  { id: "4oz", label: "4 oz", note: "A quarter-pound burger." },
  { id: "5oz", label: "5 oz", note: "A third-pounder, near enough." },
  { id: "8oz", label: "8 oz", note: "A half-pound burger." },
];

/* How much of the ground goes to patties. The butcher's minimum is 30 lb. */
export const PATTY_MIN_LBS = 30;
export const PATTY_LB_OPTIONS = ["30 lb", "40 lb", "50 lb", "60 lb"];
export const PATTY_NOTE = "30 lb minimum · $0.50/lb additional, per the butcher's fee schedule.";

export const ORGANS = [
  { id: "liver", label: "Liver", note: "Sliced and frozen flat." },
  { id: "heart", label: "Heart", note: "Lean — tastes like steak, grills well." },
  { id: "tongue", label: "Tongue", note: "Braised for tacos de lengua." },
  { id: "oxtail", label: "Ox tail", note: "The best braising cut on the animal." },
  { id: "soupbones", label: "Soup bones", note: "Bone broth for the year." },
  { id: "bones", label: "Bones", note: "Extra bones beyond the soup cut." },
];

/* Fat for tallow is a special request — it is not a box on the CCMC form,
   so it rides along on the special-requests page and the call to the butcher. */
export const TALLOW = {
  label: "Fat for tallow",
  note: "Ask for the trimmed fat and render your own tallow — the best thing you'll ever fry a potato in. Not a box on the butcher's form, so we send it over as a special request.",
};

/* ---------------- primal map (landing/how-it-works) ---------------- */

export interface Primal {
  id: string;
  name: string;
  where: string;
  photo: string;
  photoAlt: string;
  counts: Record<ShareId, string>;
}

export const PRIMALS: Primal[] = [
  {
    id: "chuck", name: "Chuck",
    where: "The front shoulder. Chuck roasts, chuck steaks, or the best ground beef there is.",
    photo: u("photo-1448907503123-67254d59ca4f", 700), photoAlt: "Raw chuck roast",
    counts: { quarter: "4–6 chuck roasts, or ~15 lb ground", half: "9–12 chuck roasts, or ~32 lb ground", whole: "18–25 chuck roasts, or ~65 lb ground" },
  },
  {
    id: "rib", name: "Rib",
    where: "Prime rib roast, bone-in rib steaks, or boneless ribeyes — your call on the cut sheet.",
    photo: u("photo-1728042359930-c0145f0fd442", 700), photoAlt: "Marbled ribeye steak on butcher paper",
    counts: { quarter: '4–7 ribeyes at 1", or 1 small prime rib', half: '9–14 ribeyes at 1", or 1–2 prime ribs', whole: '19–28 ribeyes at 1", or 2 prime ribs' },
  },
  {
    id: "loin", name: "Short Loin",
    where: "T-bones — or NY strips plus true filet mignon, separated.",
    photo: u("photo-1551028150-64b9f398f678", 700), photoAlt: "Raw T-bone steak",
    counts: { quarter: '4–6 T-bones at 1", or 3–6 strips + 2–4 filets', half: '8–12 T-bones at 1", or 7–11 strips + 4–8 filets', whole: '16–24 T-bones at 1", or 14–21 strips + 9–16 filets' },
  },
  {
    id: "sirloin", name: "Sirloin",
    where: "The weeknight steaks, plus the sirloin tip.",
    photo: u("photo-1603048297172-c92544798d5a", 700), photoAlt: "Raw sirloin steak",
    counts: { quarter: "3–5 sirloin steaks + tip roast", half: "6–9 sirloin steaks + tip roasts", whole: "13–19 sirloin steaks + tip roasts" },
  },
  {
    id: "round", name: "Round",
    where: "Top round, bottom round, eye of round — the lean roasts, cube steak, and a lot of ground.",
    photo: u("photo-1547050605-2f268cd5daf0", 700), photoAlt: "Lean round roast",
    counts: { quarter: "2–4 roasts + cube steak + ~10 lb ground", half: "4–7 roasts + cube steak + ~20 lb ground", whole: "8–14 roasts + cube steak + ~40 lb ground" },
  },
  {
    id: "brisket", name: "Brisket",
    where: "The chest. The barbecue project.",
    photo: u("photo-1583549323189-5a3335634f4e", 700), photoAlt: "Whole packer brisket",
    counts: { quarter: "Half a brisket (~4–6 lb)", half: "1 brisket (~10–12 lb)", whole: "2 briskets" },
  },
  {
    id: "plate", name: "Short Ribs & Plate",
    where: "English-cut or Korean-cut short ribs, plus skirt steak.",
    photo: u("photo-1695088224287-bb10a886fce4", 700), photoAlt: "Bone-in short ribs",
    counts: { quarter: "4–5 rib pieces + skirt", half: "8–10 rib pieces + skirt", whole: "16–20 rib pieces + 2 skirts" },
  },
  {
    id: "flank", name: "Flank & Tri-Tip",
    where: "The fast-cooking cuts — fajitas, carne asada, Santa Maria tri-tip.",
    photo: u("photo-1652690772694-ac68867c30f1", 700), photoAlt: "Flank steak showing long grain",
    counts: { quarter: "1–2 of flank / skirt / tri-tip / flat iron", half: "1 each: flank, skirt, tri-tip, flat iron", whole: "2 each: flank, skirt, tri-tip, flat iron" },
  },
  {
    id: "shank", name: "Shanks & Bones",
    where: "Cross-cut shanks with marrow, soup bones, and the broth program.",
    photo: u("photo-1628543108325-1c27cd7246b3", 700), photoAlt: "Cross-cut beef shank with marrow bone",
    counts: { quarter: "2–3 cross-cut shanks + bones", half: "4–6 cross-cut shanks + bones", whole: "8–12 cross-cut shanks + bones" },
  },
];

/* ---------------- versus the grocery store ----------------
   Per-cut shelf prices for the savings table. These are SURVEY
   ESTIMATES for Front Range grocery stores, calibrated so the
   weighted average lands near the USDA Choice retail average
   already quoted on the site (USDA_CHOICE, above). Replace the
   `retail` numbers with real observed shelf prices before leaning
   on the savings figure in advertising.

   `lbsWhole` is the take-home pounds of that cut from one typical
   animal; the list sums to TAKEHOME_TYP.                        */

export interface GroceryCut {
  id: string;
  name: string;
  store: string;     // what it's called at the store
  retail: number;    // $/lb on the shelf
  lbsWhole: number;  // take-home lbs from a whole animal
}

export const GROCERY_CUTS: GroceryCut[] = [
  { id: "rib",     name: "Ribeye & rib steaks",     store: "Choice ribeye",            retail: 21.99, lbsWhole: 20 },
  { id: "loin",    name: "T-bone, strip & filet",   store: "Choice T-bone / strip",    retail: 19.99, lbsWhole: 25 },
  { id: "sirloin", name: "Sirloin steaks",          store: "Choice top sirloin",       retail: 13.99, lbsWhole: 22 },
  { id: "fast",    name: "Flank, skirt & tri-tip",  store: "Flank / skirt / tri-tip",  retail: 15.99, lbsWhole: 20 },
  { id: "roast",   name: "Chuck & round roasts",    store: "Chuck / rump roast",       retail: 9.99,  lbsWhole: 120 },
  { id: "stew",    name: "Stew meat & cube steak",  store: "Beef stew meat",           retail: 10.49, lbsWhole: 25 },
  { id: "ribs",    name: "Short ribs & shanks",     store: "Bone-in short ribs",       retail: 9.99,  lbsWhole: 28 },
  { id: "brisket", name: "Brisket",                 store: "Whole packer brisket",     retail: 9.49,  lbsWhole: 20 },
  { id: "ground",  name: "Ground beef",             store: "85/15 ground beef",        retail: 8.49,  lbsWhole: 350 },
];

export interface SavingsRow {
  cut: GroceryCut;
  lbs: number;      // in this share
  yours: number;    // $ you pay for those lbs
  store: number;    // $ the same lbs cost at the store
  saved: number;
}

export function savingsFor(share: ShareId): { rows: SavingsRow[]; totals: { lbs: number; yours: number; store: number; saved: number; storePerLb: number } } {
  const frac = SHARES[share].frac;
  const rows = GROCERY_CUTS.map((cut) => {
    const lbs = Math.round(cut.lbsWhole * frac);
    const yours = lbs * TAKEHOME_RATE_EST;
    const store = lbs * cut.retail;
    return { cut, lbs, yours, store, saved: store - yours };
  });
  const lbs = rows.reduce((n, r) => n + r.lbs, 0);
  const yours = rows.reduce((n, r) => n + r.yours, 0);
  const store = rows.reduce((n, r) => n + r.store, 0);
  return { rows, totals: { lbs, yours, store, saved: store - yours, storePerLb: store / lbs } };
}

/* ---------------- wizard artwork ----------------
   Each cut-sheet question gets a photo of the cut plus the primal
   regions to light up on the steer photo.                        */

const primalPhoto = (id: string) => PRIMALS.find((p) => p.id === id)!;

/* the clickable regions on the steer photo, by name */
const PHOTO_REGIONS_KEYS = {
  chuck: 1, rib: 1, loin: 1, sirloin: 1, round: 1,
  brisket: 1, plate: 1, flank: 1, shank: 1,
} as const;

export interface CutMedia { photo?: string; alt?: string; regions: string[]; note?: string }

const media = (primal: string, regions: string[] = [primal]): CutMedia => {
  const p = primalPhoto(primal);
  return { photo: p.photo, alt: p.photoAlt, regions };
};

export const CUT_MEDIA: Record<string, CutMedia> = {
  rib: media("rib"),
  loin: media("loin"),
  "main:chuck": media("chuck"),
  "main:arm": media("chuck", ["chuck", "shank"]),
  "main:sirloin": media("sirloin"),
  "main:sirlointip": media("round", ["round"]),
  "main:topround": media("round"),
  "main:btmround": media("round"),
  "extras:bbq": media("brisket", ["brisket", "plate", "shank"]),
  "extras:fast": media("flank", ["flank", "plate"]),
  "extras:workhorse": media("round", ["round"]),
  /* ground comes from everywhere, so light the whole animal up */
  ground: { regions: Object.keys(PHOTO_REGIONS_KEYS), note: "Ground beef comes off every section of the animal, plus all the trim" },
  organs: media("shank", ["shank"]),
};

/* ---------------- launch wiring ----------------
   BACKEND_URL: the deployed Google Apps Script web-app URL
   (apps-script/Code.gs). Orders POST here → Google Sheet CRM +
   notification emails. Empty = local demo mode (browser only).

   STRIPE_PAYMENT_LINK: a Stripe Payment Link for the $250 deposit.
   The order code is passed as client_reference_id so payments
   reconcile against the sheet. Empty = "pay Josh directly" copy.  */

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";
export const STRIPE_PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK ?? "";

/** Base path for static assets (GitHub Pages serves under /repo/). */
export const ASSET = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, "")}`;

export const money = (n: number) =>
  "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** Signed dollars, for the savings column — a cut that costs about the
    same at the store should read as "about even", not as "$-14". */
export const moneySigned = (n: number) => {
  if (Math.abs(n) < 10) return "about even";
  return (n < 0 ? "−" : "") + money(Math.abs(n));
};

export const money2 = (n: number) =>
  "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
