// «لوحة العمل» لكل مسار: الأداة التي يبدأ منها العميل فعلياً قبل أي تسجيل.
// العبوة والتغليف ← استوديو 3D، التصنيع ← حاسبة التكلفة، التركيبة ← مكوّن الخلطة، الطباعة ← الملصق والعلبة.
// ما يصنعه هناك يُحفظ في هذا المتصفح (sessionStorage) ويُرفق بالطلب في «ابدأ مسارك»، ولإكمال الطلب يُنشئ حسابه
// فيُفتح له المشروع في لوحة التحكم ومعه تصميمه.
import type { Bi } from "../i18n/context";
import type { ServiceTrack } from "../data/services";

type TrackId = ServiceTrack["id"];

export interface Workspace {
  /** مسار اللوحة داخل المنصة (يحمل ?track=… ليظهر شريط «أكمل الطلب») */
  path: string;
  /** اسم اللوحة كما يراه العميل */
  label: Bi;
  /** فعل الخطوة الأولى: صمّم / كوّن / احسب */
  verb: Bi;
  /** ما تلتقطه اللوحة ويُرفق بالطلب */
  captures: Bi;
  icon: string;
}

export const WORKSPACES: Partial<Record<TrackId, Workspace>> = {
  B: {
    path: "/bespoke?track=B",
    label: { ar: "مكوّن التركيبة", en: "Formula composer" },
    verb: { ar: "كوّن تركيبتك", en: "Compose your formula" },
    captures: { ar: "المكوّنات في طبقاتها والتركيز والحجم", en: "Notes by layer, concentration and size" },
    icon: "ri-flask-line",
  },
  C: {
    path: "/studio-3d?track=C",
    label: { ar: "استوديو العبوة 3D", en: "3D packaging studio" },
    verb: { ar: "صمّم عبوتك وملصقها وعلبتها", en: "Design your bottle, label and box" },
    captures: { ar: "العبوة والغطاء والزجاج، الملصق، ومقاسات العلبة", en: "Bottle, cap and glass, the label, and box dimensions" },
    icon: "ri-shapes-line",
  },
  E: {
    path: "/pricing?track=E",
    label: { ar: "حاسبة التصنيع", en: "Manufacturing calculator" },
    verb: { ar: "احسب كميتك وتكلفتها", en: "Work out your volume and cost" },
    captures: { ar: "الكمية والسرعة والخيارات مع التقدير", en: "Volume, turnaround and options with the estimate" },
    icon: "ri-calculator-line",
  },
  F: {
    path: "/studio-3d?track=F&tab=label",
    label: { ar: "استوديو الملصق والعلبة", en: "Label & box studio" },
    verb: { ar: "صمّم ملصقك وعلبتك", en: "Design your label and box" },
    captures: { ar: "الملصق بنصوصه وشعاره، ومقاسات العلبة وفرخها", en: "The label with its text and logo, and the box with its dieline" },
    icon: "ri-printer-line",
  },
};

export const workspaceOf = (track?: string | null) => (track && track in WORKSPACES ? WORKSPACES[track as TrackId] : undefined);

/** نقطة البدء لمسار: لوحة عمله إن وُجدت، وإلا البريف مباشرة */
export function trackStart(track: TrackId, pkg?: number | string | null): string {
  const ws = WORKSPACES[track];
  const base = ws ? ws.path : `/start/${track}`;
  if (pkg === undefined || pkg === null || pkg === "") return base;
  return `${base}${base.includes("?") ? "&" : "?"}package=${pkg}`;
}

/** ما أنجزه العميل في لوحة العمل، كما يُرفق بالطلب */
export interface Work {
  track: TrackId;
  /** ملخص مقروء للفريق والعميل */
  summary: string;
  /** رابط داخلي يعيد فتح اللوحة بالحالة نفسها */
  link: string;
  at: string;
  /** حقول إضافية تُرسل مع الطلب (مثل تركيبة «عطرك الخاص» p_*) */
  fields?: Record<string, string>;
  /** تصميم الملصق والعلبة لحفظهما في حساب العميل بعد التسجيل */
  design?: { label?: unknown; box?: unknown; thumb?: string | null };
}

const key = (track: string) => `pp_work_${track}`;
/** الروابط المقبولة كلوحة عمل (تُعرض كرابط للفريق، فلا نقبل غير مسارات المنصة) */
export const WORK_LINK = /^\/(studio-3d|pricing|bespoke)([?#]|$)/;

export function saveWork(w: Work) {
  try {
    sessionStorage.setItem(key(w.track), JSON.stringify(w));
  } catch {
    /* التخزين غير متاح أو ممتلئ: يبقى العمل في الرابط */
  }
}
export function readWork(track: string): Work | null {
  try {
    const raw = sessionStorage.getItem(key(track));
    const w = raw ? (JSON.parse(raw) as Work) : null;
    return w && typeof w.summary === "string" && WORK_LINK.test(w.link) ? w : null;
  } catch {
    return null;
  }
}
export function clearWork(track: string) {
  try {
    sessionStorage.removeItem(key(track));
  } catch {
    /* لا شيء */
  }
}
