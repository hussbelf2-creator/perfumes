import { renderLabel } from "./render";
import type { LabelDesign } from "./types";

// ملف طباعة: الصفحة 1 = التصميم بمقاسه الحقيقي + هامش قص 3 مم + علامات القص (300 نقطة/بوصة)
//            الصفحة 2 = خط القص وحده (Dieline) بلون ماجنتا — لا يُطبع فوق التصميم

const BLEED = 3;
const MARGIN = 12;
const DPI = 300;

type Doc = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

function cutPath(doc: Doc, d: LabelDesign, x: number, y: number) {
  const w = d.widthMm, h = d.heightMm;
  if (d.shape === "rect") return doc.rect(x, y, w, h, "S");
  if (d.shape === "rounded") {
    const r = Math.min(4, w / 2, h / 2);
    return doc.roundedRect(x, y, w, h, r, r, "S");
  }
  if (d.shape === "oval") return doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, "S");
  // قوس: جانبان مستقيمان + نصف دائرة (منحنيا بيزيه) — مطابق لرسم المعاينة
  const r = Math.min(w / 2, h);
  const cx = x + w / 2;
  const k = 0.5523 * r;
  doc.lines(
    [
      [0, -(h - r)],
      [cx - r - x, 0],
      [0, -k, r - k, -r, r, -r],
      [k, 0, r, r - k, r, r],
      [x + w - (cx + r), 0],
      [0, h - r],
    ],
    x,
    y + h,
    [1, 1],
    "S",
    true,
  );
}

function cropMarks(doc: Doc, x: number, y: number, w: number, h: number) {
  const gap = BLEED + 1, len = 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  for (const [cx, sx] of [[x, -1], [x + w, 1]] as const) {
    for (const [cy, sy] of [[y, -1], [y + h, 1]] as const) {
      doc.line(cx + sx * gap, cy, cx + sx * (gap + len), cy);
      doc.line(cx, cy + sy * gap, cx, cy + sy * (gap + len));
    }
  }
}

export async function exportLabelPdf(d: LabelDesign, meta: { reference: string }): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pxPerMm = DPI / 25.4;
  const art = await renderLabel(d, pxPerMm, BLEED);
  const pageW = d.widthMm + 2 * (BLEED + MARGIN), pageH = d.heightMm + 2 * (BLEED + MARGIN);
  const doc = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: pageW > pageH ? "landscape" : "portrait", compress: true });
  const x = MARGIN + BLEED, y = MARGIN + BLEED;

  doc.addImage(art.color.toDataURL("image/png"), "PNG", MARGIN, MARGIN, d.widthMm + 2 * BLEED, d.heightMm + 2 * BLEED, undefined, "FAST");
  cropMarks(doc, x, y, d.widthMm, d.heightMm);
  doc.setFontSize(5);
  doc.setTextColor(90);
  // نص ASCII فقط: الخطوط العربية لا تُضمَّن في PDF بدون ملف خط إضافي
  // يلتف السطر داخل عرض الصفحة (الملصقات الضيقة)
  const info = doc.splitTextToSize(`Label ${d.widthMm} x ${d.heightMm} mm | ${d.shape} | bleed ${BLEED} mm | ${DPI} dpi | ref ${meta.reference}`, pageW - MARGIN);
  doc.text(info, MARGIN / 2, pageH - 4.2);

  doc.addPage([pageW, pageH], pageW > pageH ? "landscape" : "portrait");
  doc.setDrawColor(236, 0, 140);
  doc.setLineWidth(0.25);
  cutPath(doc, d, x, y);
  cropMarks(doc, x, y, d.widthMm, d.heightMm);
  doc.setFontSize(5);
  doc.setTextColor(236, 0, 140);
  doc.text(doc.splitTextToSize("CUT LINE / DIELINE - do not print", pageW - MARGIN), MARGIN / 2, pageH - 4.2);
  doc.setProperties({ title: `Label ${meta.reference}`, creator: "Perfume Platform 3D studio" });
  return doc.output("blob");
}

export async function exportLabelPng(d: LabelDesign): Promise<string> {
  const art = await renderLabel(d, DPI / 25.4, 0);
  return art.color.toDataURL("image/png");
}
