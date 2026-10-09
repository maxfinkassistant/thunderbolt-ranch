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
| Live site | https://thunderboltbeef.com/ |
| Orders / CRM | Google Sheet "Thunderbolt Ranch — Orders" in your Drive |
| Ranch Office | site footer → Ranch Office, passcode = your `ADMIN_KEY` |
| Cut sheet PDFs | Ranch Office → "CCMC PDF" on any order → email to order@ccmeatco.com |
| Deposits | Stripe dashboard → Payments (each shows the order code) |

## Updating the order script (whenever `apps-script/Code.gs` changes)

The 2026-10-02 version adds the per-steer price per pound and the final invoice email.
Until it's deployed the site still works, but: the Steers tab's new **Price per lb**
field won't save, the **Email invoice** button errors, and a customer's tracking page
won't show their final total.

1. **https://script.google.com**, signed in as thunderboltbeef@gmail.com → open **Thunderbolt Orders**.
2. Select everything in `Code.gs`, paste the whole new `apps-script/Code.gs` over it, **Save**.
3. **Deploy → Manage deployments** → pencil icon on the existing web app → **Version: New version** → **Deploy**.
   (Editing the existing deployment keeps the same `/exec` URL. A *new* deployment would change it.)
4. Check: open `<your /exec URL>?action=availability` — it should answer with `capacity` and `reserved`.
5. Check the new bit: in the Ranch Office → Steers, type a price per lb on a steer and
   **Save**. Reload. If it sticks, the new script is live.

The script adds a **Steers** tab, **Steer** / **Season** columns to the order sheet, and a
**Price per lb ($)** column to the Steers tab, all on its own. Every row in the Orders tab
counts toward the front-page tracker, so delete the test rows first.

### Deposit, pricing and groups (as of 2026-10-08)

- **$300 deposit, card only, no fee.** The script creates a Stripe link per order; the
  order is saved as *Awaiting deposit* and only counts toward the season — and only gets
  the confirmation email — once Stripe shows it paid. Stripe sends the customer back to
  `/#/order/confirmed/CODE`, which asks the script to verify. The Ranch Office shows unpaid
  rows greyed with a **Check deposit** button; you can also set the status to Reserved by
  hand if someone pays another way — then type the date into that row's **Deposit paid at**
  column on the Orders sheet, or the invoice won't take the deposit off.
- **An invoice only credits a deposit that's on file** (the sheet's *Deposit paid at*).
  Orders from before the deposit gate were reserved whether or not anyone paid; their
  Stripe deposits were backfilled into that column on 2026-10-09. A row with nothing there
  is billed the full amount, and the Harvest roster marks it **no deposit on file**.
- **Stripe tab** in the Ranch Office: the payments and payouts Stripe shows, each payment
  tied to its order, with a **Deposit check** on top — orders charged twice, orders with no
  deposit in Stripe, deposits paid but not on file, and payments with no order. Read-only;
  refunds are done in Stripe.
- **The dashboard Payment Link** (`VITE_STRIPE_PAYMENT_LINK`) is now only a fallback if
  the script can't make a link. **Change it to $300 in Stripe** so the fallback is right.
- **Rates:** whole $6.00 · half $6.10 · quarter $6.20 per lb hanging. A steer's
  "Price per lb" in the Steers tab is its *whole-share* rate; halves and quarters sit
  their usual +$0.10 / +$0.20 above it.
- **Groups:** every order code is a referral code. An organizer (quarter or half) picks what
  the group is filling — **a half (2 quarters) or a whole (4 quarters / 2 halves)** — and how
  the deposit works: **one $600 from the organizer that covers everyone**, or **$300 per
  order**. Friends who join a $600 group reserve with no deposit; if they join before the
  organizer has paid, they're held and flip to reserved the moment the $600 lands. The $600
  is credited to the organizer's invoice; covered friends pay their full share at invoice
  time. Rates follow the group's **confirmed steers' worth**: half a steer → the half rate,
  a whole → the whole rate, for everyone in it. Members see each other (first name + last
  initial) and whose deposit is in, on the confirmation and tracking pages.
- **Season:** Winter 2027, 20 steers; new orders roll to Spring 2027 when full.

### Payment receipts and "ready for pickup" (as of 2026-10-09)

**One-time setup (≈3 min), after pasting the new `Code.gs`:**
1. Apps Script → ⚙ Project Settings → tick **Show "appsscript.json" manifest file**. Open
   `appsscript.json` in the editor and replace it with `apps-script/appsscript.json` from the
   repo (it adds one permission: running on a timer).
2. Deploy → Manage deployments → pencil → **New version** → Deploy.
3. In the editor's function dropdown pick **installPaymentSync** → **Run** → approve the
   permission prompt (pick thunderboltbeef@gmail.com). It runs one check right away.

**What customers get now:**
- **Deposit receipt.** The moment a deposit is found in Stripe, the "your beef is reserved"
  email goes out as *"Deposit received — …"* with the amount, card and time and "No need to
  pay again". (Customers who couldn't tell whether the deposit went through is what caused
  the double charges.)
- **Balance receipt.** When the invoice is paid: *"Payment received — order … is paid in
  full"*, with the paid invoice PDF attached. If they haven't signed off on the cut sheet
  yet, it has a button to do it. A bank (ACH) payment gets its receipt when it clears, not
  when it's started.
- Stripe is checked when the customer comes back from paying, when you press Check deposit,
  and **every 10 minutes** in the background — whichever comes first sends the email, once.
  The ranch inbox gets a "💵 Balance paid" note for each balance payment (and is told to
  forward the signed sheet to the butcher if they signed while a bank payment was clearing).

