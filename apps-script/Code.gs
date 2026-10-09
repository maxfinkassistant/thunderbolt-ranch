/**
 * Thunderbolt Ranch — order backend (Google Apps Script web app)
 *
 * What it does:
 *   POST {action:"order", ...}   → appends the order to a Google Sheet (your CRM),
 *                                   emails the ranch a notification, emails the
 *                                   customer a confirmation with the deposit link.
 *   GET  ?action=order&code=TR-… → returns one order (customer tracking page).
 *   GET  ?action=list&key=…      → returns all orders, steers and the season
 *                                   settings (back office; key required).
 *   GET  ?action=availability    → how many of this season's steers are reserved
 *                                   (public; drives the front-page tracker).
 *   POST {action:"status", key, code, status} → updates an order's status.
 *   POST {action:"assign", key, code, steer?, season?} → links an order to a steer
 *                                   and/or moves it to another season.
 *   POST {action:"steer", key, steer, originalId?} → adds or edits a steer.
 *   POST {action:"steer-delete", key, id}          → removes a steer.
 *   POST {action:"settings", key, capacity, offline} → steers this season, and
 *                                   how many were reserved off the site.
 *
 * Setup (once, ~3 minutes) — see docs/SETUP-TODAY.md:
 *   1. script.google.com → New project → paste this file → save.
 *   2. Project Settings → Script Properties → add:
 *        ADMIN_KEY      = a passcode for the back office (e.g. KERSEY-2026)
 *        NOTIFY_EMAILS  = comma-separated ranch emails to notify on each order
 *        SHEET_ID       = (optional) an existing spreadsheet id; leave blank to auto-create
 *   3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone
 *   4. Copy the /exec URL → VITE_BACKEND_URL in the site config.
 *
 * Updating later: paste the new file over the old one, save, then
 *   Deploy → Manage deployments → pencil → Version: New version → Deploy.
 *   (Editing the existing deployment keeps the same /exec URL.)
 */

/* Seasons — keep in step with SEASONS in the site's src/data/config.ts. */
const CURRENT_SEASON = "winter-2027";
const NEXT_SEASON = "spring-2027";
const SEASON_COPY = {
  "fall-2026": { name: "fall", pickup: "estimated mid-October" },
  "winter-2027": { name: "winter", pickup: "estimated January" },
  "spring-2027": { name: "spring", pickup: "estimated April" },
};
const DEFAULT_CAPACITY = 20;  // steers this season, until the Ranch Office says otherwise
const SHARE_FRAC = { quarter: 0.25, half: 0.5, whole: 1 };
/* $/lb hanging by share. A group that fills more of a steer together
   unlocks the bigger share's rate for everyone in it. Mirrors
   SHARE_RATES / GROUP_UNLOCK / tierFor in src/data/config.ts. */
const SHARE_RATES = { whole: 6.0, half: 6.10, quarter: 6.20 };
const GROUP_UNLOCK = { half: 0.5, whole: 1 };   // steers' worth the group has confirmed
const TIER_ORDER = ["quarter", "half", "whole"];
function groupTier_(frac) { return frac >= GROUP_UNLOCK.whole - 1e-6 ? "whole" : frac >= GROUP_UNLOCK.half - 1e-6 ? "half" : "quarter"; }
/* the rate tier an order pays: its own share, or better if its group's confirmed fraction earned it */
function tierFor_(share, frac) { const g = groupTier_(frac == null ? (SHARE_FRAC[share] || 0) : frac); return TIER_ORDER.indexOf(g) > TIER_ORDER.indexOf(share) ? g : share; }
const DEPOSIT = 300;          // per order, card
const GROUP_DEPOSIT = 600;    // one from the organizer covers the whole group
const HANGING_TYP = 1000;     // lb, a typical carcass — above this counts as heavy
const PATTY_RATE = 0.5;       // $/lb — the butcher's patty charge, collected by us and passed on
/* Card payments carry the processor's fee; bank (ACH) payments don't.
   One number, shown to the customer as "includes a 3% card fee". */
const CARD_FEE_PCT = 0.03;
const PATTY_MIN_LBS = 30;

const SHEET_NAME = "Orders";
const HEADERS = [
  "Code", "Created", "Status", "Name", "Email", "Phone", "Address",
  "Share", "Total", "Deposit", "Balance", "Summary", "Notes", "Order JSON",
  "Steer", "Season",
  "Invoiced at", "Pay link id", "Pay link URL", "Confirm token",
  "Signed by", "Signed at", "Paid at", "Butcher sent at", "Payment state",
  "Card link id", "Card link URL",
  "Referral", "Group", "Deposit link id", "Deposit link URL", "Deposit paid at",
  "Deposit kind", "Deposit amount", "Group target",
  "Ready emailed at", "Paid with",
];
const COL_STATUS = 3, COL_STEER = 15, COL_SEASON = 16;
/* final-invoice workflow columns (1-based) */
const COL_INVOICED = 17, COL_PLINK_ID = 18, COL_PLINK_URL = 19, COL_TOKEN = 20,
      COL_SIGNED_BY = 21, COL_SIGNED_AT = 22, COL_PAID_AT = 23, COL_BUTCHER_AT = 24,
      COL_PAY_STATE = 25,   // "paid" | "pending" (ACH clearing) | ""
      COL_CARD_ID = 26, COL_CARD_URL = 27,   // the card link (+fee); 18/19 are the ACH link
      COL_REFERRAL = 28, COL_GROUP = 29, COL_DEP_ID = 30, COL_DEP_URL = 31, COL_DEP_PAID = 32,
      COL_DEP_KIND = 33, COL_DEP_AMT = 34, COL_TARGET = 35,
      COL_READY_AT = 36,    // when the ready-for-pickup email went out
      COL_PAID_WITH = 37;   // "Visa •••• 4242 · $1,301", for the paid invoice

const SITE_URL = "https://thunderboltbeef.com";
const RANCH_INBOX = "thunderboltbeef@gmail.com";
const BUTCHER_PHONE = "970-356-2333";
const BUTCHER_NAME = "Colorado Custom Meat Co";
const BUTCHER_ADDRESS = "443 4th Street, Kersey, CO 80644";
const BUTCHER_MAP = "https://maps.google.com/?q=" + encodeURIComponent("Colorado Custom Meat Co, 443 4th Street, Kersey, CO 80644");
/* from coloradocustommeatco.com/contact, checked 2026-10-09 */
const BUTCHER_HOURS = ["Monday–Friday 8:00 am–4:30 pm (closed 11–noon for lunch)", "Saturday 9:00 am–noon", "Sunday closed"];
/* Script property BUTCHER_EMAIL overrides this — point it at yourself
   for a dry run before the first real sheet goes to Colorado Custom. */
function butcherEmail_() { return String(props_().getProperty("BUTCHER_EMAIL") || "order@ccmeatco.com").trim(); }

const STEER_SHEET = "Steers";
const STEER_HEADERS = ["Steer ID", "Season", "Hanging weight (lb)", "Est. ready date", "Price per lb ($)", "Kill date", "Pickup from", "Pickup until"];
const STANDARD_RATE = SHARE_RATES.whole;   // the whole-share rate; a steer's "rate" is a whole-share rate
/* Seasons sold before tiered rates and group pricing: those orders keep
   the deal they were quoted — the steer's "Price per lb" (or $6.00) flat
   for every share, and the deposit they were placed with. Mirrors
   FLAT_RATE_SEASONS in src/data/config.ts. */
const FLAT_RATE_SEASONS = ["fall-2026"];
function flatRateSeason_(s) { return FLAT_RATE_SEASONS.indexOf(String(s || "")) >= 0; }

/* What the invoice takes off for the deposit: only a deposit the sheet
   has on file ("Deposit paid at"). Orders from before the deposit gate
   were reserved whether or not anyone paid, so the amount they were
   placed with is not proof of payment. Mirrors depositCredit() in
   src/lib/estimate.ts. */
function depositCredit_(o) {
  return o.depositPaidAt ? Number(o.depositAmount == null ? DEPOSIT : o.depositAmount) || 0 : 0;
}

function props_() { return PropertiesService.getScriptProperties(); }

function isAdmin_(key) {
  const want = String(props_().getProperty("ADMIN_KEY") || "").trim();
  return !!want && String(key || "").trim() === want;
}

function book_() {
  const p = props_();
  const id = p.getProperty("SHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create("Thunderbolt Ranch — Orders");
  p.setProperty("SHEET_ID", ss.getId());
  return ss;
}

function sheet_() {
  const ss = book_();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  } else if (sh.getLastColumn() < HEADERS.length) {
    /* a sheet from before steers + seasons: add the new column headings */
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  }
  return sh;
}

function steerSheet_() {
  const ss = book_();
  let sh = ss.getSheetByName(STEER_SHEET);
  if (!sh) {
    sh = ss.insertSheet(STEER_SHEET);
    sh.appendRow(STEER_HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, STEER_HEADERS.length).setFontWeight("bold");
    /* IDs and dates stay exactly as typed — no "007" → 7, no timezone drift */
    sh.getRange("A:A").setNumberFormat("@");
    sh.getRange("D:D").setNumberFormat("@");
    sh.getRange("F:H").setNumberFormat("@");
  } else if (sh.getLastColumn() < STEER_HEADERS.length) {
    /* a Steers sheet from before per-steer pricing: add the heading */
    sh.getRange(1, 1, 1, STEER_HEADERS.length).setValues([STEER_HEADERS]).setFontWeight("bold");
  }
  return sh;
}

/* yyyy-mm-dd → "October 16, 2026" for anything a customer reads. */
function prettyDate_(ymd) {
  const parts = String(ymd || "").split("-");
  if (parts.length !== 3) return String(ymd || "");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return String(ymd || "");
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "MMMM d, yyyy");
}

/* A date cell comes back as a Date; hand the site a plain yyyy-mm-dd. */
function dateText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v || "");
}

function steers_() {
  const sh = steerSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, STEER_HEADERS.length).getValues()
    .filter(r => String(r[0]).trim() !== "")
    .map(r => {
      const steer = { id: String(r[0]).trim(), season: String(r[1] || CURRENT_SEASON) };
      if (Number(r[2]) > 0) steer.hangingWeight = Number(r[2]);
      if (r[3]) steer.readyDate = dateText_(r[3]);
      if (Number(r[4]) > 0) steer.rate = Number(r[4]);
      if (r[5]) steer.killDate = dateText_(r[5]);
      if (r[6]) steer.pickupFrom = dateText_(r[6]);
      if (r[7]) steer.pickupUntil = dateText_(r[7]);
      return steer;
    });
}

function settings_() {
  const p = props_();
  const capacity = Number(p.getProperty("SEASON_CAPACITY"));
  const offline = Number(p.getProperty("SEASON_OFFLINE"));
  return { capacity: capacity >= 1 ? capacity : DEFAULT_CAPACITY, offline: offline > 0 ? offline : 0 };
}

/* Steers' worth reserved this season: every order's share, plus
   what the ranch sold off the site. */
function availability_() {
  const s = settings_();
  const online = rows_().map(orderFromRow_).filter(Boolean)
    .filter(o => o.season === CURRENT_SEASON && o.status !== "pending-deposit")
    .reduce((t, o) => t + (SHARE_FRAC[o.share] || 0), 0);
  return { season: CURRENT_SEASON, capacity: s.capacity, reserved: online + s.offline };
}

/* Everything about every group, keyed by root code: confirmed count,
   confirmed steers' worth, who's in, what they're filling, how the
   deposit works. One pass over the sheet. */
