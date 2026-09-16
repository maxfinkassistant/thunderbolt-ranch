# Go live today — the two things only you can do

Everything else is built and deployed. These two steps need *your* accounts,
so I can't click them for you. About six minutes total.

---

## 1. Order backend + CRM + emails — Google Apps Script (≈3 min)

This turns a Google Sheet into the order database/CRM and sends the emails
from your own Gmail. No new account, no API keys.

1. Go to **https://script.google.com** (signed in as the Gmail you want orders sent from) → **New project**.
2. Delete the placeholder code, paste in the whole contents of **`apps-script/Code.gs`** from the repo, click **Save** (name it "Thunderbolt Orders").
3. Left sidebar → **Project Settings** (gear) → **Script Properties** → *Add script property*, three times:
   - `ADMIN_KEY` → a passcode for the Ranch Office, e.g. `KERSEY-2026` (this is what you'll type at /customers)
   - `NOTIFY_EMAILS` → `max@bluepeakrealestate.com, josh.santo8@gmail.com` (who gets pinged on each order)
   - `SHEET_ID` → leave **blank** (the script creates "Thunderbolt Ranch — Orders" in your Drive on the first order)
4. Top right → **Deploy** → **New deployment** → gear icon → **Web app**:
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy**. Google will ask you to authorize the script (Sheets + Mail) — approve it.
5. Copy the **Web app URL** (ends in `/exec`) and send it to me.

> Test it yourself first if you like: paste the URL in a browser tab — you should see `{"ok":true,"service":"thunderbolt-ranch",...}`.

## 2. Deposit payments — Stripe Payment Link (≈3 min)

1. **https://dashboard.stripe.com** → **Payment Links** → **+ New**.
2. Product: **Thunderbolt Ranch — Beef Deposit**, price **$250.00**, one-time.
3. Under *After payment*: "Show confirmation page" is fine, or redirect to the site's tracking page.
4. Under *Options*: turn on **Collect customers' addresses** if you want it; leave phone off (we already have it).
5. **Create link** → copy the `https://buy.stripe.com/…` URL and send it to me.

The site appends `client_reference_id=<order code>` and the customer's email to that link, so every payment in your Stripe dashboard shows which order it belongs to — reconcile against the Orders sheet.

---

## What I do once you send both URLs (≈2 min)

- Set them as repo variables (`VITE_BACKEND_URL`, `VITE_STRIPE_PAYMENT_LINK`) — the site rebuilds and redeploys itself automatically.
- Place a real test order end to end and confirm the sheet row + both emails + the Stripe link.

## Where things live afterward

| Thing | Where |
|---|---|
| Live site | https://maxfinkassistant.github.io/thunderbolt-ranch/ |
| Orders / CRM | Google Sheet "Thunderbolt Ranch — Orders" in your Drive |
| Ranch Office | site footer → Ranch Office, passcode = your `ADMIN_KEY` |
| Cut sheet PDFs | Ranch Office → "CCMC PDF" on any order → email to order@ccmeatco.com |
| Deposits | Stripe dashboard → Payments (each shows the order code) |

## Later (not today)

- Custom domain (thunderboltranch.com → GitHub Pages; set `VITE_BASE=/` in the workflow)
- Stripe webhook to auto-mark deposits paid on the sheet (today: glance at Stripe, then set status in Ranch Office)
- Move off Apps Script to Supabase + Resend if volume ever warrants it — the client code is already shaped for it
