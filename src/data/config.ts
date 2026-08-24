/* ============================================================
   Christensen Ranch — product & pricing configuration
   Processor: Colorado Custom Meat Co, Kersey CO. Pickup only.

   ⚠ Rates marked PLACEHOLDER must be confirmed with the ranch
   before launch. Everything else is real structure.
   ============================================================ */

export type ShareId = "quarter" | "half" | "whole";

export interface Share {
  id: ShareId;
  label: string;
  frac: number;
  quarters: number; // how many quarter-slots of a cow this fills
  hanging: string;
  hangingMid: number; // midpoint hanging lbs, for estimates
  takehome: string;
  takehomeMid: number;
  freezer: string;
  feeds: string;
  deposit: number; // PLACEHOLDER
  pricePerLb: number; // $/lb hanging weight — PLACEHOLDER
}

export const SHARES: Record<ShareId, Share> = {
  quarter: {
    id: "quarter", label: "Quarter", frac: 0.25, quarters: 1,
    hanging: "180–220 lb", hangingMid: 200,
    takehome: "115–145 lb", takehomeMid: 130,
    freezer: "≈ 4 cu ft", feeds: "2–3 people for about 6 months",
    deposit: 200, pricePerLb: 5.25,
  },
  half: {
    id: "half", label: "Half", frac: 0.5, quarters: 2,
    hanging: "360–440 lb", hangingMid: 400,
    takehome: "230–290 lb", takehomeMid: 260,
    freezer: "≈ 8 cu ft", feeds: "a family of 4 for about a year",
    deposit: 400, pricePerLb: 4.95,
  },
  whole: {
    id: "whole", label: "Whole", frac: 1, quarters: 4,
    hanging: "720–880 lb", hangingMid: 800,
    takehome: "460–580 lb", takehomeMid: 520,
    freezer: "≈ 16 cu ft", feeds: "a large family, or two households splitting",
    deposit: 600, pricePerLb: 4.65,
  },
};

/** Everyone in a completed split-a-cow group pays the whole-beef rate. */
export const GROUP_RATE = SHARES.whole.pricePerLb;

/** Paid directly to Colorado Custom at pickup, per hanging lb. PLACEHOLDER */
export const PROCESSING_PER_LB = 1.05;

export interface HarvestDate {
  id: string;
  month: string;
  drop: string;
  ready: string;
  deadline: string;
  left: number; // quarter-slots remaining
}

export const DATES: HarvestDate[] = [
  { id: "sep", month: "September 2026", drop: "Sep 15", ready: "Sep 29 – Oct 2", deadline: "Sep 8", left: 3 },
  { id: "oct", month: "October 2026", drop: "Oct 15", ready: "Oct 29 – Nov 1", deadline: "Oct 8", left: 6 },
  { id: "nov", month: "November 2026", drop: "Nov 15", ready: "Nov 30 – Dec 3", deadline: "Nov 8", left: 8 },
  { id: "dec", month: "December 2026", drop: "Dec 15", ready: "Dec 29 – Jan 2", deadline: "Dec 8", left: 8 },
];

/* ---------------- cut sheet decisions ----------------
   weight = approx take-home lbs from a WHOLE beef, scaled by share
   ground:true → that weight rolls into ground beef            */

/* ---------------- photography ----------------
   Royalty-free photos hotlinked from Unsplash (free commercial
   license). Swap for the ranch's own photography at launch.   */

const u = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

export const IMAGES = {
  heroPlains: u("photo-1774029991779-0654d1da02f1", 1600),
  cattleField: u("photo-1655313849536-38b4ae42bfab", 1200),
  rancher: u("photo-1619279681650-179e9ef3c22f", 1000),
  dinner: u("photo-1546964124-0cce460f38ef", 1000),
};

export interface CutOption {
  id: string;
  label: string;
  detail?: string;
  ground?: boolean;
  steak?: boolean;
  gives: string;
  costs: string;
}

export interface Decision {
  id: string;
  primal: string;
  name: string;
  weight: number;
  where: string;
  why: string;
  photo: string;
  photoAlt: string;
  /** Typical yield at the most common cut choices, per share size. */
  counts: { quarter: string; half: string; whole: string };
  options: CutOption[];
  def: string;
}