function groupInfo_(orders) {
  const all = orders || rows_().map(orderFromRow_).filter(Boolean);
  const g = {};
  all.forEach(o => {
    const root = o.group || o.code;
    const info = g[root] || (g[root] = { root: root, size: 0, frac: 0, members: [], target: "whole", depositKind: "single", depositPaid: false, organizer: "" });
    const paid = o.status !== "pending-deposit";
    if (paid) { info.size += 1; info.frac += SHARE_FRAC[o.share] || 0; }
    info.members.push({ code: o.code, name: shortName_(o.name), share: o.share, paid: paid });
    if (o.code === root) {
      info.target = o.groupTarget || (o.share === "half" ? "whole" : "half");
      info.depositKind = o.depositKind === "group" ? "group" : "single";
      info.depositPaid = paid;
      info.organizer = shortName_(o.name);
    }
  });
  Object.keys(g).forEach(k => { g[k].frac = Math.round(g[k].frac * 100) / 100; });
  return g;
}
function shortName_(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts.length > 1 ? parts[0] + " " + parts[parts.length - 1].charAt(0) + "." : parts[0] || "";
}
/* stamp an order with its group's numbers for the site */
function withGroup_(o, groups) {
  const info = (groups || groupInfo_())[o.group || o.code];
  if (!info) { o.groupSize = 1; o.groupFrac = SHARE_FRAC[o.share] || 0; return o; }
  o.groupSize = Math.max(1, info.size);
  o.groupFrac = Math.max(SHARE_FRAC[o.share] || 0, info.frac);
  o.groupTarget = info.target;
  o.groupMembers = info.members.map(m => ({ code: m.code, name: m.name, share: m.share, paid: m.paid, you: m.code === o.code }));
  return o;
}
function groupSizeOf_(order, groups) { const i = (groups || groupInfo_())[order.group || order.code]; return i ? Math.max(1, i.size) : 1; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

function orderFromRow_(r) {
  try {
    const o = JSON.parse(r[13]);
    o.status = r[2] || o.status;
    o.steer = String(r[14] || "").trim() || undefined;
    /* orders from before seasons existed belong to the current one */
    o.season = String(r[15] || "") || o.season || CURRENT_SEASON;
    if (r[16]) o.invoicedAt = dateText_(r[16]);
    if (r[20]) o.signedBy = String(r[20]);
    if (r[21]) o.signedAt = dateText_(r[21]);
    if (r[22]) o.paidAt = dateText_(r[22]);
    if (r[23]) o.butcherSentAt = dateText_(r[23]);
    if (r[24]) o.payState = String(r[24]);
    if (r[27]) o.referral = String(r[27]);
    o.group = String(r[28] || "").trim() || o.code;
    if (r[31]) o.depositPaidAt = dateText_(r[31]);
    o.depositKind = String(r[32] || "single");
    /* rows from before per-order deposits carry the deposit they were
       placed with in the Deposit column — a fall order keeps its $250 */
    o.depositAmount = r[33] !== "" && r[33] != null ? Number(r[33])
      : Number(r[9]) > 0 ? Number(r[9]) : DEPOSIT;
    o.depositCredit = depositCredit_(o);
    if (r[34]) o.groupTarget = String(r[34]);
    if (r[35]) o.readyEmailedAt = dateText_(r[35]);
    return o;
  } catch (e) {
    return null;
  }
}

/* ---------------- GET ---------------- */

function doGet(e) {
  try { return doGet_(e); } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function doGet_(e) {
  const q = (e && e.parameter) || {};
  if (q.action === "order" && q.code) {
    const code = String(q.code).toUpperCase();
    const row = rows_().find(r => String(r[0]).toUpperCase() === code);
    const order = row ? orderFromRow_(row) : null;
    /* their own animal's weight and rate — never the whole roster */
    if (order) {
      withGroup_(order);
      if (order.status === "pending-deposit" && row[30]) order.depositUrl = String(row[30]);
    }
    const out = { ok: true, order: order };
    const pricing = order ? publicPricing_(steerFor_(order)) : null;
    if (pricing) out.pricing = pricing;
    return json_(out);
  }
  if (q.action === "group" && q.code) {
    /* a friend typing a code at checkout: what would they be joining? */
    const code = String(q.code).toUpperCase();
    const row = rows_().find(r => String(r[0]).toUpperCase() === code);
    if (!row) return json_({ ok: true, group: null });
    const o = orderFromRow_(row);
    const info = groupInfo_()[o.group || o.code];
    return json_({ ok: true, group: info ? {
      root: info.root, organizer: info.organizer, target: info.target, depositKind: info.depositKind,
      depositPaid: info.depositPaid, frac: info.frac,
      members: info.members.map(m => ({ name: m.name, share: m.share, paid: m.paid })),
    } : null });
  }
  if (q.action === "deposit" && q.code) {
    /* Has the deposit landed? Stripe is asked; if yes the order flips to
       reserved and the confirmation goes out. Safe to call repeatedly. */
    const code = String(q.code).toUpperCase();
    const r = landDeposit_(code);
    if (!r) return json_({ ok: false, error: "no order " + code });
    const order = withGroup_(orderFromRow_(r.row));
    if (r.paid) return json_({ ok: true, paid: true, order: order });
    return json_({ ok: true, paid: false, order: order, depositUrl: String(r.row[30] || "") });
  }
  if (q.action === "confirm" && q.code) {
    /* the page behind the "looks good & I've paid" button — only with
       the token that was in that customer's own email */
    const code = String(q.code).toUpperCase();
    let row = rows_().find(r => String(r[0]).toUpperCase() === code);
    if (!row) return json_({ ok: false, error: "no order " + code });
    if (!tokenOk_(row, q.t)) return json_({ ok: false, error: "that link isn't valid — open it from your invoice email" });
    /* back from Stripe: record the balance (and send the receipt) right away */
    if (!row[22] && (row[17] || row[25])) {
      try { const b = landBalance_(code); if (b) row = b.row; } catch (err) { /* the timer will catch it */ }
    }
    const order = withGroup_(orderFromRow_(row));
    const out = { ok: true, order: order, butcherPhone: BUTCHER_PHONE, paid: !!row[22] };
    const pricing = publicPricing_(steerFor_(order));
    if (pricing) out.pricing = pricing;
    if (row[18]) out.payUrl = String(row[18]);          // bank (ACH), at the balance
    if (row[26]) out.cardUrl = String(row[26]);         // card, balance + fee
    out.cardFeePct = CARD_FEE_PCT;
    const price = priceFor_(order, steerFor_(order), order.groupFrac);
    if (price) out.cardAmount = cardAmount_(price.balance);
    return json_(out);
  }
  if (q.action === "list") {
    if (!isAdmin_(q.key)) return json_({ ok: false, error: "bad key" });
    return json_({
      ok: true,
      orders: (function () { const all = rows_().map(orderFromRow_).filter(Boolean); const groups = groupInfo_(all); all.forEach(o => withGroup_(o, groups)); return all; })(),
      steers: steers_(),
      settings: settings_(),
    });
  }
  if (q.action === "availability") {
    const a = availability_();
    return json_({ ok: true, season: a.season, capacity: a.capacity, reserved: a.reserved });
  }
  return json_({ ok: true, service: "thunderbolt-ranch", time: new Date().toISOString() });
}

/* ---------------- POST ---------------- */

function doPost(e) {
  try { return doPost_(e); } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function doPost_(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad json" }); }

  if (["status", "assign", "steer", "steer-delete", "settings", "invoice", "stripe-check", "stripe-activity", "pickup-ready"].indexOf(body.action) >= 0) {
    if (!isAdmin_(body.key)) return json_({ ok: false, error: "bad key" });
    return adminPost_(body);
  }

  if (body.action === "invite") {
    /* public: the organizer on their own tracking page asks us to invite
       friends. Gated by the order's own email, capped per order, logged. */
    const code = String(body.code || "").toUpperCase();
    const at = orderRow_(code);
    if (at < 0) return json_({ ok: false, error: "no order " + code });
    const row = sheet_().getRange(at, 1, 1, HEADERS.length).getValues()[0];
    const order = orderFromRow_(row);
    if (String(body.email || "").trim().toLowerCase() !== String(order.email || "").trim().toLowerCase()) return json_({ ok: false, error: "that's not this order's email" });
    if (order.status === "pending-deposit") return json_({ ok: false, error: "pay your deposit first — then invite friends" });
    const invites = Array.isArray(body.invites) ? body.invites.slice(0, 6) : [];
    const already = inviteCount_(code);
    if (already + invites.length > 12) return json_({ ok: false, error: "that's enough invites for one order — email us if you need more" });
    const sms = twilioReady_();
    const results = invites.map(inv => {
      const name = String(inv.name || "").trim();
      const email = String(inv.email || "").trim();
      const phone = normalizePhone_(String(inv.phone || ""));
      const r = { email: email, phone: phone, emailed: false, texted: false, note: "" };
      if (!email && !phone) { r.note = "no email or phone"; return r; }
      if (email) { try { inviteEmail_(order, name, email); r.emailed = true; } catch (err) { r.note = "email failed: " + (err && err.message || err); } }
      if (phone) {
        if (!sms) r.note = (r.note ? r.note + "; " : "") + "texting isn't set up yet";
        else { try { inviteSms_(order, name, phone); r.texted = true; } catch (err) { r.note = (r.note ? r.note + "; " : "") + "text failed: " + (err && err.message || err); } }
      }
      logInvite_(code, name, email, phone, r);
      return r;
    });
    return json_({ ok: true, results: results, smsConfigured: sms });
  }

  /* public, token-gated — the customer signed off from their email link */
  if (body.action === "sign") {
    /* public, token-gated: the customer signed and says they've paid */
    const code = String(body.code || "").toUpperCase();
    const at = orderRow_(code);
    if (at < 0) return json_({ ok: false, error: "no order " + code });
    const sh = sheet_();
    const row = sh.getRange(at, 1, 1, HEADERS.length).getValues()[0];
    if (!tokenOk_(row, body.t)) return json_({ ok: false, error: "that link isn't valid" });
    const name = String(body.name || "").trim();
    if (!name) return json_({ ok: false, error: "name required" });
    if (!body.pdf) return json_({ ok: false, error: "signed sheet missing" });
    const order = withGroup_(orderFromRow_(row));
    const steer = steerFor_(order);
    const price = priceFor_(order, steer, order.groupFrac);
    const now = new Date();

    sh.getRange(at, COL_SIGNED_BY).setValue(name);
    sh.getRange(at, COL_SIGNED_AT).setValue(now.toISOString());

    /* Stripe is the judge of "paid", not the checkbox. A bank debit that
       hasn't cleared yet is "pending" — real, but not money in hand. */
    let state = row[22] ? "paid" : "none";
    if (state !== "paid") {
      try { const b = landBalance_(code, { quietRanch: true }); if (b) state = b.state; } catch (err) { state = "none"; }
    }
    const paid = state === "paid";

    const pdf = pdfBlob_(body.pdf, code, "signed");
    const alreadySent = !!row[23];
    let sentToButcher = false;
    if (paid && !alreadySent) {
      sendToButcher_(order, steer, price, pdf, name, now);
      sh.getRange(at, COL_BUTCHER_AT).setValue(now.toISOString());
      sentToButcher = true;
    }
    notifyRanchSigned_(order, price, pdf, name, now, state, sentToButcher || alreadySent);
    return json_({ ok: true, paid: paid, pending: state === "pending", sentToButcher: sentToButcher || alreadySent });
  }

  if (body.action === "order") {
    const o = body.order;
    if (!o || !o.code || !o.email) return json_({ ok: false, error: "missing order" });
    o.email = String(o.email).trim();
    const summary = (body.summary || []).map(l => l.name + ": " + l.detail).join("\n");
    const cost = body.cost || {};
    /* this season while the share still fits in what's left, otherwise the next */
    const a = availability_();
    o.season = a.reserved + (SHARE_FRAC[o.share] || 0) <= a.capacity + 1e-6 ? CURRENT_SEASON : NEXT_SEASON;

    /* a friend's code puts this order in their group (chains collapse
       onto the same root); otherwise it starts its own */
    let referral = String(body.referral || o.referral || "").trim().toUpperCase();
    let group = o.code, rootInfo = null;
    if (referral) {
      const refRow = rows_().find(r => String(r[0]).toUpperCase() === referral);
      if (refRow) { const ref = orderFromRow_(refRow); group = ref.group || ref.code; rootInfo = groupInfo_()[group] || null; }
      else referral = "";
    }

    /* the deposit: $300 for an order on its own, $600 from an organizer
       covering the group, $0 for a friend an organizer's $600 covers.
       The sheet decides the kind from what it can see, not the browser. */
    let kind = "single";
    if (rootInfo && group !== o.code) kind = rootInfo.depositKind === "group" ? "covered" : "single";
    else if (String(body.depositKind) === "group" && o.share !== "whole") kind = "group";
    const amount = kind === "group" ? GROUP_DEPOSIT : kind === "covered" ? 0 : DEPOSIT;
    const target = group === o.code && o.share !== "whole" ? (String(body.groupTarget) === "half" && o.share === "quarter" ? "half" : "whole") : "";
    o.depositKind = kind; o.depositAmount = amount; if (target) o.groupTarget = target;
    cost.deposit = amount; cost.balance = Number(cost.total || 0) - amount;

    /* covered: nothing to pay now — reserved outright if the organizer's
       deposit is in, otherwise held until it lands */
    const reservedNow = kind === "covered" && rootInfo && rootInfo.depositPaid;
    let depId = "", depUrl = "";
    if (amount > 0) {
      if (stripeKey_()) {
        try {
          const link = makeLink_(o, amount, kind === "group" ? "group deposit" : "deposit", "card", SITE_URL + "/#/order/confirmed/" + o.code + "?paid=1");
          depId = link.id; depUrl = link.url;
        } catch (err) { depUrl = String(body.depositLink || ""); }
      } else {
        depUrl = String(body.depositLink || "");
      }
    }

    sheet_().appendRow([
      o.code, new Date(o.createdAt || Date.now()), reservedNow ? "reserved" : "pending-deposit",
      o.name, o.email, o.phone, o.address,
      o.share, cost.total, cost.deposit, cost.balance,
      summary, (o.cutSheet && o.cutSheet.notes) || "", JSON.stringify(o),
      "", o.season,
      "", "", "", "", "", "", "", "", "", "", "",
      referral, group, depId, depUrl, reservedNow ? new Date().toISOString() : "",
      kind, amount, target,
    ]);
    const emailErrors = [];
    if (reservedNow) {
      o.status = "reserved";
      try { notifyRanch_(o, summary, cost); } catch (err) { emailErrors.push("ranch: " + (err && err.message || err)); }
      try { confirmCustomer_(withGroup_(o), summary, cost, null, true); } catch (err) { emailErrors.push("customer: " + (err && err.message || err)); }
    } else {
      try { pendingCustomer_(o, summary, depUrl); } catch (err) { emailErrors.push("customer: " + (err && err.message || err)); }
    }
    return json_({ ok: true, code: o.code, season: o.season, depositUrl: depUrl, status: reservedNow ? "reserved" : "pending-deposit", depositAmount: amount, emailErrors: emailErrors });
  }

  return json_({ ok: false, error: "unknown action" });
}

/* ---------------- back office writes (key already checked) ---------------- */

/* After an organizer's group deposit lands: every covered friend who
   joined early is reserved and told so. */
function releaseCovered_(root) {
  const sh = sheet_();
  const rows = rows_();
  rows.forEach((r, i) => {
    const o = orderFromRow_(r);
    if (!o || o.code === root || (o.group || o.code) !== root) return;
    if (o.status !== "pending-deposit" || o.depositKind !== "covered") return;
    const at = i + 2;
    sh.getRange(at, COL_STATUS).setValue("reserved");
    sh.getRange(at, COL_DEP_PAID).setValue(new Date().toISOString());
    o.status = "reserved";
    const summary = String(r[11] || ""), cost = { total: r[8], deposit: 0, balance: r[8] };
    try { notifyRanch_(o, summary, cost); } catch (err) { /* keep going */ }
    try { confirmCustomer_(withGroup_(o), summary, cost, null, true); } catch (err) { /* keep going */ }
  });
}

function orderRow_(code) {
  const i = rows_().findIndex(r => String(r[0]).toUpperCase() === String(code).toUpperCase());
  return i < 0 ? -1 : i + 2;
}

function adminPost_(body) {
  if (body.action === "status") {
    const row = orderRow_(body.code);
    if (row < 0) return json_({ ok: false, error: "not found" });
    sheet_().getRange(row, COL_STATUS).setValue(body.status);
    return json_({ ok: true });
  }

  if (body.action === "assign") {
    const row = orderRow_(body.code);
    if (row < 0) return json_({ ok: false, error: "not found" });
    const sh = sheet_();
    if (body.steer !== undefined) sh.getRange(row, COL_STEER).setNumberFormat("@").setValue(String(body.steer || "").trim());
    if (body.season) {
      if (!SEASON_COPY[body.season]) return json_({ ok: false, error: "unknown season" });
      sh.getRange(row, COL_SEASON).setValue(body.season);
    }
    return json_({ ok: true });
  }

  if (body.action === "steer") {
    const st = body.steer || {};
    const id = String(st.id || "").trim();
    if (!id) return json_({ ok: false, error: "steer needs an ID" });
    const was = String(body.originalId || id).trim();
    const sh = steerSheet_();
    const ids = steers_().map(x => x.id);
    if (id !== was && ids.indexOf(id) >= 0) return json_({ ok: false, error: "that steer ID is already used" });
    const values = [
      id,
      SEASON_COPY[st.season] ? st.season : CURRENT_SEASON,
      Number(st.hangingWeight) > 0 ? Number(st.hangingWeight) : "",
      st.readyDate || "",
      Number(st.rate) > 0 ? Number(st.rate) : "",
      st.killDate || "",
      st.pickupFrom || "",
      st.pickupUntil || "",
    ];
    if (st.pickupFrom && st.pickupUntil && String(st.pickupFrom) > String(st.pickupUntil)) return json_({ ok: false, error: "pickup window ends before it starts" });
    const at = steerRow_(was);
    if (at < 0) sh.appendRow(values);
    else sh.getRange(at, 1, 1, STEER_HEADERS.length).setValues([values]);
    if (id !== was) relink_(was, id);
    return json_({ ok: true });
  }

  if (body.action === "steer-delete") {
    const id = String(body.id || "").trim();
    const at = steerRow_(id);
    if (at < 0) return json_({ ok: false, error: "not found" });
    steerSheet_().deleteRow(at);
    relink_(id, "");
    return json_({ ok: true });
  }

  if (body.action === "stripe-check") {
    /* Is the key usable, which mode is it, and is ACH switched on —
       without creating anything or sending anyone an email. */
    if (!stripeKey_()) return json_({ ok: false, error: "STRIPE_SECRET_KEY isn't set in Script Properties." });
    const key = stripeKey_();
    const shape = key.indexOf("sk_") === 0 ? "secret" : key.indexOf("rk_") === 0 ? "restricted" : key.indexOf("pk_") === 0 ? "PUBLISHABLE (wrong kind — needs the secret key)" : "unrecognised";
    try {
      const bal = stripe_("get", "/balance");
      let ach = "unknown";
      try {
        const pmc = stripe_("get", "/payment_method_configurations");
        const cfgs = pmc.data || [];
        ach = cfgs.some(c => c.us_bank_account && c.us_bank_account.available && c.us_bank_account.display_preference && c.us_bank_account.display_preference.value === "on") ? "on" : "off";
      } catch (e2) { /* restricted keys may not read this — leave unknown */ }
      return json_({ ok: true, keyType: shape, livemode: !!bal.livemode, ach: ach });
    } catch (err) {
      return json_({ ok: false, error: "Stripe rejected the key (" + shape + "): " + (err && err.message || err) });
    }
  }

  if (body.action === "pickup-ready") {
    /* one order or every order on a steer; each answers for itself */
    const codes = (Array.isArray(body.codes) ? body.codes : [body.code])
      .map(c => String(c || "").trim().toUpperCase()).filter(Boolean);
    const results = codes.map(code => {
      try { return Object.assign({ code: code }, pickupReady_(code, !!body.paidOutside)); }
      catch (err) { return { code: code, ok: false, error: String(err && err.message || err) }; }
    });
    return json_({ ok: true, results: results });
  }

  if (body.action === "stripe-activity") {
    if (!stripeKey_()) return json_({ ok: false, error: "STRIPE_SECRET_KEY isn't set in Script Properties." });
    return json_(Object.assign({ ok: true }, stripeActivity_()));
  }

  if (body.action === "invoice") {
    const code = String(body.code || "").toUpperCase();
    const at = orderRow_(code);
    if (at < 0) return json_({ ok: false, error: "no order " + code });
    const sh = sheet_();
    const row = sh.getRange(at, 1, 1, HEADERS.length).getValues()[0];
    const order = withGroup_(orderFromRow_(row));
    const steer = steerFor_(order);
    const price = priceFor_(order, steer, order.groupFrac);
    /* the browser asks; the sheet decides what the bill actually is */
    if (!price) return json_({ ok: false, error: "that order's steer has no hanging weight yet" });
    if (!order.email) return json_({ ok: false, error: "that order has no email address" });

    const token = String(row[19] || "") || newToken_();
    const confirmUrl = SITE_URL + "/#/confirm/" + code + "?t=" + token;

    /* a fresh Stripe link for exactly this balance; retire the old one so
       a stale amount can't be paid */
    /* An invoice without a pay link is worse than no invoice — the
       sign-off button would make no sense. So: no links, no email. */
    if (!stripeKey_()) return json_({ ok: false, error: "Invoice NOT sent — STRIPE_SECRET_KEY isn't set in Script Properties (Apps Script → gear → Script Properties)." });
    let achUrl = "", achId = "", cardUrl = "", cardId = "", warning = "";
    try {
      if (row[17]) deactivatePayLink_(String(row[17]));
      if (row[25]) deactivatePayLink_(String(row[25]));
      const links = createPayLinks_(order, price, token);
      if (links.ach) { achUrl = links.ach.url; achId = links.ach.id; }
      cardUrl = links.card.url; cardId = links.card.id;
      if (!links.achAvailable) warning = "Sent with a card link only — ACH isn't enabled on the Stripe account yet (Stripe → Settings → Payment methods → ACH Direct Debit).";
    } catch (err) {
      return json_({ ok: false, error: "Invoice NOT sent — Stripe wouldn't create the pay link: " + (err && err.message || err) });
    }

    sh.getRange(at, COL_INVOICED).setValue(new Date().toISOString());
    sh.getRange(at, COL_PLINK_ID).setValue(achId);
    sh.getRange(at, COL_PLINK_URL).setValue(achUrl);
    sh.getRange(at, COL_TOKEN).setNumberFormat("@").setValue(token);
    sh.getRange(at, COL_CARD_ID).setValue(cardId);
    sh.getRange(at, COL_CARD_URL).setValue(cardUrl);

    const pdf = body.pdf ? pdfBlob_(body.pdf, code) : null;
    invoiceCustomer_(order, steer, price, { achUrl: achUrl, cardUrl: cardUrl, confirmUrl: confirmUrl, pdf: pdf });
    const out = { ok: true, payUrl: achUrl || cardUrl };
    if (warning) out.warning = warning;
    return json_(out);
  }


  if (body.action === "settings") {
    const capacity = Math.round(Number(body.capacity));
    const offline = Math.round(Number(body.offline) * 4) / 4;
    if (!(capacity >= 1) || !(offline >= 0)) return json_({ ok: false, error: "bad settings" });
    props_().setProperties({ SEASON_CAPACITY: String(capacity), SEASON_OFFLINE: String(offline) });
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

/* Sheet row of a steer by ID, or -1. */
function steerRow_(id) {
  const sh = steerSheet_();
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const i = sh.getRange(2, 1, last - 1, 1).getValues().findIndex(r => String(r[0]).trim() === id);
  return i < 0 ? -1 : i + 2;
}

/* Point every order linked to steer `from` at `to` ("" = unassigned). */
function relink_(from, to) {
  const sh = sheet_();
  rows_().forEach((r, i) => {
    if (String(r[14] || "").trim() === from) sh.getRange(i + 2, COL_STEER).setNumberFormat("@").setValue(to);
  });
}

/* ---------------- email ---------------- */

/* The final money for one order, once its steer has a weight. Mirrors
   finalPrice() in src/lib/estimate.ts — keep the two in step. Returns
   null while the animal is still unweighed. */
function priceFor_(order, steer, groupFrac) {
  if (!steer || !(Number(steer.hangingWeight) > 0)) return null;
  const hangingLbs = Number(steer.hangingWeight);
  /* the tier sets the list rate; a heavy-steer discount (entered on the
     steer as a whole-share rate) comes off every tier by the same amount */
  const flat = flatRateSeason_(order.season);   // pre-tier season: steer rate flat, no groups
  const tier = flat ? order.share : tierFor_(order.share, groupFrac);
  const standardRate = flat ? STANDARD_RATE : SHARE_RATES[tier];
  const steerRate = Number(steer.rate) > 0 ? Number(steer.rate) : 0;
  const steerDiscount = flat ? 0 : steerRate ? Math.max(0, Math.round((SHARE_RATES.whole - steerRate) * 100) / 100) : 0;
  const rate = flat ? (steerRate || STANDARD_RATE) : Math.round((standardRate - steerDiscount) * 100) / 100;
  const shareLbs = Math.round(hangingLbs * (SHARE_FRAC[order.share] || 0));
  const total = Math.round(shareLbs * rate);
  const adjusted = flat ? rate < standardRate : steerDiscount > 0;
  /* the patty fee is the butcher's, but it reaches them through us —
     the customer writes one check, to the ranch */
  const pattyLbs = pattyPounds_(order.cutSheet);
  const pattyCharge = Math.round(pattyLbs * PATTY_RATE);
  const billTotal = total + pattyCharge;
  const deposit = depositCredit_(order);
  return {
    rate: rate,
    standardRate: standardRate,
    tier: tier,
    groupFrac: flat || groupFrac == null ? (SHARE_FRAC[order.share] || 0) : groupFrac,
    groupUnlocked: tier !== order.share,
    adjusted: adjusted,
    heavy: adjusted && hangingLbs > HANGING_TYP,
    hangingLbs: hangingLbs,
    shareLbs: shareLbs,
    beefTotal: total,
    pattyLbs: pattyLbs,
    pattyCharge: pattyCharge,
    total: billTotal,
    deposit: deposit,
    balance: billTotal - deposit,
    saved: adjusted ? Math.round(shareLbs * (standardRate - rate)) : 0,
  };
}

/* Pounds of ground going to patties, from the cut sheet's "40 lb". */
function pattyPounds_(a) {
  if (!a || !a.patties) return 0;
  const lbs = parseInt(a.pattyLbs, 10);
  return isNaN(lbs) || lbs <= 0 ? PATTY_MIN_LBS : lbs;
}

/* The customer-facing reason for a reduced rate — only claims the
   carcass weight is why when the carcass actually was heavy. */
function rateNote_(p) {
  if (!p || !p.adjusted) return "";
  const from = "$" + p.standardRate.toFixed(2);
  const to = "$" + p.rate.toFixed(2);
  return p.heavy
    ? "Your steer came in at " + p.hangingLbs + " lb hanging — heavier than our typical animal. "
      + "Because of that we've brought your price down from " + from + " to " + to + " per pound, "
      + "which saves you " + money_(p.saved) + " against our standard rate."
    : "We've brought your price down from " + from + " to " + to + " per pound on this animal, "
      + "which saves you " + money_(p.saved) + " against our standard rate.";
}

function steerFor_(order) {
  if (!order || !order.steer) return null;
  const all = steers_();
  for (let i = 0; i < all.length; i++) if (all[i].id === order.steer) return all[i];
  return null;
}

function shareLabel_(s) { return { quarter: "Quarter", half: "Half", whole: "Whole" }[s] || s; }
function seasonCopy_(id) { return SEASON_COPY[id] || SEASON_COPY[CURRENT_SEASON]; }
function seasonLabel_(id) { const n = seasonCopy_(id).name; return n.charAt(0).toUpperCase() + n.slice(1); }
function money_(n) { return "$" + Number(n || 0).toLocaleString(); }

function notifyRanch_(o, summary, cost) {
  const to = props_().getProperty("NOTIFY_EMAILS");
  if (!to) return;
  const subject = "New beef order " + o.code + " — " + shareLabel_(o.share) + " — " + o.name;
  const bodyText = [
    "New order on the Thunderbolt Ranch site.",
    "",
    "Order: " + o.code,
    "Share: " + shareLabel_(o.share) + " beef",
    "Harvest: " + seasonLabel_(o.season) + (o.season !== CURRENT_SEASON ? "  (didn't fit in what's left of this season)" : ""),
    "Total: " + money_(cost.total) + "  ·  Deposit: " + money_(cost.deposit) + "  ·  Balance: " + money_(cost.balance),
    "",
    "Customer: " + o.name,
    "Email: " + o.email,
    "Phone: " + o.phone,
    "Address: " + o.address,
    "",
    "CUT SHEET",
    summary,
    o.cutSheet && o.cutSheet.notes ? "\nNotes: " + o.cutSheet.notes : "",
    "",
    "The full order is in the Orders sheet. Download the filled CCMC PDF from the site's Ranch Office.",
  ].join("\n");
  MailApp.sendEmail({ to: to, subject: subject, body: bodyText });
}

/* Sent the moment a cut sheet is saved: here's your code, finish the
   deposit, and a way back if they wander off Stripe. */
function pendingCustomer_(o, summary, depositUrl) {
  const first = (o.name || "").split(" ")[0];
  const share = shareLabel_(o.share).toLowerCase();
  const back = SITE_URL + "/#/order/confirmed/" + o.code;
  const text = [
    "Hi " + first + ",",
    "",
    "Your cut sheet for a " + share + " beef is saved under order code " + o.code + ".",
    "Your share is held once the " + money_(DEPOSIT) + " deposit is in:",
    depositUrl ? "   Pay the deposit by card: " + depositUrl : "   Reply to this email and we'll send a payment link.",
    "",
    "Already paid? Confirm here: " + back,
    "",
    "YOUR CUT SHEET",
    summary,
    "",
    "— Thunderbolt Ranch · Ranch to Table",
  ].join("\n");
  const btn = (url, label, bg) => '<a href="' + url + '" style="display:inline-block;padding:13px 22px;background:' + bg + ';color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-family:Helvetica,Arial,sans-serif">' + label + '</a>';
  const html = '<div style="font-family:Georgia,serif;color:#2b2521;max-width:620px;margin:0 auto;line-height:1.55">'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a3b22">Thunderbolt Ranch · One step left</div>'
    + '<h1 style="font-weight:400;font-size:26px;margin:6px 0 14px">Your cut sheet is saved, ' + esc_(first) + '.</h1>'
    + '<p>Order code <b style="font-family:monospace">' + esc_(o.code) + '</b>. Your ' + esc_(share) + ' is held once the ' + money_(DEPOSIT) + ' deposit is in.</p>'
    + (depositUrl ? '<p style="margin:16px 0">' + btn(depositUrl, 'Pay the ' + money_(DEPOSIT) + ' deposit', '#7a3b22') + '</p>' : '<p>Reply to this email and we\'ll send a payment link.</p>')
    + '<p style="font-size:13px;color:#555">Already paid? <a href="' + back + '">Confirm your reservation</a>.</p>'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a6333;margin:22px 0 8px">Your cut sheet</div>'
    + '<pre style="font-family:Menlo,Consolas,monospace;font-size:12.5px;line-height:1.6;background:#f7f3ea;border:1px solid #e6e0d4;border-radius:4px;padding:14px;white-space:pre-wrap;margin:0">' + esc_(summary) + '</pre>'
    + '<p style="color:#888;font-size:13px;margin-top:22px">— Thunderbolt Ranch · Ranch to Table</p></div>';
  MailApp.sendEmail({ to: o.email, subject: "Finish your Thunderbolt Ranch reservation — " + o.code, body: text, htmlBody: html, name: "Thunderbolt Ranch", replyTo: RANCH_INBOX });
}

/* `receipt` (from receiptOf_) when a deposit payment is what got them
   here: the email doubles as the payment confirmation, so it says so in
   the subject and names the amount, card and time. */
function confirmCustomer_(o, summary, cost, depositLink, paid, receipt) {
  const first = (o.name || "").split(" ")[0];
  const share = shareLabel_(o.share).toLowerCase();
  const subject = receipt
    ? "Deposit received — your Thunderbolt Ranch beef is reserved (" + o.code + ")"
    : "Your Thunderbolt Ranch beef is reserved — " + o.code;
  const receiptLine = receipt
    ? "Payment confirmation: " + money_(receipt.amount) + (receipt.method ? " · " + receipt.method : "") + " · " + whenText_(receipt.when) + "."
    : "";
  const season = seasonCopy_(o.season);
  const rolled = o.season !== CURRENT_SEASON;
  const harvestLine = rolled
    ? "Our " + seasonCopy_(CURRENT_SEASON).name + " harvest doesn't have a " + share + " left, so your share is reserved from our " + season.name + " harvest — pickup " + season.pickup + "."
    : "Your share comes from our " + season.name + " harvest — pickup " + season.pickup + ".";
  const trackUrl = SITE_URL + "/#/track/" + o.code;
  const steps = [
    ["This " + season.name, "Harvest. Your beef dry-ages 14 days at Colorado Custom Meat Co in Kersey."],
    ["After the hang", "Cut and packaged to your cut sheet. You can adjust it until your steer goes to the butcher — just reply to this email."],
    ["Once weighed", "You get an invoice email with your filled-out cut sheet and your exact balance. Pay it by bank (no fee) or card from the link, then sign off — that sends your sheet to the butcher."],
    ["Pickup, " + season.pickup, "Colorado Custom, 443 4th Street, Kersey CO. We'll confirm the date. It comes out frozen, vacuum-sealed and boxed — just leave room in the vehicle."],
  ];

  const text = [
    "Hi " + first + ",",
    "",
    "Thanks for reserving a " + share + " beef from Thunderbolt Ranch. Your order code is " + o.code + ".",
    harvestLine,
    "",
    paid
      ? (o.depositKind === "covered" ? "Your share is covered by your organizer's group deposit — reserved, nothing to pay now."
        : "Deposit received — " + money_(o.depositAmount == null ? DEPOSIT : o.depositAmount) + (o.depositKind === "group" ? " (your group deposit, which covers your friends too)" : "") + ". Your " + share + " is reserved."
          + (receiptLine ? "\n" + receiptLine + " No need to pay again." + (receipt.url ? "\nStripe receipt: " + receipt.url : "") : ""))
      : depositLink
        ? "PAY YOUR " + money_(DEPOSIT) + " DEPOSIT: " + depositLink
        : "We'll reach out shortly to collect your " + money_(DEPOSIT) + " deposit.",
    "Your deposit holds your share and applies to your total. Estimated total " + money_(cost.total) + " — the exact balance is figured on your animal's actual hanging weight, and you'll be invoiced for it once it's weighed. Nothing is due at pickup.",
    "",
    "WHAT HAPPENS NEXT",
  ].concat(steps.map(s => s[0] + " — " + s[1])).concat([
    "",
    "YOUR CUT SHEET",
    summary,
    "",
    "SPLIT A STEER WITH FRIENDS — everyone pays less",
    "Your code: " + o.code + ". One friend who orders with it gets you both the half-steer rate ($" + SHARE_RATES.half.toFixed(2) + "/lb); three gets everyone the whole-steer rate ($" + SHARE_RATES.whole.toFixed(2) + "/lb).",
    "Send them this link and your code is filled in: " + SITE_URL + "/#/order?ref=" + o.code,
    "",
    "Track your order any time: " + trackUrl,
    "Questions? Reply to this email, or write thunderboltbeef@gmail.com.",
    "",
    "— Thunderbolt Ranch · Ranch to Table",
  ]);

  const btn = (url, label, bg) => '<a href="' + url + '" style="display:inline-block;padding:13px 22px;background:' + bg + ';color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-family:Helvetica,Arial,sans-serif">' + label + '</a>';
  const html = [
    '<div style="font-family:Georgia,serif;color:#2b2521;max-width:620px;margin:0 auto;line-height:1.55">',
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a3b22">Thunderbolt Ranch · Reserved</div>',
    '<h1 style="font-weight:400;font-size:26px;margin:6px 0 14px">Your ' + esc_(share) + ' beef is booked, ' + esc_(first) + '.</h1>',
    '<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#555;margin:0 0 18px">Order code <b style="font-family:monospace;font-size:15px;color:#2b2521">' + esc_(o.code) + '</b> · ' + esc_(harvestLine) + '</p>',
    '<div style="margin:0 0 22px;padding:18px;background:#2b2521;color:#f3eee6;border-radius:4px">',
    paid
      ? '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c8a85a">' + (o.depositKind === "covered" ? 'Covered by your group' : 'Deposit received') + '</div><p style="margin:8px 0;font-size:18px">' + (o.depositKind === "covered" ? 'Your organizer\'s group deposit covers you' : money_(o.depositAmount == null ? DEPOSIT : o.depositAmount) + (o.depositKind === "group" ? ' group deposit' : '')) + ' — your ' + esc_(share) + ' is reserved. &#10003;</p>'
        + (receiptLine ? '<p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#cfc6b8">' + esc_(receiptLine) + ' No need to pay again.' + (receipt.url ? ' <a href="' + receipt.url + '" style="color:#c8a85a">Stripe receipt</a>' : '') + '</p>' : '')
      : depositLink
        ? '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c8a85a">One step to hold your share</div><div style="margin:10px 0 8px">' + btn(depositLink, 'Pay your ' + money_(DEPOSIT) + ' deposit', '#b08d45') + '</div>'
        : '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c8a85a">Deposit</div><p style="margin:8px 0">We\'ll reach out shortly to collect your ' + money_(DEPOSIT) + ' deposit.</p>',
    '<p style="font-size:13px;color:#cfc6b8;margin:6px 0 0">Your deposit applies to your total. Estimated total ' + money_(cost.total) + ' — the exact balance is figured on your animal\'s actual hanging weight. You\'ll be invoiced for it once it\'s weighed, with a link to pay by bank (no fee) or card. <b style="color:#f3eee6">Nothing is due at pickup.</b></p>',
    '</div>',
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a6333;margin-bottom:8px">What happens next</div>',
    '<table style="border-collapse:collapse;width:100%;font-family:Helvetica,Arial,sans-serif;font-size:14px">',
  ].concat(steps.map(s =>
    '<tr><td style="padding:8px 12px 8px 0;vertical-align:top;white-space:nowrap;color:#7a3b22;font-family:monospace;font-size:12px">' + esc_(s[0]) + '</td><td style="padding:8px 0;vertical-align:top;color:#444;border-bottom:1px solid #e6e0d4">' + esc_(s[1]) + '</td></tr>'
  )).concat([
    '</table>',
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a6333;margin:22px 0 8px">Your cut sheet</div>',
    '<pre style="font-family:Menlo,Consolas,monospace;font-size:12.5px;line-height:1.6;background:#f7f3ea;border:1px solid #e6e0d4;border-radius:4px;padding:14px;white-space:pre-wrap;margin:0">' + esc_(summary) + '</pre>',
    '<div style="margin:22px 0;padding:16px 18px;background:#f3ecd8;border-left:4px solid #b08d45;font-family:Helvetica,Arial,sans-serif">'
    + '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7a6333">Split a steer with friends — everyone pays less</div>'
    + '<p style="margin:6px 0 0;font-size:14px">Your code is <b style="font-family:monospace;font-size:15px">' + esc_(o.code) + '</b>. One friend who orders with it gets you both the half-steer rate ($' + SHARE_RATES.half.toFixed(2) + '/lb); three gets everyone the whole-steer rate ($' + SHARE_RATES.whole.toFixed(2) + '/lb).</p>'
    + '<p style="margin:8px 0 0;font-size:13px"><a href="' + SITE_URL + '/#/order?ref=' + esc_(o.code) + '" style="color:#7a3b22">Send friends this link</a> and your code is filled in for them.</p></div>',
    '<p style="margin:22px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px">' + btn(trackUrl, 'Track your order', '#7a3b22') + '</p>',
    '<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#555">Questions? Just reply to this email.</p>',
    '<p style="color:#888;font-size:13px">— Thunderbolt Ranch · Ranch to Table</p>',
    '</div>',
  ]).join("");

  MailApp.sendEmail({ to: o.email, subject: subject, body: text.join("\n"), htmlBody: html, name: "Thunderbolt Ranch", replyTo: RANCH_INBOX });
}

/* ---------------- the final invoice ----------------
   Sent by hand from the Ranch Office once a steer's numbers are
   settled. Everything in it is recomputed here from the sheet. The
   customer gets the filled cut sheet, a card link for the exact
   balance, the butcher's number, and a button to sign off. */

function publicPricing_(steer) {
  if (!steer || !(Number(steer.hangingWeight) > 0)) return null;
  const p = { hangingWeight: Number(steer.hangingWeight), rate: Number(steer.rate) > 0 ? Number(steer.rate) : STANDARD_RATE, steerId: steer.id };
  if (steer.readyDate) p.readyDate = steer.readyDate;
  if (steer.killDate) p.killDate = steer.killDate;
  return p;
}

function orderRow_(code) {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const codes = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < codes.length; i++) if (String(codes[i][0]).toUpperCase() === code) return i + 2;
  return -1;
}

function newToken_() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let t = "";
  for (let i = 0; i < 24; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));
  return t;
}
function tokenOk_(row, t) {
  const want = String(row[19] || "");
  return want.length >= 16 && String(t || "") === want;
}

function pdfBlob_(b64, code, tag) {
  return Utilities.newBlob(Utilities.base64Decode(String(b64)), "application/pdf",
    "CCMC-cut-sheet-" + code + (tag ? "-" + tag : "") + ".pdf");
}

/* ---- Stripe, via the REST API. The secret key lives only in Script
   Properties (STRIPE_SECRET_KEY) and only this file ever sees it. ---- */

function stripeKey_() { return String(props_().getProperty("STRIPE_SECRET_KEY") || "").trim(); }

/* RUN THIS ONCE FROM THE EDITOR after pasting a version that talks to
   Stripe: pick `authorizeStripe` in the function dropdown and press
   Run. Google then asks for the "connect to an external service"
   permission (UrlFetchApp) — a redeploy alone never prompts for it,
   which is why Test Stripe can fail with "You do not have permission
   to call UrlFetchApp.fetch" even with a good key. */
function authorizeStripe() {
  const key = stripeKey_();
  if (!key) { Logger.log("STRIPE_SECRET_KEY isn't set in Script Properties yet."); return; }
  const r = UrlFetchApp.fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: "Bearer " + key }, muteHttpExceptions: true,
  });
  Logger.log(r.getResponseCode() === 200
    ? "Authorized, and Stripe accepted the key. Press Test Stripe in the Ranch Office."
    : "Authorized (the call went out), but Stripe answered " + r.getResponseCode() + ": " + r.getContentText().slice(0, 240));
}

