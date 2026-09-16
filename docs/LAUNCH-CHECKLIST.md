# Thunderbolt Ranch — Go-Live Checklist (Gen 1)

*The order window closes **Sept 30** and it's early September — this is a two-week sprint,
not a month-long build. Ship the minimum that takes real deposits.*

## Done (working in the demo)
- [x] Pricing per the one-pager: $6/lb hanging, ≈$8.57/lb take-home, $250 deposit, Q/H/W $1,350/$2,700/$5,400
- [x] Guided cut-sheet wizard (13 questions, explainers, thickness-aware min–max counts)
- [x] Auto-filled CCMC cutting-instructions PDF (verified against the real form)
- [x] Landing + How It Works aligned to one-pager language and claims
- [x] Order tracking with status timeline; back-office CRM at /customers (roster, notes, CSV, CCMC PDFs)
- [x] Gen 2 (split-a-cow) parked in `gen2/`; FAQ and delivery removed

## Launch day (Sept 16) — see docs/SETUP-TODAY.md
- [x] **Live at https://thunderboltbeef.com/** (GitHub Pages, auto-deploys from `main`; HTTPS enforced)
- [x] thunderbolt-ranch.com + www 301-forward to thunderboltbeef.com (Squarespace Domain Forwarding)
- [x] Order backend written: `apps-script/Code.gs` → Google Sheet CRM + ranch notification + customer confirmation emails
- [x] Deposit hand-off to a Stripe Payment Link with the order code attached
- [x] Ranch Office key validated server-side (no passcode in client code once the backend is on)
- [ ] **Max:** deploy the Apps Script web app → send me the `/exec` URL
- [ ] **Max:** create the $250 Stripe Payment Link → send me the URL
- [ ] Me: set both as repo variables → auto-redeploy → real end-to-end test order
- [ ] Remove the TR-SAMPLE1 seed order once real orders flow (it's local-only demo data; harmless on the sheet)
- [ ] Butcher sanity-check of the wizard's per-cut count estimates (`src/data/config.ts` yields)
- [ ] Decide refund policy language for pre-deadline cancellations (deposit currently described as applying to total; confirm refundability wording)

## Week 2 — sell it
- [ ] Google Business Profile live; site linked
- [ ] Personal outreach wave (Josh's list) + Nextdoor/Facebook presence
- [ ] Deadline emails scheduled: Sept 16 harvest note, Sept 23 one-week, Sept 28–30 final call
- [ ] Cards/QR at Colorado Custom's counter
- [ ] Mobile pass + a real $1 Stripe test end to end

## Pickup week (Oct 1)
- [ ] Email cut sheets to order@ccmeatco.com from /customers (one click per order)
- [ ] Pickup logistics email: coolers, freezer space, $10/day storage after the grace week
- [ ] Collect balances (checks to Thunderbolt Ranch LLC; Stripe invoice as backup)
- [ ] Mark orders picked-up in /customers as they clear

## After Gen 1
- [ ] "How was the first ribeye?" follow-up + next-harvest waitlist
- [ ] SEO buildout (city pages, schema markup, recipes per cut)
- [ ] Ranch photography to replace stock (including a broadside Angus for the steer map)
- [ ] Gen 2: reactivate split-a-cow (group referral links) once a waitlist exists
