# Thunderbolt Ranch — Go-Live Checklist

*Critical path: pricing confirmation → Supabase swap → Stripe → email → everything else.
Realistically 3–4 weeks to launch once pricing is confirmed.*

## 1. Business decisions (blockers)
- [ ] Confirm real pricing: deposits ($200/$400/$600 placeholders), hanging rates ($5.25/$4.95/$4.65), processing ($1.05/lb) — all in `src/data/config.ts`
- [ ] Spot-check `STORE_COMPARE` grocery prices against a real Front Range store
- [ ] Refund policy language; Colorado Custom storage terms (7 free days / $10/day); delivery radius
- [ ] Real harvest dates + share capacity for the season
- [ ] Ranch photography to replace stock (incl. broadside steer for the diagram re-trace)
- [ ] LLC/DBA, terms of service, privacy policy page

## 2. Infrastructure (week 1)
- [ ] Domain + Cloudflare DNS; deploy to Vercel with HTTPS
- [ ] Supabase: `orders` + `groups` tables (schema in TECH-STACK.md); swap `src/lib/store.ts` bodies
- [ ] Server-side group-fill constraint (≤ 4 quarters; no double-claim races)
- [ ] Admin view: orders per harvest + printable ticket per order for Colorado Custom

## 3. Payments — Stripe (week 2)
- [ ] Stripe account under the business entity
- [ ] Checkout for deposits (one price per share size); webhook marks order `reserved`
- [ ] Refunds: full pre-deadline, credit post-deadline
- [ ] Hanging-weight balance via Stripe Invoices once actual weight is known
- [ ] Decide fee handling on balances (offer ACH — 0.8% capped — on $1,500+ invoices)
- [ ] Test-mode end-to-end: reserve → webhook → email → refund

## 4. Email + SMS (week 2–3)
- [ ] Resend/Postmark on the domain with SPF/DKIM
- [ ] Templates: confirmation (with estimated-box ticket), weight+balance notice, pickup instructions, deadline reminders
- [ ] Twilio: "group at 3/4, one quarter left" + pickup-day SMS
- [ ] Group lifecycle: member joined, cow completed

## 5. CRM — built into the site at /customers (DONE in demo; harden for launch)
- [x] Harvest roster with per-order status control (drives customer tracking pages)
- [x] Groups board with 3/4-full call list flags
- [x] Customer rollup with notes + CSV export
- [x] Printable butcher ticket per order
- [ ] Replace the placeholder passcode gate with real auth (Supabase) at launch
- [ ] Source tagging on every order (group link / direct / market) for attribution
- [ ] +14 days post-pickup automation: review ask + next-season group CTA (via Resend)

## 6. SEO (week 3–4, ongoing)
- [ ] Per-route titles/meta, OG images, sitemap.xml, robots.txt; pre-render or SSG the landing + how-it-works routes
- [ ] Schema.org: LocalBusiness + Product (shares w/ price) + FAQPage
- [ ] Google Business Profile: category, service area, photos, harvest posts
- [ ] City pages: beef shares Greeley / Fort Collins / Denver / Longmont
- [ ] Keyword targets: "quarter cow Colorado", "half beef price", "buy beef in bulk Denver"
- [ ] Content cadence: recipe/explainer per cut section (9 long-tail pages), harvest diary
- [ ] Plausible/GA4 events: deposit paid, group created, group-link visit → claim

## 7. Launch QA
- [ ] Full mobile pass; cross-browser; keyboard/a11y through order flow
- [ ] Real seed data; remove HNDRSN sample seeding for production
- [ ] Real $1 Stripe test through the whole journey
- [ ] 404 page, error states, "sold out" state for full months

## 8. Launch week
- [ ] Seed 2–3 real friends/family groups before public launch
- [ ] GBP live, socials claimed, first Nextdoor/Facebook presence
- [ ] Farmers-market kit: steer-diagram banner + iPad with live site