function stripe_(method, path, params) {
  const opts = { method: method, headers: { Authorization: "Bearer " + stripeKey_() }, muteHttpExceptions: true };
  if (params) { opts.payload = params; opts.contentType = "application/x-www-form-urlencoded"; }
  const res = UrlFetchApp.fetch("https://api.stripe.com/v1" + path, opts);
  const body = JSON.parse(res.getContentText() || "{}");
  if (res.getResponseCode() >= 300) throw new Error("Stripe: " + ((body.error && body.error.message) || res.getResponseCode()));
  return body;
}

/* Two one-off Payment Links per invoice: bank (ACH) at the balance,
   and card at the balance plus the card fee. Payment Links don't expire
   the way Checkout Sessions do, so the email stays good. If ACH isn't
   enabled on the Stripe account yet only the card link is made and the
   Ranch Office is told. */
function cardAmount_(balance) { return Math.round(balance * (1 + CARD_FEE_PCT)); }

function makeLink_(order, amountDollars, label, method, redirectUrl) {
  const priceObj = stripe_("post", "/prices", {
    unit_amount: String(Math.round(amountDollars * 100)),
    currency: "usd",
    "product_data[name]": "Thunderbolt Ranch — " + label + ", order " + order.code + " (" + shareLabel_(order.share) + " beef)",
  });
  const link = stripe_("post", "/payment_links", {
    "line_items[0][price]": priceObj.id,
    "line_items[0][quantity]": "1",
    "payment_method_types[0]": method,
    "metadata[order]": order.code,
    "metadata[method]": method,
    "after_completion[type]": "redirect",
    "after_completion[redirect][url]": redirectUrl,
  });
  return {
    id: link.id,
    url: link.url + "?client_reference_id=" + encodeURIComponent(order.code) + "&prefilled_email=" + encodeURIComponent(order.email),
  };
}