export const DECISIONS: Decision[] = [
  {
    id: "chuck", primal: "chuck", name: "Chuck", weight: 95,
    where: "The front shoulder. It works hard every day the animal is alive, so it's laced with connective tissue.",
    why: "That tissue is the whole point — melt it slowly and it turns to gelatin. Rush it and it's leather.",
    photo: u("photo-1448907503123-67254d59ca4f", 700),
    photoAlt: "Raw chuck roast",
    counts: {
      quarter: "3–4 chuck roasts + ~11 lb ground chuck",
      half: "6–8 chuck roasts + ~21 lb ground chuck",
      whole: "12–16 chuck roasts + ~43 lb ground chuck",
    },
    options: [
      { id: "roast", label: "Chuck roasts", detail: "3–4 lb each", gives: "Pot roast, birria, shredded beef. The most useful roast on the animal.", costs: "Fewer pounds of ground beef." },
      { id: "mix", label: "Half roasts, half ground", detail: "Most common choice", gives: "A few roasts plus a solid ground beef base.", costs: "Nothing, really. This is the safe pick." },
      { id: "grind", label: "Grind all of it", ground: true, gives: "Ground chuck — the best-tasting ground beef there is.", costs: "No chuck roasts at all. People regret this one in January." },
    ],
    def: "mix",
  },
  {
    id: "rib", primal: "rib", name: "Rib", weight: 30,
    where: "Along the upper back, behind the shoulder. Barely used, heavily marbled.",
    why: "This is the same muscle either way. You are choosing whether to receive it sliced or whole — you cannot have both.",
    photo: u("photo-1728042359930-c0145f0fd442", 700),
    photoAlt: "Marbled ribeye steak on butcher paper",
    counts: {
      quarter: "4–6 ribeyes, or 1 small prime rib roast",
      half: "8–12 ribeyes, or 1 prime rib + 5–6 ribeyes",
      whole: "16–24 ribeyes, or 2 prime ribs + 10–12 ribeyes",
    },
    options: [
      { id: "steak", label: "Ribeye steaks", detail: "Cut to your thickness", steak: true, gives: "The forgiving steak. Fat protects it from overcooking.", costs: "No prime rib roast. There is no holiday roast in your box." },
      { id: "roast", label: "Prime rib roast", detail: "Standing rib roast", gives: "The Christmas centerpiece. Feeds a crowd from one piece.", costs: "Zero ribeyes. Every one of them is inside that roast." },
      { id: "split", label: "One roast, rest as steaks", detail: "Recommended", steak: true, gives: "One holiday roast, plus steaks for the rest of the year.", costs: "Fewer of each than going all-in on one." },
    ],
    def: "split",
  },
  {
    id: "loin", primal: "loin", name: "Short Loin", weight: 32,
    where: "The middle of the back. Two muscles sit on either side of the spine: the strip on top, the tenderloin underneath.",
    why: "A T-bone is those two muscles still joined by the bone. Cut the bone out and you get a NY strip and a filet. Same meat, one decision.",
    photo: u("photo-1551028150-64b9f398f678", 700),
    photoAlt: "Raw T-bone steak",
    counts: {
      quarter: "4–5 T-bones, or 3–4 NY strips + 2–3 filets",
      half: "8–10 T-bones, or 6–8 NY strips + 4–5 filets",
      whole: "16–20 T-bones, or 12–16 NY strips + 8–10 filets",
    },
    options: [
      { id: "tbone", label: "T-bones & Porterhouse", detail: "Bone-in, both muscles", steak: true, gives: "Two steaks in one, and the bone adds flavor.", costs: "No separate NY strips. No filet mignon. They're in the T-bone." },
      { id: "split", label: "NY Strip + Filet, separated", detail: "Boneless", steak: true, gives: "Clean strips and true filet mignon steaks.", costs: "No T-bones or porterhouse, ever." },
    ],
    def: "split",
  },
  {
    id: "sirloin", primal: "sirloin", name: "Sirloin", weight: 34,
    where: "Behind the loin, ahead of the hip. Leaner, and it does more work than the loin.",
    why: "The weeknight steak. Not as tender as loin cuts, but it takes marinade well and costs you nothing extra.",
    photo: u("photo-1603048297172-c92544798d5a", 700),
    photoAlt: "Raw sirloin steak",
    counts: {
      quarter: "2–3 sirloin steaks",
      half: "5–7 sirloin steaks",
      whole: "10–14 sirloin steaks",
    },
    options: [
      { id: "steak", label: "Sirloin steaks", detail: "Cut to your thickness", steak: true, gives: "Everyday grilling steaks. The ones you don't feel guilty using.", costs: "Fewer roasts and less ground." },
      { id: "roast", label: "Sirloin roasts", detail: "3–4 lb each", gives: "Lean roast beef, good for slicing thin for sandwiches.", costs: "No sirloin steaks." },
      { id: "grind", label: "Grind it", ground: true, gives: "Very lean ground beef.", costs: "You're grinding a perfectly good steak. Think twice." },
    ],
    def: "steak",
  },
  {
    id: "round", primal: "round", name: "Round", weight: 70,
    where: "The hind leg. The largest section on the animal and the leanest.",
    why: "Almost no fat. Roasted whole it's dry unless you're careful — which is why most people grind at least part of it.",
    photo: u("photo-1547050605-2f268cd5daf0", 700),
    photoAlt: "Lean round roast",
    counts: {
      quarter: "1–2 round roasts + ~8 lb lean ground",
      half: "2–4 round roasts + ~16 lb lean ground",
      whole: "5–8 round roasts + ~32 lb lean ground",
    },
    options: [
      { id: "roast", label: "Rump & round roasts", detail: "3–4 lb each", gives: "Lean roasts. Good sliced thin for French dip.", costs: "A lot of freezer space in roasts you may not reach for." },
      { id: "mix", label: "Some roasts, rest ground", detail: "Recommended", ground: true, gives: "A couple of roasts plus a big lift to your ground beef total.", costs: "Nothing. Most people land here." },
      { id: "cube", label: "Cube steaks & stew meat", detail: "Tenderized / diced", gives: "Chicken-fried steak and stew cubes, already prepped.", costs: "No round roasts." },
      { id: "grind", label: "Grind all of it", detail: "Maximum ground beef", ground: true, gives: "The single biggest boost to your ground beef pounds.", costs: "No roasts, no stew meat from the hind leg." },
    ],
    def: "mix",
  },
  {
    id: "brisket", primal: "brisket", name: "Brisket", weight: 22,
    where: "The chest, under the front shoulder. Cattle have no collarbone, so this muscle carries the animal's weight.",
    why: "Tough, and worth it. Twelve hours of smoke turns it into the best thing you'll cook all year. Or grind it and never think about it again.",
    photo: u("photo-1583549323189-5a3335634f4e", 700),
    photoAlt: "Whole packer brisket",
    counts: {
      quarter: "Half a brisket (flat or point, ~4–6 lb)",
      half: "1 whole packer brisket (~10–12 lb)",
      whole: "2 whole packer briskets",
    },
    options: [
      { id: "whole", label: "Keep whole", detail: "Packer brisket", gives: "One large brisket per side. The barbecue cut.", costs: "It's a project. If you won't smoke it, it sits in the freezer." },
      { id: "half", label: "Cut in half", detail: "Flat and point separated", gives: "Two manageable pieces instead of one 12-pounder.", costs: "Harder to smoke as one true packer." },
      { id: "grind", label: "Grind it", ground: true, gives: "Brisket makes exceptional burger. Genuinely.", costs: "No brisket. Pitmasters will be disappointed in you." },
    ],
    def: "whole",
  },
  {
    id: "shortrib", primal: "plate", name: "Short Ribs & Plate", weight: 18,
    where: "The lower rib cage and belly, below the rib section.",
    why: "Fatty and rich. Braised short ribs are restaurant food you can make at home.",
    photo: u("photo-1695088224287-bb10a886fce4", 700),
    photoAlt: "Bone-in short ribs",
    counts: {
      quarter: "4–5 short rib pieces (~4 lb)",
      half: "8–10 short rib pieces (~9 lb)",
      whole: "16–20 short rib pieces (~18 lb)",
    },
    options: [
      { id: "english", label: "English cut short ribs", detail: "Thick, bone-in", gives: "Braising ribs. Fall-apart in a Dutch oven.", costs: "Fewer ground pounds." },
      { id: "korean", label: "Korean / flanken cut", detail: "Thin, cross-cut", gives: "Kalbi. Quick on a hot grill, kids eat them with their hands.", costs: "Too thin to braise." },
      { id: "grind", label: "Grind it", ground: true, gives: "Fatty trim that makes ground beef taste better.", costs: "No short ribs." },
    ],
    def: "english",
  },
  {
    id: "flank", primal: "flank", name: "Flank, Skirt & Tri-Tip", weight: 16,
    where: "The abdominal wall and the bottom of the sirloin. Thin, grainy muscles.",
    why: "Fajitas, carne asada, stir-fry. These need a hot fire and a sharp knife across the grain.",
    photo: u("photo-1652690772694-ac68867c30f1", 700),
    photoAlt: "Flank steak showing long grain",
    counts: {
      quarter: "1–2 of the three (rotates fairly by side)",
      half: "1 flank + 1 skirt + 1 tri-tip",
      whole: "2 flanks + 2 skirts + 2 tri-tips",
    },
    options: [
      { id: "keep", label: "Keep them whole", detail: "Flank, skirt, tri-tip", gives: "Three distinct cuts that cook fast on a weeknight.", costs: "You have to slice them correctly or they're chewy." },
      { id: "grind", label: "Grind them", ground: true, gives: "More ground beef, no learning curve.", costs: "You lose the best fast-cooking cuts on the animal." },
    ],
    def: "keep",
  },
  {
    id: "shank", primal: "shank", name: "Shanks & Soup Bones", weight: 16,
    where: "The lower legs, and the bones left after cutting.",
    why: "Marrow and collagen. This is where broth comes from.",
    photo: u("photo-1628543108325-1c27cd7246b3", 700),
    photoAlt: "Cross-cut beef shank with marrow bone",
    counts: {
      quarter: "2–3 cross-cut shanks + soup bones",
      half: "4–6 cross-cut shanks + soup bones",
      whole: "8–12 cross-cut shanks + soup bones",
    },
    options: [
      { id: "osso", label: "Cross-cut shanks", detail: "Osso buco style", gives: "Osso buco, and marrow bones for stock.", costs: "Takes freezer room." },
      { id: "bones", label: "Soup bones only", detail: "Cut for stock", gives: "Bone broth for the whole year.", costs: "No osso buco." },
      { id: "grind", label: "Grind, skip the bones", ground: true, gives: "A few more pounds of ground.", costs: "No bones. Broth people will mourn." },
    ],
    def: "grind",
  },
];

