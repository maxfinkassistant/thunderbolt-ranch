# Christensen Ranch — Bulk Beef Storefront

Consumer site for selling shares of Colorado-raised beef: customers reserve a quarter, half, or whole animal, design their own cut sheet, and pick up at Colorado Custom Meat Co in Kersey, CO. Groups can split one cow via shareable referral links and everyone gets the whole-beef rate when it fills.

Built from the original cut-sheet prototype artifact; expanded into a full multi-page app.

## Run it

```bash
bun install
bun run dev        # http://localhost:5176
```

## What's here

No custom cuts — every share is cut to the ranch's standard cut sheet (`STANDARD_CUT` in config); marketing leads with the discounted all-in $/lb vs store per-cut prices.

| Route | Page |
|---|---|
| `/` | Landing — price-led hero, one-price comparison strip, photo steer map with per-share yield popups, Colorado farm-to-table story, shares, harvest calendar, FAQ |
| `/how-it-works` | 5-step process walkthrough, price-math comparison table, what's-in-the-box (steer map + standard cut list), logistics |
| `/order` | 2-step order flow: share & month → review (estimated box + standard cut + full cost estimate) & deposit |
| `/order?group=CODE` | Same flow joining a split-a-cow group (locks month, limits share size to open quarters, applies whole-beef rate) |
| `/split` | Split-a-cow explainer + create a group |
| `/split/:code` | Group page — steer fills quarter-by-quarter, member list, shareable claim link |
| `/track` / `/track/:code` | Order lookup + status timeline with the full cut ticket |

## Structure

- `src/data/config.ts` — shares, pricing, harvest dates, cut decisions, photos. **All placeholder rates are flagged here.**
- `src/lib/store.ts` — data layer (orders, groups). localStorage today; function signatures mirror the planned Supabase tables (see `docs/TECH-STACK.md`). Seeds one sample group (`HNDRSN`) + orders on first run.
- `src/lib/yield.ts` — take-home weight and cost estimates.
- `src/components/Cow.tsx` — interactive primal diagram (silhouette + clipped regions). `CowMeter.tsx` — the group-fill progress steer.
- `src/pages/` — Landing, Order, Split, Group, Track.
- `docs/MARKETING-PLAYBOOK.md` — positioning, split-a-cow growth loop, channels, seasonal calendar, 30/60/90.
- `docs/TECH-STACK.md` — hosting/payments/database recommendation and Supabase migration path.

Photography is royalty-free Unsplash, hotlinked — swap for ranch photos before launch.
