# Thunderbolt Ranch — continue the build (hand-off prompt)

Paste this into a new Claude Code session opened in `~/projects/christensen-ranch`:

---

Continue work on the Thunderbolt Ranch beef-share site (Vite/React/TS in this repo,
Apps Script backend in `apps-script/Code.gs`, live at thunderboltbeef.com via GitHub
Pages on push to `main`). Read `docs/SETUP-TODAY.md` and `docs/CHANGES-2026-10-06.md`
first — they describe the current model and what's been shipped. Memory file for the
project: `project_christensen_ranch.md`.

**State as of 2026-10-08 (all committed and deployed on the site side):**
- Season Winter 2027, 20 head; rolls to Spring 2027 when full.
- Rates whole $6.00 · half $6.10 · quarter $6.20 /lb hanging. A steer's "Price per lb"
  in the Ranch Office is its whole-share rate; halves/quarters sit +$0.10/+$0.20 above.
- Deposit gates the order: $300 per order (card, Stripe link made per order by the
  script), or an organizer's $600 group deposit that covers friends (credited to the
  organizer's invoice; covered friends pay their full share at invoice time). Orders sit
  as "awaiting deposit" until Stripe confirms; the Ranch Office has Check deposit.
- Groups: organizer picks a half or whole target; friends join via code or
  `/#/order?ref=CODE`; rate tier follows the group's confirmed steers' worth; members and
  deposit status visible to the group; invites sent by the ranch (email + Twilio SMS when
  `TWILIO_SID/TOKEN/FROM` are Script Properties). Ranch Office has a Groups tab with
  "Whole group on steer".
- Invoice flow: Email invoice → cut sheet attached + bank/card pay links (3% card fee) +
  sign-off page → signed sheet to the ranch; to the butcher once Stripe shows paid.
- Phone number removed everywhere; questions go to thunderboltbeef@gmail.com.

**Two implementations of the pricing math must stay in step:** `finalPrice()` in
`src/lib/estimate.ts` and `priceFor_()` in `apps-script/Code.gs`. There's a parity-test
pattern in the git history (search commits for "cases, 0 mismatches"); re-run that idea
after any pricing change.

**Not yet done / waiting on Max:**
1. The Apps Script in the repo is ahead of what's deployed. Max must paste
   `apps-script/Code.gs` into script.google.com → Thunderbolt Orders and redeploy
   (Manage deployments → pencil → New version). Probe pattern for "is the new script
   live": GET `?action=group&code=TR-NOPE` should answer `{"ok":true,"group":null}` on the
   new version. Backend URL is the `VITE_BACKEND_URL` repo variable (`gh variable list`).
2. Ranch Office → Steers → tracker → set capacity to 20 (availability still reports 7).
3. Stripe fallback deposit link: Max needs to make a $300 Payment Link and paste the URL;
   set it with `gh variable set VITE_STRIPE_PAYMENT_LINK --body <url>` then
   `gh workflow run deploy.yml`. Current fallback is still the $500 link.
4. Dry run of the full order → deposit → confirmation → invite → invoice flow with Max's
   own email, in test mode or live-then-refund.
5. Optional: Twilio Script Properties for text invites (needs A2P 10DLC registration).

**Conventions:** verify in the browser before claiming done (dev server:
`preview_start christensen-ranch`, port 5176, path routing in dev / hash routing in
prod); commit with Max Fink as author and the Claude co-author trailer; after each
Code.gs change, `pbcopy < apps-script/Code.gs` and tell Max to redeploy; never put the
Stripe key anywhere but Script Properties.
