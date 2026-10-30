import type { Bi } from "@/i18n/context";
import type { FontId } from "./types";

// خطوط الملصق: الخطان الأولان محمّلان في الموقع أصلاً، والبقية تُحمَّل عند فتح محرر الملصق فقط

export const FONTS: Record<FontId, { family: string; name: Bi; css?: string; sample: string }> = {
  readex: { family: "Readex Pro", name: { ar: "ريدكس (عصري)", en: "Readex (modern)" }, sample: "عطر" },
  plex: { family: "IBM Plex Sans Arabic", name: { ar: "بلكس (هادئ)", en: "Plex (calm)" }, sample: "عطر" },
  amiri: { family: "Amiri", name: { ar: "أميري (نسخ كلاسيكي)", en: "Amiri (classic naskh)" }, css: "Amiri:wght@400;700", sample: "عطر" },
  reem: { family: "Reem Kufi", name: { ar: "ريم كوفي (هندسي)", en: "Reem Kufi (geometric)" }, css: "Reem+Kufi:wght@400;700", sample: "عطر" },
  playfair: { family: "Playfair Display", name: { ar: "بلايفير (لاتيني فاخر)", en: "Playfair (Latin serif)" }, css: "Playfair+Display:wght@400;700", sample: "Parfum" },
};

let injected = false;
function injectCss() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const fams = Object.values(FONTS)
    .filter((f) => f.css)
    .map((f) => `family=${f.css}`)
    .join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${fams}&display=swap`;
  document.head.appendChild(link);
}

/** يضمن تحميل الخط قبل الرسم على اللوحة (اللوحة لا تنتظر الخطوط تلقائياً) */
export async function ensureFonts(ids: FontId[], sample = "عطر Parfum") {
  injectCss();
  await Promise.all(
    [...new Set(ids)].flatMap((id) =>
      [400, 700].map((w) =>
        document.fonts.load(`${w} 32px "${FONTS[id].family}"`, sample).catch(() => []),
      ),
    ),
  );
}