function createPayLinks_(order, price, token) {
  const back = SITE_URL + "/#/confirm/" + order.code + "?t=" + token + "&paid=1";
  const out = { ach: null, card: null, achAvailable: true };
  try {
    out.ach = makeLink_(order, price.balance, "balance by bank", "us_bank_account", back);
  } catch (err) {
    if (!/us_bank_account|payment_method/i.test(String(err && err.message || err))) throw err;
    out.achAvailable = false;
  }
  out.card = makeLink_(order, cardAmount_(price.balance), "balance by card incl. " + Math.round(CARD_FEE_PCT * 100) + "% card fee", "card", back);
  return out;
}

function deactivatePayLink_(id) {
  try { stripe_("post", "/payment_links/" + id, { active: "false" }); } catch (err) { /* already gone — fine */ }
}

/* What Stripe shows across this order's links: "paid", "pending" (a
   bank debit was submitted and is still clearing — ACH takes about
   four business days), or "none". */
function payLinkState_(ids) {
  return paidSession_(ids).state;
}

/* The checkout behind that state — the paid one, else one still
   clearing — with its charge expanded so a receipt can name the card. */
function paidSession_(ids) {
  if (!stripeKey_()) return { state: "none", session: null };
  let pending = null;
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) continue;
    const r = stripe_("get", "/checkout/sessions?payment_link=" + encodeURIComponent(ids[i]) + "&limit=20&expand[]=data.payment_intent.latest_charge");
    const d = r.data || [];
    const paid = d.find(x => x.payment_status === "paid");
    if (paid) return { state: "paid", session: paid };
    if (!pending) pending = d.find(x => x.status === "complete") || null;
  }
  return pending ? { state: "pending", session: pending } : { state: "none", session: null };
}

