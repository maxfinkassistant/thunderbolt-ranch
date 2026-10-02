/* Thin client for the Apps Script backend (apps-script/Code.gs).
   Requests are kept "simple" (no custom headers, text body) so the
   browser skips CORS preflight — Apps Script web apps don't answer
   OPTIONS. Every call degrades gracefully when BACKEND_URL is unset. */

import { BACKEND_URL } from "../data/config";
import type { Order, Steer, SeasonSettings } from "./store";
import type { SeasonId } from "../data/config";

export const backendConfigured = () => BACKEND_URL.length > 0;

export interface OrderPayload {
  order: Order;
  summary: { name: string; detail: string }[];
  cost: { total: number; deposit: number; balance: number };
  depositLink: string;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, redirect: "follow" });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error("Backend returned a non-JSON response"); }
  if (!res.ok || json.ok === false) throw new Error(json.error || `Backend error ${res.status}`);
  return json as T;
}

/** `season` comes back once the backend knows about seasons — it
    decides fall vs. winter from what's actually left. */
export async function submitOrder(payload: OrderPayload): Promise<{ ok: true; code: string; season?: SeasonId }> {
  return call(BACKEND_URL, { method: "POST", body: JSON.stringify({ action: "order", ...payload }) });
}

/** What the customer's own tracking page is allowed to know about the
    animal behind their order — their numbers only, never the roster. */
export interface PublicPricing {
  hangingWeight: number;
  rate: number;
  readyDate?: string;
}

export async function fetchOrder(code: string): Promise<Order | null> {
  const r = await call<{ ok: boolean; order: Order | null }>(
    `${BACKEND_URL}?action=order&code=${encodeURIComponent(code)}`,
  );
  return r.order;
}

/** The order plus its steer's weight and rate, once it has been
    weighed. `pricing` is absent on a backend that predates this. */
export async function fetchTracking(code: string): Promise<{ order: Order | null; pricing?: PublicPricing }> {
  const r = await call<{ ok: boolean; order: Order | null; pricing?: PublicPricing }>(
    `${BACKEND_URL}?action=order&code=${encodeURIComponent(code)}`,
  );
  return { order: r.order, pricing: r.pricing };
}

export async function fetchOrders(adminKey: string): Promise<Order[]> {
  const r = await call<{ ok: boolean; orders: Order[] }>(
    `${BACKEND_URL}?action=list&key=${encodeURIComponent(adminKey)}`,
  );
  return r.orders;
}

/** Everything the Ranch Office shows. `steers` and `settings` are
    absent until the Apps Script is updated to the steer-tracking version. */
export interface Office {
  orders: Order[];
  steers?: Steer[];
  settings?: SeasonSettings;
}

export async function fetchOffice(adminKey: string): Promise<Office> {
  const r = await call<{ ok: boolean } & Office>(
    `${BACKEND_URL}?action=list&key=${encodeURIComponent(adminKey)}`,
  );
  return { orders: r.orders, steers: r.steers, settings: r.settings };
}

const admin = (adminKey: string, body: Record<string, unknown>) =>
  call<{ ok: true }>(BACKEND_URL, { method: "POST", body: JSON.stringify({ key: adminKey, ...body }) });

export const pushSteer = (adminKey: string, steer: Steer, originalId?: string) =>
  admin(adminKey, { action: "steer", steer, originalId });

export const removeSteer = (adminKey: string, id: string) =>
  admin(adminKey, { action: "steer-delete", id });

/** Link an order to a steer and/or move it between seasons. */
export const pushAssignment = (adminKey: string, code: string, patch: { steer?: string; season?: SeasonId }) =>
  admin(adminKey, { action: "assign", code, ...patch });

export const pushSettings = (adminKey: string, settings: SeasonSettings) =>
  admin(adminKey, { action: "settings", ...settings });

/** Email one customer their final invoice. The backend recomputes the
    money from the sheet — the browser never dictates what to bill. */
export const sendInvoice = (adminKey: string, code: string) =>
  admin(adminKey, { action: "invoice", code });

/** Public: how much of the current season is spoken for. Null when
    the backend predates steer tracking. */
export async function fetchAvailability(): Promise<{ capacity: number; reserved: number } | null> {
  const r = await call<{ ok: boolean; capacity?: number; reserved?: number }>(`${BACKEND_URL}?action=availability`);
  return typeof r.capacity === "number" && typeof r.reserved === "number"
    ? { capacity: r.capacity, reserved: r.reserved }
    : null;
}

export async function pushStatus(adminKey: string, code: string, status: string): Promise<void> {
  await call(BACKEND_URL, { method: "POST", body: JSON.stringify({ action: "status", key: adminKey, code, status }) });
}

/* "bad" only when the backend itself rejects the key. Apps Script
   sometimes answers with an HTML error page or stalls, so anything
   else gets one retry before it's reported as "unreachable". */
export async function checkAdminKey(adminKey: string): Promise<"ok" | "bad" | "unreachable"> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fetchOrders(adminKey);
      return "ok";
    } catch (e) {
      if ((e as Error).message === "bad key") return "bad";
    }
  }
  return "unreachable";
}
