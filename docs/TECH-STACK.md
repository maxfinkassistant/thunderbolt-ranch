# Christensen Ranch — Tool Stack Recommendation

*How to take this prototype to a paying, production storefront.*

---

## TL;DR recommendation

**Keep this custom site** (the cut-sheet builder and split-a-cow flow are the product — no template platform can do them), and pair it with boring, cheap managed services:

| Layer | Tool | Cost | Why |
|---|---|---|---|
| Hosting | **Vercel** (or Netlify) | $0 | This Vite/React app deploys in one command; free tier covers a seasonal business forever |
| Database / backend | **Supabase** | $0–25/mo | Postgres + auth + row-level security. `src/lib/store.ts` was written to swap straight onto `orders` and `groups` tables |
| Payments | **Stripe** | 2.9% + 30¢ | Deposits via Payment Links or Checkout; invoices for the hanging-weight balance; full/partial refunds for the pre-deadline policy |
| Email | **Resend** (or Postmark) | $0–20/mo | Confirmation w/ cut sheet, hanging-weight notice, deadline reminders |
| SMS | **Twilio** | pennies/msg | "One quarter left on your cow" + pickup-day nudges — highest ROI messages in the funnel |
| CRM | **Airtable** (you already run it) or Supabase views | $0 | One row per customer; season, share size, group, LTV. Skip HubSpot-class tools at this scale |
| Analytics | **Plausible** or GA4 | $0–9/mo | Track share-link → deposit conversion, channel attribution |
| Domain/DNS | Cloudflare | ~$10/yr | — |

**Total fixed cost: roughly $10–55/month.** Everything scales with orders, not headcount.

## Why not Squarespace?

Squarespace (also Wix/Webflow-only) is the right tool for a brochure, and the wrong tool for this business:

- No way to build the 9-decision cut-sheet wizard, live yield math, or the group/referral logic — that's custom application behavior, and it's your differentiator.
- Commerce model assumes fixed-price SKUs shipped in cartons, not deposit-now / balance-on-hanging-weight / pay-processor-at-pickup.
- You'd end up bolting on Google Forms and phone calls — exactly the friction this site removes.

If you want a hosted marketing layer anyway, put the blog/recipes on anything and keep ordering on the app. But one site is simpler and better for SEO.

## Off-the-shelf alternatives (worth knowing about)

If you ever want to abandon custom software entirely:

- **GrazeCart** (~$120/mo) and **Barn2Door** (~$100–250/mo) are farm-direct commerce platforms — inventory by weight, deposits, pickup scheduling. Neither has an interactive cut-sheet builder or group-buy links; both are inventory-first (selling packs of steaks), not share-first.
- **Shopify** ($39/mo + apps) can take deposits with preorder apps, but the cut sheet and split-a-cow would still be custom development inside a more constrained platform.

Verdict: they solve the part that's already solved here, and can't do the part that makes this offer different.

## Supabase schema (maps 1:1 to the current code)

```sql
create table groups (
  code        text primary key,          -- e.g. HNDRSN
  name        text not null,
  date_id     text not null,             -- harvest month
  created_by  text not null,
  created_at  timestamptz default now()
);

create table orders (
  code        text primary key,          -- e.g. CR-4F7K2M
  status      text not null default 'reserved',
  share       text not null,             -- quarter | half | whole
  date_id     text not null,
  picks       jsonb not null,            -- cut decisions
  thickness   jsonb not null,
  pkg         text, patties bool, patty_size text,
  organs      text[], notes text,
  name        text not null, email text not null, phone text,
  group_code  text references groups(code),
  stripe_payment_intent text,
  created_at  timestamptz default now()
);

-- group fill = sum of quarters per member; enforce <= 4 in an insert trigger
```

`src/lib/store.ts` already exposes `createOrder`, `getGroup`, `groupFill`, etc. — replace the localStorage bodies with `supabase.from(...)` calls and the UI doesn't change.

## Launch path

1. **Now (this repo):** demo site, localStorage persistence — share with family/design partners for feedback.
2. **Week 1–2:** Supabase project + the two tables above; swap the store; deploy to Vercel on the real domain.
3. **Week 2–3:** Stripe Checkout for deposits (one product per share size); webhook marks the order `reserved`. Resend transactional emails (confirmation with the cut ticket rendered in).
4. **Week 3–4:** Admin view — a simple protected route (or even Airtable synced from Supabase) listing orders per harvest for you and a printable cut ticket per order for Colorado Custom.
5. **Season 2:** Twilio nudges (3/4-full groups, deadlines, pickup), review-ask automation, inventory counter driven from the DB instead of config.

## Placeholders to confirm before real money moves

All marked in `src/data/config.ts`:
- Deposit amounts ($200/$400/$600) and whether they're per-share or per-quarter
- $/lb hanging rates (currently $5.25 / $4.95 / $4.65 tiering) and the processing rate ($1.05/lb)
- Free storage days at Colorado Custom (site currently says 7) and the $10/day figure
- Delivery radius for the $100 local delivery
- Refund policy language (site says: full refund until order deadline, then credit)
- Harvest dates/capacity for the real season
- Swap Unsplash photography for the ranch's own photos before launch (`IMAGES` in config + per-cut `photo` fields)