/* What a receipt says about a payment: how much, when, with what. */
function receiptOf_(session) {
  const pi = session && typeof session.payment_intent === "object" ? session.payment_intent : null;
  const ch = pi && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const pm = (ch && ch.payment_method_details) || {};
  const brand = pm.card && pm.card.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : "Card";
  const method = pm.type === "card" ? brand + " •••• " + pm.card.last4
    : pm.type === "us_bank_account" ? (pm.us_bank_account.bank_name || "Bank account") + " •••• " + pm.us_bank_account.last4
    : pm.type === "link" ? "Link" : "";
  return {
    amount: session ? (session.amount_total || 0) / 100 : 0,
    when: new Date(((ch && ch.created) || (session && session.created) || Date.now() / 1000) * 1000),
    method: method,
    url: (ch && ch.receipt_url) || "",
  };
}

/* A sheet timestamp (Date, ISO string or yyyy-mm-dd) as a ranch-time day,
   "October 9, 2026" — an evening payment's UTC stamp is already tomorrow. */
function dayText_(v) {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return prettyDate_(String(v));
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? String(v) : Utilities.formatDate(d, Session.getScriptTimeZone(), "MMMM d, yyyy");
}

function whenText_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), "MMMM d, yyyy 'at' h:mm a"); }

/* Every page of a Stripe list, up to `max` items. */
function stripeList_(path, params, max) {
  const out = [];
  let after = "";
  while (out.length < max) {
    const q = Object.keys(params).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
      .concat(["limit=100"], after ? ["starting_after=" + after] : []).join("&");
    const r = stripe_("get", path + "?" + q);
    const d = r.data || [];
    Array.prototype.push.apply(out, d);
    if (!r.has_more || !d.length) break;
    after = d[d.length - 1].id;
  }
  return out;
}

const DEPOSIT_AMOUNTS = [250, DEPOSIT, GROUP_DEPOSIT];   // the fall $250, today's $300, a group's $600

/* What the Ranch Office's Stripe tab shows, read-only: payments (each
   tied to an order where it can be), payouts and the balance. A payment
   is tied by the order code the checkout carried, else by the order's
   own pay links, else by email — the closest order in time when one
   email placed several. */
function stripeActivity_() {
  const charges = stripeList_("/charges", { "expand[]": "data.balance_transaction" }, 500);
  const sessions = stripeList_("/checkout/sessions", {}, 500);
  const payouts = stripeList_("/payouts", { "expand[]": "data.destination" }, 200);
  const bal = stripe_("get", "/balance");

  const orders = rows_().map(r => ({
    code: String(r[0]).toUpperCase(), name: String(r[3] || ""), email: String(r[4] || "").trim().toLowerCase(),
    created: new Date(r[1]).getTime() || 0, depLink: String(r[29] || ""),
    balLinks: [String(r[17] || ""), String(r[25] || "")].filter(Boolean),
  }));
  const byCode = {};
  orders.forEach(o => { byCode[o.code] = o; });
  const sessionFor = {};
  sessions.forEach(s => { if (s.payment_intent) sessionFor[s.payment_intent] = s; });

  const payments = charges.map(c => {
    const s = sessionFor[c.payment_intent] || null;
    const bd = c.billing_details || {};
    const email = String((s && s.customer_details && s.customer_details.email) || bd.email || c.receipt_email || "").trim();
    const link = s && s.payment_link ? String(s.payment_link) : "";
    const ref = s && s.client_reference_id ? String(s.client_reference_id).toUpperCase() : "";
    let order = null, how = "";
    if (ref && byCode[ref]) { order = byCode[ref]; how = "code"; }
    if (!order && link) {
      order = orders.find(o => o.depLink === link || o.balLinks.indexOf(link) >= 0) || null;
      if (order) how = "link";
    }
    if (!order && email) {
      const t = c.created * 1000;
      const same = orders.filter(o => o.email === email.toLowerCase())
        .sort((a, b) => Math.abs(a.created - t) - Math.abs(b.created - t));
      if (same.length) { order = same[0]; how = "email"; }
    }
    const amount = c.amount / 100;
    const kind = order && order.balLinks.indexOf(link) >= 0 ? "balance"
      : DEPOSIT_AMOUNTS.indexOf(amount) >= 0 ? "deposit" : order ? "balance" : "other";
    const pm = c.payment_method_details || {};
    const card = pm.card || {}, bank = pm.us_bank_account || {};
    const bt = c.balance_transaction && typeof c.balance_transaction === "object" ? c.balance_transaction : null;
    return {
      id: c.id, paymentIntent: c.payment_intent || "", amount: amount, refunded: (c.amount_refunded || 0) / 100,
      currency: String(c.currency || "usd").toUpperCase(),
      status: c.disputed ? "disputed" : c.refunded ? (c.captured ? "refunded" : "reversed")
        : c.amount_refunded > 0 ? "partially-refunded" : c.status === "failed" ? "failed"
        : c.status === "pending" ? "pending" : !c.captured ? "uncaptured" : "succeeded",
      failure: c.failure_message || "",
      method: pm.type === "card" ? { type: "card", brand: card.brand || "", last4: card.last4 || "", wallet: card.wallet ? card.wallet.type : "" }
        : pm.type === "us_bank_account" ? { type: "bank", brand: bank.bank_name || "", last4: bank.last4 || "" }
        : { type: String(pm.type || "") },
      email: email, name: String(bd.name || (s && s.customer_details && s.customer_details.name) || ""),
      created: new Date(c.created * 1000).toISOString(),
      fee: bt ? bt.fee / 100 : null, net: bt ? bt.net / 100 : null,
      order: order ? order.code : "", orderName: order ? order.name : "", matchedBy: how, kind: kind,
    };
  });

  const sum = list => (list || []).filter(x => x.currency === "usd").reduce((t, x) => t + x.amount, 0) / 100;
  return {
    livemode: !!bal.livemode,
    balance: { available: sum(bal.available), pending: sum(bal.pending) },
    payments: payments,
    payouts: payouts.map(p => {
      const d = p.destination && typeof p.destination === "object" ? p.destination : {};
      return {
        id: p.id, amount: p.amount / 100, currency: String(p.currency || "usd").toUpperCase(), status: p.status,
        arrival: new Date(p.arrival_date * 1000).toISOString(), created: new Date(p.created * 1000).toISOString(),
        type: p.type === "card" ? "Payout to debit card" : "Payout to bank account", method: p.method || "standard",
        destination: { bank: String(d.bank_name || d.brand || ""), last4: String(d.last4 || "") },
        failure: p.failure_message || "",
      };
    }),
  };
}

