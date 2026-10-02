# Per-steer price per pound, and the final invoice

**2026-10-02** · built and shipped

## The problem

Every order is billed at one global rate — `HANGING_RATE`, $6.00/lb hanging. When a
steer comes in heavy the customer's bill climbs with it. The ranch wants to soften
that by dropping the price per pound on that animal, and to tell the customer why.

There was also no final invoice at all: the only emails went out at reservation time.

## The design

### Rate on the steer

`Steer` gains `rate?: number`. Unset means the standard $6.00, so every existing
steer is unaffected. It's typed by hand in the Ranch Office — no tier table to
maintain — in a new "Price per lb" column beside Hanging weight.

### One pricing function

`finalPrice(share, steer)` in `src/lib/estimate.ts` is the single source of the
post-harvest math: rate used, hanging pounds, share pounds, total, deposit,
balance, whether the rate was adjusted, and what that saved. Returns `null`
until the steer has a weight, which is what keeps every surface showing the
estimate until there's a real number to show.

`priceFor_()` in `apps-script/Code.gs` mirrors it for the server, which recomputes
the bill from the sheet rather than trusting anything the browser sends.
**These two must stay in step** — there's a parity check in the commit message's
test notes covering 144 weight × rate × share combinations.

### The note

`rateNote()` generates the customer-facing explanation. It only appears when the
rate is under standard, and it only blames the carcass weight when the carcass
was actually over `HANGING_TYP` (900 lb). Dropping a rate on a light animal gets
the neutral wording instead, so we never email someone a false reason.

### Surfaces

| Where | What it shows |
|---|---|
| Ranch Office roster | Total, `shareLbs × rate`, and a "rate cut · saves $X" chip |
| Ranch Office steers tab | The rate field, with "$X/lb off standard" under it |
| Order ticket | Share of the hang, price per pound (with the old rate struck), note |
| Invoice email | New `invoice` action, sent by hand per order |
| Customer Track page | "Your final total" panel + note, once the steer is weighed |

### Privacy boundary

The Track page is public — anyone with an order code can load it. So the public
`?action=order` endpoint attaches only *that order's* `pricing` (hanging weight
and rate), never the steer roster.

## Deliberately not built

- Automatic weight tiers. Josh types the number.
- Free-text override of the note. The generated text covers the stated case; add
  an override if a second reason for a discount ever comes up.
- Automatic invoice sending. Josh presses the button when the numbers are settled.
