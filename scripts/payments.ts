/* Payments check: runs apps-script/Code.gs against a fake sheet, fake Stripe
   and a captured outbox — deposits and balances land once, receipts go out
   once, the pickup email is gated. Run with `bun run payments` after any
   change to the payment or pickup code. `bun run payments -- out/` also
   writes the customer emails and the paid invoice as HTML to look at. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const outDir = process.argv[2];
const code = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

/* ---------- fake sheet ---------- */
type Grid = any[][];
function makeSheet(name: string, grid: Grid) {
  const sh: any = {
    name, grid,
    getLastRow: () => grid.length,
    getLastColumn: () => Math.max(...grid.map((r) => r.length)),
    appendRow: (r: any[]) => { grid.push([...r]); },
    deleteRow: (i: number) => { grid.splice(i - 1, 1); },
    setFrozenRows: () => {},
    getRange: (a: any, b?: number, c = 1, d = 1) => {
      if (typeof a === "string") return { setNumberFormat: () => ({}), setFontWeight: () => ({}) };
      const r0 = a - 1, c0 = (b as number) - 1;
      const rng: any = {
        getValues: () => Array.from({ length: c }, (_, i) => Array.from({ length: d }, (_, j) => grid[r0 + i]?.[c0 + j] ?? "")),
        setValue: (v: any) => { while (grid.length <= r0) grid.push([]); grid[r0][c0] = v; return rng; },
        setValues: (vs: any[][]) => { vs.forEach((row, i) => row.forEach((v, j) => { while (grid.length <= r0 + i) grid.push([]); grid[r0 + i][c0 + j] = v; })); return rng; },
        setNumberFormat: () => rng, setFontWeight: () => rng,
      };
      return rng;
    },
  };
  return sh;
}

/* ---------- fake Stripe ---------- */
const sessions: Record<string, any[]> = {};   // payment link id -> checkout sessions
let stripeCalls = 0;
const UrlFetchApp = {
  fetch: (url: string) => {
    stripeCalls++;
    const u = new URL(url);
    let body: any = {};
    if (u.pathname.endsWith("/checkout/sessions")) body = { data: sessions[u.searchParams.get("payment_link") || ""] || [], has_more: false };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
  },
};
const card = (amount: number, brand = "visa", last4 = "4242", t = 1791600000) => ({
  payment_status: "paid", status: "complete", amount_total: amount * 100, created: t,
  payment_intent: { id: "pi_x", latest_charge: { created: t, receipt_url: "https://pay.stripe.com/receipts/x", payment_method_details: { type: "card", card: { brand, last4 } } } },
});
const achPending = (amount: number) => ({ payment_status: "unpaid", status: "complete", amount_total: amount * 100, created: 1791600000, payment_intent: { id: "pi_y", latest_charge: null } });

/* ---------- outbox + services ---------- */
const outbox: any[] = [];
const blobs: any[] = [];
const fmt = (d: Date, _tz: string, f: string) => {
  const p = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", ...o }).format(d);
  if (f === "yyyy-MM-dd") return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(d);
  if (f === "MMMM d, yyyy") return p({ month: "long", day: "numeric", year: "numeric" });
  if (f === "EEEE, MMMM d") return p({ weekday: "long", month: "long", day: "numeric" });
  if (f === "MMMM d, yyyy 'at' h:mm a") return p({ month: "long", day: "numeric", year: "numeric" }) + " at " + p({ hour: "numeric", minute: "2-digit" });
  throw new Error("fmt " + f);
};
const blob = (data: any, mime: string, name: string): any => {
  const b: any = { data, mime, name, getAs: (m: string) => { const x = blob(data, m, name); blobs.push(x); return x; }, setName: (n: string) => { b.name = n; return b; } };
  return b;
};
const props: Record<string, string> = { SHEET_ID: "x", STRIPE_SECRET_KEY: "sk_test_x", ADMIN_KEY: "k" };
let lockHeld = false;
const env = {
  SpreadsheetApp: { openById: () => book },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: () => {}, setProperties: () => {} }) },
  MailApp: { sendEmail: (m: any) => { outbox.push(m); } },
  UrlFetchApp,
  LockService: { getScriptLock: () => ({ waitLock: () => { if (lockHeld) throw new Error("re-entrant lock"); lockHeld = true; }, releaseLock: () => { lockHeld = false; } }) },
  Utilities: { formatDate: fmt, newBlob: blob, base64Decode: (s: string) => s },
  Session: { getScriptTimeZone: () => "America/Denver" },
  ContentService: { createTextOutput: (t: string) => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: "json" } },
  ScriptApp: {},
};

