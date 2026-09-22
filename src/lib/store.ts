/* ============================================================
   Local data layer. Persists to localStorage today; shapes and
   signatures mirror the future backend so it can swap without
   touching the UI. Keys bumped to v2 for the cut-sheet-wizard
   order shape.
   ============================================================ */

import { MAIN_CUTS, EXTRA_GROUPS, type ShareId, type CutMode } from "../data/config";

/** Keep-or-grind answer. Undefined means "not answered yet" — the
    barbecue / fast / workhorse groups make people choose. */
export type KeepGrind = "yes" | "grind";

/** The popular pick for a keep-or-grind cut, used for badges and
    for estimating before the question has been answered. */
export function popularExtra(id: string): KeepGrind {
  for (const g of EXTRA_GROUPS) for (const c of g.cuts) if (c.id === id) return c.popular;
  return "grind";
}

/** What to assume for an unanswered keep-or-grind cut. */
export function effectiveExtra(a: CutSheetAnswers, id: string): KeepGrind {
  return a.extras[id] ?? popularExtra(id);
}

/* ---------------- cut sheet answers ---------------- */

export interface MainCutAnswer {
  mode: CutMode;
  roastSize?: string;    // "3 lb"
  thickness?: string;    // '1 1/4'
  perPackage?: string;   // "2"
}

export interface CutSheetAnswers {
  main: Record<string, MainCutAnswer>;           // chuck, arm, sirloin, sirlointip, topround, btmround
  rib: { choice: "prime" | "ribsteak" | "ribeye"; thickness?: string; perPackage?: string };
  loin: { choice: "tbone" | "strip"; thickness: string; perPackage: string };
  filetThickness?: string;                        // when loin.choice === "strip"
  extras: Record<string, KeepGrind | undefined>;  // brisket, flank, … undefined = unanswered
  groundPack: string;                             // "1" | "1.5" | "2"
  patties: boolean;
  pattySize: string;
  pattyLbs: string;                               // "40 lb"
  organs: string[];
  tallow: boolean;                                // fat for rendering — special request
  notes: string;
}

export function defaultCutSheet(): CutSheetAnswers {
  return {
    main: Object.fromEntries(
      MAIN_CUTS.map((c) => [c.id, {
        mode: c.defMode,
        roastSize: "3 lb",
        thickness: "1",
        perPackage: "2",
      } satisfies MainCutAnswer]),
    ),
    rib: { choice: "ribeye", thickness: "1", perPackage: "2" },
    loin: { choice: "tbone", thickness: "1", perPackage: "2" },
    filetThickness: "1 1/2",
    extras: {},                 // deliberately empty — keep or grind is a required choice
    groundPack: "1",
    patties: false,
    pattySize: "4oz",
    pattyLbs: "40 lb",
    organs: [],
    tallow: false,
    notes: "",
  };
}

/** A fully answered sheet — used for the sample order people can
    browse from the front page before they start their own. */
export function sampleCutSheet(): CutSheetAnswers {
  return {
    ...defaultCutSheet(),
    extras: Object.fromEntries(
      EXTRA_GROUPS.flatMap((g) => g.cuts.map((c) => [c.id, c.popular])),
    ),
    organs: ["soupbones", "oxtail"],
    tallow: true,
    notes: "Leaning on the freezer for weeknights — happy to take extra ground.",
  };
}

/* ---------------- orders ---------------- */

export type OrderStatus =
  | "reserved"      // deposit in, share held
  | "locked"        // past Sept 30 deadline, cut sheet sent to butcher
  | "processing"    // harvested, hanging at Colorado Custom
  | "ready"         // packaged, ready for pickup
  | "picked-up";

export interface Order {
  code: string;            // e.g. TR-4F7K2M
  createdAt: string;
  status: OrderStatus;
  share: ShareId;
  cutSheet: CutSheetAnswers;
  name: string;
  email: string;
  phone: string;
  address: string;         // CCMC cut sheet wants it
  sample?: boolean;
}

const ORDERS_KEY = "tr.orders.v2";
const NOTES_KEY = "tr.notes.v2";

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, rows: T[]) {
  localStorage.setItem(key, JSON.stringify(rows));
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/* One sample order so tracking + back office demo themselves. */
function seed() {
  const existing = load<Order>(ORDERS_KEY);
  const sampleRow = existing.find((o) => o.code === "TR-SAMPLE1");
  /* refresh a stale sample from an older cut-sheet shape */
  if (sampleRow && sampleRow.cutSheet?.tallow === undefined) {
    save(ORDERS_KEY, existing.map((o) => (o.code === "TR-SAMPLE1" ? { ...o, cutSheet: sampleCutSheet() } : o)));
    return;
  }
  if (existing.length) return;
  const sample: Order = {
    code: "TR-SAMPLE1", createdAt: "2026-09-02T17:00:00Z", status: "reserved",
    share: "half", cutSheet: sampleCutSheet(),
    name: "Dana Henderson", email: "dana@example.com", phone: "970-555-0134",
    address: "418 Maple St, Greeley CO", sample: true,
  };
  save(ORDERS_KEY, [sample]);
}

seed();

export function listOrders(): Order[] {
  return load<Order>(ORDERS_KEY);
}

export function getOrder(code: string): Order | undefined {
  return listOrders().find((o) => o.code.toUpperCase() === code.toUpperCase());
}

export function createOrder(input: Omit<Order, "code" | "createdAt" | "status">): Order {
  const order: Order = {
    ...input,
    code: "TR-" + randomCode(6),
    createdAt: new Date().toISOString(),
    status: "reserved",
  };
  const rows = listOrders();
  rows.push(order);
  save(ORDERS_KEY, rows);
  return order;
}

export function updateOrderStatus(code: string, status: OrderStatus) {
  const rows = listOrders();
  const i = rows.findIndex((o) => o.code === code);
  if (i < 0) return;
  rows[i] = { ...rows[i], status };
  save(ORDERS_KEY, rows);
}

/* ---------------- customer notes (admin) ---------------- */

export function getNotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setNote(email: string, text: string) {
  const notes = getNotes();
  if (text.trim()) notes[email] = text;
  else delete notes[email];
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

/* ---------------- status timeline ---------------- */

export const STATUS_STEPS: { id: OrderStatus; label: string; blurb: string }[] = [
  { id: "reserved", label: "Reserved", blurb: "Deposit in. Your share is held, and your cut sheet can still be changed until Sept 30." },
  { id: "locked", label: "Cut sheet locked", blurb: "Sept 30 has passed — your cutting instructions are with Colorado Custom." },
  { id: "processing", label: "Hanging & processing", blurb: "Your beef is dry aging 14 days, then cut and packaged to your instructions." },
  { id: "ready", label: "Ready for pickup", blurb: "Pick up at Colorado Custom in Kersey the week of Oct 1. Bring coolers." },
  { id: "picked-up", label: "Picked up", blurb: "Enjoy. Tell us how the first ribeye went." },
];

export function statusIndex(s: OrderStatus): number {
  return STATUS_STEPS.findIndex((x) => x.id === s);
}
