/* ============================================================
   Local data layer. Persists to localStorage today; the shapes
   and function signatures mirror what a Supabase backend would
   expose (orders, groups tables) so it can be swapped without
   touching the UI.
   ============================================================ */

import { SHARES, DATES, DECISIONS, type ShareId } from "../data/config";

export type OrderStatus =
  | "reserved"      // deposit paid, cut sheet editable until deadline
  | "locked"        // past deadline, cut sheet sent to butcher
  | "processing"    // animal delivered, at Colorado Custom
  | "aging"         // dry aging
  | "ready"         // ready for pickup
  | "picked-up";

export interface Order {
  code: string;            // e.g. CR-4F7K2M
  createdAt: string;
  status: OrderStatus;
  share: ShareId;
  dateId: string;
  picks: Record<string, string>;
  thickness: Record<string, string>;
  pkg: string;
  patties: boolean;
  pattySize: string;
  organs: string[];
  notes: string;
  name: string;
  email: string;
  phone: string;
  groupCode?: string;      // set when this order joined a split-a-cow group
  sample?: boolean;
}

export interface GroupMember {
  name: string;
  share: ShareId;
  orderCode: string;
  joinedAt: string;
}

export interface Group {
  code: string;            // e.g. HENDERSON or 6-char
  name: string;            // display name, e.g. "The Hendersons' cow"
  dateId: string;
  createdAt: string;
  createdBy: string;
  members: GroupMember[];
  sample?: boolean;
}

const ORDERS_KEY = "cr.orders.v1";
const GROUPS_KEY = "cr.groups.v1";

/* ---------------- persistence ---------------- */

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

/* ---------------- ids ---------------- */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/* ---------------- seed data ----------------
   One sample group + orders so the split-a-cow and tracking
   pages demonstrate themselves on first visit.               */

function seed() {
  if (localStorage.getItem(GROUPS_KEY)) return;

  const sampleOrders: Order[] = [
    {
      code: "CR-SAMPLE1", createdAt: "2026-08-02T17:00:00Z", status: "reserved",
      share: "quarter", dateId: "oct",
      picks: Object.fromEntries(DECISIONS.map((d) => [d.id, d.def])),
      thickness: { rib: "1.5", loin: "1.5", sirloin: "1" },
      pkg: "1.5", patties: false, pattySize: "5oz", organs: [],
      notes: "", name: "Dana Henderson", email: "dana@example.com", phone: "",
      groupCode: "HNDRSN", sample: true,
    },
    {
      code: "CR-SAMPLE2", createdAt: "2026-08-05T21:30:00Z", status: "reserved",
      share: "quarter", dateId: "oct",
      picks: Object.fromEntries(DECISIONS.map((d) => [d.id, d.def])),
      thickness: { rib: "1", loin: "1", sirloin: "1" },
      pkg: "1", patties: true, pattySize: "5oz", organs: ["bones"],
      notes: "", name: "Marcus Lee", email: "marcus@example.com", phone: "",
      groupCode: "HNDRSN", sample: true,
    },
    {
      code: "CR-SAMPLE3", createdAt: "2026-08-11T15:10:00Z", status: "reserved",
      share: "quarter", dateId: "oct",
      picks: Object.fromEntries(DECISIONS.map((d) => [d.id, d.def])),
      thickness: { rib: "1.5", loin: "1.5", sirloin: "1" },
      pkg: "2", patties: false, pattySize: "5oz", organs: ["oxtail", "tallow"],
      notes: "", name: "Priya Shah", email: "priya@example.com", phone: "",
      groupCode: "HNDRSN", sample: true,
    },
  ];

  const sampleGroup: Group = {
    code: "HNDRSN",
    name: "The Henderson Block Cow",
    dateId: "oct",
    createdAt: "2026-08-02T17:00:00Z",
    createdBy: "Dana Henderson",
    members: sampleOrders.map((o) => ({
      name: o.name, share: o.share, orderCode: o.code, joinedAt: o.createdAt,
    })),
    sample: true,
  };

  save(ORDERS_KEY, sampleOrders);
  save(GROUPS_KEY, [sampleGroup]);
}

seed();

/* ---------------- orders ---------------- */

export function listOrders(): Order[] {
  return load<Order>(ORDERS_KEY);
}

export function getOrder(code: string): Order | undefined {
  return listOrders().find((o) => o.code.toUpperCase() === code.toUpperCase());
}

export function createOrder(input: Omit<Order, "code" | "createdAt" | "status">): Order {
  const order: Order = {
    ...input,
    code: "CR-" + randomCode(6),
    createdAt: new Date().toISOString(),
    status: "reserved",
  };
  const rows = listOrders();
  rows.push(order);
  save(ORDERS_KEY, rows);

  if (order.groupCode) {
    const g = getGroup(order.groupCode);
    if (g) {
      g.members.push({
        name: order.name, share: order.share,
        orderCode: order.code, joinedAt: order.createdAt,
      });
      upsertGroup(g);
    }
  }
  return order;
}

/* ---------------- groups ---------------- */

export function listGroups(): Group[] {
  return load<Group>(GROUPS_KEY);
}

export function getGroup(code: string): Group | undefined {
  return listGroups().find((g) => g.code.toUpperCase() === code.toUpperCase());
}

export function createGroup(name: string, dateId: string, createdBy: string): Group {
  const g: Group = {
    code: randomCode(6),
    name, dateId, createdBy,
    createdAt: new Date().toISOString(),
    members: [],
  };
  const rows = listGroups();
  rows.push(g);
  save(GROUPS_KEY, rows);
  return g;
}

function upsertGroup(g: Group) {
  const rows = listGroups();
  const i = rows.findIndex((x) => x.code === g.code);
  if (i >= 0) rows[i] = g;
  else rows.push(g);
  save(GROUPS_KEY, rows);
}

/** Quarter-slots filled out of 4. */
export function groupFill(g: Group): number {
  return g.members.reduce((sum, m) => sum + SHARES[m.share].quarters, 0);
}

export function groupComplete(g: Group): boolean {
  return groupFill(g) >= 4;
}

/* ---------------- status timeline ---------------- */

export const STATUS_STEPS: { id: OrderStatus; label: string; blurb: string }[] = [
  { id: "reserved", label: "Reserved", blurb: "Deposit paid. Your share is held — you can cancel for a full refund until the order deadline." },
  { id: "locked", label: "Order locked", blurb: "Deadline passed. Your animal is committed to the butcher." },
  { id: "processing", label: "At the butcher", blurb: "Your animal was delivered to Colorado Custom in Kersey." },
  { id: "aging", label: "Dry aging", blurb: "About two weeks. This is where the flavor comes from." },
  { id: "ready", label: "Ready for pickup", blurb: "Colorado Custom will call you to set a time. Bring coolers." },
  { id: "picked-up", label: "Picked up", blurb: "Enjoy. Tell us how the brisket went." },
];

export function statusIndex(s: OrderStatus): number {
  return STATUS_STEPS.findIndex((x) => x.id === s);
}

export function harvestFor(dateId: string) {
  return DATES.find((d) => d.id === dateId);
}