const gs = new Function(...Object.keys(env), code + "\n;return { doGet, doPost, syncPayments, HEADERS, STEER_HEADERS };")(...Object.values(env)) as any;
const H: string[] = gs.HEADERS;
const col = (name: string) => { const i = H.indexOf(name); if (i < 0) throw new Error("no col " + name); return i; };

function orderRow(o: Record<string, any>) {
  const r = new Array(H.length).fill("");
  const json = { code: o.Code, name: o.Name, email: o.Email, phone: "555", share: o.Share, season: o.Season, cutSheet: {} };
  for (const [k, v] of Object.entries(o)) r[col(k)] = v;
  r[col("Order JSON")] = JSON.stringify(json);
  return r;
}
const ordersGrid: Grid = [H.slice()];
const steersGrid: Grid = [gs.STEER_HEADERS.slice()];
const sheets: Record<string, any> = { Orders: makeSheet("Orders", ordersGrid), Steers: makeSheet("Steers", steersGrid) };
const book = { getSheetByName: (n: string) => sheets[n] ?? null, insertSheet: (n: string) => (sheets[n] = makeSheet(n, [])) };

/* ---------- fixtures ---------- */
steersGrid.push(["S1", "winter-2027", 1000, "2027-01-08", "", "2026-12-20", "", ""]);                      // no pickup window yet
steersGrid.push(["S2", "fall-2026", 800, "", "", "", "2026-10-17", "2026-10-24"]);                        // window set
const base = { Created: new Date("2026-10-08T16:00:00Z"), Phone: "555", Address: "x", Summary: "cuts", Notes: "" };
ordersGrid.push(orderRow({ ...base, Code: "TR-DEP001", Status: "pending-deposit", Name: "Dana Dep", Email: "dana@example.com", Share: "quarter", Total: 1550, Deposit: 300, Balance: 1250, Season: "winter-2027", "Deposit link id": "plink_dep1", "Deposit link URL": "https://buy.stripe.com/d", "Deposit kind": "single", "Deposit amount": 300 }));
ordersGrid.push(orderRow({ ...base, Code: "TR-BAL001", Status: "processing", Name: "Bo Bal", Email: "bo@example.com", Share: "quarter", Total: 1350, Deposit: 250, Balance: 1100, Season: "fall-2026", Steer: "S2", "Invoiced at": "2026-10-09T15:00:00Z", "Pay link id": "plink_ach1", "Card link id": "plink_card1", "Confirm token": "TOKENTOKENTOKEN12345", "Deposit paid at": new Date("2026-10-04T15:25:00Z") }));
ordersGrid.push(orderRow({ ...base, Code: "TR-ACH001", Status: "processing", Name: "Ash Ach", Email: "ash@example.com", Share: "half", Total: 2700, Deposit: 250, Balance: 2450, Season: "fall-2026", Steer: "S2", "Invoiced at": "2026-10-09T15:00:00Z", "Pay link id": "plink_ach2", "Card link id": "plink_card2", "Confirm token": "TOKENTOKENTOKEN22222", "Deposit paid at": new Date("2026-10-04T16:00:00Z") }));
ordersGrid.push(orderRow({ ...base, Code: "TR-SIGN01", Status: "processing", Name: "Sig Ner", Email: "sig@example.com", Share: "quarter", Total: 1350, Deposit: 250, Balance: 1100, Season: "fall-2026", Steer: "S2", "Invoiced at": "2026-10-09T15:00:00Z", "Pay link id": "plink_ach3", "Card link id": "plink_card3", "Confirm token": "TOKENTOKENTOKEN33333", "Deposit paid at": new Date("2026-10-04T17:00:00Z") }));
ordersGrid.push(orderRow({ ...base, Code: "TR-FALL01", Status: "processing", Name: "Fay Fall", Email: "fay@example.com", Share: "quarter", Total: 1350, Deposit: 250, Balance: 1100, Season: "fall-2026", Steer: "S1" }));
ordersGrid.push(orderRow({ ...base, Code: "TR-CASH01", Status: "processing", Name: "Cass Cash", Email: "cass@example.com", Share: "quarter", Total: 1350, Deposit: 250, Balance: 1100, Season: "fall-2026", Steer: "S2", "Deposit paid at": new Date("2026-10-05T17:00:00Z") }));

