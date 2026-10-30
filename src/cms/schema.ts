import type { Bi } from "@/i18n/context";
import { DISCOVERY_CALL, DISCOVERY_KIT } from "@/config/offers";
import { PLATFORM_FACTS, SITE } from "@/config/site";
import { FAQS, type FaqTopic } from "@/data/faq";
import { PHOTOS } from "@/lib/photos";
import { DEFAULT_BOX_RATES, type BoxRates } from "@/studio/box/rates";
import { DEFAULT_EXTRA_RATES } from "@/studio/spec";
import { DEFAULT_CALC, type CalcConfig } from "@/lib/pricing";
import { SERVICE_TRACKS, type ServiceTrack } from "@/data/services";
import { DEFAULT_BESPOKE, type BespokeRates } from "@/bespoke/compose";
import { DEFAULT_LEGAL, LEGAL_KINDS, type LegalKind, type LegalPageDoc } from "@/data/legal";

type TrackId = ServiceTrack["id"];

// نظام المحتوى: وثائق محددة الشكل لكل منها قيم افتراضية (هي المحتوى الحالي في الكود).
// ما يحفظه المحرر «تجاوز» للافتراضي، ويمر دائماً عبر sanitize: أي حقل تالف يعود لقيمته الافتراضية
// فلا يكسر خطأ في الإدخال الموقع.

export const CMS_KEYS = ["site", "announcement", "hero", "faq", "offers", "pricing", "legal"] as const;
export type CmsKey = (typeof CMS_KEYS)[number];

export interface SiteDoc {
  email: string;
  phone: string;
  whatsapp: string;
  address: Bi;
  workingHours: Bi;
  social: { instagram: string; x: string; tiktok: string; snapchat: string; linkedin: string };
  /** تظهر في عروض الأسعار وتعليمات التحويل البنكي */
  billing: { legalName: string; vatNumber: string; cr: string; bankName: string; iban: string };
}

export interface AnnouncementDoc {
  enabled: boolean;
  text: Bi;
  /** رابط داخلي (/book) أو https */
  link: string;
  linkLabel: Bi;
  tone: "dark" | "accent";
  /** يختفي تلقائياً بعد هذا التاريخ (YYYY-MM-DD) — اختياري */
  until: string;
}

export interface HeroDoc {
  eyebrow: Bi;
  line1: Bi;
  line2: Bi;
  highlight: Bi;
  sub: Bi;
  primaryCta: Bi;
  secondaryCta: Bi;
  image: string;
  imageAlt: Bi;
  facts: { value: number; prefix: string; label: Bi }[];
}

export interface FaqItem {
  id: string;
  topic: FaqTopic;
  q: Bi;
  a: Bi;
  published: boolean;
}
export interface FaqDoc {
  items: FaqItem[];
}

export interface OffersDoc {
  call: { minutes: number; slots: string[]; workDays: number[]; daysAhead: number };
  /** السعر لا يُعدَّل من هنا: الخادم يتحقق منه عند الدفع (KIT_PRICE_HALALAS) */
  kit: { vials: number; ml: number; creditDays: number; shipping: Bi };
}

/** أسعار التقدير: العلب (تُحسب من تصميم العلبة الفعلي في الاستوديو) */
export interface PricingDoc {
  box: BoxRates;
  /** أرقام حاسبة التكلفة */
  calc: CalcConfig;
  /** سعر عينة الاكتشاف (ر.س) — الخادم يتحقق به عند الدفع */
  kit: { price: number };
  /** «يبدأ من» لكل مسار (ر.س)؛ 0 = عرض سعر مخصص */
  services: Record<TrackId, number>;
  /** «عطرك الخاص» للأفراد: سعر المل لكل تركيز، والزجاجة، وإضافة المكوّن النادر */
  bespoke: BespokeRates;
}

/** الصفحات القانونية: الخصوصية والشروط والاسترجاع */
export type LegalDoc = { updated: string } & Record<LegalKind, LegalPageDoc>;

export interface CmsDocs {
  site: SiteDoc;
  announcement: AnnouncementDoc;
  hero: HeroDoc;
  faq: FaqDoc;
  offers: OffersDoc;
  pricing: PricingDoc;
  legal: LegalDoc;
}

