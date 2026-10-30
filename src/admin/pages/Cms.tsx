import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n, type Bi } from "@/i18n/context";
import { canEditKey, cmsRepo, type Drafts, type Snapshot, type Version } from "@/cms/repo";
import { useCms, useContent } from "@/cms/ContentProvider";
import { CMS_KEYS, DEFAULTS, RE, announcementLive, rejectedFields, sanitize, type AnnouncementDoc, type CmsDocs, type CmsKey, type FaqDoc, type HeroDoc, type LegalDoc, type OffersDoc, type PricingDoc, type SiteDoc } from "@/cms/schema";
import { DEFAULT_LEGAL, LEGAL_KINDS, LEGAL_PATHS, LEGAL_VARS, type LegalKind, type LegalPageDoc } from "@/data/legal";
import { estimateBox, type BoxRates } from "@/studio/box/pricing";
import { defaultBox, fitFor, type BoxStyle } from "@/studio/box/types";
import { compressImage, storeImage } from "@/creatives/images";
import { validationText } from "@/creatives/messages";
import { CImg } from "@/creatives/components/ui";
import { COST_ITEMS, SPEEDS, type CalcConfig } from "@/lib/pricing";
import { SERVICE_TRACKS } from "@/data/services";
import { FAQ_TOPICS } from "@/data/faq";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, PageTitle, fieldCls, useFormat } from "../components/ui";
import { EXTRAS } from "@/studio/spec";

type AnyDoc = CmsDocs[CmsKey];

const META: Record<CmsKey, { icon: string; label: Bi; hint: Bi; page: string }> = {
  site: { icon: "ri-contacts-line", label: { ar: "التواصل والحسابات", en: "Contact & social" }, hint: { ar: "البريد والجوال وواتساب والعنوان وروابط الحسابات", en: "Email, phone, WhatsApp, address and social links" }, page: "/contact" },
  announcement: { icon: "ri-megaphone-line", label: { ar: "شريط الإعلان", en: "Announcement bar" }, hint: { ar: "رسالة قصيرة تظهر أسفل صفحات الموقع", en: "A short message shown at the bottom of site pages" }, page: "/" },
  hero: { icon: "ri-layout-top-2-line", label: { ar: "واجهة الصفحة الرئيسية", en: "Homepage hero" }, hint: { ar: "العنوان والوصف والأزرار والصورة والأرقام", en: "Headline, intro, buttons, image and numbers" }, page: "/" },
  faq: { icon: "ri-question-answer-line", label: { ar: "الأسئلة الشائعة", en: "FAQ" }, hint: { ar: "الأسئلة العامة في الرئيسية وصفحة الأسئلة والخدمات", en: "General questions on home, FAQ and services" }, page: "/faq" },
  offers: { icon: "ri-calendar-schedule-line", label: { ar: "المكالمة والعينة", en: "Call & kit" }, hint: { ar: "مواعيد مكالمة الاكتشاف وتفاصيل العينة", en: "Discovery call schedule and kit details" }, page: "/book" },
  pricing: { icon: "ri-price-tag-3-line", label: { ar: "قائمة الأسعار", en: "Price list" }, hint: { ar: "الحاسبة والباقات والعينة وأسعار العلب", en: "Calculator, packages, kit and box rates" }, page: "/pricing" },
  legal: { icon: "ri-scales-3-line", label: { ar: "الصفحات القانونية", en: "Legal pages" }, hint: { ar: "الخصوصية والشروط والإلغاء والاسترجاع", en: "Privacy, terms, cancellation & refunds" }, page: "/privacy" },
};

const FIELD_LABELS: Record<string, Bi> = {
  email: { ar: "البريد", en: "Email" },
  phone: { ar: "الجوال", en: "Phone" },
  whatsapp: { ar: "واتساب", en: "WhatsApp" },
  link: { ar: "الرابط", en: "Link" },
  until: { ar: "تاريخ الانتهاء", en: "End date" },
  image: { ar: "الصورة", en: "Image" },
  updated: { ar: "آخر تحديث", en: "Last updated" },
  "billing.vatNumber": { ar: "الرقم الضريبي", en: "VAT number" },
  "billing.cr": { ar: "السجل التجاري", en: "CR number" },
  "billing.iban": { ar: "الآيبان", en: "IBAN" },
  "social.instagram": { ar: "إنستغرام", en: "Instagram" },
  "social.x": { ar: "إكس", en: "X" },
  "social.tiktok": { ar: "تيك توك", en: "TikTok" },
  "social.snapchat": { ar: "سناب شات", en: "Snapchat" },
  "social.linkedin": { ar: "لينكدإن", en: "LinkedIn" },
};

