/* Popup shown when a primal is clicked on the steer map:
   what the section is, and what it typically yields in a
   quarter, half, and whole beef. */

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { Primal } from "../data/config";

export default function CutDialog({
  primal,
  onClose,
}: {
  primal: Primal | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!primal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [primal, onClose]);

  if (!primal) return null;

  return (
    <div className="dialog-scrim" onClick={onClose} role="presentation">
      <div
        className="cut-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cut-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <img className="cut-dialog-photo" src={primal.photo} alt={primal.photoAlt} />
        <div className="cut-dialog-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "var(--space-md)" }}>
            <h3 id="cut-dialog-title" className="d" style={{ fontSize: "1.5rem" }}>{primal.name}</h3>
            <button ref={closeRef} className="dialog-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <p className="small" style={{ color: "var(--ink-2)", marginTop: 4 }}>{primal.where}</p>

          <div className="count-table">
            <div className="count-row">
              <span className="count-share">Quarter</span>
              <span className="count-val">{primal.counts.quarter}</span>
            </div>
            <div className="count-row">
              <span className="count-share">Half</span>
              <span className="count-val">{primal.counts.half}</span>
            </div>
            <div className="count-row">
              <span className="count-share">Whole</span>
              <span className="count-val">{primal.counts.whole}</span>
            </div>
          </div>

          <p className="small mute" style={{ marginTop: "var(--space-sm)" }}>
            Estimates for a typical animal — your cut sheet decides the exact mix.
          </p>

          <Link to="/order" className="btn btn-solid btn-wide" style={{ marginTop: "var(--space-md)" }}>
            Start your order
          </Link>
        </div>
      </div>
    </div>
  );
}