export const DEFAULTS: CmsDocs = {
  site: {
    email: SITE.email,
    phone: SITE.phone,
    whatsapp: SITE.whatsapp,
    address: { ...SITE.address },
    workingHours: { ...SITE.workingHours },
    social: { ...SITE.social },
    billing: { legalName: "", vatNumber: "", cr: "", bankName: "", iban: "" },
  },
  announcement: {
    enabled: false,
    text: { ar: "عينة الاكتشاف متاحة الآن: جرّب ثلاثة اتجاهات عطرية قبل أن تبدأ.", en: "The discovery kit is here: try three scent directions before you start." },
    link: "/discovery-kit",
    linkLabel: { ar: "اطلبها", en: "Order it" },
    tone: "dark",
    until: "",
  },
  hero: {
    eyebrow: { ar: "مصنع سعودي يبني براندات العطور لعملاء حول العالم", en: "A Saudi fragrance house building brands for clients worldwide" },
    line1: { ar: "براندك العطري،", en: "Your fragrance brand," },
    line2: { ar: "من الفكرة ", en: "from idea " },
    highlight: { ar: "إلى الرف.", en: "to shelf." },
    sub: {
      ar: "مدير مشروع واحد يقود التركيبة والهوية والعبوة والتصنيع — بدل التنسيق بين خمسة موردين. وأنت تعتمد كل قرار من لوحة واحدة.",
      en: "One project manager leads formula, identity, packaging and production — instead of you juggling five suppliers. You approve every step from one dashboard.",
    },
    primaryCta: { ar: "ابدأ مشروعك", en: "Start your project" },
    secondaryCta: { ar: "تحدّث مع خبير", en: "Talk to an expert" },
    image: PHOTOS.hero,
    imageAlt: { ar: "زجاجة عطر شفافة على حجر ترافرتين", en: "Clear perfume bottle on travertine stone" },
    facts: PLATFORM_FACTS.map((f) => ({ value: f.value, prefix: f.prefix ?? "", label: { ...f.label } })),
  },
  faq: { items: FAQS.map((f, i) => ({ id: `f${i + 1}`, topic: f.topic, q: { ...f.q }, a: { ...f.a }, published: true })) },
  offers: {
    call: { minutes: DISCOVERY_CALL.minutes, slots: [...DISCOVERY_CALL.slots], workDays: [...DISCOVERY_CALL.workDays], daysAhead: DISCOVERY_CALL.daysAhead },
    kit: { vials: DISCOVERY_KIT.vials, ml: DISCOVERY_KIT.ml, creditDays: DISCOVERY_KIT.creditDays, shipping: { ...DISCOVERY_KIT.shipping } },
  },
  pricing: {
    box: structuredClone(DEFAULT_BOX_RATES),
    calc: structuredClone(DEFAULT_CALC),
    kit: { price: DISCOVERY_KIT.price },
    services: Object.fromEntries(SERVICE_TRACKS.map((t) => [t.id, Number(t.price.en.replace(/\D/g, "")) || 0])) as Record<TrackId, number>,
    bespoke: structuredClone(DEFAULT_BESPOKE),
  },
  legal: { updated: "2026-10-20", ...structuredClone(DEFAULT_LEGAL) },
};

// ─── التنقية ─────────────────────────────────────────────────────
type U = unknown;
const obj = (v: U): Record<string, U> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, U>) : {});
const str = (v: U, def: string, max: number) => (typeof v === "string" ? v.slice(0, max) : def);
const bi = (v: U, def: Bi, max: number): Bi => {
  const o = obj(v);
  return { ar: str(o.ar, def.ar, max), en: str(o.en, def.en, max) };
};
const int = (v: U, def: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def);
const bool = (v: U, def: boolean) => (typeof v === "boolean" ? v : def);
const pattern = (v: U, def: string, re: RegExp, max = 300) => (typeof v === "string" && (v === "" || re.test(v)) ? v.slice(0, max) : def);

