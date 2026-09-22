/* Fill the actual CCMC "Beef Cutting Instructions" fillable PDF
   from a completed order. Field names come straight from the
   form's AcroForm dictionary. Runs entirely in the browser. */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SHARES, HARVEST, ASSET, TALLOW, PATTY_SIZES, ORGANS } from "../data/config";
import { effectiveExtra, type Order } from "./store";

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
  const keep = (id: string) => effectiveExtra(a, id) === "yes";
  fillYesGrind(form, "FLANK", keep("flank"));
  fillYesGrind(form, "CUBE STEAK", keep("cubesteak"));
  fillYesGrind(form, "BRISKET", keep("brisket"));
  fillYesGrind(form, "EYE OF ROUND", keep("eyeofround"));
  fillYesGrind(form, "STEW MEAT", keep("stewmeat"));
  fillYesGrind(form, "SKIRT STEAK", keep("skirtsteak"));
  fillYesGrind(form, "SHANKS", keep("shanks"));
  fillYesGrind(form, "SHORT RIBS", keep("shortribs"));
  fillYesGrind(form, "SHORT RIBS_2", keep("koreanribs")); // KOREAN RIBS row
  fillYesGrind(form, "TRI TIP", keep("tritip"));
  fillYesGrind(form, "FLAT IRON", keep("flatiron"));

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

  await addSpecialRequestsPage(doc, order);

  return doc.save();
}

/* The CCMC form has no free-text box, so anything that doesn't fit
   on it — tallow, patty poundage, the customer's own notes — gets
   its own page stapled to the back. */
async function addSpecialRequestsPage(doc: PDFDocument, order: Order) {
  const a = order.cutSheet;
  const items: [string, string][] = [];

  if (a.tallow) items.push([TALLOW.label, "Please save the trimmed fat for rendering."]);
  if (a.patties) {
    const sz = PATTY_SIZES.find((s) => s.id === a.pattySize);
    items.push(["Patties", `${a.pattyLbs ?? "40 lb"} pressed into ${sz?.label ?? a.pattySize} patties (${sz?.note ?? ""}).`.trim()]);
  }
  if (a.organs.length) {
    const names = a.organs.map((id) => ORGANS.find((o) => o.id === id)?.label ?? id);
    items.push(["Organs & bones", names.join(", ")]);
  }
  if (a.notes.trim()) items.push(["Notes from the customer", a.notes.trim()]);

  if (!items.length) return;

  /* The standard fonts are WinAnsi-only and pdf-lib throws on anything
     else, so a pasted emoji or smart character can't be allowed through. */
  const safe = (text: string) =>
    text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u2026/g, "...")
      .replace(/\s+/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

  const page = doc.addPage([612, 792]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.13, 0.11, 0.09);
  const mute = rgb(0.42, 0.39, 0.36);
  let y = 730;

  page.drawText("SPECIAL REQUESTS", { x: 54, y, size: 16, font: bold, color: ink });
  y -= 20;
  page.drawText(safe(`${order.name} - order ${order.code} - ${SHARES[order.share].label} beef`), { x: 54, y, size: 10, font: body, color: mute });
  y -= 10;
  page.drawLine({ start: { x: 54, y }, end: { x: 558, y }, thickness: 1, color: ink });
  y -= 28;

  /* naive wrap at ~86 characters, which fits 10pt Helvetica in 504pt */
  const wrap = (text: string, max = 86) => {
    const out: string[] = [];
    let line = "";
    for (const word of safe(text).split(" ")) {
      if ((line + " " + word).trim().length > max) { out.push(line.trim()); line = word; }
      else line += " " + word;
    }
    if (line.trim()) out.push(line.trim());
    return out;
  };

  for (const [label, text] of items) {
    page.drawText(safe(label.toUpperCase()), { x: 54, y, size: 9, font: bold, color: mute });
    y -= 15;
    for (const line of wrap(text)) {
      page.drawText(line, { x: 54, y, size: 10.5, font: body, color: ink });
      y -= 15;
    }
    y -= 12;
  }

  page.drawText("Questions on any of this? Call Colorado Custom Meat Co at 970-356-2333.", {
    x: 54, y: Math.max(y, 60), size: 9.5, font: body, color: mute,
  });
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
