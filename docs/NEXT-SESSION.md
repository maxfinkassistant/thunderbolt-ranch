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
`src/lib/estimate.ts` and `priceFor_()` in `apps-script/Code.gs`. Run `bun run parity`
(`scripts/parity.ts`) after any pricing change — it compares the two over 540 cases and
pins the legacy deal. **Fall 2026 orders are priced on the old flat model** (steer's manual
rate or $6.00 for every share, the $250 deposit they were placed with): see
`FLAT_RATE_SEASONS` in both files. Tiers, groups and per-order deposits start with Winter 2027.

**Done since 2026-10-08 noon (verified live):** script redeployed (`?action=group&code=TR-NOPE`
→ `{"ok":true,"group":null}`), tracker capacity 20 (availability answers `capacity:20`), $300
Stripe fallback link set as `VITE_STRIPE_PAYMENT_LINK`, landing "split a steer" band fixed
(it printed "Bring 0.5 friend" after GROUP_UNLOCK became steers' worth). The live order flow
was walked to checkout as a quarter organizer with a half target and a $600 group deposit:
math reads $600 today · $950 balance · $1,550 total. Not submitted — a real row + Stripe link.

**Not yet done / waiting on Max:**
1. Dry run of the full order → deposit → confirmation → invite → invoice flow with Max's
   own email, in test mode or live-then-refund. The Orders sheet already holds one 0.25
   reserved row (availability `reserved:0.25`) — delete it if it's a test before go-live.
2. Optional: Twilio Script Properties for text invites (needs A2P 10DLC registration).
3. The Ranch Office passcode (`ADMIN_KEY`) isn't in the repo or memory; Max logs in himself.

**Conventions:** verify in the browser before claiming done (dev server:
`preview_start christensen-ranch`, port 5176, path routing in dev / hash routing in
prod); commit with Max Fink as author and the Claude co-author trailer; after each
Code.gs change, `pbcopy < apps-script/Code.gs` and tell Max to redeploy; never put the
Stripe key anywhere but Script Properties.