// ─── حقول ─────────────────────────────────────────────────────────
function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: boolean }) {
  return (
    <label className="block">
      <span className={`block text-xs mb-1.5 ${error ? "text-red-700" : "text-paper-500"}`}>{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-paper-400">{hint}</span>}
    </label>
  );
}

function BiInput({ label, value, onChange, max, rows }: { label: string; value: Bi; onChange: (v: Bi) => void; max: number; rows?: number }) {
  const { t } = useI18n();
  return (
    <fieldset className="grid sm:grid-cols-2 gap-3">
      <legend className="sr-only">{label}</legend>
      {(["ar", "en"] as const).map((l) => (
        <Field key={l} label={`${label} · ${l === "ar" ? t("عربي", "Arabic") : t("إنجليزي", "English")}`}>
          {rows ? (
            <textarea value={value[l]} dir={l === "ar" ? "rtl" : "ltr"} maxLength={max} rows={rows} onChange={(e) => onChange({ ...value, [l]: e.target.value })} className={`${fieldCls} resize-y`} />
          ) : (
            <input value={value[l]} dir={l === "ar" ? "rtl" : "ltr"} maxLength={max} onChange={(e) => onChange({ ...value, [l]: e.target.value })} className={fieldCls} />
          )}
        </Field>
      ))}
    </fieldset>
  );
}

function Ltr({ label, value, onChange, placeholder, re, hint, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; re?: RegExp; hint?: string; type?: string }) {
  const bad = !!value && !!re && !re.test(value);
  return (
    <Field label={label} hint={hint} error={bad}>
      <input type={type} value={value} dir="ltr" placeholder={placeholder} onChange={(e) => onChange(e.target.value.trim())} aria-invalid={bad} className={`${fieldCls} ${bad ? "!border-red-400" : ""}`} />
    </Field>
  );
}

function Num({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <Field label={label}>
      <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={fieldCls} />
    </Field>
  );
}

// ─── محررات الوثائق ─────────────────────────────────────────────────
function SiteEditor({ v, set }: { v: SiteDoc; set: (v: SiteDoc) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Ltr label={t("البريد", "Email")} value={v.email} re={RE.email} placeholder="hello@brand.sa" onChange={(email) => set({ ...v, email })} type="email" />
        <Ltr label={t("الجوال (دولي)", "Phone (intl.)")} value={v.phone} re={RE.phone} placeholder="+966500000000" onChange={(phone) => set({ ...v, phone })} />
        <Ltr label={t("واتساب (أرقام فقط)", "WhatsApp (digits)")} value={v.whatsapp} re={RE.whatsapp} placeholder="966500000000" onChange={(whatsapp) => set({ ...v, whatsapp: whatsapp.replace(/[^\d]/g, "") })} hint={t("يظهر زر واتساب العائم حين يُضبط", "The floating WhatsApp button appears once set")} />
      </div>
      <BiInput label={t("العنوان", "Address")} value={v.address} max={120} onChange={(address) => set({ ...v, address })} />
      <BiInput label={t("ساعات العمل", "Working hours")} value={v.workingHours} max={120} onChange={(workingHours) => set({ ...v, workingHours })} />
      <p className="text-xs text-paper-500 pt-2">{t("روابط الحسابات (https) — الفارغ لا يظهر", "Social links (https) — empty ones are hidden")}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {(Object.keys(v.social) as (keyof SiteDoc["social"])[]).map((k) => (
          <Ltr key={k} label={FIELD_LABELS[`social.${k}`] ? t(FIELD_LABELS[`social.${k}`].ar, FIELD_LABELS[`social.${k}`].en) : k} value={v.social[k]} re={RE.https} placeholder="https://" onChange={(x) => set({ ...v, social: { ...v.social, [k]: x } })} />
        ))}
      </div>
      <p className="text-xs text-paper-500 pt-2">{t("بيانات الفوترة — تظهر للعميل في عرض السعر وتعليمات التحويل البنكي", "Billing details — shown to clients on quotes and bank-transfer instructions")}</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label={t("الاسم النظامي للمنشأة", "Registered company name")}>
          <input value={v.billing.legalName} maxLength={120} onChange={(e) => set({ ...v, billing: { ...v.billing, legalName: e.target.value } })} className={fieldCls} />
        </Field>
        <Ltr label={t("الرقم الضريبي", "VAT number")} value={v.billing.vatNumber} re={RE.vat} placeholder="3xxxxxxxxxxxxx3" onChange={(vatNumber) => set({ ...v, billing: { ...v.billing, vatNumber: vatNumber.replace(/\D/g, "") } })} hint={t("15 رقماً يبدأ وينتهي بـ3", "15 digits starting and ending with 3")} />
        <Ltr label={t("السجل التجاري", "CR number")} value={v.billing.cr} re={RE.cr} placeholder="10xxxxxxxx" onChange={(cr) => set({ ...v, billing: { ...v.billing, cr: cr.replace(/\D/g, "") } })} />
        <Field label={t("اسم البنك", "Bank name")}>
          <input value={v.billing.bankName} maxLength={60} onChange={(e) => set({ ...v, billing: { ...v.billing, bankName: e.target.value } })} className={fieldCls} />
        </Field>
        <div className="sm:col-span-2">
          <Ltr label={t("الآيبان", "IBAN")} value={v.billing.iban} re={RE.iban} placeholder="SA0000000000000000000000" onChange={(iban) => set({ ...v, billing: { ...v.billing, iban: iban.replace(/\s/g, "").toUpperCase() } })} hint={t("يظهر للعميل خيار التحويل البنكي حين يُضبط", "Clients see the bank-transfer option once set")} />
        </div>
      </div>
    </div>
  );
}

function AnnouncementEditor({ v, set }: { v: AnnouncementDoc; set: (v: AnnouncementDoc) => void }) {
  const { t, pick } = useI18n();
  const live = announcementLive(v);
  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 rounded-xl bg-white border border-paper-200 px-4 py-3">
        <span className="text-sm text-ink-900">{t("إظهار الشريط", "Show the bar")}</span>
        <input type="checkbox" role="switch" checked={v.enabled} onChange={(e) => set({ ...v, enabled: e.target.checked })} className="w-5 h-5 accent-ink-900" />
      </label>
      <BiInput label={t("النص", "Text")} value={v.text} max={160} onChange={(text) => set({ ...v, text })} />
      <div className="grid sm:grid-cols-3 gap-3">
        <Ltr label={t("الرابط", "Link")} value={v.link} re={RE.link} placeholder="/discovery-kit" onChange={(link) => set({ ...v, link })} hint={t("مسار داخلي أو https", "Internal path or https")} />
        <Field label={t("اللون", "Tone")}>
          <select value={v.tone} onChange={(e) => set({ ...v, tone: e.target.value as AnnouncementDoc["tone"] })} className={fieldCls}>
            <option value="dark">{t("داكن", "Dark")}</option>
            <option value="accent">{t("نحاسي", "Accent")}</option>
          </select>
        </Field>
        <Field label={t("ينتهي في (اختياري)", "Ends on (optional)")}>
          <input type="date" value={v.until} onChange={(e) => set({ ...v, until: e.target.value })} className={fieldCls} />
        </Field>
      </div>
      <BiInput label={t("نص الزر", "Button label")} value={v.linkLabel} max={40} onChange={(linkLabel) => set({ ...v, linkLabel })} />
      <div>
        <p className="text-xs text-paper-500 mb-2">{t("معاينة", "Preview")} · {live ? t("سيظهر بعد النشر", "Will show once published") : t("مخفي", "Hidden")}</p>
        <div className={`rounded-2xl ps-4 pe-2 py-2.5 flex items-center gap-3 ${v.tone === "dark" ? "bg-ink-900 text-white" : "bg-accent2 text-white"} ${live ? "" : "opacity-40"}`}>
          <p className="text-sm flex-1">{pick(v.text) || "—"}</p>
          {pick(v.linkLabel) && <span className="rounded-full bg-white text-ink-900 px-3 py-1.5 text-xs">{pick(v.linkLabel)}</span>}
        </div>
      </div>
    </div>
  );
}

