/* Hand the browser a CSV to save. Every cell quoted, so commas and
   quotes in names and descriptions survive the trip into a spreadsheet;
   a byte-order mark up front so Excel reads "•" and "—" as UTF-8. */
export function csvDownload(name: string, head: string[], rows: (string | number)[][]) {
  const csv = [head, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? "").split('"').join('""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
