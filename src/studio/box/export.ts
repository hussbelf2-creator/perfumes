import { BLEED, renderSheet } from "./art";
import { polyArea, segLen, type BoxSpec, type Flat, type Seg } from "./dielines";
import { STYLES, THICKNESS, type BoxDesign } from "./types";

// ملفات المصنع: خط القص ماجنتا متصل، خط التكسير سماوي متقطع، مناطق اللصق مظللة.
// النصوص لاتينية (ASCII) لأن خطوط PDF الافتراضية لا تدعم العربية.

export const CUT = "#EC008C";
export const CREASE = "#00AEEF";
export const GLUE = "#9AA0A6";

const f2 = (n: number) => Math.round(n * 100) / 100;

export function dielineStats(flat: Flat) {
  const { minX, minY, maxX, maxY } = flat.bounds;
  const cut = flat.cuts.reduce((a, s) => a + segLen(s), 0);
  const crease = flat.folds.reduce((a, s) => a + segLen(s), 0);
  const area = flat.panels.reduce((a, p) => a + Math.abs(polyArea(p.poly)), 0);
  return { sheetW: maxX - minX, sheetH: maxY - minY, cut, crease, area };
}

export function specLine(d: BoxDesign, spec: BoxSpec) {
  const style = STYLES.find((s) => s.id === d.style)!;
  return `${style.name.en} | inner ${d.L} x ${d.W} x ${d.H} mm | outer ${f2(spec.outer.w)} x ${f2(spec.outer.d)} x ${f2(spec.outer.h)} mm | board ${THICKNESS[d.style]} mm`;
}

/** مخطط القص كملف SVG بالمليمتر (طبقات مسمّاة لبرامج الرسم وماكينات القص) */
export function dielineSvg(d: BoxDesign, spec: BoxSpec, flat: Flat): string {
  const M = 12;
  const { minX, minY, maxX, maxY } = flat.bounds;
  const W = maxX - minX + 2 * M, Hh = maxY - minY + 2 * M + 14;
  const X = (x: number) => f2(x - minX + M);
  const Y = (y: number) => f2(maxY - y + M);
  const line = (s: Seg) => `<line x1="${X(s.a[0])}" y1="${Y(s.a[1])}" x2="${X(s.b[0])}" y2="${Y(s.b[1])}"/>`;
  const st = dielineStats(flat);
  const glue = flat.panels
    .filter((p) => p.kind === "glue")
    .map((p) => `<polygon points="${p.poly.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}"/>`)
    .join("");
  const esc = (s: string) => s.replace(/[<&>"]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${f2(W)}mm" height="${f2(Hh)}mm" viewBox="0 0 ${f2(W)} ${f2(Hh)}">
  <title>${esc(specLine(d, spec))}</title>
  <defs><pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="${GLUE}" stroke-width="0.4"/></pattern></defs>
  <g id="glue" inkscape:groupmode="layer" inkscape:label="GLUE" fill="url(#hatch)" stroke="none">${glue}</g>
  <g id="crease" inkscape:groupmode="layer" inkscape:label="CREASE" stroke="${CREASE}" stroke-width="0.25" stroke-dasharray="3 1.5" fill="none">${flat.folds.map(line).join("")}</g>
  <g id="cut" inkscape:groupmode="layer" inkscape:label="CUT" stroke="${CUT}" stroke-width="0.25" fill="none">${flat.cuts.map(line).join("")}</g>
  <g id="info" inkscape:groupmode="layer" inkscape:label="INFO" font-family="Helvetica, Arial, sans-serif" font-size="3" fill="#444">
    <text x="${M}" y="${f2(Hh - 9)}">${esc(specLine(d, spec))}</text>
    <text x="${M}" y="${f2(Hh - 4.5)}">sheet ${f2(st.sheetW)} x ${f2(st.sheetH)} mm | cut ${Math.round(st.cut)} mm | crease ${Math.round(st.crease)} mm | bleed ${BLEED} mm (artwork) | magenta = cut, cyan dashed = crease, hatched = glue (no ink)</text>
  </g>
</svg>`;
}

type Doc = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

function drawDieline(doc: Doc, flat: Flat, ox: number, oy: number) {
  const { minX, maxY } = flat.bounds;
  const X = (x: number) => ox + x - minX;
  const Y = (y: number) => oy + maxY - y;
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(236, 0, 140);
  for (const s of flat.cuts) doc.line(X(s.a[0]), Y(s.a[1]), X(s.b[0]), Y(s.b[1]));
  doc.setDrawColor(0, 174, 239);
  doc.setLineDashPattern([3, 1.5], 0);
  for (const s of flat.folds) doc.line(X(s.a[0]), Y(s.a[1]), X(s.b[0]), Y(s.b[1]));
  doc.setLineDashPattern([], 0);
}

export async function exportBoxPdf(d: BoxDesign, spec: BoxSpec, flat: Flat, logoUrl: string | null, reference: string): Promise<Blob> {
  const [{ jsPDF }, sheet] = await Promise.all([import("jspdf"), renderSheet(d, flat, 300 / 25.4, logoUrl)]);
  const M = 15;
  const pageW = sheet.wMm + 2 * M, pageH = sheet.hMm + 2 * M + 8;
  const orient = pageW > pageH ? "landscape" : "portrait";
  const doc = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: orient, compress: true });
  const st = dielineStats(flat);
  const dpi = Math.round(sheet.pxPerMm * 25.4);
  const info = (text: string, color: [number, number, number] = [90, 90, 90]) => {
    doc.setFontSize(6);
    doc.setTextColor(...color);
    doc.text(doc.splitTextToSize(text, pageW - 2 * M), M, pageH - 9);
  };

  // الصفحة 1: التصميم بمقاسه الحقيقي مع هامش القص، وخط القص فوقه للتحقق من التموضع
  doc.addImage(sheet.color.toDataURL("image/jpeg", 0.93), "JPEG", M, M, sheet.wMm, sheet.hMm, undefined, "FAST");
  drawDieline(doc, flat, M + BLEED, M + BLEED);
  info(`ARTWORK ${dpi} dpi, ${BLEED} mm bleed | dieline overlaid for position only (spot colours, do not print) | ${specLine(d, spec)} | ref ${reference}`);

  // الصفحة 2: المخطط وحده — لماكينة القص والتكسير
  doc.addPage([pageW, pageH], orient);
  const { minX, maxY } = flat.bounds;
  doc.setFillColor(225, 228, 231);
  for (const p of flat.panels.filter((x) => x.kind === "glue")) {
    const pts = p.poly.map(([x, y]) => [M + BLEED + x - minX, M + BLEED + maxY - y]);
    const rel = pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]]);
    doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "F", true);
  }
  drawDieline(doc, flat, M + BLEED, M + BLEED);
  info(`DIELINE | sheet ${f2(st.sheetW)} x ${f2(st.sheetH)} mm | cut ${Math.round(st.cut)} mm, crease ${Math.round(st.crease)} mm | magenta = cut, cyan dashed = crease, grey = glue area (no ink) | ${specLine(d, spec)}`, [236, 0, 140]);
  doc.setProperties({ title: `Box dieline ${reference}`, creator: "Perfume Platform 3D studio" });
  return doc.output("blob");
}