export const GROUND_BASE = 110; // whole-beef trim that always grinds

export const THICKNESS = [
  { id: "0.75", label: '3/4"', per: 0.6, note: "Thin. Fast and easy to overcook." },
  { id: "1", label: '1"', per: 0.85, note: "The default. Hard to get wrong." },
  { id: "1.5", label: '1 1/2"', per: 1.25, note: "Steakhouse thickness. Best sear-to-center ratio." },
  { id: "2", label: '2"', per: 1.7, note: "A shared steak. Needs a reverse sear." },
];

export const PKG = [
  { id: "1", label: "1 lb", note: "Two burgers, or taco night for two." },
  { id: "1.5", label: "1 1/2 lb", note: "Most-picked size. Meatloaf or chili for four." },
  { id: "2", label: "2 lb", note: "Big-batch cooking. Fewer packages to thaw." },
];

export const ORGANS = [
  { id: "liver", label: "Liver", note: "Sliced and frozen flat." },
  { id: "heart", label: "Heart", note: "Lean, tastes like steak. Grills well." },
  { id: "tongue", label: "Tongue", note: "Braised for tacos de lengua." },
  { id: "oxtail", label: "Oxtail", note: "Best braising cut on the animal." },
  { id: "bones", label: "Extra soup bones", note: "Beyond what's in your shank choice." },
  { id: "tallow", label: "Fat for rendering", note: "Make your own tallow." },
];