sessions.plink_dep1 = [card(300, "mastercard", "8090")];
sessions.plink_card1 = [card(Math.round(1150 * 1.03))];
sessions.plink_ach2 = [achPending(2450)];

/* ---------- checks ---------- */
let bad = 0;
const ok = (cond: any, msg: string) => { if (!cond) { bad++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
const cell = (codeId: string, name: string) => ordersGrid.find((r) => r[0] === codeId)![col(name)];
const mails = (to: string, re?: RegExp) => outbox.filter((m) => m.to === to && (!re || re.test(m.subject)));
const post = (b: any) => JSON.parse(gs.doPost({ postData: { contents: JSON.stringify(b) } }).text);
const get = (q: any) => JSON.parse(gs.doGet({ parameter: q }).text);

// A. deposit lands once, whoever asks
let r = get({ action: "deposit", code: "TR-DEP001" });
ok(r.paid === true, "deposit action sees the paid deposit");
get({ action: "deposit", code: "TR-DEP001" });
gs.syncPayments();
ok(cell("TR-DEP001", "Status") === "reserved", "order flips to reserved");
ok(!!cell("TR-DEP001", "Deposit paid at"), "deposit paid at recorded");
ok(mails("dana@example.com").length === 1, "exactly one email to the depositor (" + mails("dana@example.com").length + ")");
ok(/^Deposit received/.test(mails("dana@example.com")[0]?.subject), "subject says deposit received: " + mails("dana@example.com")[0]?.subject);
ok(/Mastercard •••• 8090/.test(mails("dana@example.com")[0]?.body), "receipt names the card");
ok(/\$300/.test(mails("dana@example.com")[0]?.body), "receipt names the amount");

// B. balance found by the timer: once, with the paid invoice attached, ranch told
gs.syncPayments(); gs.syncPayments();
const bo = mails("bo@example.com");
ok(bo.length === 1, "exactly one receipt to the balance payer (" + bo.length + ")");
ok(/^Payment received/.test(bo[0]?.subject), "subject: " + bo[0]?.subject);
ok(bo[0]?.attachments?.[0]?.mime === "application/pdf", "paid invoice PDF attached");
ok(/paid/.test(bo[0]?.attachments?.[0]?.name), "attachment named as paid: " + bo[0]?.attachments?.[0]?.name);
ok(/sign off/i.test(bo[0]?.body), "unsigned customer is asked to sign");
ok(String(cell("TR-BAL001", "Paid with")).startsWith("Visa •••• 4242"), "paid-with recorded: " + cell("TR-BAL001", "Paid with"));
ok(outbox.filter((m) => /Balance paid — TR-BAL001/.test(m.subject)).length === 1, "ranch told once");

// C. ACH still clearing: pending, nobody emailed
ok(cell("TR-ACH001", "Payment state") === "pending", "ACH marked pending");
ok(mails("ash@example.com").length === 0, "no receipt while ACH clears");
sessions.plink_ach2 = [{ ...achPending(2450), payment_status: "paid", payment_intent: { id: "pi_y", latest_charge: { created: 1791700000, receipt_url: "", payment_method_details: { type: "us_bank_account", us_bank_account: { bank_name: "CHASE", last4: "6789" } } } } }];
gs.syncPayments();
ok(mails("ash@example.com").length === 1 && /CHASE •••• 6789/.test(mails("ash@example.com")[0].body), "receipt once ACH clears, names the bank");

// D. sign while paid (they paid, came back, signed before the timer looked)
// receipt yes, 💵 ranch email no (the signed-sheet email covers it), butcher gets it
sessions.plink_card3 = [card(Math.round(1150 * 1.03), "amex", "1009")];
const before = outbox.length;
r = post({ action: "sign", code: "TR-SIGN01", t: "TOKENTOKENTOKEN33333", name: "Sig Ner", pdf: "JVBERi0=" });
ok(r.ok && r.paid && r.sentToButcher, "sign: paid and sent to butcher");
const after = outbox.slice(before);
ok(after.filter((m) => m.to === "sig@example.com").length === 1, "sign: one receipt to customer");
ok(!/sign off/i.test(after.find((m) => m.to === "sig@example.com")?.body || ""), "sign: receipt doesn't ask them to sign again");
ok(after.filter((m) => /Balance paid/.test(m.subject)).length === 0, "sign: no duplicate ranch payment email");
gs.syncPayments();
ok(mails("sig@example.com").length === 1, "timer doesn't re-send after sign");

// E. fall order with no links: the timer leaves it alone
ok(mails("fay@example.com").length === 0, "fall order without links untouched");

// F. ready for pickup gates
r = post({ key: "k", action: "pickup-ready", codes: ["TR-FALL01"] });
ok(!r.results[0].ok && /pickup window/.test(r.results[0].error), "no window → refused: " + r.results[0].error);
r = post({ key: "k", action: "pickup-ready", codes: ["TR-CASH01"] });
ok(!r.results[0].ok && r.results[0].unpaid, "unpaid, no override → refused: " + r.results[0].error);
r = post({ key: "k", action: "pickup-ready", codes: ["TR-CASH01"], paidOutside: true });
ok(r.results[0].ok, "unpaid with override → sent");
ok(cell("TR-CASH01", "Payment state") === "outside" && !!cell("TR-CASH01", "Paid at"), "override marks paid outside Stripe");
r = post({ key: "k", action: "pickup-ready", codes: ["TR-BAL001", "TR-SIGN01"] });
ok(r.results.every((x: any) => x.ok), "paid orders on the steer → sent");
const ready = outbox.filter((m) => /ready for pickup/.test(m.subject));
ok(ready.length === 3, "three pickup emails (" + ready.length + ")");
ok(ready.every((m) => m.attachments?.[0]?.mime === "application/pdf"), "each carries the invoice PDF");
ok(ready.every((m) => /443 4th Street/.test(m.body) && /970-356-2333/.test(m.body) && /closed 11–noon/.test(m.body)), "address, phone, hours in every pickup email");
ok(/Saturday, October 17 – Saturday, October 24, 2026/.test(ready[0].body), "window has weekdays: " + (ready[0].body.match(/PICK UP: .*/) || [""])[0]);
ok(cell("TR-BAL001", "Status") === "ready" && !!cell("TR-BAL001", "Ready emailed at"), "order moves to ready, dated");
r = post({ key: "x", action: "pickup-ready", codes: ["TR-BAL001"] });
ok(r.ok === false && r.error === "bad key", "admin key required");

console.log(`\n${bad} failures · ${outbox.length} emails · ${stripeCalls} Stripe calls`);

/* write the customer-facing HTML out for a look */
if (!outDir) process.exit(bad ? 1 : 0);
mkdirSync(outDir, { recursive: true });
const M = "<meta charset=\"utf-8\">";
const pick = (re: RegExp, to?: string) => outbox.find((m) => re.test(m.subject) && (!to || m.to === to));
writeFileSync(`${outDir}/deposit-receipt.html`, M + pick(/^Deposit received/).htmlBody);
writeFileSync(`${outDir}/balance-receipt.html`, M + pick(/^Payment received/, "bo@example.com").htmlBody);
writeFileSync(`${outDir}/pickup-email.html`, M + pick(/ready for pickup/, "bo@example.com").htmlBody);
writeFileSync(`${outDir}/invoice-paid.html`, pick(/ready for pickup/, "bo@example.com").attachments[0].data);
writeFileSync(`${outDir}/invoice-outside.html`, pick(/ready for pickup/, "cass@example.com").attachments[0].data);
writeFileSync(`${outDir}/pickup-email.txt`, pick(/ready for pickup/, "bo@example.com").body);
process.exit(bad ? 1 : 0);
