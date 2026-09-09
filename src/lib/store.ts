/* ============================================================
   Local data layer. Persists to localStorage today; shapes and
   signatures mirror the future backend so it can swap without
   touching the UI. Keys bumped to v2 for the cut-sheet-wizard
   order shape.
   ============================================================ */

import { MAIN_CUTS, EXTRA_GROUPS, type ShareId, type CutMode } from "../data/config";

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
  extras: Record<string, "yes" | "grind">;        // brisket, flank, …
  groundPack: string;                             // "1" | "1.5" | "2"
  patties: boolean;
  pattySize: string;
  organs: string[];
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
    extras: Object.fromEntries(
      EXTRA_GROUPS.flatMap((g) => g.cuts.map((c) => [c.id, c.def])),
    ),
    groundPack: "1.5",
    patties: false,
    pattySize: "5oz",
    organs: [],
    notes: "",
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
  if (localStorage.getItem(ORDERS_KEY)) return;
  const sample: Order = {
    code: "TR-SAMPLE1", createdAt: "2026-09-02T17:00:00Z", status: "reserved",
    share: "half", cutSheet: defaultCutSheet(),
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