/* ---- payments land once: recorded once, the customer told once ----
   The customer's page, the Ranch Office and the ten-minute timer can all
   ask at the same moment; the script lock and a re-read of the row make
   sure only the first one records it and sends the email. */

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function rowAt_(at) { return sheet_().getRange(at, 1, 1, HEADERS.length).getValues()[0]; }

/* The deposit, if Stripe has it: reserved, dated, receipt sent.
   { row, paid } — paid is true when it's in, now or before. Null: no such order. */
function landDeposit_(code) {
  const got = withLock_(() => {
    const at = orderRow_(code);
    if (at < 0) return null;
    const row = rowAt_(at);
    if (row[2] !== "pending-deposit") return { row: row, paid: true };
    if (!row[29] || !stripeKey_()) return { row: row, paid: false };
    let hit;
    try { hit = paidSession_([String(row[29])]); } catch (err) { return { row: row, paid: false }; }
    if (hit.state !== "paid") return { row: row, paid: false };
    const sh = sheet_(), now = new Date().toISOString();
    sh.getRange(at, COL_STATUS).setValue("reserved");
    sh.getRange(at, COL_DEP_PAID).setValue(now);
    row[2] = "reserved"; row[31] = now;
    return { row: row, paid: true, landed: true, receipt: receiptOf_(hit.session) };
  });
  if (!got || !got.landed) return got;
  const order = orderFromRow_(got.row);
  const summary = String(got.row[11] || "");
  const cost = { total: got.row[8], deposit: got.row[9], balance: got.row[10] };
  try { notifyRanch_(order, summary, cost); } catch (err) { /* don't fail the customer for a ranch email */ }
  try { confirmCustomer_(withGroup_(order), summary, cost, null, true, got.receipt); } catch (err) { /* ditto */ }
  /* an organizer's group deposit also covers friends who joined before it landed */
  if (order.depositKind === "group") releaseCovered_(order.code);
  return got;
}

/* The invoice balance, if Stripe has it: dated, receipt (with the paid
   invoice attached) to the customer, a note to the ranch. A bank payment
   still clearing is noted as "pending" and nothing is sent yet.
   { row, state: "paid" | "pending" | "none" }. Null: no such order. */
function landBalance_(code, opts) {
  opts = opts || {};
  const got = withLock_(() => {
    const at = orderRow_(code);
    if (at < 0) return null;
    const row = rowAt_(at);
    if (row[22]) return { row: row, state: "paid" };
    if (!(row[17] || row[25]) || !stripeKey_()) return { row: row, state: "none" };
    const hit = paidSession_([String(row[17] || ""), String(row[25] || "")]);
    const sh = sheet_();
    if (hit.state === "pending" && row[24] !== "pending") { sh.getRange(at, COL_PAY_STATE).setValue("pending"); row[24] = "pending"; }
    if (hit.state !== "paid") return { row: row, state: hit.state };
    const receipt = receiptOf_(hit.session);
    /* a card payment carries the card fee on top of the balance — say so,
       or "$1,185" next to a "$1,150 balance" looks like an overcharge */
    const o = orderFromRow_(row), price = o ? priceFor_(o, steerFor_(o), withGroup_(o).groupFrac) : null;
    const withFee = price && receipt.amount > price.balance + 0.5;
    const paidWith = (receipt.method ? receipt.method + " · " : "") + money_(receipt.amount)
      + (withFee ? " incl. " + Math.round(CARD_FEE_PCT * 100) + "% card fee" : "");
    sh.getRange(at, COL_PAID_AT).setValue(receipt.when.toISOString());
    sh.getRange(at, COL_PAY_STATE).setValue("paid");
    sh.getRange(at, COL_PAID_WITH).setValue(paidWith);
    row[22] = receipt.when.toISOString(); row[24] = "paid"; row[36] = paidWith;
    return { row: row, state: "paid", landed: true, receipt: receipt };
  });
  if (!got || !got.landed) return got;
  const order = withGroup_(orderFromRow_(got.row));
  const steer = steerFor_(order);
  const price = priceFor_(order, steer, order.groupFrac);
  try { balanceReceipt_(order, steer, price, got.receipt, got.row); } catch (err) { console.error("balance receipt " + code + ": " + err); }
  if (!opts.quietRanch) {
    try { notifyRanchPaid_(order, got.receipt, got.row); } catch (err) { /* keep going */ }
  }
  return got;
}

/* Every ten minutes (installPaymentSync sets it up): deposits and
   balances Stripe has taken since anyone looked. */
function syncPayments() {
  if (!stripeKey_()) return;
  rows_().forEach(r => {
    const code = String(r[0] || "").trim().toUpperCase();
    if (!code) return;
    try {
      if (r[2] === "pending-deposit" && r[29]) landDeposit_(code);
      else if (!r[22] && (r[17] || r[25])) landBalance_(code);
    } catch (err) { console.error("syncPayments " + code + ": " + err); }
  });
}

/* RUN THIS ONCE FROM THE EDITOR: pick `installPaymentSync` and press Run.
   Google asks for the new "run when you're not there" permission, then
   syncPayments runs every ten minutes on its own. Safe to run again. */
function installPaymentSync() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "syncPayments")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncPayments").timeBased().everyMinutes(10).create();
  syncPayments();
  Logger.log("Payment sync is on: every 10 minutes, deposits and invoice payments are recorded and receipts sent.");
}

/* ---- ready for pickup ---- */

/* One order: the steer has a pickup window and the balance is paid
   (or Josh says it was paid outside Stripe) → the email, with the paid
   invoice attached, and the order moves to "ready". */
function pickupReady_(code, paidOutside) {
  const at = orderRow_(code);
  if (at < 0) return { ok: false, error: "no order " + code };
  let row = rowAt_(at);
  const order = withGroup_(orderFromRow_(row));
  const steer = steerFor_(order);
  if (!steer) return { ok: false, error: "no steer linked" };
  if (!steer.pickupFrom || !steer.pickupUntil) return { ok: false, error: "steer " + steer.id + " has no pickup window" };
  if (!order.email) return { ok: false, error: "no email address" };
  const price = priceFor_(order, steer, order.groupFrac);
  if (!price) return { ok: false, error: "steer " + steer.id + " has no hanging weight" };
  const sh = sheet_();
  if (!row[22]) {
    /* the timer may not have looked yet */
    try { const b = landBalance_(code); if (b) row = b.row; } catch (err) { /* fall through */ }
  }
  if (!row[22]) {
    if (!paidOutside) return { ok: false, unpaid: true, error: "Stripe shows no balance payment" };
    const now = new Date().toISOString();
    sh.getRange(at, COL_PAID_AT).setValue(now);
    sh.getRange(at, COL_PAY_STATE).setValue("outside");
    sh.getRange(at, COL_PAID_WITH).setValue("paid outside Stripe");
    row[22] = now; row[24] = "outside"; row[36] = "paid outside Stripe";
  }
  const pdf = invoiceConfirmationPdf_(order, steer, price, row);
  pickupEmail_(order, steer, price, pdf);
  sh.getRange(at, COL_STATUS).setValue("ready");
  sh.getRange(at, COL_READY_AT).setValue(new Date().toISOString());
  return { ok: true };
}

/* "Saturday, January 9" — a pickup day, with the weekday so nobody
   drives to Kersey on a Sunday. */
function pickupDay_(ymd) {
  const parts = String(ymd || "").split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(d.getTime()) ? String(ymd || "") : Utilities.formatDate(d, Session.getScriptTimeZone(), "EEEE, MMMM d");
}

function pickupWindow_(steer) {
  return pickupDay_(steer.pickupFrom) + " – " + pickupDay_(steer.pickupUntil) + ", " + String(steer.pickupUntil).slice(0, 4);
}

/* What the paid invoice says. Shared by the receipt and the pickup
   email's attachment so they can never disagree. */
function paidLines_(order, price, row) {
  const lines = [["Beef — " + price.shareLbs + " lb × $" + price.rate.toFixed(2) + "/lb", money_(price.beefTotal)]];
  if (price.pattyCharge > 0) lines.push(["Patties — " + price.pattyLbs + " lb × $" + PATTY_RATE.toFixed(2) + "/lb", money_(price.pattyCharge)]);
  lines.push(["Total", money_(price.total)]);
  if (price.deposit > 0) lines.push(["Deposit paid" + (order.depositPaidAt ? " " + dayText_(order.depositPaidAt) : ""), "−" + money_(price.deposit)]);
  if (row[22]) lines.push(["Balance paid " + dayText_(row[22]) + (row[36] ? " · " + row[36] : ""), "−" + money_(price.balance)]);
  return lines;
}

/* The final invoice, marked paid, as a PDF. */
function invoiceConfirmationPdf_(order, steer, price, row) {
  const paid = !!row[22];
  const lines = paidLines_(order, price, row);
  const cell = 'style="padding:7px 0;border-bottom:1px solid #ddd"';
  const html = [
    '<html><head><meta charset="utf-8"></head><body style="font-family:Helvetica,Arial,sans-serif;color:#2b2521;font-size:12px;margin:36px">',
    '<table style="width:100%"><tr><td><div style="font-size:22px;font-weight:bold">Thunderbolt Ranch LLC</div>',
    '<div style="color:#666">thunderboltbeef.com · ' + RANCH_INBOX + '</div></td>',
    '<td style="text-align:right;vertical-align:top"><div style="font-size:16px;font-weight:bold">' + (paid ? 'FINAL INVOICE — PAID IN FULL' : 'FINAL INVOICE') + '</div>',
    '<div style="color:#666">Order ' + esc_(order.code) + ' · issued ' + dayText_(new Date()) + '</div></td></tr></table>',
    '<hr style="border:0;border-top:2px solid #2b2521;margin:16px 0">',
    '<table style="width:100%;font-size:12px"><tr>',
    '<td style="vertical-align:top;width:50%"><div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px">Billed to</div>',
    '<div>' + esc_(order.name) + '</div><div>' + esc_(order.email) + '</div>' + (order.phone ? '<div>' + esc_(order.phone) + '</div>' : '') + '</td>',
    '<td style="vertical-align:top"><div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px">Your beef</div>',
    '<div>' + esc_(shareLabel_(order.share)) + ' share · steer ' + esc_(steer.id) + '</div>',
    '<div>' + price.hangingLbs + ' lb hanging · your share ' + price.shareLbs + ' lb</div>',
    order.signedBy ? '<div>Cut sheet signed by ' + esc_(order.signedBy) + (order.signedAt ? ', ' + dayText_(order.signedAt) : '') + '</div>' : '',
    '</td></tr></table>',
    '<table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:12px">',
  ].concat(lines.map(l => '<tr><td ' + cell + '>' + esc_(l[0]) + '</td><td ' + cell + ' align="right">' + esc_(l[1]) + '</td></tr>')).concat([
    '<tr><td style="padding:10px 0;font-weight:bold;font-size:14px;border-top:2px solid #2b2521">Amount due</td>',
    '<td style="padding:10px 0;font-weight:bold;font-size:14px;border-top:2px solid #2b2521" align="right">' + (paid ? '$0' : money_(price.balance)) + '</td></tr>',
    '</table>',
    steer.pickupFrom && steer.pickupUntil
      ? '<div style="margin-top:22px;padding:12px 14px;background:#f3ecd8"><b>Pickup ' + esc_(pickupWindow_(steer)) + '</b><br>'
        + esc_(BUTCHER_NAME) + ', ' + esc_(BUTCHER_ADDRESS) + ' · ' + BUTCHER_PHONE + '<br>' + esc_(BUTCHER_HOURS.join(" · ")) + '</div>'
      : '',
    '<p style="color:#666;margin-top:22px">Nothing is due at pickup. Thank you for buying beef straight from the ranch.</p>',
    '</body></html>',
  ]).join("");
  return Utilities.newBlob(html, "text/html", "invoice.html").getAs("application/pdf")
    .setName("Thunderbolt-Ranch-invoice-" + order.code + (paid ? "-paid" : "") + ".pdf");
}

