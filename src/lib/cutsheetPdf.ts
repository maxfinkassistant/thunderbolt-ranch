/* Fill the actual CCMC "Beef Cutting Instructions" fillable PDF
   from a completed order. Field names come straight from the
   form's AcroForm dictionary. Runs entirely in the browser. */

import { PDFDocument } from "pdf-lib";
import { SHARES, HARVEST, ASSET } from "../data/config";
import type { Order } from "./store";

const X = "X";

function setText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string) {
  try {
    form.getTextField(name).setText(value);
  } catch {
    /* field missing — leave a console note but don't break the download */
    console.warn("cut sheet field not found:", name);
  }
}

/* Main-table row helpers: each row has ROAST/LBS, OR, THICKNESS,
   #/PACKAGE, GRIND columns with the row name as the suffix. */
function fillRow(
  form: ReturnType<PDFDocument["getForm"]>,
  suffix: string,
  v: { roast?: string; thickness?: string; perPackage?: string; grind?: boolean },
) {
  if (v.roast) setText(form, `ROAST  LBS${suffix}`, v.roast);
  if (v.thickness) setText(form, `STEAK THICKNESS${suffix}`, `${v.thickness}"`);
  if (v.perPackage) setText(form, ` Per Package${suffix}`, v.perPackage);
  if (v.grind) setText(form, `Grind${suffix}`, X);
}

function fillYesGrind(form: ReturnType<PDFDocument["getForm"]>, suffix: string, keep: boolean) {
  setText(form, keep ? `Yes${suffix}` : `Grind${suffix}`, X);
}

export async function buildFilledCutSheet(order: Order): Promise<Uint8Array> {
  const bytes = await fetch(ASSET("ccmc-cut-sheet.pdf")).then((r) => r.arrayBuffer());
  return fillCutSheet(order, bytes);
}

export async function fillCutSheet(order: Order, bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const a = order.cutSheet;

  /* header (Text1–5 = Date, Customer, Address, Email, Phone) */
  setText(form, "Text1", new Date(order.createdAt).toLocaleDateString());
  setText(form, "Text2", order.name);
  setText(form, "Text3", order.address);
  setText(form, "Text4", order.email);
  setText(form, "Text5", order.phone);
  setText(form, "KILL DATE", HARVEST.killDate);
  setText(form, "CARCASS WEIGHT", `~${SHARES[order.share].hanging} lb (est)`);
  setText(form, "WHOLE   12   14", SHARES[order.share].label.toUpperCase());

  /* main cuts */
  const m = a.main;
  fillRow(form, "CHUCK", m.chuck?.mode === "roast"
    ? { roast: m.chuck.roastSize }
    : m.chuck?.mode === "steak"
      ? { thickness: m.chuck.thickness, perPackage: m.chuck.perPackage }
      : { grind: true });
  fillRow(form, "ARM", m.arm?.mode === "roast" ? { roast: m.arm.roastSize } : { grind: true });

  /* rib — three mutually exclusive rows */
  if (a.rib.choice === "prime") {
    fillRow(form, "PRIME ROAST OR RIB STEAKS OR RIBEYE", { roast: "WHOLE" });
  } else if (a.rib.choice === "ribsteak") {
    fillRow(form, "PRIME ROAST OR RIB STEAKS OR RIBEYE_2", { thickness: a.rib.thickness, perPackage: a.rib.perPackage });
  } else {
    fillRow(form, "PRIME ROAST OR RIB STEAKS OR RIBEYE_3", { thickness: a.rib.thickness, perPackage: a.rib.perPackage });
  }

  /* loin — T-bone row or NY strip row (+ tenderloin) */
  if (a.loin.choice === "tbone") {
    fillRow(form, "T BONE OR NY STRIP", { thickness: a.loin.thickness, perPackage: a.loin.perPackage });
  } else {
    fillRow(form, "T BONE OR NY STRIP_2", { thickness: a.loin.thickness, perPackage: a.loin.perPackage });
    fillRow(form, "TENDERLOINFILET", { thickness: a.filetThickness ?? "1 1/2", perPackage: "2" });
  }

  const rowFor = (id: string, suffix: string) => {
    const ans = m[id];
    if (!ans) return;
    fillRow(form, suffix, ans.mode === "roast"
      ? { roast: ans.roastSize }
      : ans.mode === "steak"
        ? { thickness: ans.thickness, perPackage: ans.perPackage }
        : { grind: true });
  };
  rowFor("sirloin", "SIRLOIN");
  rowFor("sirlointip", "SIRLOIN TIP");
  rowFor("topround", "TOP ROUND");
  rowFor("btmround", "BTM ROUND");

  /* yes / grind list */
  fillYesGrind(form, "FLANK", a.extras.flank === "yes");
  fillYesGrind(form, "CUBE STEAK", a.extras.cubesteak === "yes");
  fillYesGrind(form, "BRISKET", a.extras.brisket === "yes");
  fillYesGrind(form, "EYE OF ROUND", a.extras.eyeofround === "yes");
  fillYesGrind(form, "STEW MEAT", a.extras.stewmeat === "yes");
  fillYesGrind(form, "SKIRT STEAK", a.extras.skirtsteak === "yes");
  fillYesGrind(form, "SHANKS", a.extras.shanks === "yes");
  fillYesGrind(form, "SHORT RIBS", a.extras.shortribs === "yes");
  fillYesGrind(form, "SHORT RIBS_2", a.extras.koreanribs === "yes"); // KOREAN RIBS row
  fillYesGrind(form, "TRI TIP", a.extras.tritip === "yes");
  fillYesGrind(form, "FLAT IRON", a.extras.flatiron === "yes");

  /* ground + patties */
  setText(form, a.groundPack === "1" ? "1 lb" : a.groundPack === "2" ? "2 lbs" : "1 12 lbs", X);
  if (a.patties) {
    setText(form, a.pattySize, X);
  }

  /* organs */
  const organMap: Record<string, string> = {
    liver: "Liver", heart: "Heart", tongue: "Tongue",
    oxtail: "Ox Tail", soupbones: "Soup Bones", bones: "Bones",
  };
  for (const o of a.organs) {
    const f = organMap[o.toLowerCase()] ?? organMap[o];
    if (f) setText(form, f, X);
  }

  return doc.save();
}

export async function downloadCutSheet(order: Order) {
  const bytes = await buildFilledCutSheet(order);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `CCMC-cut-sheet-${order.code}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
