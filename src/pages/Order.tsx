import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  SHARES, DEPOSIT, HANGING_RATE, TAKEHOME_RATE_EST, HARVEST, PROCESSOR,
  MAIN_CUTS, EXTRA_GROUPS, RIB_CHOICES, LOIN_CHOICES,
  RIB_YIELD, RIB_ROAST_LBS, TBONE_YIELD, STRIP_YIELD, FILET_YIELD,
  THICKNESS_OPTIONS, PER_PACKAGE_OPTIONS, ROAST_SIZE_OPTIONS,
  GROUND_PACK_OPTIONS, PATTY_SIZES, PATTY_NOTE, ORGANS,
  steakCount, roastCount, money, money2, PAYABLE_TO, RANCH_CONTACT,
  type ShareId, type MainCutDef,
} from "../data/config";
import { defaultCutSheet, createOrder, type Order as OrderRow, type CutSheetAnswers } from "../lib/store";
import { boxSummary, groundEstimate, shareCost } from "../lib/estimate";
import { downloadCutSheet } from "../lib/cutsheetPdf";
import { backendConfigured, submitOrder } from "../lib/api";
import { STRIPE_PAYMENT_LINK } from "../data/config";

/** Stripe Payment Link with the order code attached for reconciliation. */
function depositUrl(code: string, email: string): string {
  if (!STRIPE_PAYMENT_LINK) return "";
  const sep = STRIPE_PAYMENT_LINK.includes("?") ? "&" : "?";
  return `${STRIPE_PAYMENT_LINK}${sep}client_reference_id=${encodeURIComponent(code)}&prefilled_email=${encodeURIComponent(email)}`;
}