/* "Payment received" for the invoice balance. */
function balanceReceipt_(o, steer, price, receipt, row) {
  const first = (o.name || "").split(" ")[0];
  const signUrl = row[19] && !row[20] ? SITE_URL + "/#/confirm/" + o.code + "?t=" + row[19] : "";
  const paidLine = "We received your payment of " + money_(receipt.amount) + (receipt.method ? " (" + receipt.method + ")" : "")
    + " on " + whenText_(receipt.when) + ". Order " + o.code + " is paid in full.";
  const lines = price ? paidLines_(o, price, row) : [];
  const next = signUrl
    ? "One step left: sign off on your cut sheet so it can go to the butcher — " + signUrl
    : "Your signed cut sheet is going to the butcher. We'll email you when your beef is ready, with the pickup window and directions.";
  const text = ["Hi " + first + ",", "", paidLine, ""]
    .concat(lines.map(l => l[0] + ": " + l[1]))
    .concat(["Amount due: $0", "", next, "", receipt.url ? "Stripe receipt: " + receipt.url : "", "Your paid invoice is attached. Questions? Just reply.", "", "— Thunderbolt Ranch · Ranch to Table"]);
  const html = [
    '<div style="font-family:Georgia,serif;color:#2b2521;max-width:620px;margin:0 auto;line-height:1.55">',
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5b7a4e">Thunderbolt Ranch · Payment received</div>',
    '<h1 style="font-weight:400;font-size:26px;margin:6px 0 14px">Paid in full — thank you, ' + esc_(first) + '.</h1>',
    '<p>' + esc_(paidLine) + '</p>',
    '<table style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:14px;width:100%">',
  ].concat(lines.map(l => '<tr><td style="padding:6px 0;border-bottom:1px solid #e6e0d4">' + esc_(l[0]) + '</td><td style="text-align:right;border-bottom:1px solid #e6e0d4">' + esc_(l[1]) + '</td></tr>')).concat([
    '<tr style="font-weight:700"><td style="padding:10px 0">Amount due</td><td style="text-align:right">$0</td></tr></table>',
    signUrl
      ? '<p style="margin:18px 0"><a href="' + signUrl + '" style="display:inline-block;padding:13px 22px;background:#7a3b22;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-family:Helvetica,Arial,sans-serif">Sign off on your cut sheet</a><br><span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#555">One step left — it goes to the butcher once you sign.</span></p>'
      : '<p>' + esc_(next) + '</p>',
    receipt.url ? '<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px"><a href="' + receipt.url + '" style="color:#7a3b22">Stripe receipt</a></p>' : '',
    '<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#555">Your paid invoice is attached. Questions? Just reply to this email.</p>',
    '<p style="color:#888;font-size:13px">— Thunderbolt Ranch · Ranch to Table</p></div>',
  ]).join("");
  const msg = { to: o.email, subject: "Payment received — order " + o.code + " is paid in full", body: text.filter(x => x !== null).join("\n"), htmlBody: html, name: "Thunderbolt Ranch", replyTo: RANCH_INBOX };
  if (price && steer) msg.attachments = [invoiceConfirmationPdf_(o, steer, price, row)];
  MailApp.sendEmail(msg);
}

/* The ranch hears about a balance the timer (or the customer's page) found. */
function notifyRanchPaid_(o, receipt, row) {
  const signed = !!row[20], sent = !!row[23];
  MailApp.sendEmail({
    to: RANCH_INBOX,
    subject: "💵 Balance paid — " + o.code + " · " + o.name + " · " + money_(receipt.amount),
    body: [
      o.name + " paid " + money_(receipt.amount) + (receipt.method ? " (" + receipt.method + ")" : "") + " on " + whenText_(receipt.when) + ". They've been sent a receipt.",
      "",
      !signed ? "They haven't signed off on the cut sheet yet — the receipt reminds them."
        : sent ? "Their signed sheet already went to the butcher."
          : "They signed while the payment was clearing, so the signed sheet did NOT go to the butcher. Forward it from the \"Signed cut sheet — " + o.code + "\" email to " + butcherEmail_() + ".",
      "",
      "Ranch Office: " + SITE_URL + "/#/customers",
    ].join("\n"),
  });
}

/* "Your beef is ready" — the pickup window, where, when they're open,
   who to call, and the paid invoice attached. */
function pickupEmail_(o, steer, price, pdf) {
  const first = (o.name || "").split(" ")[0];
  const share = shareLabel_(o.share).toLowerCase();
  const windowText = pickupWindow_(steer);
  const tell = "Tell them you're picking up Thunderbolt Ranch beef for " + o.name + " — steer " + steer.id + ", order " + o.code + ".";
  const tips = [
    "Nothing to pay at pickup — your balance is paid.",
    "It comes out frozen, vacuum-sealed, labeled and boxed. Leave room in the vehicle and clear space in the freezer before you go.",
    "Please pick up by " + pickupDay_(steer.pickupUntil) + " — a $10/day storage fee applies after that.",
    "Running late or need a different day? Call the butcher at " + BUTCHER_PHONE + ".",
  ];
  const text = [
    "Hi " + first + ",",
    "",
    "Thank you for paying in full — your " + share + " beef is ready.",
    "",
    "PICK UP: " + windowText,
    BUTCHER_NAME + ", " + BUTCHER_ADDRESS,
    "Map: " + BUTCHER_MAP,
    "Phone: " + BUTCHER_PHONE,
    "Hours: " + BUTCHER_HOURS.join(" · "),
    "",
    tell,
    "",
  ].concat(tips.map(t => "• " + t)).concat([
    "",
    "Your paid invoice is attached. Questions about your order? Just reply.",
    "",
    "— Thunderbolt Ranch · Ranch to Table",
  ]);
  const html = [
    '<div style="font-family:Georgia,serif;color:#2b2521;max-width:620px;margin:0 auto;line-height:1.55">',
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5b7a4e">Thunderbolt Ranch · Ready for pickup</div>',
    '<h1 style="font-weight:400;font-size:26px;margin:6px 0 14px">Your beef is ready, ' + esc_(first) + '.</h1>',
    '<p>Thank you for paying in full. Your ' + esc_(share) + ' is cut, wrapped and frozen at the butcher.</p>',
    '<div style="margin:18px 0;padding:18px;background:#2b2521;color:#f3eee6;border-radius:4px;font-family:Helvetica,Arial,sans-serif">',
    '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c8a85a">Pick up</div>',
    '<div style="font-size:20px;margin:6px 0 12px;font-family:Georgia,serif">' + esc_(windowText) + '</div>',
    '<div style="font-size:15px"><b>' + esc_(BUTCHER_NAME) + '</b><br><a href="' + BUTCHER_MAP + '" style="color:#f3eee6">' + esc_(BUTCHER_ADDRESS) + '</a><br>',
    '<a href="tel:' + BUTCHER_PHONE + '" style="color:#f3eee6">' + BUTCHER_PHONE + '</a></div>',
    '<div style="font-size:13px;color:#cfc6b8;margin-top:10px">' + BUTCHER_HOURS.map(esc_).join('<br>') + '</div>',
    '</div>',
    '<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;padding:12px 16px;background:#f3ecd8;border-left:4px solid #b08d45">' + esc_(tell) + '</p>',
    '<ul style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#444;padding-left:20px">',
  ].concat(tips.map(t => '<li style="margin:6px 0">' + esc_(t) + '</li>')).concat([
    '</ul>',
    '<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#555">Your paid invoice is attached. Questions about your order? Just reply to this email.</p>',
    '<p style="color:#888;font-size:13px">— Thunderbolt Ranch · Ranch to Table</p></div>',
  ]).join("");
  MailApp.sendEmail({
    to: o.email, subject: "Your Thunderbolt Ranch beef is ready for pickup — " + o.code,
    body: text.join("\n"), htmlBody: html, name: "Thunderbolt Ranch", replyTo: RANCH_INBOX, attachments: [pdf],
  });
}

/* ---- the emails ---- */

function moneyLines_(o, price) {
  const lines = ["Beef: " + price.shareLbs + " lb × $" + price.rate.toFixed(2) + "/lb = " + money_(price.beefTotal)
    + (price.groupUnlocked ? "   (your group filled " + (price.tier === "whole" ? "a whole steer" : "half a steer") + " — " + price.tier + "-steer rate)" : "")];
  if (price.pattyCharge > 0) {
    lines.push("Patties: " + price.pattyLbs + " lb × $" + PATTY_RATE.toFixed(2) + "/lb = " + money_(price.pattyCharge) + "  (the butcher's charge for pressing them, which we pay and add here)");
    lines.push("Total: " + money_(price.total));
  }
  if (price.deposit > 0) lines.push("Deposit already paid: −" + money_(price.deposit));
  lines.push("BALANCE DUE: " + money_(price.balance));
  return lines;
}

