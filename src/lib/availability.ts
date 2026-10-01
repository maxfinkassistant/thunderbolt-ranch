/* How much of the current season is spoken for — the number behind
   the "3 of 7 steers reserved" tracker. Comes from the order system
   when there is one, from this browser's demo data when there isn't.
   One fetch is shared by every component that asks. */

import { useEffect, useState } from "react";
import { SEASON_STEERS, SHARES, CURRENT_SEASON, NEXT_SEASON, type ShareId, type SeasonId } from "../data/config";
import { backendConfigured, fetchAvailability } from "./api";
import { listOrders, getSettings, reservedSteers } from "./store";

export interface Availability {
  capacity: number;   // steers this season
  reserved: number;   // steers' worth already reserved
  /** False until the order system has answered — show the season, not a count. */
  known: boolean;
}

const UNKNOWN: Availability = { capacity: SEASON_STEERS, reserved: 0, known: false };

function localAvailability(): Availability {
  const settings = getSettings();
  return { capacity: settings.capacity, reserved: reservedSteers(listOrders(), settings), known: true };
}

let cached: Availability | null = null;
let pending: Promise<Availability> | null = null;
const listeners = new Set<(a: Availability) => void>();

function load(): Promise<Availability> {
  pending ??= fetchAvailability()
    .then((r) => (r ? { ...r, known: true } : UNKNOWN))
    .catch(() => UNKNOWN)
    .then((a) => { cached = a; listeners.forEach((fn) => fn(a)); return a; });
  return pending;
}

/** Drop the cached answer — call after anything that changes the count. */
export function refreshAvailability() {
  cached = null;
  pending = null;
  if (backendConfigured()) load();
  else { const a = localAvailability(); listeners.forEach((fn) => fn(a)); }
}

export function useAvailability(): Availability {
  const [a, setA] = useState<Availability>(() =>
    backendConfigured() ? cached ?? UNKNOWN : localAvailability(),
  );
  useEffect(() => {
    listeners.add(setA);
    if (backendConfigured()) load().then(setA);
    return () => { listeners.delete(setA); };
  }, []);
  return a;
}

const EPS = 1e-6;

export const seasonFull = (a: Availability) => a.known && a.reserved >= a.capacity - EPS;

/** Steers' worth still open this season. */
export const steersLeft = (a: Availability) => Math.max(0, a.capacity - a.reserved);

/** Which season a new order of this size lands in: the current one
    while the share still fits, otherwise the next. */
export function seasonFor(a: Availability, share: ShareId): SeasonId {
  if (!a.known) return CURRENT_SEASON;
  return a.reserved + SHARES[share].frac <= a.capacity + EPS ? CURRENT_SEASON : NEXT_SEASON;
}

/** 2.75 → { whole: "2", frac: "¾" }. Shares come in quarters, so the
    count does too; the fraction is split out so it can be set smaller. */
export function steerCountParts(n: number): { whole: string; frac: string } {
  const q = Math.round(n * 4);
  const whole = Math.floor(q / 4);
  const frac = ["", "¼", "½", "¾"][q % 4];
  return { whole: whole === 0 && frac ? "" : String(whole), frac };
}

/** 2.75 → "2¾", for plain text. */
export function steerCount(n: number): string {
  const { whole, frac } = steerCountParts(n);
  return whole + frac;
}
