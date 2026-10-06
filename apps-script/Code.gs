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
];
const COL_STATUS = 3, COL_STEER = 15, COL_SEASON = 16;
/* final-invoice workflow columns (1-based) */
const COL_INVOICED = 17, COL_PLINK_ID = 18, COL_PLINK_URL = 19, COL_TOKEN = 20,
      COL_SIGNED_BY = 21, COL_SIGNED_AT = 22, COL_PAID_AT = 23, COL_BUTCHER_AT = 24,
      COL_PAY_STATE = 25,   // "paid" | "pending" (ACH clearing) | ""
      COL_CARD_ID = 26, COL_CARD_URL = 27;   // the card link (+fee); 18/19 are the ACH link

const SITE_URL = "https://thunderboltbeef.com";
const RANCH_INBOX = "thunderboltbeef@gmail.com";
const BUTCHER_PHONE = "970-356-2333";
/* Script property BUTCHER_EMAIL overrides this — point it at yourself
   for a dry run before the first real sheet goes to Colorado Custom. */
function butcherEmail_() { return String(props_().getProperty("BUTCHER_EMAIL") || "order@ccmeatco.com").trim(); }

const STEER_SHEET = "Steers";
const STEER_HEADERS = ["Steer ID", "Season", "Hanging weight (lb)", "Est. ready date", "Price per lb ($)", "Kill date"];
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
    sh.getRange("F:F").setNumberFormat("@");
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
    if (r[16]) o.invoicedAt = dateText_(r[16]);
    if (r[20]) o.signedBy = String(r[20]);
    if (r[21]) o.signedAt = dateText_(r[21]);
    if (r[22]) o.paidAt = dateText_(r[22]);
    if (r[23]) o.butcherSentAt = dateText_(r[23]);
    if (r[24]) o.payState = String(r[24]);
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
    const out = { ok: true, order: order };
    const pricing = order ? publicPricing_(steerFor_(order)) : null;
    if (pricing) out.pricing = pricing;
    return json_(out);
  }
  if (q.action === "confirm" && q.code) {
    /* the page behind the "looks good & I've paid" button — only with
       the token that was in that customer's own email */
    const code = String(q.code).toUpperCase();
    const row = rows_().find(r => String(r[0]).toUpperCase() === code);
    if (!row) return json_({ ok: false, error: "no order " + code });
    if (!tokenOk_(row, q.t)) return json_({ ok: false, error: "that link isn't valid — open it from your invoice email" });
    const order = orderFromRow_(row);
    const out = { ok: true, order: order, butcherPhone: BUTCHER_PHONE, paid: !!row[22] };
    const pricing = publicPricing_(steerFor_(order));
    if (pricing) out.pricing = pricing;
    if (row[18]) out.payUrl = String(row[18]);          // bank (ACH), at the balance
    if (row[26]) out.cardUrl = String(row[26]);         // card, balance + fee
    out.cardFeePct = CARD_FEE_PCT;
    const price = priceFor_(order, steerFor_(order));
    if (price) out.cardAmount = cardAmount_(price.balance);
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
    const order = orderFromRow_(row);
    const steer = steerFor_(order);
    const price = priceFor_(order, steer);
    const now = new Date();

    sh.getRange(at, COL_SIGNED_BY).setValue(name);
    sh.getRange(at, COL_SIGNED_AT).setValue(now.toISOString());

    /* Stripe is the judge of "paid", not the checkbox. A bank debit that
       hasn't cleared yet is "pending" — real, but not money in hand. */
    let state = row[22] ? "paid" : "none";
    if (state !== "paid" && (row[17] || row[25])) {
      try { state = payLinkState_([String(row[17] || ""), String(row[25] || "")]); } catch (err) { state = "none"; }
      if (state === "paid") sh.getRange(at, COL_PAID_AT).setValue(now.toISOString());
    }
    sh.getRange(at, COL_PAY_STATE).setValue(state === "none" ? "" : state);
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
      st.killDate || "",
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
    const at = orderRow_(code);
    if (at < 0) return json_({ ok: false, error: "no order " + code });
    const sh = sheet_();
    const row = sh.getRange(at, 1, 1, HEADERS.length).getValues()[0];
    const order = orderFromRow_(row);
    const steer = steerFor_(order);
    const price = priceFor_(order, steer);
    /* the browser asks; the sheet decides what the bill actually is */
    if (!price) return json_({ ok: false, error: "that order's steer has no hanging weight yet" });
    if (!order.email) return json_({ ok: false, error: "that order has no email address" });

    const token = String(row[19] || "") || newToken_();
    const confirmUrl = SITE_URL + "/#/confirm/" + code + "?t=" + token;

    /* a fresh Stripe link for exactly this balance; retire the old one so
       a stale amount can't be paid */
    let achUrl = "", achId = "", cardUrl = "", cardId = "", warning = "";
    if (stripeKey_()) {
      try {
        if (row[17]) deactivatePayLink_(String(row[17]));
        if (row[25]) deactivatePayLink_(String(row[25]));
        const links = createPayLinks_(order, price, token);
        if (links.ach) { achUrl = links.ach.url; achId = links.ach.id; }
        cardUrl = links.card.url; cardId = links.card.id;
        if (!links.achAvailable) warning = "Invoice sent with a card link only — ACH isn't enabled on the Stripe account yet (Stripe → Settings → Payment methods → ACH Direct Debit).";
      } catch (err) {
        warning = "Invoice sent without payment links — " + (err && err.message || err);
      }
    } else {
      warning = "Invoice sent without payment links: STRIPE_SECRET_KEY isn't set in Script Properties.";
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
function priceFor_(order, steer) {
  if (!steer || !(Number(steer.hangingWeight) > 0)) return null;
  const hangingLbs = Number(steer.hangingWeight);
  const rate = Number(steer.rate) > 0 ? Number(steer.rate) : STANDARD_RATE;
  const shareLbs = Math.round(hangingLbs * (SHARE_FRAC[order.share] || 0));
  const total = Math.round(shareLbs * rate);
  const adjusted = rate < STANDARD_RATE;
  /* the patty fee is the butcher's, but it reaches them through us —
     the customer writes one check, to the ranch */
  const pattyLbs = pattyPounds_(order.cutSheet);
  const pattyCharge = Math.round(pattyLbs * PATTY_RATE);
  const billTotal = total + pattyCharge;
  return {
    rate: rate,
    standardRate: STANDARD_RATE,
    adjusted: adjusted,
    heavy: adjusted && hangingLbs > HANGING_TYP,
    hangingLbs: hangingLbs,
    shareLbs: shareLbs,
    beefTotal: total,
    pattyLbs: pattyLbs,
    pattyCharge: pattyCharge,
    total: billTotal,
    deposit: DEPOSIT,
    balance: billTotal - DEPOSIT,
    saved: adjusted ? Math.round(shareLbs * (STANDARD_RATE - rate)) : 0,
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
    "Pickup, " + season.pickup + " — at Colorado Custom, 443 4th Street, Kersey CO. We'll confirm the date. It comes out frozen and boxed, so just leave room in the vehicle.",
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

function makeLink_(order, amountDollars, label, method, token) {
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
    "after_completion[redirect][url]": SITE_URL + "/#/confirm/" + order.code + "?t=" + token + "&paid=1",
  });
  return {
    id: link.id,
    url: link.url + "?client_reference_id=" + encodeURIComponent(order.code) + "&prefilled_email=" + encodeURIComponent(order.email),
  };
}

function createPayLinks_(order, price, token) {
  const out = { ach: null, card: null, achAvailable: true };
  try {
    out.ach = makeLink_(order, price.balance, "balance by bank", "us_bank_account", token);
  } catch (err) {
    if (!/us_bank_account|payment_method/i.test(String(err && err.message || err))) throw err;
    out.achAvailable = false;
  }
  out.card = makeLink_(order, cardAmount_(price.balance), "balance by card incl. " + Math.round(CARD_FEE_PCT * 100) + "% card fee", "card", token);
  return out;
}

function deactivatePayLink_(id) {
  try { stripe_("post", "/payment_links/" + id, { active: "false" }); } catch (err) { /* already gone — fine */ }
}

/* What Stripe shows across this order's links: "paid", "pending" (a
   bank debit was submitted and is still clearing — ACH takes about
   four business days), or "none". */
function payLinkState_(ids) {
  if (!stripeKey_()) return "none";
  let pending = false;
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) continue;
    const r = stripe_("get", "/checkout/sessions?payment_link=" + encodeURIComponent(ids[i]) + "&limit=20");
    const d = r.data || [];
    if (d.some(x => x.payment_status === "paid")) return "paid";
    if (d.some(x => x.status === "complete")) pending = true;
  }
  return pending ? "pending" : "none";
}

