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

## Week 1 — take real money
- [ ] Domain + deploy to Vercel (site is one `bun run build` away)
- [ ] Supabase for orders (schema mirrors `src/lib/store.ts`); swap localStorage bodies
- [ ] Stripe Checkout for the $250 deposit; webhook marks order reserved
- [ ] Real auth on /customers (replace the KERSEY passcode)
- [ ] Confirmation email via Resend (order summary + cut-sheet PDF attached)
- [ ] Remove the TR-SAMPLE1 seed order for production
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