function esc_(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function invoiceCustomer_(o, steer, price, opts) {
  const first = (o.name || "").split(" ")[0];
  const subject = "Your Thunderbolt Ranch invoice — " + o.code;
  const note = rateNote_(price);
  const readyLine = steer.readyDate
    ? "Ready for pickup: " + prettyDate_(steer.readyDate) + " at Colorado Custom Meat Co, 443 4th Street, Kersey CO."
    : "Pickup at Colorado Custom Meat Co, 443 4th Street, Kersey CO — we'll confirm the date.";
  const feePct = Math.round(CARD_FEE_PCT * 100) + "%";
  const cardAmt = cardAmount_(price.balance);
  const payText = [
    opts.achUrl ? "   By bank (ACH), " + money_(price.balance) + ", no fee: " + opts.achUrl : "",
    opts.cardUrl ? "   By card, " + money_(cardAmt) + " (includes a " + feePct + " card fee): " + opts.cardUrl : "",
  ].filter(Boolean).join("\n");

  const text = [
    "Hi " + first + ",",
    "",
    "Your " + shareLabel_(o.share).toLowerCase() + " beef is cut and weighed. Three things, in order:",
    "",
    "1. REVIEW YOUR CUT SHEET — it's attached. Reply to this email with any changes before you sign.",
    "2. PAY YOUR BALANCE of " + money_(price.balance) + ":",
    payText,
    "3. SIGN OFF — once you've paid and the sheet is right, confirm here: " + opts.confirmUrl,
    "   That sends your signed cut sheet to the butcher. (Bank payments take a few business days to clear — your sheet goes over once it does.)",
    "",
    "QUESTIONS ABOUT CUTS?  Colorado Custom Meat Co — " + BUTCHER_PHONE,
    "Questions about your order or the bill: reply to this email.",
    "",
    "YOUR ANIMAL",
    "Steer: " + (o.steer || "—") + "   Hanging weight: " + price.hangingLbs + " lb   Your share: " + price.shareLbs + " lb",
    "",
    "WHAT YOU OWE",
  ].concat(moneyLines_(o, price)).concat([
    "",
    "That's one payment, to Thunderbolt Ranch LLC — nothing to settle with the butcher.",
  ]);
  if (note) text.push("", "GOOD NEWS ON YOUR PRICE", note);
  text.push("", readyLine, "Everything comes out frozen, vacuum-sealed, labeled and boxed — just leave room in the vehicle.", "", "— Thunderbolt Ranch · Ranch to Table");

  const btn = (url, label, bg) => '<a href="' + url + '" style="display:inline-block;padding:13px 22px;background:' + bg + ';color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-family:Helvetica,Arial,sans-serif">' + label + '</a>';
  const html = [
    '<div style="font-family:Georgia,serif;color:#2b2521;max-width:620px;margin:0 auto;line-height:1.55">',
    '<p>Hi ' + esc_(first) + ',</p>',
    '<p>Your ' + esc_(shareLabel_(o.share).toLowerCase()) + ' beef is cut and weighed. Three things, in order:</p>',
    '<ol style="padding-left:20px">',
    '<li style="margin-bottom:14px"><b>Review your cut sheet</b> — it\'s attached. Reply to this email with any changes <i>before</i> you sign.</li>',
    '<li style="margin-bottom:14px"><b>Pay your balance of ' + money_(price.balance) + '.</b><br>' +
      '<div style="margin:10px 0">'
        + (opts.achUrl ? btn(opts.achUrl, 'Pay ' + money_(price.balance) + ' by bank — no fee', '#7a3b22') + '<div style="font-size:12px;color:#666;margin:6px 0 12px">Bank (ACH) takes a few business days to clear.</div>' : '')
        + (opts.cardUrl ? btn(opts.cardUrl, 'Pay ' + money_(cardAmt) + ' by card', '#5a5047') + '<div style="font-size:12px;color:#666;margin-top:6px">Includes a ' + feePct + ' card fee (' + money_(cardAmt - price.balance) + ').</div>' : '')
        + '</div></li>',
    '<li><b>Sign off.</b> Once you\'ve paid and the sheet is right:<br><div style="margin:10px 0">' + btn(opts.confirmUrl, 'Everything looks good & I\'ve paid', '#2b2521') + '</div><span style="font-size:13px;color:#666">That sends your signed cut sheet to the butcher.</span></li>',
    '</ol>',
    '<div style="margin:22px 0;padding:16px 18px;background:#f3ecd8;border-left:4px solid #b08d45;font-family:Helvetica,Arial,sans-serif">',
    '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7a6333">Questions about cuts?</div>',
    '<div style="font-size:20px;margin-top:4px"><b>Colorado Custom Meat Co — <a href="tel:' + BUTCHER_PHONE + '" style="color:#2b2521">' + BUTCHER_PHONE + '</a></b></div>',
    '<div style="font-size:13px;color:#555;margin-top:4px">Questions about your order or the bill: just reply to this email.</div>',
    '</div>',
    '<table style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:14px;width:100%">',
    '<tr><td style="padding:6px 0;color:#666">Steer ' + esc_(o.steer || '—') + ' · ' + price.hangingLbs + ' lb hanging · your share ' + price.shareLbs + ' lb</td><td></td></tr>',
    '<tr><td style="padding:6px 0">Beef — ' + price.shareLbs + ' lb × $' + price.rate.toFixed(2) + '/lb</td><td style="text-align:right">' + money_(price.beefTotal) + '</td></tr>',
    price.pattyCharge > 0 ? '<tr><td style="padding:6px 0">Patties — ' + price.pattyLbs + ' lb × $' + PATTY_RATE.toFixed(2) + '/lb (the butcher\'s charge, which we pay and add here)</td><td style="text-align:right">' + money_(price.pattyCharge) + '</td></tr>' : '',
    price.deposit > 0 ? '<tr><td style="padding:6px 0">Deposit already paid</td><td style="text-align:right">−' + money_(price.deposit) + '</td></tr>' : '',
    '<tr style="font-weight:700;border-top:2px solid #2b2521"><td style="padding:10px 0">Balance due</td><td style="text-align:right;padding:10px 0">' + money_(price.balance) + '</td></tr>',
    '</table>',
    '<p style="font-size:13px;color:#555">One payment, to Thunderbolt Ranch LLC — nothing to settle with the butcher.</p>',
    note ? '<p style="padding:12px 16px;background:#e9efe4;border-left:4px solid #5b7a4e"><b>Good news on your price.</b> ' + esc_(note) + '</p>' : '',
    '<p>' + esc_(readyLine) + '<br>Everything comes out frozen, vacuum-sealed, labeled and boxed — just leave room in the vehicle.</p>',
    '<p style="color:#666">— Thunderbolt Ranch · Ranch to Table</p>',
    '</div>',
  ].join("");

  const msg = { to: o.email, subject: subject, body: text.join("\n"), htmlBody: html, name: "Thunderbolt Ranch", replyTo: RANCH_INBOX };
  if (opts.pdf) msg.attachments = [opts.pdf];
  MailApp.sendEmail(msg);
}

function notifyRanchSigned_(o, price, pdf, name, when, state, toButcher) {
  const status = state === "paid"
    ? (toButcher ? "Paid in Stripe. Signed sheet sent to " + butcherEmail_() + "." : "Paid in Stripe.")
    : state === "pending"
      ? "ACH BANK PAYMENT IS PROCESSING in Stripe — usually clears in about 4 business days. Sheet NOT sent to the butcher yet; forward the attached sheet once Stripe shows it paid (or now, if you're comfortable)."
      : "NO PAYMENT FOUND in Stripe yet. Sheet NOT sent to the butcher — check Stripe, then forward the attached sheet yourself.";
  MailApp.sendEmail({
    to: RANCH_INBOX,
    subject: (state === "paid" ? "✓ " : state === "pending" ? "⏳ " : "⚠ ") + "Signed cut sheet — " + o.code + " · " + o.name,
    body: [
      o.name + " signed off on order " + o.code + " (" + shareLabel_(o.share) + " beef).",
      "Signed as: " + name + " · " + when.toLocaleString(),
      price ? "Balance: " + money_(price.balance) : "",
      "",
      status,
      "",
      "Ranch Office: " + SITE_URL + "/#/customers",
    ].join("\n"),
    attachments: [pdf],
  });
}

function sendToButcher_(o, steer, price, pdf, name, when) {
  MailApp.sendEmail({
    to: butcherEmail_(),
    cc: RANCH_INBOX,
    subject: "Cut sheet — " + o.name + " · " + shareLabel_(o.share) + " beef · steer " + (o.steer || "—") + " · Thunderbolt Ranch",
    body: [
      "Attached: signed cutting instructions for " + o.name + ".",
      "",
      "Steer / tag: " + (o.steer || "—"),
      "Kill date: " + (steer && steer.killDate ? prettyDate_(steer.killDate) : "—"),
      "Hanging weight: " + (price ? price.hangingLbs + " lb" : "—"),
      "Share: " + shareLabel_(o.share),
      "Customer: " + o.name + " · " + o.phone + " · " + o.email,
      "Signed by customer: " + name + ", " + when.toLocaleDateString(),
      "",
      "Questions — Thunderbolt Ranch, thunderboltbeef@gmail.com (reply to this email).",
    ].join("\n"),
    name: "Thunderbolt Ranch",
    replyTo: RANCH_INBOX,
    attachments: [pdf],
  });
}


/* ---------------- group invites ----------------
   Email via MailApp; text via Twilio when TWILIO_SID / TWILIO_TOKEN /
   TWILIO_FROM are in Script Properties. Every invite is logged to an
   "Invites" sheet so a complaint can be traced. */

const INVITE_SHEET = "Invites";
function inviteSheet_() {
  const ss = book_();
  let sh = ss.getSheetByName(INVITE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(INVITE_SHEET);
    sh.appendRow(["Sent at", "Order", "Invited name", "Email", "Phone", "Emailed", "Texted", "Note"]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 8).setFontWeight("bold");
    sh.getRange("E:E").setNumberFormat("@");
  }
  return sh;
}
function inviteCount_(code) {
  const sh = inviteSheet_();
  const last = sh.getLastRow();
  if (last < 2) return 0;
  return sh.getRange(2, 2, last - 1, 1).getValues().filter(r => String(r[0]).toUpperCase() === code).length;
}
function logInvite_(code, name, email, phone, r) {
  inviteSheet_().appendRow([new Date().toISOString(), code, name, email, phone, r.emailed ? "yes" : "", r.texted ? "yes" : "", r.note || ""]);
}

function normalizePhone_(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") return "+" + digits;
  return digits.charAt(0) === "+" ? digits : "+" + digits;
}

function twilioReady_() {
  const p = props_();
  return !!(p.getProperty("TWILIO_SID") && p.getProperty("TWILIO_TOKEN") && p.getProperty("TWILIO_FROM"));
}

function inviteSms_(order, name, to) {
  const p = props_();
  const sid = p.getProperty("TWILIO_SID"), token = p.getProperty("TWILIO_TOKEN"), from = p.getProperty("TWILIO_FROM");
  const first = (order.name || "").split(" ")[0];
  const body = (name ? name + " — " : "") + first + " invited you to split a steer from Thunderbolt Ranch (Colorado Angus, cut your way). "
    + "Order with code " + order.code + " and everyone pays less: " + SITE_URL + "/#/order?ref=" + order.code
    + " Reply STOP to opt out.";
  const res = UrlFetchApp.fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", {
    method: "post",
    headers: { Authorization: "Basic " + Utilities.base64Encode(sid + ":" + token) },
    payload: { To: to, From: from, Body: body },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    let msg = String(res.getResponseCode());
    try { msg = JSON.parse(res.getContentText()).message || msg; } catch (e) { /* keep code */ }
    throw new Error("Twilio: " + msg);
  }
}

function inviteEmail_(order, name, to) {
  const first = (order.name || "").split(" ")[0];
  const link = SITE_URL + "/#/order?ref=" + order.code;
  const info = groupInfo_()[order.group || order.code] || {};
  const filling = info.target === "half" ? "half a steer" : "a whole steer";
  const covered = info.depositKind === "group";
  const hi = name ? "Hi " + esc_(name.split(" ")[0]) + "," : "Hi,";
  const subject = first + " invited you to split a steer — Thunderbolt Ranch";
  const text = [
    name ? "Hi " + name.split(" ")[0] + "," : "Hi,",
    "",
    first + " is ordering beef from Thunderbolt Ranch — one Colorado Angus, pasture-raised, grain-finished, cut however you want it — and wants to split a steer with you.",
    "",
    "Order with " + first + "'s code and everyone in the group pays less per pound:",
    "   1 friend  → the half-steer rate,  $" + SHARE_RATES.half.toFixed(2) + "/lb",
    "   3 friends → the whole-steer rate, $" + SHARE_RATES.whole.toFixed(2) + "/lb",
    "",
    "Order here (the code is filled in for you): " + link,
    "Code: " + order.code,
    "",
    "You get your own cut sheet — your beef, your way. " + (covered ? first + "'s group deposit covers you — nothing to pay up front." : "$" + DEPOSIT + " deposit holds your share."),
    "The group is filling " + filling + ".",
    "",
    "— Thunderbolt Ranch · Ranch to Table · thunderboltbeef.com",
  ].join("\n");
  const btn = (url, label, bg) => '<a href="' + url + '" style="display:inline-block;padding:13px 22px;background:' + bg + ';color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-family:Helvetica,Arial,sans-serif">' + label + '</a>';
  const html = '<div style="font-family:Georgia,serif;color:#2b2521;max-width:620px;margin:0 auto;line-height:1.55">'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7a3b22">Thunderbolt Ranch · Split a steer</div>'
    + '<h1 style="font-weight:400;font-size:26px;margin:6px 0 14px">' + esc_(first) + ' wants to split a steer with you.</h1>'
    + '<p>' + hi + '</p>'
    + '<p>' + esc_(first) + ' is ordering beef from Thunderbolt Ranch — one Colorado Angus, pasture-raised and grain-finished, cut however you want it — and the more of a steer a group fills, the less everyone pays per pound.</p>'
    + '<table style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:14px;margin:12px 0">'
    + '<tr><td style="padding:6px 14px 6px 0;color:#7a3b22;font-family:monospace;font-size:12px">1 FRIEND</td><td>everyone pays the half-steer rate, $' + SHARE_RATES.half.toFixed(2) + '/lb</td></tr>'
    + '<tr><td style="padding:6px 14px 6px 0;color:#7a3b22;font-family:monospace;font-size:12px">3 FRIENDS</td><td>everyone pays the whole-steer rate, $' + SHARE_RATES.whole.toFixed(2) + '/lb</td></tr>'
    + '</table>'
    + '<p style="margin:18px 0">' + btn(link, "Order with " + esc_(first) + "'s code", '#7a3b22') + '</p>'
    + '<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#555">The code <b style="font-family:monospace">' + esc_(order.code) + '</b> is filled in for you. The group is filling ' + filling + '. You get your own cut sheet — your beef, your way. ' + (covered ? esc_(first) + '\'s group deposit covers you — nothing to pay up front.' : 'A $' + DEPOSIT + ' deposit holds your share.') + '</p>'
    + '<p style="color:#888;font-size:13px">— Thunderbolt Ranch · Ranch to Table · <a href="' + SITE_URL + '" style="color:#7a3b22">thunderboltbeef.com</a></p></div>';
  MailApp.sendEmail({ to: to, subject: subject, body: text, htmlBody: html, name: "Thunderbolt Ranch", replyTo: RANCH_INBOX });
}