const inches = (id?: string) => THICKNESS_OPTIONS.find((t) => t.id === id)?.inches ?? 1;
const fmtRange = ([lo, hi]: [number, number]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

/* wizard step ids, in order */
const QUESTIONS = [
  "rib", "loin",
  ...MAIN_CUTS.map((c) => `main:${c.id}`),
  ...EXTRA_GROUPS.map((g) => `extras:${g.id}`),
  "ground", "organs",
] as const;

export default function Order() {
  const [share, setShare] = useState<ShareId | null>(null);
  const [q, setQ] = useState(-1);           // -1 = share pick, QUESTIONS.length = review
  const [a, setA] = useState<CutSheetAnswers>(defaultCutSheet);
  const [who, setWho] = useState({ name: "", email: "", phone: "", address: "" });
  const [placed, setPlaced] = useState<OrderRow | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const frac = share ? SHARES[share].frac : 0.5;
  const ground = useMemo(() => (share ? groundEstimate(a, share) : [0, 0] as [number, number]), [a, share]);

  const next = () => { setQ((x) => x + 1); window.scrollTo({ top: 0 }); };
  const back = () => { setQ((x) => x - 1); window.scrollTo({ top: 0 }); };

  const place = async () => {
    setPlacing(true);
    setPlaceError(null);
    const order = createOrder({ share: share!, cutSheet: a, ...who });
    if (backendConfigured()) {
      try {
        const cost = shareCost(share!);
        await submitOrder({
          order,
          summary: boxSummary(a, share!),
          cost: { total: cost.total, deposit: cost.deposit, balance: cost.balance },
          depositLink: depositUrl(order.code, order.email),
        });
      } catch (err) {
        setPlacing(false);
        setPlaceError(
          `We couldn't reach the ranch's order system (${(err as Error).message}). ` +
          `Your order isn't lost — text Josh at ${RANCH_CONTACT.phone} with code ${order.code}, or try again.`,
        );
        return;
      }
    }
    setPlacing(false);
    setPlaced(order);
    window.scrollTo({ top: 0 });
  };

  /* ============ CONFIRMATION ============ */
  if (placed) {
    return (
      <main className="page confirm-wrap">
        <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-md)" }}>Reserved</div>
        <h2 className="d" style={{ fontSize: "clamp(2.2rem,5vw,3.2rem)" }}>Your beef is booked.</h2>
        <p style={{ marginTop: "var(--space-md)", color: "var(--ink-2)" }}>
          Order <strong className="mono">{placed.code}</strong>
          {backendConfigured()
            ? <> — a confirmation is on its way to {placed.email}.</>
            : <> — save this code.</>}
        </p>

        {STRIPE_PAYMENT_LINK ? (
          <div className="pay-panel" style={{ marginTop: "var(--space-lg)", textAlign: "left" }}>
            <span className="tag">One more step</span>
            <p className="small" style={{ marginBottom: "var(--space-md)" }}>
              Your share is held once the {money(DEPOSIT)} deposit is in. Card payment is secure through Stripe;
              your order code travels with it so we can match it up.
            </p>
            <a className="btn btn-on-dark btn-wide" href={depositUrl(placed.code, placed.email)} target="_blank" rel="noreferrer">
              Pay {money(DEPOSIT)} deposit now
            </a>
          </div>
        ) : (
          <div className="group-note" style={{ marginTop: "var(--space-lg)", textAlign: "left" }}>
            <span className="tag">Deposit</span>
            <span>
              {RANCH_CONTACT.name} will reach out to collect your {money(DEPOSIT)} deposit — or call/text
              him at {RANCH_CONTACT.phone} with order code <strong className="mono">{placed.code}</strong>.
            </span>
          </div>
        )}

        <div className="next-steps">
          {[
            ["Now", `Your ${money(DEPOSIT)} deposit holds your ${SHARES[placed.share].label.toLowerCase()}. You can adjust your cut sheet until ${HARVEST.orderBy}.`],
            [HARVEST.killDate.replace(", 2026", ""), "Harvest. Your beef dry-ages 14 days at Colorado Custom in Kersey."],
            [HARVEST.processed.replace(", 2026", ""), "Cut and packaged to your exact cut sheet, vacuum sealed and labeled."],
            [HARVEST.ready, `Pickup in Kersey — bring coolers for about ${SHARES[placed.share].takehome} lb. Balance of ${money(SHARES[placed.share].total - DEPOSIT)} due to ${PAYABLE_TO}.`],
          ].map(([k, v]) => (
            <div className="next-step" key={k}>
              <div className="when">{k}</div>
              <div className="what">{v}</div>
            </div>
          ))}
        </div>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <button
            className="btn btn-solid"
            disabled={pdfBusy}
            onClick={async () => { setPdfBusy(true); try { await downloadCutSheet(placed); } finally { setPdfBusy(false); } }}
          >
            {pdfBusy ? "Building PDF…" : "Download your cut sheet (PDF)"}
          </button>
          <Link className="btn btn-ghost" to={`/track/${placed.code}`}>Track this order</Link>
        </div>
        <p className="small mute" style={{ marginTop: "var(--space-md)" }}>
          That's the actual Colorado Custom cutting-instructions form, filled out from your answers.
        </p>
      </main>
    );
  }

  /* ============ SHARE PICK ============ */
  if (q === -1) {
    return (
      <main className="page order-main">
        <div className="section-head">
          <div className="tag" style={{ color: "var(--rust)", marginBottom: "var(--space-xs)" }}>
            {HARVEST.label} harvest · order by {HARVEST.orderBy}
          </div>
          <h2 className="d">How much beef?</h2>
          <p>
            One price for every share: {money2(HANGING_RATE)}/lb hanging weight —
            about {money2(TAKEHOME_RATE_EST)}/lb in your freezer. {money(DEPOSIT)} deposit
            holds it, balance due at pickup.
          </p>
        </div>

        <div className="share-grid" style={{ marginBottom: "var(--space-2xl)" }}>
          {Object.values(SHARES).map((s) => {
            const on = share === s.id;
            return (
              <button key={s.id} onClick={() => setShare(s.id)} className={"share-card" + (on ? " on" : "")}>
                {s.id === "half" && <span className="share-badge">Most popular</span>}
                <div className="d">{s.label} beef</div>
                <div className="d" style={{ fontSize: "2rem", marginTop: 6, color: on ? "var(--brass)" : "var(--rust)" }}>
                  {money(s.total)}
                </div>
                <div className="share-specs">
                  <span>{s.hanging} LBS HANGING</span>
                  <span>{s.takehome} LBS TAKE-HOME (EST)</span>
                  <span className="hot">FREEZER {s.freezer}</span>
                </div>
                <p className="share-feeds">Feeds {s.feeds}.</p>
                <div className="share-price">
                  <span className="small" style={{ opacity: 0.75 }}>{money(DEPOSIT)} deposit</span>
                  <strong>{money(s.total - DEPOSIT)} at pickup</strong>
                </div>
              </button>
            );
          })}
        </div>

        <p className="small mute measure" style={{ marginBottom: "var(--space-lg)" }}>
          Estimates based on a typical 1,500 lb animal — your actual animal may run somewhat
          above or below these figures. Next: a short walk-through builds your custom cut
          sheet, one question at a time. Every answer has a safe default, so you can't get it wrong.
        </p>

        <div className="hero-actions" style={{ marginTop: 0 }}>
          <Link to="/" className="btn btn-ghost">Back</Link>
          <button className="btn btn-solid btn-big" disabled={!share} onClick={next}>
            Build my cut sheet
          </button>
        </div>
      </main>
    );
  }

  /* ============ REVIEW ============ */
  if (q >= QUESTIONS.length) {
    const cost = shareCost(share!);
    const lines = boxSummary(a, share!);
    return (
      <main className="page order-main">
        <div className="section-head">
          <h2 className="d">Check it over</h2>
          <p>This becomes your official Colorado Custom cut sheet — we fill out the butcher's form for you.</p>
        </div>

        <div className="cutsheet-grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)" }}>
          <div className="ticket" style={{ alignSelf: "start" }}>
            <div className="ticket-head">
              <span className="tag">Your estimated box</span>
              <span className="mute">{SHARES[share!].label.toUpperCase()} BEEF</span>
            </div>
            {lines.map((l) => (
              <div className="ticket-row" key={l.name}>
                <span className="k">{l.name}</span>
                <span className="v">{l.detail}</span>
              </div>
            ))}
            <div className="ticket-total">
              <span>ESTIMATED TAKE-HOME</span>
              <span className="v">≈ {cost.takehomeLbs} LB</span>
            </div>
          </div>

          <div style={{ display: "grid", gap: "var(--space-md)", alignContent: "start" }}>
            <div className="pay-panel">
              <span className="tag">What you'll pay</span>
              <div className="pay-row">
                <span>Deposit today<span className="sub">To {PAYABLE_TO}. Applies to your total.</span></span>
                <b>{money(cost.deposit)}</b>
              </div>
              <div className="pay-row">
                <span>Balance at pickup<span className="sub">{cost.hangingLbs} lb hanging × {money2(HANGING_RATE)}/lb − deposit</span></span>
                <b>{money(cost.balance)}</b>
              </div>
              <div className="pay-row total">
                <span>Total</span>
                <b>{money(cost.total)}</b>
              </div>
              <p className="pay-fine">
                No processing fees, no hidden costs — about {money2(TAKEHOME_RATE_EST)}/lb in your
                freezer. Checks payable to {PAYABLE_TO}. Pickup at {PROCESSOR.name}, Kersey.
              </p>
            </div>

            <div className="decision" style={{ display: "grid", gap: "var(--space-sm)" }}>
              {([
                ["name", "Your name", "name"],
                ["email", "Email", "email"],
                ["phone", "Phone", "tel"],
                ["address", "Address", "street-address"],
              ] as const).map(([k, label, ac]) => (
                <div className="field" key={k}>
                  <label htmlFor={`o-${k}`}>{label}</label>
                  <input id={`o-${k}`} value={who[k]} autoComplete={ac}
                    onChange={(e) => setWho({ ...who, [k]: e.target.value })} />
                </div>
              ))}
              <button className="btn btn-dark btn-wide" disabled={placing || !who.name || !who.email || !who.phone} onClick={place}>
                {placing ? "Reserving…" : `Reserve & pay ${money(DEPOSIT)} deposit`}
              </button>
              {placeError && <p className="small" style={{ color: "var(--rust)" }}>{placeError}</p>}
              <p className="small mute" style={{ textAlign: "center" }}>
                {STRIPE_PAYMENT_LINK
                  ? "Next: secure card payment through Stripe."
                  : `${RANCH_CONTACT.name} will collect your deposit after you reserve.`}{" "}
                Questions? Call or text {RANCH_CONTACT.name}: {RANCH_CONTACT.phone}.
              </p>
            </div>

            <button className="btn btn-ghost btn-wide" onClick={back}>Back to the cut sheet</button>
          </div>
        </div>
      </main>
    );
  }

  /* ============ WIZARD ============ */
  const qid = QUESTIONS[q];
  const progress = `${q + 1} of ${QUESTIONS.length}`;

  const Chips = ({ opts, value, onPick, dark }: { opts: readonly string[]; value?: string; onPick: (v: string) => void; dark?: boolean }) => (
    <div className="chips">
      {opts.map((o) => (
        <button key={o} className={"chip" + (value === o ? " on" : "")} onClick={() => onPick(o)}>{o}</button>
      ))}
    </div>
  );

  const ThicknessPicker = ({ value, onPick, count, what }: { value?: string; onPick: (v: string) => void; count?: [number, number]; what?: string }) => (
    <div className="thickness">
      <div className="tag" style={{ color: "var(--mute)", marginBottom: "var(--space-sm)" }}>Steak thickness</div>
      <div className="chips">
        {THICKNESS_OPTIONS.map((t) => (
          <button key={t.id} className={"chip" + (value === t.id ? " on" : "")} onClick={() => onPick(t.id)}>{t.label}</button>
        ))}
      </div>
      <p className="chip-note">
        {THICKNESS_OPTIONS.find((t) => t.id === value)?.note}{" "}
        {count && <>Thicker means fewer: roughly <b>{fmtRange(count)} {what ?? "steaks"}</b> in your {SHARES[share!].label.toLowerCase()} at this thickness.</>}
      </p>
    </div>
  );

  let body: JSX.Element = <></>;
  let title = "";
  let where = "";
  let help = "";

  if (qid === "rib") {
    title = "The rib section";
    where = "Along the upper back — barely worked, heavily marbled. The luxury cuts live here.";
    help = "This is one muscle, and you choose the shape it arrives in: a standing prime rib roast for the holidays, bone-in rib steaks, or classic boneless ribeyes. You can't have all three — they come out of each other.";
    const c = a.rib.choice === "prime" ? undefined : steakCount(RIB_YIELD, frac, inches(a.rib.thickness));
    body = (
      <>
        <div className="opts">
          {RIB_CHOICES.map((o) => (
            <button key={o.id} className={"opt" + (a.rib.choice === o.id ? " on" : "")}
              onClick={() => setA({ ...a, rib: { ...a.rib, choice: o.id } })}>
              <div className="lbl">{o.label}</div>
            </button>
          ))}
        </div>
        {(() => { const o = RIB_CHOICES.find((x) => x.id === a.rib.choice)!; return (
          <div className="tradeoff">
            <div className="trade trade-get"><span className="tag">You get</span>{o.gives}</div>
            <div className="trade trade-give"><span className="tag">You give up</span>{o.costs}</div>
          </div>
        ); })()}
        {a.rib.choice === "prime" ? (
          <p className="chip-note">Your {SHARES[share!].label.toLowerCase()} yields {share === "whole" ? "two prime rib roasts (one per side)" : share === "half" ? "one full prime rib roast" : "one smaller prime rib roast"} — roughly {fmtRange(roastCount(RIB_ROAST_LBS, frac, 5))} × 5 lb pieces.</p>
        ) : (
          <>
            <ThicknessPicker value={a.rib.thickness} count={c} what={a.rib.choice === "ribsteak" ? "rib steaks" : "ribeyes"}
              onPick={(t) => setA({ ...a, rib: { ...a.rib, thickness: t } })} />
            <div style={{ marginTop: "var(--space-md)" }}>
              <div className="tag" style={{ color: "var(--mute)", marginBottom: "var(--space-sm)" }}>Steaks per package</div>
              <Chips opts={PER_PACKAGE_OPTIONS} value={a.rib.perPackage} onPick={(v) => setA({ ...a, rib: { ...a.rib, perPackage: v } })} />
            </div>
          </>
        )}
      </>
    );
  } else if (qid === "loin") {
    title = "The short loin";
    where = "The middle of the back — the strip on top of the bone, the tenderloin underneath.";
    help = "A T-bone is both muscles still joined at the bone. Cut the bone away and the same meat becomes NY strips and true filet mignon. Same beef, one decision — there's no wrong answer, only preference.";
    const tb = steakCount(TBONE_YIELD, frac, inches(a.loin.thickness));
    const st = steakCount(STRIP_YIELD, frac, inches(a.loin.thickness));
    const fi = steakCount(FILET_YIELD, frac, inches(a.filetThickness ?? "1 1/2"));
    body = (
      <>
        <div className="opts">
          {LOIN_CHOICES.map((o) => (
            <button key={o.id} className={"opt" + (a.loin.choice === o.id ? " on" : "")}
              onClick={() => setA({ ...a, loin: { ...a.loin, choice: o.id } })}>
              <div className="lbl">{o.label}</div>
            </button>
          ))}
        </div>
        {(() => { const o = LOIN_CHOICES.find((x) => x.id === a.loin.choice)!; return (
          <div className="tradeoff">
            <div className="trade trade-get"><span className="tag">You get</span>{o.gives}</div>
            <div className="trade trade-give"><span className="tag">You give up</span>{o.costs}</div>
          </div>
        ); })()}
        <ThicknessPicker value={a.loin.thickness} count={a.loin.choice === "tbone" ? tb : st}
          what={a.loin.choice === "tbone" ? "T-bones" : "NY strips"}
          onPick={(t) => setA({ ...a, loin: { ...a.loin, thickness: t } })} />
        {a.loin.choice === "strip" && (
          <p className="chip-note">Plus roughly <b>{fmtRange(fi)} filet mignon</b> at 1 1/2" from the freed tenderloin.</p>
        )}
        <div style={{ marginTop: "var(--space-md)" }}>
          <div className="tag" style={{ color: "var(--mute)", marginBottom: "var(--space-sm)" }}>Steaks per package</div>
          <Chips opts={PER_PACKAGE_OPTIONS} value={a.loin.perPackage} onPick={(v) => setA({ ...a, loin: { ...a.loin, perPackage: v } })} />
        </div>
      </>
    );
  } else if (qid.startsWith("main:")) {
    const cut = MAIN_CUTS.find((c) => c.id === qid.slice(5))!;
    const ans = a.main[cut.id];
    title = cut.name;
    where = cut.where;
    help = cut.help;
    const setMain = (patch: Partial<typeof ans>) =>
      setA({ ...a, main: { ...a.main, [cut.id]: { ...ans, ...patch } } });
    const modeLabels: Record<string, string> = { roast: "Roasts", steak: "Steaks", grind: "Grind it" };
    const c = ans.mode === "steak" && cut.yield ? steakCount(cut.yield, frac, inches(ans.thickness)) : undefined;
    const rc = ans.mode === "roast" && cut.roastLbs ? roastCount(cut.roastLbs, frac, parseInt(ans.roastSize ?? "3") || 3) : undefined;
    body = (
      <>
        <div className="opts">
          {cut.modes.map((mo) => (
            <button key={mo} className={"opt" + (ans.mode === mo ? " on" : "")} onClick={() => setMain({ mode: mo })}>
              <div className="lbl">{modeLabels[mo]}</div>
            </button>
          ))}
        </div>
        {ans.mode === "roast" && (
          <>
            <div className="tag" style={{ color: "var(--mute)", margin: "var(--space-sm) 0" }}>Roast size</div>
            <Chips opts={ROAST_SIZE_OPTIONS} value={ans.roastSize} onPick={(v) => setMain({ roastSize: v })} />
            {rc && <p className="chip-note">Roughly <b>{fmtRange(rc)} roasts</b> in your {SHARES[share!].label.toLowerCase()}.</p>}
          </>
        )}
        {ans.mode === "steak" && cut.yield && (
          <>
            <ThicknessPicker value={ans.thickness} count={c} what={`${cut.name.toLowerCase()} steaks`} onPick={(v) => setMain({ thickness: v })} />
            <div style={{ marginTop: "var(--space-md)" }}>
              <div className="tag" style={{ color: "var(--mute)", marginBottom: "var(--space-sm)" }}>Steaks per package</div>
              <Chips opts={PER_PACKAGE_OPTIONS} value={ans.perPackage} onPick={(v) => setMain({ perPackage: v })} />
            </div>
          </>
        )}
        {ans.mode === "grind" && (
          <p className="chip-note">Rolls into your ground beef — running estimate <b>{ground[0]}–{ground[1]} lb</b>.</p>
        )}
      </>
    );
  } else if (qid.startsWith("extras:")) {
    const group = EXTRA_GROUPS.find((g) => g.id === qid.slice(7))!;
    title = group.title;
    where = group.intro;
    help = "Keep it and it comes home as the cut; grind it and it joins your ground beef. Tap to flip each one.";
    body = (
      <div className="organ-grid">
        {group.cuts.map((c) => {
          const keep = a.extras[c.id] === "yes";
          return (
            <button key={c.id} className={"organ" + (keep ? " on" : "")}
              onClick={() => setA({ ...a, extras: { ...a.extras, [c.id]: keep ? "grind" : "yes" } })}>
              <div style={{ fontWeight: 600 }}>{c.name} — {keep ? "keep" : "grind"}</div>
              <div className="note">{c.help}</div>
            </button>
          );
        })}
      </div>
    );
  } else if (qid === "ground") {
    title = "Ground beef";
    where = `Everything you didn't keep whole, plus the trim — you're at roughly ${ground[0]}–${ground[1]} lb.`;
    help = "This is the package you'll reach for most. Pick the size that matches how you cook, and decide if you want some pressed into patties.";
    body = (
      <>
        <div className="opts">
          {GROUND_PACK_OPTIONS.map((p) => (
            <button key={p.id} className={"opt" + (a.groundPack === p.id ? " on" : "")} onClick={() => setA({ ...a, groundPack: p.id })}>
              <div className="lbl">{p.label}</div>
              <div className="det">{p.note}</div>
            </button>
          ))}
        </div>
        <div className="patty-row" style={{ borderTopColor: "var(--line)" }}>
          <label>
            <input type="checkbox" checked={a.patties} onChange={(e) => setA({ ...a, patties: e.target.checked })} style={{ accentColor: "var(--rust)" }} />
            <span>
              <b>Press some into patties</b>
              <span className="mute" style={{ display: "block", marginTop: 2, fontSize: "0.85rem" }}>{PATTY_NOTE}</span>
            </span>
          </label>
          {a.patties && (
            <div className="chips" style={{ marginTop: "var(--space-sm)", marginLeft: 28 }}>
              {PATTY_SIZES.map((s) => (
                <button key={s} className={"chip" + (a.pattySize === s ? " on" : "")} onClick={() => setA({ ...a, pattySize: s })}>{s}</button>
              ))}
            </div>
          )}
        </div>
      </>
    );
  } else if (qid === "organs") {
    title = "Organs & bones";
    where = "Included at no extra charge — but only if you ask.";
    help = "If you don't check them, they don't come home with you. Broth makers: take the bones.";
    body = (
      <>
        <div className="organ-grid">
          {ORGANS.map((o) => {
            const on = a.organs.includes(o.id);
            return (
              <button key={o.id} className={"organ" + (on ? " on" : "")}
                onClick={() => setA({ ...a, organs: on ? a.organs.filter((x) => x !== o.id) : [...a.organs, o.id] })}>
                <div style={{ fontWeight: 600 }}>{o.label}</div>
                <div className="note">{o.note}</div>
              </button>
            );
          })}
        </div>
        <div className="field" style={{ marginTop: "var(--space-lg)" }}>
          <label htmlFor="o-notes">Anything else for the butcher?</label>
          <textarea id="o-notes" rows={3} value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })}
            placeholder="Questions, special requests, how you plan to cook things…" />
        </div>
      </>
    );
  }

  return (
    <main className="page order-main" style={{ maxWidth: 760 }}>
      <div className="wizard-top">
        <span className="tag" style={{ color: "var(--rust)" }}>Your cut sheet · question {progress}</span>
        <div className="wizard-bar"><div style={{ width: `${((q + 1) / QUESTIONS.length) * 100}%` }} /></div>
      </div>

      <section className="decision" style={{ padding: "var(--space-xl)" }}>
        <h2 className="d" style={{ fontSize: "1.8rem" }}>{title}</h2>
        <p className="where" style={{ marginTop: 4 }}>{where}</p>
        <p className="why">{help}</p>
        {body}
      </section>

      <div className="wizard-nav">
        <button className="btn btn-ghost" onClick={back}>Back</button>
        <span className="small mute">Ground beef so far: ≈ {ground[0]}–{ground[1]} lb</span>
        <button className="btn btn-solid" onClick={next}>
          {q === QUESTIONS.length - 1 ? "Review my order" : "Next"}
        </button>
      </div>
    </main>
  );
}
