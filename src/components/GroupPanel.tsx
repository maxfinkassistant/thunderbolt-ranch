/* "Your group: 2 of 4" — the referral code, how far the group is from
   the next rate, a copyable invite link and a pre-written email. Every
   confirmed order in the group pays the unlocked rate. */

import { useState } from "react";
import { SHARE_RATES, GROUP_UNLOCK, SITE_URL, tierFor, money2, type ShareId } from "../data/config";
import { backendConfigured, sendInvites, type Invite, type InviteResult } from "../lib/api";

const blankRow = (): Invite => ({ name: "", email: "", phone: "" });

export default function GroupPanel({ code, share, size, email }: { code: string; share: ShareId; size: number; email?: string }) {
  const [copied, setCopied] = useState(false);
  const [rows, setRows] = useState<Invite[]>([blankRow(), blankRow()]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<InviteResult[] | null>(null);
  const [smsOn, setSmsOn] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const filled = rows.filter((r) => (r.email ?? "").trim() || (r.phone ?? "").trim());

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filled.length) return;
    setSending(true); setErr(null);
    try {
      if (!backendConfigured()) { setSent(filled.map((r) => ({ ...r, emailed: !!r.email, texted: !!r.phone, note: "demo" }))); return; }
      const r = await sendInvites(code, email ?? "", filled);
      setSent(r.results); setSmsOn(r.smsConfigured);
      setRows([blankRow(), blankRow()]);
    } catch (ex) { setErr((ex as Error).message); }
    finally { setSending(false); }
  };
  const link = `${SITE_URL}/#/order?ref=${code}`;
  const eff = tierFor(share, size);            // the rate tier they actually pay now
  const unlocked = eff !== share;
  const needHalf = Math.max(0, GROUP_UNLOCK.half + 1 - size);
  const needWhole = Math.max(0, GROUP_UNLOCK.whole + 1 - size);
  const next = eff === "quarter" ? { n: needHalf, rate: SHARE_RATES.half, label: "half-steer" }
    : eff === "half" ? { n: needWhole, rate: SHARE_RATES.whole, label: "whole-steer" }
    : null;

  const subject = "Split a steer with me — Thunderbolt Ranch";
  const body = `I'm ordering beef from Thunderbolt Ranch — one Colorado Angus, cut however you want it. `
    + `If you order with my code we all pay less per pound: one friend gets everyone the half-steer rate (${money2(SHARE_RATES.half)}/lb), `
    + `three gets us all the whole-steer rate (${money2(SHARE_RATES.whole)}/lb).\n\nOrder here and my code is filled in for you: ${link}\n\nCode: ${code}`;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("Copy this link", link); }
  };

  return (
    <div className="group-panel">
      <div className="group-head">
        <span className="tag">Split a steer with friends</span>
        <span className="group-count">{size} of {GROUP_UNLOCK.whole + 1}</span>
      </div>
      <div className="group-dots" aria-hidden="true">
        {Array.from({ length: GROUP_UNLOCK.whole + 1 }, (_, i) => <span key={i} className={i < size ? "on" : ""} />)}
      </div>
      <p className="group-line">
        {eff === "whole"
          ? <>Your group has the <b>whole-steer rate — {money2(SHARE_RATES.whole)}/lb</b> for everyone.</>
          : unlocked
            ? <>Your group unlocked the <b>{eff}-steer rate — {money2(SHARE_RATES[eff])}/lb</b>.{next && next.n > 0 && <> {next.n} more friend{next.n > 1 ? "s" : ""} → {money2(next.rate)}/lb for everyone.</>}</>
            : <>You're at <b>{money2(SHARE_RATES[share])}/lb</b>, the {share}-steer rate.{next && <> Get <b>{next.n} friend{next.n > 1 ? "s" : ""}</b> to order with your code and everyone pays the {next.label} rate, {money2(next.rate)}/lb.</>}</>}
      </p>
      <div className="group-code">
        <span className="tag">Your code</span>
        <b className="mono">{code}</b>
      </div>
      <form className="invite-form" onSubmit={send}>
        <span className="tag" style={{ color: "var(--mute)" }}>Invite friends — we'll email and text them your code</span>
        {rows.map((r, i) => (
          <div className="invite-row" key={i}>
            <input placeholder="Name" value={r.name ?? ""} autoComplete="off"
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input placeholder="Email" type="email" value={r.email ?? ""} autoComplete="off"
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
            <input placeholder="Phone" type="tel" value={r.phone ?? ""} autoComplete="off"
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
          </div>
        ))}
        <div className="group-actions">
          <button className="btn btn-solid" type="submit" disabled={sending || !filled.length}>
            {sending ? "Sending…" : filled.length ? `Send ${filled.length} invite${filled.length === 1 ? "" : "s"}` : "Send invites"}
          </button>
          {rows.length < 6 && <button className="btn btn-ghost" type="button" onClick={() => setRows([...rows, blankRow()])}>+ Another</button>}
          <button className="btn btn-ghost" type="button" onClick={copy}>{copied ? "Link copied ✓" : "Copy link"}</button>
          <a className="btn btn-ghost" href={mailto}>Open in my email</a>
        </div>
        {err && <p className="small" style={{ color: "var(--rust)" }}>{err}</p>}
        {sent && (
          <ul className="invite-sent">
            {sent.map((r, i) => (
              <li key={i}>
                <b>{r.email || r.phone}</b>{" — "}
                {[r.emailed && "emailed", r.texted && "texted"].filter(Boolean).join(" & ") || "not sent"}
                {r.note && r.note !== "demo" && <span className="mute"> · {r.note}</span>}
              </li>
            ))}
            {!smsOn && <li className="mute">Texts aren't switched on yet — emails went out.</li>}
          </ul>
        )}
      </form>
      <p className="small mute">Each friend gets a link with your code filled in and places their own order with their own cut sheet. Rates are set at invoice time on everyone whose deposit is in.</p>
    </div>
  );
}
