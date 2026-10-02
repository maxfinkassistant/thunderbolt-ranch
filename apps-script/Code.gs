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
const CURRENT_SEASON = "fall-2026";
const NEXT_SEASON = "winter-2027";
const SEASON_COPY = {
  "fall-2026": { name: "fall", pickup: "estimated mid-October" },
  "winter-2027": { name: "winter", pickup: "estimated January" },
};
const DEFAULT_CAPACITY = 7;   // steers this season, until the Ranch Office says otherwise
const SHARE_FRAC = { quarter: 0.25, half: 0.5, whole: 1 };
const DEPOSIT = 250;          // flat, every share size
const HANGING_TYP = 900;      // lb, a typical carcass — above this counts as heavy

const SHEET_NAME = "Orders";
const HEADERS = [
  "Code", "Created", "Status", "Name", "Email", "Phone", "Address",
  "Share", "Total", "Deposit", "Balance", "Summary", "Notes", "Order JSON",
  "Steer", "Season",
];
const COL_STATUS = 3, COL_STEER = 15, COL_SEASON = 16;

const STEER_SHEET = "Steers";
const STEER_HEADERS = ["Steer ID", "Season", "Hanging weight (lb)", "Est. ready date", "Price per lb ($)"];
const STANDARD_RATE = 6.0;   // $/lb hanging, unless a steer says otherwise

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
    .filter(o => o.season === CURRENT_SEASON)
    .reduce((t, o) => t + (SHARE_FRAC[o.share] || 0), 0);
  return { season: CURRENT_SEASON, capacity: s.capacity, reserved: online + s.offline };
}

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
    const steer = order ? steerFor_(order) : null;
    const out = { ok: true, order: order };
    if (steer && Number(steer.hangingWeight) > 0) {
      out.pricing = {
        hangingWeight: Number(steer.hangingWeight),
        rate: Number(steer.rate) > 0 ? Number(steer.rate) : STANDARD_RATE,
      };
      if (steer.readyDate) out.pricing.readyDate = steer.readyDate;
    }
    return json_(out);
  }
  if (q.action === "list") {
    if (!isAdmin_(q.key)) return json_({ ok: false, error: "bad key" });
    return json_({
      ok: true,
      orders: rows_().map(orderFromRow_).filter(Boolean),
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

  if (["status", "assign", "steer", "steer-delete", "settings", "invoice"].indexOf(body.action) >= 0) {
    if (!isAdmin_(body.key)) return json_({ ok: false, error: "bad key" });
    return adminPost_(body);
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
    sheet_().appendRow([
      o.code, new Date(o.createdAt || Date.now()), o.status || "reserved",
      o.name, o.email, o.phone, o.address,
      o.share, cost.total, cost.deposit, cost.balance,
      summary, (o.cutSheet && o.cutSheet.notes) || "", JSON.stringify(o),
      "", o.season,
    ]);
    const emailErrors = [];
    try { notifyRanch_(o, summary, cost); } catch (err) { emailErrors.push("ranch: " + (err && err.message || err)); }
    try { confirmCustomer_(o, summary, cost, body.depositLink); } catch (err) { emailErrors.push("customer: " + (err && err.message || err)); }
    return json_({ ok: true, code: o.code, season: o.season, emailErrors: emailErrors });
  }

  return json_({ ok: false, error: "unknown action" });
}

/* ---------------- back office writes (key already checked) ---------------- */

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
    ];
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

  if (body.action === "invoice") {
    const code = String(body.code || "").toUpperCase();
    const row = rows_().find(r => String(r[0]).toUpperCase() === code);
    if (!row) return json_({ ok: false, error: "no order " + code });
    const order = orderFromRow_(row);
    const steer = steerFor_(order);
    const price = priceFor_(order, steer);
    /* the browser asks; the sheet decides what the bill actually is */
    if (!price) return json_({ ok: false, error: "that order's steer has no hanging weight yet" });
    if (!order.email) return json_({ ok: false, error: "that order has no email address" });
    invoiceCustomer_(order, steer, price);
    return json_({ ok: true });
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
function priceFor_(order, steer) {
  if (!steer || !(Number(steer.hangingWeight) > 0)) return null;
  const hangingLbs = Number(steer.hangingWeight);
  const rate = Number(steer.rate) > 0 ? Number(steer.rate) : STANDARD_RATE;
  const shareLbs = Math.round(hangingLbs * (SHARE_FRAC[order.share] || 0));
  const total = Math.round(shareLbs * rate);
  const adjusted = rate < STANDARD_RATE;
  return {
    rate: rate,
    standardRate: STANDARD_RATE,
    adjusted: adjusted,
    heavy: adjusted && hangingLbs > HANGING_TYP,
    hangingLbs: hangingLbs,
    shareLbs: shareLbs,
    total: total,
    deposit: DEPOSIT,
    balance: total - DEPOSIT,
    saved: adjusted ? Math.round(shareLbs * (STANDARD_RATE - rate)) : 0,
  };
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
    "Total: " + money_(cost.total) + "  ·  Deposit: " + money_(cost.deposit) + "  ·  Balance at pickup: " + money_(cost.balance),
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

function confirmCustomer_(o, summary, cost, depositLink) {
  const subject = "Your Thunderbolt Ranch beef is reserved — " + o.code;
  const payLine = depositLink
    ? "Pay your " + money_(cost.deposit) + " deposit here: " + depositLink
    : "Josh will reach out shortly to collect your " + money_(cost.deposit) + " deposit.";
  const season = seasonCopy_(o.season);
  const rolled = o.season !== CURRENT_SEASON;
  const bodyText = [
    "Hi " + (o.name || "").split(" ")[0] + ",",
    "",
    "Thanks for reserving a " + shareLabel_(o.share).toLowerCase() + " beef from Thunderbolt Ranch. Your order code is " + o.code + ".",
    rolled
      ? "Our " + seasonCopy_(CURRENT_SEASON).name + " harvest doesn't have a " + shareLabel_(o.share).toLowerCase() + " left, so your share is reserved from our " + season.name + " harvest — pickup " + season.pickup + "."
      : "Your share comes from our " + season.name + " harvest — pickup " + season.pickup + ".",
    "",
    payLine,
    "Your deposit applies to your total of " + money_(cost.total) + "; the balance of " + money_(cost.balance) + " is due at pickup, payable to Thunderbolt Ranch LLC.",
    "",
    "WHAT HAPPENS NEXT",
    "This " + season.name + " — harvest. Your beef dry-ages 14 days at Colorado Custom Meat Co in Kersey.",
    "After the hang — cut and packaged to your cut sheet (you can adjust it until your steer goes to the butcher — just text Josh).",
    "Pickup, " + season.pickup + " — at Colorado Custom, 443 4th Street, Kersey CO. We'll confirm the date. Bring coolers.",
    "",
    "YOUR CUT SHEET",
    summary,
    "",
    "Questions? Call or text Josh — 402-245-8195, or reply to this email.",
    "",
    "— Thunderbolt Ranch · Ranch to Table",
  ].join("\n");
  MailApp.sendEmail({ to: o.email, subject: subject, body: bodyText, name: "Thunderbolt Ranch" });
}

/* ---------------- the final invoice ----------------
   Sent by hand from the Ranch Office once a steer's numbers are
   settled. Everything in it is recomputed here from the sheet. */

function invoiceCustomer_(o, steer, price) {
  const subject = "Your Thunderbolt Ranch invoice — " + o.code;
  const season = seasonCopy_(o.season);
  const note = rateNote_(price);
  const readyLine = steer.readyDate
    ? "Ready for pickup: " + prettyDate_(steer.readyDate) + " at Colorado Custom Meat Co, 443 4th Street, Kersey CO."
    : "Pickup at Colorado Custom Meat Co, 443 4th Street, Kersey CO — we'll confirm the date.";

  const lines = [
    "Hi " + (o.name || "").split(" ")[0] + ",",
    "",
    "Your " + shareLabel_(o.share).toLowerCase() + " beef is cut and weighed, so here's your final invoice.",
    "",
    "YOUR ANIMAL",
    "Steer: " + (o.steer || "—"),
    "Hanging weight: " + price.hangingLbs + " lb",
    "Your " + shareLabel_(o.share).toLowerCase() + " share: " + price.shareLbs + " lb hanging",
    "",
    "WHAT YOU OWE",
    price.shareLbs + " lb × $" + price.rate.toFixed(2) + "/lb = " + money_(price.total),
    "Deposit already paid: −" + money_(price.deposit),
    "BALANCE DUE AT PICKUP: " + money_(price.balance),
    "",
  ];

  if (note) lines.push("GOOD NEWS ON YOUR PRICE", note, "");

  lines.push(
    readyLine,
    "Bring coolers — everything comes frozen, vacuum-sealed and labeled.",
    "Balance is payable to Thunderbolt Ranch LLC. Checks are fine, or ask Josh about card.",
    "",
    "Questions on any of this? Call or text Josh — 402-245-8195, or just reply here.",
    "",
    "— Thunderbolt Ranch · Ranch to Table",
  );

  MailApp.sendEmail({
    to: o.email,
    subject: subject,
    body: lines.join("\n"),
    name: "Thunderbolt Ranch",
  });
}