function HeroEditor({ v, set }: { v: HeroDoc; set: (v: HeroDoc) => void }) {
  const { t, num } = useI18n();
  const [imgErr, setImgErr] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    setImgErr("");
    setBusy(true);
    try {
      set({ ...v, image: await storeImage(await compressImage(f, 2000, 0.88), "hero", "site") });
    } catch (e) {
      setImgErr(validationText(e instanceof Error ? e.message : "upload_failed", t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <BiInput label={t("السطر الصغير أعلى العنوان", "Eyebrow")} value={v.eyebrow} max={90} onChange={(eyebrow) => set({ ...v, eyebrow })} />
      <BiInput label={t("العنوان · السطر الأول", "Headline · line 1")} value={v.line1} max={60} onChange={(line1) => set({ ...v, line1 })} />
      <BiInput label={t("السطر الثاني", "Line 2")} value={v.line2} max={60} onChange={(line2) => set({ ...v, line2 })} />
      <BiInput label={t("الكلمات الملوّنة في نهايته", "Highlighted words at its end")} value={v.highlight} max={40} onChange={(highlight) => set({ ...v, highlight })} />
      <BiInput label={t("الوصف", "Intro")} value={v.sub} max={320} rows={3} onChange={(sub) => set({ ...v, sub })} />
      <BiInput label={t("الزر الرئيسي", "Primary button")} value={v.primaryCta} max={40} onChange={(primaryCta) => set({ ...v, primaryCta })} />
      <BiInput label={t("الزر الثانوي", "Secondary button")} value={v.secondaryCta} max={40} onChange={(secondaryCta) => set({ ...v, secondaryCta })} />
      <div className="grid sm:grid-cols-[10rem_1fr] gap-4 items-start">
        <CImg src={v.image} alt={t("صورة الواجهة", "Hero image")} className="aspect-[4/5] rounded-2xl" />
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Btn variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
              <i className="ri-image-edit-line" aria-hidden="true"></i>
              {busy ? t("جاري الرفع…", "Uploading…") : t("تغيير الصورة", "Change image")}
            </Btn>
            {v.image !== DEFAULTS.hero.image && <Btn variant="ghost" onClick={() => set({ ...v, image: DEFAULTS.hero.image })}>{t("الصورة الأصلية", "Original image")}</Btn>}
            <input ref={input} type="file" accept="image/*" className="sr-only" aria-label={t("صورة الواجهة", "Hero image")} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </div>
          {imgErr && <p role="alert" className="text-xs text-red-700">{imgErr}</p>}
          <p className="text-[11px] text-paper-500">{t("عمودية 4:5 تقريباً، تُصغَّر تلقائياً إلى 2000 بكسل.", "Roughly portrait 4:5, auto-resized to 2000 px.")}</p>
          <BiInput label={t("وصف الصورة (لقارئ الشاشة)", "Image description (screen readers)")} value={v.imageAlt} max={140} onChange={(imageAlt) => set({ ...v, imageAlt })} />
        </div>
      </div>
      <div>
        <p className="text-xs text-paper-500 mb-2">{t("الأرقام أسفل الواجهة (تظهر في صفحة «عن المنصة» أيضاً) — حقائق موثقة فقط", "Numbers under the hero (also on About) — verifiable facts only")}</p>
        <div className="space-y-3">
          {v.facts.map((f, i) => (
            <div key={i} className="rounded-xl border border-paper-200 bg-white p-3 grid grid-cols-2 lg:grid-cols-[5rem_7rem_1fr] gap-3 items-end">
              <Field label={t("بادئة", "Prefix")}>
                <input value={f.prefix} maxLength={8} dir="ltr" onChange={(e) => set({ ...v, facts: v.facts.map((x, k) => (k === i ? { ...x, prefix: e.target.value } : x)) })} className={fieldCls} />
              </Field>
              <Num label={t(`الرقم ${num(i + 1)}`, `Number ${i + 1}`)} value={f.value} min={0} max={1_000_000} onChange={(value) => set({ ...v, facts: v.facts.map((x, k) => (k === i ? { ...x, value } : x)) })} />
              <div className="col-span-2 lg:col-span-1"><BiInput label={t("الوصف", "Label")} value={f.label} max={60} onChange={(label) => set({ ...v, facts: v.facts.map((x, k) => (k === i ? { ...x, label } : x)) })} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FaqEditor({ v, set }: { v: FaqDoc; set: (v: FaqDoc) => void }) {
  const { t, pick, num } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const items = v.items;
  const put = (i: number, patch: Partial<FaqDoc["items"][number]>) => set({ items: items.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    set({ items: next });
  };
  const add = () => {
    const id = `q${Date.now().toString(36)}`;
    set({ items: [...items, { id, topic: "start", q: { ar: "", en: "" }, a: { ar: "", en: "" }, published: true }] });
    setOpen(id);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-paper-500">{t("أول خمسة أسئلة منشورة تظهر في الرئيسية. السؤال بلا نص عربي لا يُحفظ.", "The first five published questions show on the homepage. Questions without Arabic text aren't saved.")}</p>
      <ol className="space-y-2">
        {items.map((f, i) => {
          const isOpen = open === f.id;
          return (
            <li key={f.id} className="rounded-xl border border-paper-200 bg-white">
              <div className="flex items-center gap-2 p-2">
                <span className="w-7 text-center font-mono text-xs text-paper-400">{num(i + 1)}</span>
                <button type="button" onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen} className="flex-1 min-w-0 text-start text-sm text-ink-900 truncate py-1.5">
                  {pick(f.q) || <span className="text-paper-400">{t("سؤال جديد", "New question")}</span>}
                </button>
                {!f.published && <span className="rounded-full bg-paper-100 text-paper-600 px-2 py-0.5 text-[10px]">{t("مخفي", "Hidden")}</span>}
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-full hover:bg-paper-100 disabled:opacity-30" aria-label={t(`حرّك السؤال ${num(i + 1)} للأعلى`, `Move question ${i + 1} up`)}><i className="ri-arrow-up-s-line" aria-hidden="true"></i></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="w-8 h-8 rounded-full hover:bg-paper-100 disabled:opacity-30" aria-label={t(`حرّك السؤال ${num(i + 1)} للأسفل`, `Move question ${i + 1} down`)}><i className="ri-arrow-down-s-line" aria-hidden="true"></i></button>
                <button type="button" onClick={() => set({ items: items.filter((_, k) => k !== i) })} className="w-8 h-8 rounded-full hover:bg-red-50 text-red-700" aria-label={t(`احذف السؤال ${num(i + 1)}`, `Delete question ${i + 1}`)}><i className="ri-delete-bin-line" aria-hidden="true"></i></button>
              </div>
              {isOpen && (
                <div className="border-t border-paper-100 p-3 space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label={t("الموضوع", "Topic")}>
                      <select value={f.topic} onChange={(e) => put(i, { topic: e.target.value as typeof f.topic })} className={fieldCls}>
                        {FAQ_TOPICS.map((x) => <option key={x.key} value={x.key}>{pick(x.label)}</option>)}
                      </select>
                    </Field>
                    <label className="inline-flex items-center gap-2 text-sm text-ink-900 pb-2.5">
                      <input type="checkbox" checked={f.published} onChange={(e) => put(i, { published: e.target.checked })} className="w-4 h-4 accent-ink-900" />
                      {t("منشور", "Published")}
                    </label>
                  </div>
                  <BiInput label={t("السؤال", "Question")} value={f.q} max={300} onChange={(q) => put(i, { q })} />
                  <BiInput label={t("الإجابة", "Answer")} value={f.a} max={2000} rows={4} onChange={(a) => put(i, { a })} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <Btn variant="secondary" onClick={add}>
        <i className="ri-add-line" aria-hidden="true"></i>
        {t("سؤال جديد", "New question")}
      </Btn>
    </div>
  );
}

const DAYS: Bi[] = [
  { ar: "الأحد", en: "Sun" },
  { ar: "الاثنين", en: "Mon" },
  { ar: "الثلاثاء", en: "Tue" },
  { ar: "الأربعاء", en: "Wed" },
  { ar: "الخميس", en: "Thu" },
  { ar: "الجمعة", en: "Fri" },
  { ar: "السبت", en: "Sat" },
];

function OffersEditor({ v, set }: { v: OffersDoc; set: (v: OffersDoc) => void }) {
  const { t, pick } = useI18n();
  const [slot, setSlot] = useState("13:00");
  const c = v.call, k = v.kit;
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm text-ink-900">{t("مكالمة الاكتشاف", "Discovery call")}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Num label={t("المدة (دقيقة)", "Length (minutes)")} value={c.minutes} min={10} max={120} onChange={(minutes) => set({ ...v, call: { ...c, minutes } })} />
          <Num label={t("أيام الحجز المتاحة مقدماً", "Days bookable ahead")} value={c.daysAhead} min={1} max={60} onChange={(daysAhead) => set({ ...v, call: { ...c, daysAhead } })} />
        </div>
        <div role="group" aria-label={t("أيام العمل", "Working days")} className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const on = c.workDays.includes(i);
            return (
              <button key={i} type="button" aria-pressed={on} onClick={() => set({ ...v, call: { ...c, workDays: on ? c.workDays.filter((x) => x !== i) : [...c.workDays, i].sort() } })} className={`rounded-full px-3 py-1.5 text-xs border ${on ? "bg-ink-900 text-white border-ink-900" : "bg-white border-paper-200 text-paper-700"}`}>
                {pick(d)}
              </button>
            );
          })}
        </div>
        <div>
          <p className="text-xs text-paper-500 mb-2">{t("المواعيد بتوقيت الرياض", "Slots in Riyadh time")}</p>
          <ul className="flex flex-wrap gap-1.5" aria-label={t("المواعيد", "Slots")}>
            {c.slots.map((s) => (
              <li key={s} className="inline-flex items-center gap-1 rounded-full border border-paper-200 bg-white ps-3 pe-1 py-1 text-xs font-mono" dir="ltr">
                {s}
                <button type="button" onClick={() => set({ ...v, call: { ...c, slots: c.slots.filter((x) => x !== s) } })} className="w-6 h-6 rounded-full hover:bg-paper-100" aria-label={t(`احذف موعد ${s}`, `Remove slot ${s}`)}><i className="ri-close-line" aria-hidden="true"></i></button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <input type="time" value={slot} step={900} onChange={(e) => setSlot(e.target.value)} className={`${fieldCls} !w-36`} aria-label={t("موعد جديد", "New slot")} />
            <Btn variant="secondary" onClick={() => RE.slot.test(slot) && !c.slots.includes(slot) && set({ ...v, call: { ...c, slots: [...c.slots, slot].sort() } })}>{t("إضافة موعد", "Add slot")}</Btn>
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm text-ink-900">{t("عينة الاكتشاف", "Discovery kit")}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Num label={t("عدد العينات", "Vials")} value={k.vials} min={1} max={12} onChange={(vials) => set({ ...v, kit: { ...k, vials } })} />
          <Num label={t("حجم العينة (مل)", "Vial size (ml)")} value={k.ml} min={1} max={50} onChange={(ml) => set({ ...v, kit: { ...k, ml } })} />
          <Num label={t("مدة الخصم من المشروع (يوماً)", "Credit window (days)")} value={k.creditDays} min={0} max={365} onChange={(creditDays) => set({ ...v, kit: { ...k, creditDays } })} />
        </div>
        <BiInput label={t("مدة الشحن", "Shipping time")} value={k.shipping} max={80} onChange={(shipping) => set({ ...v, kit: { ...k, shipping } })} />
        <p className="rounded-xl bg-sand-soft px-4 py-3 text-xs text-paper-700 leading-[1.8]">
          <i className="ri-lock-line me-1" aria-hidden="true"></i>
          {t("السعر يُعدَّل من وثيقة «الأسعار» (للمالك والمدير): منها تعرض الصفحة السعر، ومنها يتحقق الخادم من المبلغ عند الدفع.", "The price is edited in the “Pricing” document (owners and admins): the page shows it from there, and the server verifies payments against it.")}
        </p>
      </section>
    </div>
  );
}

const STYLE_NAMES: { id: BoxStyle; name: Bi }[] = [
  { id: "tuck", name: { ar: "بلسان", en: "Tuck end" } },
  { id: "drawer", name: { ar: "درج", en: "Drawer" } },
  { id: "rigid", name: { ar: "صلبة بغطاء", en: "Rigid" } },
  { id: "magnetic", name: { ar: "مغناطيسية", en: "Magnetic" } },
  { id: "tube", name: { ar: "أسطوانة", en: "Tube" } },
];

function PricingEditor({ v, set }: { v: PricingDoc; set: (v: PricingDoc) => void }) {
  const { t, pick, num } = useI18n();
  const b = v.box;
  const put = (patch: Partial<BoxRates>) => set({ ...v, box: { ...b, ...patch } });
  const c = v.calc;
  const putC = (patch: Partial<CalcConfig>) => set({ ...v, calc: { ...c, ...patch } });
  // مثال حي: نفس العلبة الافتراضية بكل نوع، بألف قطعة
  const sample = useMemo(() => STYLE_NAMES.map((s) => ({ s, e: estimateBox({ ...defaultBox(), style: s.id, ...fitFor(s.id, { w: 52, d: 36, h: 120 }) }, 1000, b) })), [b]);
  const money = (n: number) => t(`${num(n, 2)} ر.س`, `SAR ${num(n, 2)}`);
  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-sand-soft px-4 py-3 text-xs text-paper-700 leading-[1.8]">
        {t("هذه الأرقام تحدد السعر التقديري الذي يراه العميل وهو يصمم علبته في الاستوديو، وتدخل في حاسبة التكلفة. اضبطها على عروض موردي الكرتون والمطابع الفعلية.", "These rates drive the estimate clients see while designing their box in the studio, and feed the cost calculator. Calibrate them on real board and print supplier quotes.")}
      </p>
      <section className="space-y-3" aria-labelledby="pr-calc">
        <h3 id="pr-calc" className="text-sm text-ink-900">{t("حاسبة التكلفة: تكلفة الوحدة لكل عنصر (ر.س)", "Cost calculator: unit cost per element (SAR)")}</h3>
        <div className="grid sm:grid-cols-4 gap-3">
          {COST_ITEMS.map((i) => (
            <Num key={i.key} label={pick(i.label)} value={c.items[i.key] ?? i.perUnit} min={0} max={10000} step={0.5} onChange={(x) => putC({ items: { ...c.items, [i.key]: x } })} />
          ))}
        </div>
        <div className="grid sm:grid-cols-5 gap-3">
          {c.tiers.map((tier, i) => (
            <div key={i} className="rounded-xl border border-paper-200 bg-white p-2 space-y-2">
              <Num label={t(`الشريحة ${num(i + 1)}: من كمية`, `Tier ${i + 1}: from qty`)} value={tier.qty} min={1} max={1000000} step={100} onChange={(qty) => putC({ tiers: c.tiers.map((x, j) => (j === i ? { ...x, qty } : x)) })} />
              <Num label={t("خصم %", "Discount %")} value={tier.discount} min={0} max={90} step={1} onChange={(discount) => putC({ tiers: c.tiers.map((x, j) => (j === i ? { ...x, discount } : x)) })} />
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {SPEEDS.map((sp) => (
            <Num key={sp.id} label={t(`مضاعف السرعة: ${pick(sp.label)}`, `Speed multiplier: ${pick(sp.label)}`)} value={c.speeds[sp.id]} min={1} max={5} step={0.05} onChange={(x) => putC({ speeds: { ...c.speeds, [sp.id]: x } })} />
          ))}
          <Num label={t("جولة العينات (ر.س)", "Sample round (SAR)")} value={c.sample} min={0} max={1000000} step={50} onChange={(sample) => putC({ sample })} />
          <Num label={t("جولة التصميم (ر.س)", "Design round (SAR)")} value={c.designRound} min={0} max={1000000} step={100} onChange={(designRound) => putC({ designRound })} />
          <Num label={t("مضاعف سعر التجزئة المقترح", "Suggested retail multiplier")} value={c.retail} min={1} max={20} step={0.1} onChange={(retail) => putC({ retail })} />
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="pr-services">
        <h3 id="pr-services" className="text-sm text-ink-900">{t("الخدمات: «يبدأ من» (ر.س، 0 = عرض سعر مخصص)", "Services: “from” price (SAR, 0 = custom quote)")}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {SERVICE_TRACKS.map((tr) => (
            <Num key={tr.id} label={pick(tr.title)} value={v.services[tr.id]} min={0} max={10000000} step={500} onChange={(x) => set({ ...v, services: { ...v.services, [tr.id]: x } })} />
          ))}
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="pr-bespoke">
        <h3 id="pr-bespoke" className="text-sm text-ink-900">{t("«عطرك الخاص» للأفراد (ر.س)", "“Your signature scent” for individuals (SAR)")}</h3>
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Num label={t("المل · أو دو بارفان", "Per ml · EDP")} value={v.bespoke.perMl.edp} min={0.5} max={10000} step={0.5} onChange={(edp) => set({ ...v, bespoke: { ...v.bespoke, perMl: { ...v.bespoke.perMl, edp } } })} />
          <Num label={t("المل · إكستريه", "Per ml · Extrait")} value={v.bespoke.perMl.extrait} min={0.5} max={10000} step={0.5} onChange={(extrait) => set({ ...v, bespoke: { ...v.bespoke, perMl: { ...v.bespoke.perMl, extrait } } })} />
          <Num label={t("المل · دهن عطري", "Per ml · Oil")} value={v.bespoke.perMl.oil} min={0.5} max={10000} step={0.5} onChange={(oil) => set({ ...v, bespoke: { ...v.bespoke, perMl: { ...v.bespoke.perMl, oil } } })} />
          <Num label={t("الزجاجة والعلبة والنقش", "Bottle, box & engraving")} value={v.bespoke.bottle} min={0} max={100000} step={10} onChange={(bottle) => set({ ...v, bespoke: { ...v.bespoke, bottle } })} />
          <Num label={t("إضافة المكوّن النادر", "Rare-note surcharge")} value={v.bespoke.premium} min={0} max={100000} step={10} onChange={(premium) => set({ ...v, bespoke: { ...v.bespoke, premium } })} />
        </div>
        <p className="text-xs text-paper-500">{t("سعر تقديري يراه العميل وهو يكوّن عطره؛ السعر النهائي في عرض السعر بعد جلسة المستشار.", "An estimate the client sees while composing; the final price comes in the quote after the consultation.")}</p>
      </section>
      <section className="space-y-3" aria-labelledby="pr-kit">
        <h3 id="pr-kit" className="text-sm text-ink-900">{t("عينة الاكتشاف", "Discovery kit")}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Num label={t("السعر (ر.س)", "Price (SAR)")} value={v.kit.price} min={1} max={100000} step={10} onChange={(price) => set({ ...v, kit: { price } })} />
        </div>
        <p className="text-xs text-paper-500">{t("الخادم يتحقق من مبلغ الدفع بهذا السعر بعد النشر، والكوبونات تُطبَّق عليه.", "After publishing, the server verifies payments against this price; coupons apply to it.")}</p>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm text-ink-900">{t("لكل نوع علبة", "Per box style")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="text-xs text-paper-500">
                <th className="text-start font-normal pb-2">{t("النوع", "Style")}</th>
                <th className="text-start font-normal pb-2">{t("الخامة / م²", "Board / m²")}</th>
                <th className="text-start font-normal pb-2">{t("التجميع / علبة", "Assembly / box")}</th>
                <th className="text-start font-normal pb-2">{t("أقل كمية", "MOQ")}</th>
              </tr>
            </thead>
            <tbody>
              {STYLE_NAMES.map(({ id, name }) => (
                <tr key={id} className="border-t border-paper-100">
                  <th scope="row" className="text-start font-normal py-2 pe-2 text-ink-900">{pick(name)}</th>
                  {(["boardPerM2", "assemblyPerUnit", "moq"] as const).map((k) => (
                    <td key={k} className="py-2 pe-2">
                      <input
                        type="number"
                        min={k === "moq" ? 1 : 0}
                        step={k === "moq" ? 50 : 0.05}
                        value={b[k][id]}
                        onChange={(e) => put({ [k]: { ...b[k], [id]: Number(e.target.value) } } as Partial<BoxRates>)}
                        aria-label={`${pick(name)} · ${k === "boardPerM2" ? t("الخامة لكل م²", "board per m²") : k === "assemblyPerUnit" ? t("التجميع لكل علبة", "assembly per box") : t("أقل كمية", "MOQ")}`}
                        className={`${fieldCls} !py-1.5`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm text-ink-900">{t("الطباعة والتشطيب (لكل م² من الفرخ)", "Print & finish (per m² of sheet)")}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Num label={t("هدر القص %", "Waste %")} value={Math.round((b.waste - 1) * 100)} min={0} max={100} onChange={(x) => put({ waste: 1 + x / 100 })} />
          <Num label={t("طباعة لون كامل", "Full-flood print")} value={b.printFloodPerM2} min={0} max={200} step={0.05} onChange={(printFloodPerM2) => put({ printFloodPerM2 })} />
          <Num label={t("طباعة نص فقط", "Text-only print")} value={b.printLightPerM2} min={0} max={200} step={0.05} onChange={(printLightPerM2) => put({ printLightPerM2 })} />
          <Num label={t("تشطيب مطفأ", "Matte")} value={b.finishPerM2.matte} min={0} max={200} step={0.05} onChange={(matte) => put({ finishPerM2: { ...b.finishPerM2, matte } })} />
          <Num label={t("ملمس مخملي", "Soft-touch")} value={b.finishPerM2.soft} min={0} max={200} step={0.05} onChange={(soft) => put({ finishPerM2: { ...b.finishPerM2, soft } })} />
          <Num label={t("لامع", "Gloss")} value={b.finishPerM2.gloss} min={0} max={200} step={0.05} onChange={(gloss) => put({ finishPerM2: { ...b.finishPerM2, gloss } })} />
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm text-ink-900">{t("الفويل والتجهيز", "Foil & setup")}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Num label={t("فويل لكل علبة", "Foil per box")} value={b.foilPerUnit} min={0} max={100} step={0.05} onChange={(foilPerUnit) => put({ foilPerUnit })} />
          <Num label={t("كليشة الفويل (مرة)", "Foil block (once)")} value={b.foilBlock} min={0} max={100000} step={10} onChange={(foilBlock) => put({ foilBlock })} />
          <Num label={t("ألواح وتجهيز (مرة)", "Plates & make-ready (once)")} value={b.platesSetup} min={0} max={100000} step={10} onChange={(platesSetup) => put({ platesSetup })} />
          <Num label={t("قالب القص لكل مم", "Die per mm")} value={b.diePerMm} min={0} max={10} step={0.01} onChange={(diePerMm) => put({ diePerMm })} />
          <Num label={t("أقل سعر للقالب", "Die minimum")} value={b.dieMin} min={0} max={100000} step={10} onChange={(dieMin) => put({ dieMin })} />
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm text-ink-900">{t("ملحقات التغليف (لكل علبة)", "Packaging extras (per box)")}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {EXTRAS.map((x) => (
            <Num key={x.id} label={pick(x.name)} value={b.extrasPerUnit?.[x.id] ?? x.perUnit} min={0} max={100} step={0.05} onChange={(v) => put({ extrasPerUnit: { ...(b.extrasPerUnit ?? {}), [x.id]: v } })} />
          ))}
        </div>
      </section>
      <section aria-labelledby="pr-sample">
        <h3 id="pr-sample" className="text-sm text-ink-900 mb-2">{t("أثر الأسعار: علبة لعبوة 50 مل، 1,000 قطعة، أسود مخملي بفويل ذهبي", "Effect: a box for a 50 ml bottle, 1,000 units, soft-touch black with gold foil")}</h3>
        <ul className="grid sm:grid-cols-5 gap-2" data-testid="pricing-sample">
          {sample.map(({ s, e }) => (
            <li key={s.id} className="rounded-xl border border-paper-200 bg-white px-3 py-2">
              <p className="text-[11px] text-paper-500">{pick(s.name)}</p>
              <p className="font-mono text-sm text-ink-900" dir="ltr" style={{ textAlign: "start" }}>{money(e.unit)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const LEGAL_LABELS: Record<LegalKind, Bi> = {
  privacy: { ar: "الخصوصية", en: "Privacy" },
  terms: { ar: "الشروط", en: "Terms" },
  refund: { ar: "الإلغاء والاسترجاع", en: "Refunds" },
};

function LegalEditor({ v, set }: { v: LegalDoc; set: (v: LegalDoc) => void }) {
  const { t, pick, num } = useI18n();
  const [kind, setKind] = useState<LegalKind>("privacy");
  const [open, setOpen] = useState<string | null>(null);
  const site = useContent("site");
  // بيانات تظهر في النصوص كـ«—» حتى تُدخل
  const missing = [
    !site.billing.legalName && t("الاسم النظامي", "legal name"),
    !site.billing.cr && t("السجل التجاري", "CR number"),
    !site.billing.vatNumber && t("الرقم الضريبي", "VAT number"),
    !site.email && t("البريد", "email"),
    !site.phone && t("الجوال", "phone"),
  ].filter(Boolean);
  const page = v[kind];
  const putPage = (p: LegalPageDoc) => set({ ...v, [kind]: p });
  const sections = page.sections;
  const put = (i: number, patch: Partial<LegalPageDoc["sections"][number]>) => putPage({ ...page, sections: sections.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    putPage({ ...page, sections: next });
  };
  const add = () => {
    const id = `s${Date.now().toString(36)}`;
    putPage({ ...page, sections: [...sections, { id, title: { ar: "", en: "" }, body: { ar: "", en: "" } }] });
    setOpen(id);
  };
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 leading-[1.8]">
        {t("النصوص الافتراضية صياغة مبدئية: راجعها مع مستشار قانوني قبل الإطلاق. بيانات المنشأة (الاسم النظامي، السجل، الرقم الضريبي) تُملأ تلقائياً من «التواصل والحسابات».", "The default texts are a starting draft: have a lawyer review them before launch. Business details (legal name, CR, VAT number) fill in automatically from “Contact & social”.")}
      </p>
      {missing.length > 0 && (
        <p role="status" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800 leading-[1.8]" data-testid="legal-missing">
          {t(`ناقص في «التواصل والحسابات» ويظهر «—» في النصوص المنشورة: ${missing.join("، ")}.`, `Missing in “Contact & social”, shown as “—” on the published pages: ${missing.join(", ")}.`)}{" "}
          <a href="?doc=site" className="underline underline-offset-4">{t("أكمله", "Complete it")}</a>
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-full border border-paper-200 bg-white p-1" role="tablist" aria-label={t("الصفحة", "Page")}>
          {LEGAL_KINDS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === kind} onClick={() => { setKind(k); setOpen(null); }} className={`rounded-full px-4 py-1.5 text-sm ${k === kind ? "bg-ink-900 text-white" : "text-paper-600"}`}>{pick(LEGAL_LABELS[k])}</button>
          ))}
        </div>
        <Ltr label={t("آخر تحديث", "Last updated")} type="date" value={v.updated} re={RE.date} onChange={(updated) => set({ ...v, updated })} />
        <a href={LEGAL_PATHS[kind]} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4 text-paper-600 pb-3">{t("افتح الصفحة", "Open page")}</a>
      </div>
      <BiInput label={t("العنوان", "Title")} value={page.title} max={120} onChange={(title) => putPage({ ...page, title })} />
      <BiInput label={t("المقدمة", "Intro")} value={page.intro} max={1500} rows={3} onChange={(intro) => putPage({ ...page, intro })} />
      <p className="text-xs text-paper-500 leading-[1.8]">
        {t("فقرات يفصلها سطر فارغ، والسطر الذي يبدأ بـ«- » بند في قائمة. المتغيرات:", "Paragraphs are separated by a blank line; a line starting with “- ” is a list item. Variables:")}{" "}
        <span dir="ltr" className="font-mono">{LEGAL_VARS.map((x) => `{${x}}`).join(" ")}</span>
      </p>
      <ol className="space-y-2">
        {sections.map((x, i) => {
          const isOpen = open === x.id;
          return (
            <li key={x.id} className="rounded-xl border border-paper-200 bg-white">
              <div className="flex items-center gap-2 p-2">
                <span className="w-7 text-center font-mono text-xs text-paper-400">{num(i + 1)}</span>
                <button type="button" onClick={() => setOpen(isOpen ? null : x.id)} aria-expanded={isOpen} className="flex-1 min-w-0 text-start text-sm text-ink-900 truncate py-1.5">
                  {pick(x.title) || <span className="text-paper-400">{t("قسم جديد", "New section")}</span>}
                </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-full hover:bg-paper-100 disabled:opacity-30" aria-label={t(`حرّك القسم ${num(i + 1)} للأعلى`, `Move section ${i + 1} up`)}><i className="ri-arrow-up-s-line" aria-hidden="true"></i></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="w-8 h-8 rounded-full hover:bg-paper-100 disabled:opacity-30" aria-label={t(`حرّك القسم ${num(i + 1)} للأسفل`, `Move section ${i + 1} down`)}><i className="ri-arrow-down-s-line" aria-hidden="true"></i></button>
                <button type="button" onClick={() => putPage({ ...page, sections: sections.filter((_, k) => k !== i) })} className="w-8 h-8 rounded-full hover:bg-red-50 text-red-700" aria-label={t(`احذف القسم ${num(i + 1)}`, `Delete section ${i + 1}`)}><i className="ri-delete-bin-line" aria-hidden="true"></i></button>
              </div>
              {isOpen && (
                <div className="border-t border-paper-100 p-3 space-y-3">
                  <BiInput label={t("عنوان القسم", "Section title")} value={x.title} max={160} onChange={(title) => put(i, { title })} />
                  <BiInput label={t("النص", "Text")} value={x.body} max={8000} rows={10} onChange={(body) => put(i, { body })} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Btn variant="secondary" onClick={add}>
          <i className="ri-add-line" aria-hidden="true"></i>
          {t("قسم جديد", "New section")}
        </Btn>
        <Btn variant="ghost" onClick={() => window.confirm(t("استبدال نص هذه الصفحة بالنص الافتراضي؟", "Replace this page with the default text?")) && putPage(structuredClone(DEFAULT_LEGAL[kind]))}>
          {t("استعادة النص الافتراضي", "Restore default text")}
        </Btn>
      </div>
    </div>
  );
}

function DocEditor<K extends CmsKey>({ k, v, set }: { k: K; v: CmsDocs[K]; set: (v: CmsDocs[K]) => void }) {
  const s = set as (v: AnyDoc) => void;
  switch (k) {
    case "site":
      return <SiteEditor v={v as SiteDoc} set={s} />;
    case "announcement":
      return <AnnouncementEditor v={v as AnnouncementDoc} set={s} />;
    case "hero":
      return <HeroEditor v={v as HeroDoc} set={s} />;
    case "faq":
      return <FaqEditor v={v as FaqDoc} set={s} />;
    case "pricing":
      return <PricingEditor v={v as PricingDoc} set={s} />;
    case "legal":
      return <LegalEditor v={v as LegalDoc} set={s} />;
    default:
      return <OffersEditor v={v as OffersDoc} set={s} />;
  }
}

// ─── الصفحة ─────────────────────────────────────────────────────────
export default function Cms() {
  const { t, pick, num } = useI18n();
  const { run, actor, member } = useCrm();
  const { setPreview, refresh: refreshSite } = useCms();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const asked = params.get("doc") ?? "";
  // وثيقة لا يملك الدور تعديلها (الأسعار للمحرر) → الواجهة الرئيسية
  const key: CmsKey = (CMS_KEYS as readonly string[]).includes(asked) && (!actor || canEditKey(actor.role, asked as CmsKey)) ? (asked as CmsKey) : "hero";
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [value, setValue] = useState<AnyDoc | null>(null);
  const [baseline, setBaseline] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!actor) return;
    const [s, d] = await Promise.all([cmsRepo.loadPublished(), cmsRepo.loadDrafts(actor.role)]);
    setSnap(s);
    setDrafts(d);
    return { s, d };
  }, [actor]);

  const loadDoc = useCallback(
    async (k: CmsKey) => {
      const r = await load();
      if (!r || !actor) return;
      // عبر sanitize: وثيقة منشورة قبل إضافة حقول جديدة تُكمَل بالقيم الافتراضية
      const v = sanitize(k, r.d.drafts[k] ?? r.s.published[k] ?? DEFAULTS[k]) as AnyDoc;
      setValue(structuredClone(v));
      setBaseline(JSON.stringify(v));
      setErrors([]);
      setVersions(await cmsRepo.versions(k, actor.role));
    },
    [load, actor],
  );

  useEffect(() => {
    void loadDoc(key);
  }, [key, loadDoc]);

  const dirty = value !== null && JSON.stringify(value) !== baseline;
  // تنبيه قبل مغادرة الصفحة بتعديلات غير محفوظة
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const hasDraft = !!drafts?.drafts[key];
  const pubMeta = snap?.publishedMeta[key];
  const draftMeta = drafts?.draftMeta[key];
  const who = (id?: string | null) => {
    const m = member(id ?? null);
    return m ? `${m.firstName} ${m.lastName}` : t("الفريق", "the team");
  };

  const pickDoc = (k: CmsKey) => {
    if (dirty && !window.confirm(t("لديك تعديلات غير محفوظة. تركها؟", "You have unsaved changes. Discard them?"))) return;
    const next = new URLSearchParams(params);
    next.set("doc", k);
    setParams(next, { replace: true });
  };

  const validate = () => {
    if (!value) return false;
    // الأسعار أرقام تُقيَّد وتُقرَّب تلقائياً (لا حقول نصية تُرفض)
    if (key === "pricing") return true;
    // الأقسام الفارغة تُحذف بصمت؛ التاريخ وحده يُرفض صراحة
    const bad = rejectedFields(key, value as never).filter((p) => !p.startsWith("items") && !p.startsWith("facts") && !p.startsWith("call.slots") && !/^(privacy|terms|refund)\./.test(p));
    setErrors(bad);
    return bad.length === 0;
  };

  const saveDraft = async (quiet = false) => {
    if (!value || !actor || !validate()) return false;
    const ok = await run((_, a) => cmsRepo.saveDraft(key, value as never, a.role, a.id), quiet ? undefined : t("حُفظت المسودة — لم تُنشر بعد", "Draft saved — not published yet"));
    if (ok) await loadDoc(key);
    return ok;
  };

  const publish = async () => {
    if (!value || !actor) return;
    if (dirty || !hasDraft) {
      if (!validate()) return;
      if (!(await run((_, a) => cmsRepo.saveDraft(key, value as never, a.role, a.id)))) return;
    }
    if (await run((_, a) => cmsRepo.publish(key, a.role, a.id), t("نُشر في الموقع", "Published to the site"))) {
      await loadDoc(key);
      await refreshSite();
    }
  };

  const discard = async () => {
    if (!window.confirm(t("حذف المسودة والعودة للنسخة المنشورة؟", "Delete the draft and return to the published version?"))) return;
    if (hasDraft && !(await run((_, a) => cmsRepo.discardDraft(key, a.role), t("حُذفت المسودة", "Draft deleted")))) return;
    await loadDoc(key);
  };

  const preview = async () => {
    if (dirty && !(await saveDraft(true))) return;
    setPreview(true);
    window.open(`${META[key].page}?cms_preview=1`, "_blank", "noopener");
  };

  const restore = async (v: Version) => {
    if (dirty && !window.confirm(t("ستُستبدل تعديلاتك غير المحفوظة. متابعة؟", "Your unsaved changes will be replaced. Continue?"))) return;
    if (await run((_, a) => cmsRepo.restore(v.id, a.role, a.id), t("استُرجعت النسخة كمسودة — راجعها ثم انشرها", "Version restored as a draft — review it, then publish"))) await loadDoc(key);
  };

  const status = useMemo(
    () =>
      CMS_KEYS.filter((k) => !actor || canEditKey(actor.role, k)).map((k) => ({
        k,
        draft: !!drafts?.drafts[k],
        published: !!snap?.published[k],
      })),
    [drafts, snap, actor],
  );

  return (
    <>
      <PageTitle
        title={t("محتوى الموقع", "Site content")}
        sub={t("عدّل، احفظ كمسودة، عاين في الموقع كما سيظهر، ثم انشر. كل نشر يُحفظ كنسخة يمكن استرجاعها.", "Edit, save a draft, preview it on the live site, then publish. Every publish is kept as a version you can restore.")}
      />
      <div className="grid xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-3 space-y-6">
        <nav aria-label={t("وثائق المحتوى", "Content documents")}>
          <ul className="grid sm:grid-cols-2 xl:grid-cols-1 gap-2">
            {status.map(({ k, draft, published }) => (
              <li key={k}>
                <button type="button" onClick={() => pickDoc(k)} aria-current={k === key ? "page" : undefined} className={`w-full text-start rounded-2xl border p-3 flex items-start gap-3 transition-colors ${k === key ? "border-ink-900 bg-white" : "border-paper-200 bg-white/60 hover:border-paper-400"}`}>
                  <i className={`${META[k].icon} text-lg text-ink-900 mt-0.5`} aria-hidden="true"></i>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink-900">{pick(META[k].label)}</span>
                    <span className="block text-[11px] text-paper-500 truncate">{pick(META[k].hint)}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {draft && <span className="rounded-full bg-accent2-soft text-accent2-ink px-2 py-0.5 text-[10px]">{t("مسودة غير منشورة", "Unpublished draft")}</span>}
                      {!published && <span className="rounded-full bg-paper-100 text-paper-600 px-2 py-0.5 text-[10px]">{t("المحتوى الأصلي", "Original content")}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <aside aria-labelledby="cms-versions">
          <Card className="p-5">
            <h2 id="cms-versions" className="text-sm text-ink-900 mb-3">{t("النسخ المنشورة", "Published versions")} <span className="font-mono text-xs text-paper-500">{num(versions.length)}</span></h2>
            {versions.length === 0 ? (
              <p className="text-xs text-paper-500">{t("لا نسخ بعد. كل نشر يُحفظ هنا (آخر 30).", "No versions yet. Each publish is kept here (last 30).")}</p>
            ) : (
              <ol className="space-y-2">
                {versions.map((v, i) => (
                  <li key={v.id} className="rounded-xl border border-paper-200 bg-white px-3 py-2 flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-ink-900">{f.riyadh(v.publishedAt)}{i === 0 && <span className="ms-1.5 rounded-full bg-[#E6F2EC] text-[#1F6B4F] px-1.5 py-0.5 text-[10px]">{t("الحالية", "Live")}</span>}</span>
                      <span className="block text-[11px] text-paper-500">{who(v.publishedBy)}</span>
                    </span>
                    {i > 0 && (
                      <button type="button" onClick={() => restore(v)} className="shrink-0 rounded-full border border-paper-300 px-2.5 py-1 text-[11px] text-ink-900 hover:border-ink-900">{t("استرجاع", "Restore")}</button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
        </div>

        <section className="xl:col-span-9 space-y-4 min-w-0" aria-labelledby="cms-doc">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 id="cms-doc" className="font-display text-xl text-ink-900">{pick(META[key].label)}</h2>
                <p className="mt-1 text-xs text-paper-500" data-testid="cms-status">
                  {dirty
                    ? t("تعديلات غير محفوظة", "Unsaved changes")
                    : hasDraft
                      ? t(`مسودة محفوظة ${f.ago(draftMeta!.at)} بواسطة ${who(draftMeta?.by)} — لم تُنشر`, `Draft saved ${f.ago(draftMeta!.at)} by ${who(draftMeta?.by)} — not published`)
                      : pubMeta
                        ? t(`منشور ${f.ago(pubMeta.at)} بواسطة ${who(pubMeta.by)}`, `Published ${f.ago(pubMeta.at)} by ${who(pubMeta.by)}`)
                        : t("المحتوى الأصلي للموقع — لم يُعدَّل بعد", "The site's original content — not edited yet")}
                </p>
              </div>
            </div>
            {value ? <DocEditor k={key} v={value as never} set={(v) => setValue(v)} /> : <div className="h-64 shimmer rounded-xl bg-paper-100" />}
            {errors.length > 0 && (
              <div role="alert" className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                {t("صحّح هذه الحقول قبل الحفظ:", "Fix these fields before saving:")} {errors.map((e) => (FIELD_LABELS[e] ? pick(FIELD_LABELS[e]) : e)).join("، ")}
              </div>
            )}
          </Card>
          <div className="sticky bottom-3 z-10 rounded-2xl bg-white/95 backdrop-blur border border-paper-200 shadow-lg p-3 flex flex-wrap items-center gap-2">
            <Btn onClick={publish} disabled={!value || (!dirty && !hasDraft)}>
              <i className="ri-upload-cloud-2-line" aria-hidden="true"></i>
              {t("نشر", "Publish")}
            </Btn>
            <Btn variant="secondary" onClick={() => void saveDraft()} disabled={!dirty}>{t("حفظ كمسودة", "Save draft")}</Btn>
            <Btn variant="secondary" onClick={preview} disabled={!value}>
              <i className="ri-eye-line" aria-hidden="true"></i>
              {t("معاينة في الموقع", "Preview on site")}
            </Btn>
            {(dirty || hasDraft) && <Btn variant="ghost" onClick={discard}>{t("تجاهل التعديلات", "Discard changes")}</Btn>}
          </div>
        </section>

      </div>
    </>
  );
}
