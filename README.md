# Thunderbolt Ranch — Beef Storefront (Gen 1)

Ranch-to-table storefront for one Colorado Angus harvest: customers reserve a quarter,
half, or whole, build a custom cut sheet through a guided wizard, and the site fills out
Colorado Custom Meat Co's official cutting-instructions PDF from their answers.

Pricing and language follow the Thunderbolt Ranch one-pager: $6/lb hanging weight,
≈$8.57/lb take-home, $250 deposit for any size, October 2026 harvest, order by Sept 30,
pickup only in Kersey, payment to Thunderbolt Ranch LLC.

## Run it

```bash
bun install
bun run dev        # http://localhost:5176
```

`bun run build` produces a single self-contained `dist/index.html` (demo-shareable).

## Routes

| Route | Page |
|---|---|
| `/` | Landing — hero + Angus primal map (tap for per-share yields), price strip vs USDA average, pasture-to-freezer weights, pricing cards, timeline & who-you-pay |
| `/how-it-works` | 5-step walkthrough, USDA price comparison, what's-in-the-box |
| `/order` | Share pick → 13-question cut-sheet wizard (explainers + live min–max counts, thickness-aware) → review & $250 deposit → confirmation with filled CCMC PDF download |
| `/track/:code` | Status timeline + estimated box + cut-sheet PDF |
| `/customers` | Back office (passcode `KERSEY`, placeholder): roster w/ status control, per-order CCMC PDFs, customer notes, CSV export |

## Key files

- `src/data/config.ts` — pricing, harvest dates, wizard schema, yield estimates (butcher should sanity-check), approved brand claims
- `src/lib/store.ts` — orders in localStorage (v2 keys), shaped for a backend swap
- `src/lib/estimate.ts` — box summary + count math; `src/lib/cutsheetPdf.ts` — fills `public/ccmc-cut-sheet.pdf` via pdf-lib
- `src/components/SteerMap.tsx` — Angus photo (public-domain, warm-toned, `public/angus-steer.jpg`) with traced SVG overlays
- `gen2/` — split-a-cow group buying, built but unrouted (Gen 2)
- `docs/` — marketing playbook, launch checklist, tech stack

Claims policy: only one-pager language (grain finished, pasture raised, Ranch to Table,
one Angus animal, Colorado, conception-to-harvest ownership). Photography is royalty-free
stand-ins until ranch photos exist.