/* ---------------- standard ranch cut ----------------
   No custom cut sheets — every share is cut to the butcher's
   proven standard list.                                       */

export const STANDARD_CUT = [
  { k: "Steaks", v: 'Ribeyes, NY strips, filets & sirloins · 1" thick, 2 per pack' },
  { k: "Roasts", v: "Chuck & round roasts · 3 lb each" },
  { k: "Brisket", v: "Halved — flat and point" },
  { k: "Short ribs", v: "English cut, bone-in" },
  { k: "Fast cuts", v: "Flank, skirt & tri-tip, kept whole" },
  { k: "Shanks", v: "Cross-cut with marrow bone" },
  { k: "Ground beef", v: "Everything else · 1½ lb packs, ~40% of your box" },
  { k: "Organs & bones", v: "Free on request at pickup — just tell us" },
];

/* Typical Front Range grocery prices, for the comparison table.
   PLACEHOLDER — spot-check against a local store before launch. */
export const STORE_COMPARE = [
  { cut: "Ribeye steak", store: 17.99 },
  { cut: "Filet mignon", store: 24.99 },
  { cut: "NY strip", store: 15.99 },
  { cut: "Brisket", store: 6.99 },
  { cut: "Chuck roast", store: 8.49 },
  { cut: "Ground beef", store: 5.99 },
];

export const RANCH_PHONE = "970-645-1339";
export const PROCESSOR = {
  name: "Colorado Custom Meat Co",
  address: "443 4th Street, Kersey CO 80644",
  phone: "970-356-2333",
};

export const money = (n: number) =>
  "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export const money2 = (n: number) =>
  "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