/* ---- the emails ---- */

function moneyLines_(o, price) {
  const lines = ["Beef: " + price.shareLbs + " lb × $" + price.rate.toFixed(2) + "/lb = " + money_(price.beefTotal)];
  if (price.pattyCharge > 0) {
    lines.push("Patties: " + price.pattyLbs + " lb × $" + PATTY_RATE.toFixed(2) + "/lb = " + money_(price.pattyCharge) + "  (the butcher's charge for pressing them, which we pay and add here)");
    lines.push("Total: " + money_(price.total));
  }
  lines.push("Deposit already paid: −" + money_(price.deposit));
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
  const payText = (opts.achUrl || opts.cardUrl)
    ? [
        opts.achUrl ? "   By bank (ACH), " + money_(price.balance) + ", no fee: " + opts.achUrl : "",
        opts.cardUrl ? "   By card, " + money_(cardAmt) + " (includes a " + feePct + " card fee): " + opts.cardUrl : "",
      ].filter(Boolean).join("\n")
    : "   By check to Thunderbolt Ranch LLC at pickup.";

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
    "Questions about your order or the bill: Josh, 402-245-8195.",
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
      ((opts.achUrl || opts.cardUrl)
        ? '<div style="margin:10px 0">'
          + (opts.achUrl ? btn(opts.achUrl, 'Pay ' + money_(price.balance) + ' by bank — no fee', '#7a3b22') + '<div style="font-size:12px;color:#666;margin:6px 0 12px">Bank (ACH) takes a few business days to clear.</div>' : '')
          + (opts.cardUrl ? btn(opts.cardUrl, 'Pay ' + money_(cardAmt) + ' by card', '#5a5047') + '<div style="font-size:12px;color:#666;margin-top:6px">Includes a ' + feePct + ' card fee (' + money_(cardAmt - price.balance) + ').</div>' : '')
          + '</div>'
        : 'By check to Thunderbolt Ranch LLC at pickup.') + '</li>',
    '<li><b>Sign off.</b> Once you\'ve paid and the sheet is right:<br><div style="margin:10px 0">' + btn(opts.confirmUrl, 'Everything looks good & I\'ve paid', '#2b2521') + '</div><span style="font-size:13px;color:#666">That sends your signed cut sheet to the butcher.</span></li>',
    '</ol>',
    '<div style="margin:22px 0;padding:16px 18px;background:#f3ecd8;border-left:4px solid #b08d45;font-family:Helvetica,Arial,sans-serif">',
    '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7a6333">Questions about cuts?</div>',
    '<div style="font-size:20px;margin-top:4px"><b>Colorado Custom Meat Co — <a href="tel:' + BUTCHER_PHONE + '" style="color:#2b2521">' + BUTCHER_PHONE + '</a></b></div>',
    '<div style="font-size:13px;color:#555;margin-top:4px">Questions about your order or the bill: Josh, 402-245-8195.</div>',
    '</div>',
    '<table style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:14px;width:100%">',
    '<tr><td style="padding:6px 0;color:#666">Steer ' + esc_(o.steer || '—') + ' · ' + price.hangingLbs + ' lb hanging · your share ' + price.shareLbs + ' lb</td><td></td></tr>',
    '<tr><td style="padding:6px 0">Beef — ' + price.shareLbs + ' lb × $' + price.rate.toFixed(2) + '/lb</td><td style="text-align:right">' + money_(price.beefTotal) + '</td></tr>',
    price.pattyCharge > 0 ? '<tr><td style="padding:6px 0">Patties — ' + price.pattyLbs + ' lb × $' + PATTY_RATE.toFixed(2) + '/lb (the butcher\'s charge, which we pay and add here)</td><td style="text-align:right">' + money_(price.pattyCharge) + '</td></tr>' : '',
    '<tr><td style="padding:6px 0">Deposit already paid</td><td style="text-align:right">−' + money_(price.deposit) + '</td></tr>',
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
      "Questions — Josh, Thunderbolt Ranch, 402-245-8195.",
    ].join("\n"),
    name: "Thunderbolt Ranch",
    replyTo: RANCH_INBOX,
    attachments: [pdf],
  });
}
