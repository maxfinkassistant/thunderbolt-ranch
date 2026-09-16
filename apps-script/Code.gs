/**
 * Thunderbolt Ranch — order backend (Google Apps Script web app)
 *
 * What it does:
 *   POST {action:"order", ...}   → appends the order to a Google Sheet (your CRM),
 *                                   emails the ranch a notification, emails the
 *                                   customer a confirmation with the deposit link.
 *   GET  ?action=order&code=TR-… → returns one order (customer tracking page).
 *   GET  ?action=list&key=…      → returns all orders (back office; key required).
 *   POST {action:"status", key, code, status} → updates an order's status.
 *
 * Setup (once, ~3 minutes) — see docs/SETUP-TODAY.md:
 *   1. script.google.com → New project → paste this file → save.
 *   2. Project Settings → Script Properties → add:
 *        ADMIN_KEY      = a passcode for the back office (e.g. KERSEY-2026)
 *        NOTIFY_EMAILS  = comma-separated ranch emails to notify on each order
 *        SHEET_ID       = (optional) an existing spreadsheet id; leave blank to auto-create
 *   3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone
 *   4. Copy the /exec URL → VITE_BACKEND_URL in the site config.
 */

const SHEET_NAME = "Orders";
const HEADERS = [
  "Code", "Created", "Status", "Name", "Email", "Phone", "Address",
  "Share", "Total", "Deposit", "Balance", "Summary", "Notes", "Order JSON",
];

function props_() { return PropertiesService.getScriptProperties(); }

function sheet_() {
  const p = props_();
  let ss;
  const id = p.getProperty("SHEET_ID");
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create("Thunderbolt Ranch — Orders");
    p.setProperty("SHEET_ID", ss.getId());
  }
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sh;
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
    return json_({ ok: true, order: row ? orderFromRow_(row) : null });
  }
  if (q.action === "list") {
    if (!q.key || q.key !== props_().getProperty("ADMIN_KEY")) return json_({ ok: false, error: "bad key" });
    return json_({ ok: true, orders: rows_().map(orderFromRow_).filter(Boolean) });
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

  if (body.action === "status") {
    if (!body.key || body.key !== props_().getProperty("ADMIN_KEY")) return json_({ ok: false, error: "bad key" });
    const sh = sheet_();
    const rows = rows_();
    const i = rows.findIndex(r => String(r[0]).toUpperCase() === String(body.code).toUpperCase());
    if (i < 0) return json_({ ok: false, error: "not found" });
    sh.getRange(i + 2, 3).setValue(body.status);
    return json_({ ok: true });
  }

  if (body.action === "order") {
    const o = body.order;
    if (!o || !o.code || !o.email) return json_({ ok: false, error: "missing order" });
    o.email = String(o.email).trim();
    const summary = (body.summary || []).map(l => l.name + ": " + l.detail).join("\n");
    const cost = body.cost || {};
    sheet_().appendRow([
      o.code, new Date(o.createdAt || Date.now()), o.status || "reserved",
      o.name, o.email, o.phone, o.address,
      o.share, cost.total, cost.deposit, cost.balance,
      summary, (o.cutSheet && o.cutSheet.notes) || "", JSON.stringify(o),
    ]);
    const emailErrors = [];
    try { notifyRanch_(o, summary, cost); } catch (err) { emailErrors.push("ranch: " + (err && err.message || err)); }
    try { confirmCustomer_(o, summary, cost, body.depositLink); } catch (err) { emailErrors.push("customer: " + (err && err.message || err)); }
    return json_({ ok: true, code: o.code, emailErrors: emailErrors });
  }

  return json_({ ok: false, error: "unknown action" });
}

/* ---------------- email ---------------- */

function shareLabel_(s) { return { quarter: "Quarter", half: "Half", whole: "Whole" }[s] || s; }
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
  const bodyText = [
    "Hi " + (o.name || "").split(" ")[0] + ",",
    "",
    "Thanks for reserving a " + shareLabel_(o.share).toLowerCase() + " beef from Thunderbolt Ranch. Your order code is " + o.code + ".",
    "",
    payLine,
    "Your deposit applies to your total of " + money_(cost.total) + "; the balance of " + money_(cost.balance) + " is due at pickup, payable to Thunderbolt Ranch LLC.",
    "",
    "WHAT HAPPENS NEXT",
    "Sept 16 — harvest. Your beef dry-ages 14 days at Colorado Custom Meat Co in Kersey.",
    "Sept 30 — cut and packaged to your cut sheet (you can adjust it until then — just text Josh).",
    "Week of Oct 1 — pickup at Colorado Custom, 443 4th Street, Kersey CO. Bring coolers.",
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