export const RE = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phone: /^\+[1-9]\d{7,14}$/,
  whatsapp: /^[1-9]\d{7,14}$/,
  https: /^https:\/\/[^\s]+$/,
  /** رابط داخلي (لا يبدأ بـ //) أو https */
  link: /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/,
  image: /^(https:\/\/|idb:)[^\s]+$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  slot: /^([01]\d|2[0-3]):[0-5]\d$/,
  /** الرقم الضريبي السعودي: 15 رقماً يبدأ وينتهي بـ3 */
  vat: /^3\d{13}3$/,
  /** السجل التجاري: 10 أرقام */
  cr: /^\d{10}$/,
  /** آيبان سعودي بلا مسافات */
  iban: /^SA\d{22}$/,
};

// أرقام عشرية مقيّدة (الأسعار بالهللة: خانتان)
const money = (v: U, def: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v * 100) / 100)) : def);
const STYLE_KEYS = ["tuck", "drawer", "rigid", "magnetic", "tube"] as const;
const perStyle = (v: U, d: Record<(typeof STYLE_KEYS)[number], number>, min: number, max: number, int = false) => {
  const o = obj(v);
  return Object.fromEntries(STYLE_KEYS.map((k) => [k, int ? Math.round(money(o[k], d[k], min, max)) : money(o[k], d[k], min, max)])) as Record<(typeof STYLE_KEYS)[number], number>;
};
const sanitizers = {
  site: (v, d) => {
    const o = obj(v), s = obj(o.social), b = obj(o.billing);
    return {
      email: pattern(o.email, d.email, RE.email, 120),
      phone: pattern(o.phone, d.phone, RE.phone, 20),
      whatsapp: pattern(o.whatsapp, d.whatsapp, RE.whatsapp, 20),
      address: bi(o.address, d.address, 120),
      workingHours: bi(o.workingHours, d.workingHours, 120),
      social: {
        instagram: pattern(s.instagram, d.social.instagram, RE.https),
        x: pattern(s.x, d.social.x, RE.https),
        tiktok: pattern(s.tiktok, d.social.tiktok, RE.https),
        snapchat: pattern(s.snapchat, d.social.snapchat, RE.https),
        linkedin: pattern(s.linkedin, d.social.linkedin, RE.https),
      },
      billing: {
        legalName: str(b.legalName, d.billing.legalName, 120),
        vatNumber: pattern(b.vatNumber, d.billing.vatNumber, RE.vat, 15),
        cr: pattern(b.cr, d.billing.cr, RE.cr, 10),
        bankName: str(b.bankName, d.billing.bankName, 60),
        iban: pattern(b.iban, d.billing.iban, RE.iban, 24),
      },
    };
  },
  announcement: (v, d) => {
    const o = obj(v);
    return {
      enabled: bool(o.enabled, d.enabled),
      text: bi(o.text, d.text, 160),
      link: pattern(o.link, d.link, RE.link),
      linkLabel: bi(o.linkLabel, d.linkLabel, 40),
      tone: o.tone === "accent" || o.tone === "dark" ? o.tone : d.tone,
      until: pattern(o.until, d.until, RE.date, 10),
    };
  },
  hero: (v, d) => {
    const o = obj(v);
    const facts = Array.isArray(o.facts)
      ? o.facts.slice(0, 4).map((f, i) => {
          const x = obj(f), fd = d.facts[i] ?? d.facts[0];
          return { value: int(x.value, fd.value, 0, 1_000_000), prefix: str(x.prefix, "", 8), label: bi(x.label, fd.label, 60) };
        })
      : d.facts;
    return {
      eyebrow: bi(o.eyebrow, d.eyebrow, 90),
      line1: bi(o.line1, d.line1, 60),
      line2: bi(o.line2, d.line2, 60),
      highlight: bi(o.highlight, d.highlight, 40),
      sub: bi(o.sub, d.sub, 320),
      primaryCta: bi(o.primaryCta, d.primaryCta, 40),
      secondaryCta: bi(o.secondaryCta, d.secondaryCta, 40),
      image: typeof o.image === "string" && RE.image.test(o.image) ? o.image : d.image,
      imageAlt: bi(o.imageAlt, d.imageAlt, 140),
      facts: facts.length ? facts : d.facts,
    };
  },
  faq: (v, d) => {
    const o = obj(v);
    if (!Array.isArray(o.items)) return d;
    const topics: FaqTopic[] = ["start", "cost", "process", "ownership"];
    const seen = new Set<string>();
    const items = o.items.slice(0, 80).flatMap((it, i) => {
      const x = obj(it);
      const q = bi(x.q, { ar: "", en: "" }, 300), a = bi(x.a, { ar: "", en: "" }, 2000);
      if (!q.ar.trim() || !a.ar.trim()) return [];
      let id = str(x.id, `f${i + 1}`, 24).replace(/[^\w-]/g, "") || `f${i + 1}`;
      while (seen.has(id)) id += "x";
      seen.add(id);
      return [{ id, topic: topics.includes(x.topic as FaqTopic) ? (x.topic as FaqTopic) : "start", q, a, published: bool(x.published, true) }];
    });
    return { items };
  },
  offers: (v, d) => {
    const o = obj(v), c = obj(o.call), k = obj(o.kit);
    const slots = Array.isArray(c.slots) ? [...new Set(c.slots.filter((s): s is string => typeof s === "string" && RE.slot.test(s)))].sort().slice(0, 16) : d.call.slots;
    const days = Array.isArray(c.workDays) ? [...new Set(c.workDays.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : d.call.workDays;
    return {
      call: { minutes: int(c.minutes, d.call.minutes, 10, 120), slots: slots.length ? slots : d.call.slots, workDays: days.length ? days : d.call.workDays, daysAhead: int(c.daysAhead, d.call.daysAhead, 1, 60) },
      kit: { vials: int(k.vials, d.kit.vials, 1, 12), ml: int(k.ml, d.kit.ml, 1, 50), creditDays: int(k.creditDays, d.kit.creditDays, 0, 365), shipping: bi(k.shipping, d.kit.shipping, 80) },
    };
  },
  pricing: (v, d) => {
    const b = obj(obj(v).box), db = d.box, f = obj(b.finishPerM2);
    return {
      box: {
        boardPerM2: perStyle(b.boardPerM2, db.boardPerM2, 0, 500),
        waste: money(b.waste, db.waste, 1, 2),
        printFloodPerM2: money(b.printFloodPerM2, db.printFloodPerM2, 0, 200),
        printLightPerM2: money(b.printLightPerM2, db.printLightPerM2, 0, 200),
        finishPerM2: { matte: money(f.matte, db.finishPerM2.matte, 0, 200), soft: money(f.soft, db.finishPerM2.soft, 0, 200), gloss: money(f.gloss, db.finishPerM2.gloss, 0, 200) },
        foilPerUnit: money(b.foilPerUnit, db.foilPerUnit, 0, 100),
        assemblyPerUnit: perStyle(b.assemblyPerUnit, db.assemblyPerUnit, 0, 500),
        diePerMm: money(b.diePerMm, db.diePerMm, 0, 10),
        dieMin: money(b.dieMin, db.dieMin, 0, 100_000),
        platesSetup: money(b.platesSetup, db.platesSetup, 0, 100_000),
        foilBlock: money(b.foilBlock, db.foilBlock, 0, 100_000),
        moq: perStyle(b.moq, db.moq, 1, 1_000_000, true),
        extrasPerUnit: Object.fromEntries(Object.entries(DEFAULT_EXTRA_RATES).map(([k, dv]) => [k, money(obj(b.extrasPerUnit)[k], db.extrasPerUnit?.[k] ?? dv, 0, 100)])),
      },
      calc: (() => {
        const c = obj(obj(v).calc), dc = d.calc, it = obj(c.items), sp = obj(c.speeds);
        const tiers = Array.isArray(c.tiers) && c.tiers.length === dc.tiers.length ? (c.tiers as U[]) : dc.tiers;
        return {
          items: Object.fromEntries(Object.keys(dc.items).map((k) => [k, money(it[k], dc.items[k], 0, 10_000)])),
          // الحدود تصاعدية دائماً: كل حد أكبر من السابق
          tiers: tiers.map((x, i) => ({ qty: int(obj(x).qty, dc.tiers[i].qty, 1, 1_000_000), discount: money(obj(x).discount, dc.tiers[i].discount, 0, 90) })).reduce<CalcConfig["tiers"]>((acc, x) => [...acc, { ...x, qty: Math.max(x.qty, (acc[acc.length - 1]?.qty ?? 0) + 1) }], []),
          speeds: { standard: money(sp.standard, dc.speeds.standard, 1, 5), express: money(sp.express, dc.speeds.express, 1, 5), urgent: money(sp.urgent, dc.speeds.urgent, 1, 5) },
          sample: money(c.sample, dc.sample, 0, 1_000_000),
          designRound: money(c.designRound, dc.designRound, 0, 1_000_000),
          retail: money(c.retail, dc.retail, 1, 20),
        };
      })(),
      kit: { price: money(obj(obj(v).kit).price, d.kit.price, 1, 100_000) },
      services: Object.fromEntries(SERVICE_TRACKS.map((t) => [t.id, Math.round(money(obj(obj(v).services)[t.id], d.services[t.id], 0, 10_000_000))])) as Record<TrackId, number>,
      bespoke: (() => {
        const bs = obj(obj(v).bespoke), ml = obj(bs.perMl), db = d.bespoke;
        return {
          perMl: { edp: money(ml.edp, db.perMl.edp, 0.5, 10_000), extrait: money(ml.extrait, db.perMl.extrait, 0.5, 10_000), oil: money(ml.oil, db.perMl.oil, 0.5, 10_000) },
          bottle: money(bs.bottle, db.bottle, 0, 100_000),
          premium: money(bs.premium, db.premium, 0, 100_000),
        };
      })(),
    };
  },
} as { [K in CmsKey]: (v: U, d: CmsDocs[K]) => CmsDocs[K] };

// الصفحات القانونية: قسم بلا عنوان أو نص عربي يُحذف؛ صفحة فرغت من الأقسام تعود لنصها الافتراضي
const legalPage = (v: U, d: LegalPageDoc): LegalPageDoc => {
  const o = obj(v);
  const seen = new Set<string>();
  const sections = Array.isArray(o.sections)
    ? o.sections.slice(0, 30).flatMap((it, i) => {
        const x = obj(it);
        const title = bi(x.title, { ar: "", en: "" }, 160), body = bi(x.body, { ar: "", en: "" }, 8000);
        if (!title.ar.trim() || !body.ar.trim()) return [];
        let id = str(x.id, `s${i + 1}`, 24).replace(/[^\w-]/g, "") || `s${i + 1}`;
        while (seen.has(id)) id += "x";
        seen.add(id);
        return [{ id, title, body }];
      })
    : [];
  return { title: bi(o.title, d.title, 120), intro: bi(o.intro, d.intro, 1500), sections: sections.length ? sections : d.sections };
};
sanitizers.legal = (v, d) => {
  const o = obj(v);
  return { updated: pattern(o.updated, d.updated, RE.date, 10) || d.updated, ...(Object.fromEntries(LEGAL_KINDS.map((k) => [k, legalPage(o[k], d[k])])) as Record<LegalKind, LegalPageDoc>) };
};

export function sanitize<K extends CmsKey>(key: K, value: unknown): CmsDocs[K] {
  return sanitizers[key](value, DEFAULTS[key]);
}

/** الحقول المرفوضة عند الحفظ (للتنبيه في المحرر بدل الإصلاح الصامت) */
export function rejectedFields<K extends CmsKey>(key: K, value: CmsDocs[K]): string[] {
  const clean = sanitize(key, value) as unknown as Record<string, unknown>;
  const raw = value as unknown as Record<string, unknown>;
  const out: string[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
      for (const k of Object.keys(b as object)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(path);
  };
  walk(clean, raw, "");
  return out;
}

/** الإعلان ظاهر الآن؟ (مفعّل ولم تنته مدته) */
/** اليوم بتوقيت الرياض (UTC+3 بلا توقيت صيفي) */
export const riyadhToday = (now = Date.now()) => new Date(now + 3 * 3_600_000).toISOString().slice(0, 10);

export function announcementLive(a: AnnouncementDoc, today = riyadhToday()) {
  return a.enabled && !!a.text.ar.trim() && (!a.until || today <= a.until);
}
