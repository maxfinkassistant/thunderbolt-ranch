/* Thin client for the Apps Script backend (apps-script/Code.gs).
   Requests are kept "simple" (no custom headers, text body) so the
   browser skips CORS preflight — Apps Script web apps don't answer
   OPTIONS. Every call degrades gracefully when BACKEND_URL is unset. */

import { BACKEND_URL } from "../data/config";
import type { Order } from "./store";

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

export async function submitOrder(payload: OrderPayload): Promise<{ ok: true; code: string }> {
  return call(BACKEND_URL, { method: "POST", body: JSON.stringify({ action: "order", ...payload }) });
}

export async function fetchOrder(code: string): Promise<Order | null> {
  const r = await call<{ ok: boolean; order: Order | null }>(
    `${BACKEND_URL}?action=order&code=${encodeURIComponent(code)}`,
  );
  return r.order;
}

export async function fetchOrders(adminKey: string): Promise<Order[]> {
  const r = await call<{ ok: boolean; orders: Order[] }>(
    `${BACKEND_URL}?action=list&key=${encodeURIComponent(adminKey)}`,
  );
  return r.orders;
}

export async function pushStatus(adminKey: string, code: string, status: string): Promise<void> {
  await call(BACKEND_URL, { method: "POST", body: JSON.stringify({ action: "status", key: adminKey, code, status }) });
}

export async function checkAdminKey(adminKey: string): Promise<boolean> {
  try {
    await fetchOrders(adminKey);
    return true;
  } catch {
    return false;
  }
}