**Ready for pickup:**
1. When Colorado Custom gives you the pickup window, open **Steers**, enter **Pickup window**
   (earliest and latest day) on that steer, and **Save**.
2. Either press **Ready for pickup → N paid** under the dates (emails everyone on that steer
   whose balance is paid), or press **Ready for pickup** on one order in the Harvest roster.
3. The email thanks them for paying in full and gives the window (with weekdays), Colorado
   Custom's address, map link, phone (970-356-2333) and hours (Mon–Fri 8–4:30, closed 11–noon;
   Sat 9–noon; Sun closed), what to tell the butcher (name, steer tag, order code), the $10/day
   storage note after the last day, and the **final invoice marked paid in full** as a PDF.
   The order moves to *Ready for pickup*.
- The button stays greyed out until the steer has both pickup dates. If Stripe shows no
  balance payment you're asked first — send it only if they paid another way (check, cash);
  that marks their balance "paid outside Stripe" on the sheet.

### Group invites by text (optional, ≈5 min)

Invites always go by email. To also text them, put three Script Properties in the
Apps Script project (gear → Script Properties):

- `TWILIO_SID` — Account SID from https://console.twilio.com
- `TWILIO_TOKEN` — Auth Token, same page
- `TWILIO_FROM` — a Twilio number you own, in +1 form

No redeploy needed for properties. Without them, the invite form still works and tells
the organizer "texting isn't set up yet".

Two things to know about texting in the US: Twilio requires **A2P 10DLC registration**
for business traffic on regular numbers — unregistered messages get filtered — and the
texts end with "Reply STOP to opt out" because the recipient didn't sign up themselves.
Every invite is logged to an **Invites** sheet (who, when, which order) so any complaint
can be traced.

### Groups in the Ranch Office

The **Groups** tab lists everyone who ordered with the same code. Each member has their
own cut sheet, invoice and sign-off; what they share is the steer and the rate. Pick a
steer in **Whole group on steer** to assign every member at once — each cut sheet then
carries that tag and a "Group order" note so the butcher knows four sheets are one animal.

### One-time: Stripe for invoices (≈2 min)

The invoice email carries a card link for the customer's exact balance, and the
"I've paid" button checks Stripe before anything goes to the butcher. Both need a
Stripe **secret** key in the script — never in the site.

1. Stripe dashboard → **Developers → API keys** → copy the **Secret key** (`sk_live_…`).
   Use `sk_test_…` first if you want a dry run.
2. Apps Script editor → **Project Settings (gear) → Script Properties → Add**:
   - `STRIPE_SECRET_KEY` = the key
   - `BUTCHER_EMAIL` = **your own address** for the first run, then change it to
     `order@ccmeatco.com` (leave it unset and it defaults to Colorado Custom).
3. **Grant the script internet access** (one time): in the editor, open the function
   dropdown next to ▶ Run, choose **`authorizeStripe`**, press **Run**. Google pops
   "Authorization required" → Review permissions → pick thunderboltbeef@gmail.com →
   Advanced → Go to Thunderbolt Orders → Allow. Without this every Stripe call fails
   with *"You do not have permission to call UrlFetchApp.fetch"* — pasting and
   redeploying never asks for this permission on its own.

   **If the prompt never appears** and Run just errors, or the "Click here to provide
   permissions" link opens a *"Sorry, unable to open the file"* page with `authuser=N`
   in the address:
   - You're signed into several Google accounts. Open a **private/incognito window**,
     sign in as thunderboltbeef@gmail.com *only*, open script.google.com → Thunderbolt
     Orders, and Run `authorizeStripe` from there.
   - If it still errors without prompting, the manifest pins the permissions. Gear →
     tick **Show "appsscript.json" manifest file in editor** → open `appsscript.json`
     → replace it with `apps-script/appsscript.json` from this repo → Save → Run
     `authorizeStripe` again. The prompt will appear.
4. **Turn on ACH**: Stripe → Settings → Payment methods → **ACH Direct Debit** → enable.
   Without it the invoice link is card-only and the Ranch Office says so.
5. Redeploy (Manage deployments → pencil → New version → Deploy).

Nothing in the site bundle ever sees the key; only `Code.gs` reads it.

Card payments carry a 3% fee (`CARD_FEE_PCT` in `Code.gs`); bank payments don't. The
customer gets two buttons — the balance by bank, or the balance + 3% by card — and the
fee is spelled out next to the card button.

ACH takes about four business days to clear. A customer who pays by bank and signs
right away shows as **⏳ ACH clearing** — the sheet stays with you until Stripe shows it
paid, then forward it (or forward it early if you're comfortable).

### Sending a final invoice — and what happens after

1. Ranch Office → **Steers**: hanging weight, kill date, and a lower **Price per lb**
   if the animal came in heavy. Blank = the standard $6.00.
2. **Harvest roster** → **Email invoice** on the order. You'll see the balance and rate
   in a confirmation before anything sends.
3. The customer gets: the filled cut sheet attached, a **Pay by card** button for the
   exact balance, Colorado Custom's phone number up top, and an
   **"Everything looks good & I've paid"** button.
4. They reply with any changes (lands in thunderboltbeef@), pay, then tap the button,
   type their name as a signature, and submit.
5. The script writes their name and timestamp onto the form's signature line and
   emails the signed sheet to thunderboltbeef@. Then it asks Stripe whether that
   link was paid:
   - **Paid** → the signed sheet goes to Colorado Custom automatically (cc you).
   - **Not paid** → it stays with you, subject marked ⚠. Check Stripe, then forward
     the attached sheet yourself.
6. The roster shows where each order is: *invoiced · signed · paid · sent to CCMC*.

Re-sending an invoice issues a fresh Stripe link for the current balance and retires
the old one, so a stale amount can't be paid.
