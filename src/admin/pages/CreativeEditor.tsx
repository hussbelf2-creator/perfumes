import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n, type Bi } from "@/i18n/context";
import { creativesRepo, type Catalog } from "@/creatives/repo";
import { compressImage, MAX_IMAGES, storeImage } from "@/creatives/images";
import { validationText } from "@/creatives/messages";
import { CImg, Monogram } from "@/creatives/components/ui";
import { SPECIALTIES, SPECIALTY_ICONS, SPECIALTY_LABELS, slugify, type Creative, type NewCreative, type NewWork, type Work } from "@/creatives/types";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, Drawer, Empty, PageTitle, fieldCls } from "../components/ui";

const blank = (): NewCreative => ({
  slug: "",
  name: { ar: "", en: "" },
  title: { ar: "", en: "" },
  bio: { ar: "", en: "" },
  city: { ar: "", en: "" },
  specialties: [],
  yearsExp: 3,
  rateFrom: null,
  turnaroundDays: 14,
  avatar: null,
  available: true,
  featured: false,
  published: false,
  sample: false,
  profileId: null,
  sort: 10,
});
const strip = <T extends { id: string; createdAt: string; updatedAt: string }>(x: T): Omit<T, "id" | "createdAt" | "updatedAt"> => {
  const { id, createdAt, updatedAt, ...rest } = x;
  void id;
  void createdAt;
  void updatedAt;
  return rest;
};

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-paper-500 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-paper-400">{hint}</span>}
    </label>
  );
}

/** حقل بلغتين: العربية مطلوبة، والإنجليزية اختيارية (تُستخدم العربية بديلاً) */
function BiField({ label, value, onChange, multiline, max }: { label: string; value: Bi; onChange: (v: Bi) => void; multiline?: boolean; max: number }) {
  const { t } = useI18n();
  const El = multiline ? "textarea" : "input";
  return (
    <fieldset className="grid sm:grid-cols-2 gap-3">
      <legend className="sr-only">{label}</legend>
      {(["ar", "en"] as const).map((l) => (
        <Field key={l} label={`${label} · ${l === "ar" ? t("عربي", "Arabic") : t("إنجليزي", "English")}`}>
          <El
            value={value[l]}
            dir={l === "ar" ? "rtl" : "ltr"}
            maxLength={max}
            rows={multiline ? 5 : undefined}
            onChange={(e: { target: { value: string } }) => onChange({ ...value, [l]: e.target.value })}
            className={`${fieldCls} ${multiline ? "resize-y" : ""}`}
          />
        </Field>
      ))}
    </fieldset>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl bg-white border border-paper-200 px-4 py-3 cursor-pointer">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-ink-900" />
      <span>
        <span className="block text-sm text-ink-900">{label}</span>
        {hint && <span className="block text-[11px] text-paper-500 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

/** رفع صور متعددة: سحب وإفلات أو اختيار، تصغير في المتصفح، ترتيب، وتعيين الغلاف */
function ImagePicker({ images, onChange, folder }: { images: string[]; onChange: (v: string[]) => void; folder: string }) {
  const { t, num } = useI18n();
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(images);
  latest.current = images;

  const add = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, Math.max(0, MAX_IMAGES - latest.current.length));
    if (!list.length) {
      setErr(validationText("too_many_images", t));
      return;
    }
    setErr("");
    setBusy(list.length);
    for (const f of list) {
      try {
        const url = await storeImage(await compressImage(f), folder);
        latest.current = [...latest.current, url];
        onChange(latest.current);
      } catch (e) {
        setErr(validationText(e instanceof Error ? e.message : "upload_failed", t));
      }
      setBusy((n) => n - 1);
    }
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void add(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${over ? "border-ink-900 bg-white" : "border-paper-300 bg-paper-50"}`}
      >
        <i className="ri-image-add-line text-2xl text-paper-500" aria-hidden="true"></i>
        <p className="mt-1 text-sm text-paper-600">{t("اسحب الصور هنا أو", "Drop images here or")}</p>
        <button type="button" onClick={() => input.current?.click()} disabled={images.length >= MAX_IMAGES} className="mt-2 rounded-full bg-ink-900 text-white px-4 py-2 text-sm disabled:opacity-50">
          {t("اختر صوراً", "Choose images")}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label={t("صور العمل", "Work images")}
          onChange={(e) => {
            if (e.target.files) void add(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-[11px] text-paper-400">{t(`حتى ${num(MAX_IMAGES)} صورة · تُصغَّر تلقائياً إلى 1600 بكسل`, `Up to ${MAX_IMAGES} images · auto-resized to 1600 px`)}</p>
      </div>
      {busy > 0 && <p className="mt-2 text-xs text-paper-600" role="status">{t(`جاري رفع ${num(busy)}…`, `Uploading ${busy}…`)}</p>}
      {err && <p className="mt-2 text-xs text-red-700" role="alert">{err}</p>}
      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2" aria-label={t("الصور المرفوعة", "Uploaded images")}>
          {images.map((src, i) => (
            <li key={src} className="relative rounded-xl overflow-hidden border border-paper-200 bg-white">
              <CImg src={src} alt={t(`صورة ${num(i + 1)}`, `Image ${i + 1}`)} className="aspect-square" />
              {i === 0 && <span className="absolute top-1.5 start-1.5 rounded-full bg-ink-900 text-white px-2 py-0.5 text-[10px]">{t("الغلاف", "Cover")}</span>}
              <div className="absolute bottom-1 inset-x-1 flex justify-between gap-1">
                <span className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-full bg-white/90 text-ink-900 disabled:opacity-30" aria-label={t(`قدّم الصورة ${num(i + 1)}`, `Move image ${i + 1} earlier`)}>
                    <i className="ri-arrow-right-s-line inline-block flip-ltr" aria-hidden="true"></i>
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="w-7 h-7 rounded-full bg-white/90 text-ink-900 disabled:opacity-30" aria-label={t(`أخّر الصورة ${num(i + 1)}`, `Move image ${i + 1} later`)}>
                    <i className="ri-arrow-left-s-line inline-block flip-ltr" aria-hidden="true"></i>
                  </button>
                </span>
                <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))} className="w-7 h-7 rounded-full bg-white/90 text-red-700" aria-label={t(`احذف الصورة ${num(i + 1)}`, `Remove image ${i + 1}`)}>
                  <i className="ri-delete-bin-line" aria-hidden="true"></i>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkForm({ creative, work, onDone }: { creative: Creative; work: Work | null; onDone: (saved: boolean) => void }) {
  const { t, pick } = useI18n();
  const { run } = useCrm();
  const [d, setD] = useState<NewWork>(() =>
    work
      ? strip(work)
      : { creativeId: creative.id, title: { ar: "", en: "" }, summary: { ar: "", en: "" }, category: creative.specialties[0] ?? "identity", images: [], client: null, concept: false, year: new Date().getFullYear(), published: true, sort: 10 },
  );
  const set = (p: Partial<NewWork>) => setD((x) => ({ ...x, ...p }));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (await run((_, a) => creativesRepo.saveWork(d, work?.id ?? null, a.role), work ? t("حُفظ العمل", "Work saved") : t("أُضيف العمل", "Work added"))) onDone(true);
  };
  return (
    <form onSubmit={save} className="p-6 space-y-5">
      <ImagePicker images={d.images} onChange={(images) => set({ images })} folder={`works/${creative.id}`} />
      <BiField label={t("العنوان", "Title")} value={d.title} onChange={(title) => set({ title })} max={120} />
      <BiField label={t("وصف قصير", "Short description")} value={d.summary} onChange={(summary) => set({ summary })} multiline max={600} />
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("التصنيف", "Category")}>
          <select value={d.category} onChange={(e) => set({ category: e.target.value as NewWork["category"] })} className={fieldCls}>
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>{pick(SPECIALTY_LABELS[s])}</option>
            ))}
          </select>
        </Field>
        <Field label={t("السنة", "Year")}>
          <input type="number" min={1990} max={2100} value={d.year} onChange={(e) => set({ year: Number(e.target.value) })} className={fieldCls} />
        </Field>
      </div>
      <Toggle label={t("مشروع تصوّري (ليس لعميل فعلي)", "Concept project (not for a real client)")} checked={d.concept} onChange={(concept) => set({ concept, client: concept ? null : d.client })} hint={t("يظهر للزائر بوضوح — الصدق في المعرض يبني الثقة.", "Shown clearly to visitors — an honest portfolio builds trust.")} />
      {!d.concept && (
        <Field label={t("اسم العميل/البراند (اختياري، بإذنه)", "Client / brand (optional, with permission)")}>
          <input value={d.client ?? ""} maxLength={80} onChange={(e) => set({ client: e.target.value || null })} className={fieldCls} />
        </Field>
      )}
      <Toggle label={t("منشور في الموقع", "Published on the site")} checked={d.published} onChange={(published) => set({ published })} />
      <div className="flex justify-end gap-2 pt-2">
        <Btn variant="ghost" type="button" onClick={() => onDone(false)}>{t("إلغاء", "Cancel")}</Btn>
        <Btn type="submit" disabled={!d.images.length || !d.title.ar.trim()}>{work ? t("حفظ العمل", "Save work") : t("إضافة العمل", "Add work")}</Btn>
      </div>
    </form>
  );
}

export default function CreativeEditor() {
  const { id = "new" } = useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const { t, pick, num } = useI18n();
  const { run, data: crm } = useCrm();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [d, setD] = useState<NewCreative | null>(isNew ? blank() : null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [editing, setEditing] = useState<Work | "new" | null>(null);
  const [avatarErr, setAvatarErr] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const c = await creativesRepo.listAll();
    setCat(c);
    return c;
  }, []);
  useEffect(() => {
    void load().then((c) => {
      if (isNew) return;
      const found = c.creatives.find((x) => x.id === id);
      setD(found ? strip(found) : null);
    });
  }, [id, isNew, load]);

  const creative = cat?.creatives.find((x) => x.id === id);
  const works = cat?.works.filter((w) => w.creativeId === id) ?? [];
  if (cat && !isNew && !creative)
    return (
      <Card>
        <Empty icon="ri-user-unfollow-line" title={t("لم نجد هذا المصمم", "Creative not found")} hint={t("ربما حُذف.", "It may have been deleted.")} />
      </Card>
    );
  if (!d) return <div className="h-48 rounded-2xl shimmer bg-paper-100" />;

  const set = (p: Partial<NewCreative>) => setD((x) => (x ? { ...x, ...p } : x));
  const setName = (name: Bi) => set({ name, ...(slugTouched ? {} : { slug: slugify(name.en) }) });
  const designers = crm?.team.filter((m) => m.active && m.role === "designer") ?? [];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    let saved: Creative | null = null;
    const ok = await run(async (_, a) => {
      saved = await creativesRepo.saveCreative(d, isNew ? null : id, a.role);
    }, isNew ? t("أُضيف المصمم. أضف أعماله الآن.", "Creative added. Add their work now.") : t("حُفظ الملف", "Profile saved"));
    if (!ok || !saved) return;
    if (isNew) nav(`/admin/creatives/${(saved as Creative).id}`, { replace: true });
    else await load();
  };
  const remove = async () => {
    if (!window.confirm(t(`حذف ${pick(d.name)} وكل أعماله نهائياً؟`, `Delete ${pick(d.name)} and all their work permanently?`))) return;
    if (await run((_, a) => creativesRepo.removeCreative(id, a.role), t("حُذف المصمم", "Creative deleted"))) nav("/admin/creatives", { replace: true });
  };
  const removeWork = async (w: Work) => {
    if (!window.confirm(t(`حذف «${pick(w.title)}»؟`, `Delete “${pick(w.title)}”?`))) return;
    if (await run((_, a) => creativesRepo.removeWork(w.id, a.role), t("حُذف العمل", "Work deleted"))) await load();
  };
  const toggleWork = async (w: Work) => {
    if (await run((_, a) => creativesRepo.saveWork({ ...strip(w), published: !w.published }, w.id, a.role), w.published ? t("أُخفي العمل", "Work hidden") : t("نُشر العمل", "Work published"))) await load();
  };
  const pickAvatar = async (f: File) => {
    setAvatarErr("");
    try {
      set({ avatar: await storeImage(await compressImage(f, 600), "avatars") });
    } catch (e) {
      setAvatarErr(validationText(e instanceof Error ? e.message : "upload_failed", t));
    }
  };

  return (
    <>
      <Link to="/admin/creatives" className="inline-flex items-center gap-2 text-sm text-paper-600 hover:text-ink-900 mb-3">
        <i className="ri-arrow-right-line inline-block flip-ltr" aria-hidden="true"></i>
        {t("كل المبدعين", "All creatives")}
      </Link>
      <PageTitle
        title={isNew ? t("مصمم جديد", "New creative") : pick(d.name) || t("بلا اسم", "Untitled")}
        actions={
          !isNew && creative ? (
            <a href={`/creatives/${creative.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm text-ink-900 hover:border-ink-900">
              <i className="ri-external-link-line" aria-hidden="true"></i>
              {t("عرض الملف", "View profile")}
            </a>
          ) : undefined
        }
      />

      <div className="grid xl:grid-cols-12 gap-6 items-start">
        <form onSubmit={save} className="xl:col-span-7 space-y-5">
          <Card className="p-5 space-y-5" title={t("الملف الشخصي", "Profile")}>
            <div className="flex items-center gap-4">
              <Monogram creative={{ name: d.name.ar ? d.name : { ar: "؟", en: "?" }, avatar: d.avatar }} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => avatarInput.current?.click()} className="rounded-full border border-paper-300 bg-white px-3 py-1.5 text-xs text-ink-900 hover:border-ink-900">
                  {d.avatar ? t("تغيير الصورة", "Change photo") : t("رفع صورة شخصية", "Upload photo")}
                </button>
                {d.avatar && (
                  <button type="button" onClick={() => set({ avatar: null })} className="rounded-full px-3 py-1.5 text-xs text-red-700">{t("إزالة", "Remove")}</button>
                )}
                <input ref={avatarInput} type="file" accept="image/*" className="sr-only" aria-label={t("الصورة الشخصية", "Profile photo")} onChange={(e) => e.target.files?.[0] && void pickAvatar(e.target.files[0])} />
              </div>
              {avatarErr && <p className="text-xs text-red-700" role="alert">{avatarErr}</p>}
            </div>
            <BiField label={t("الاسم", "Name")} value={d.name} onChange={setName} max={80} />
            <Field label={t("رابط الملف", "Profile link")} hint={t("حروف إنجليزية صغيرة وأرقام وشرطات — يُقترح من الاسم الإنجليزي.", "Lowercase letters, numbers and hyphens — suggested from the English name.")}>
              <div className="flex items-center gap-2" dir="ltr">
                <span className="text-xs text-paper-500 font-mono shrink-0">/creatives/</span>
                <input
                  value={d.slug}
                  maxLength={48}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
                  }}
                  className={`${fieldCls} font-mono`}
                  aria-label={t("رابط الملف", "Profile link")}
                />
              </div>
            </Field>
            <BiField label={t("المسمّى", "Title")} value={d.title} onChange={(title) => set({ title })} max={120} />
            <BiField label={t("المدينة", "City")} value={d.city} onChange={(city) => set({ city })} max={60} />
            <BiField label={t("نبذة", "Bio")} value={d.bio} onChange={(bio) => set({ bio })} multiline max={1200} />
          </Card>

          <Card className="p-5 space-y-4" title={t("التخصصات والأسعار", "Specialties & pricing")}>
            <div role="group" aria-label={t("التخصصات", "Specialties")} className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => {
                const on = d.specialties.includes(s);
                return (
                  <button key={s} type="button" aria-pressed={on} onClick={() => set({ specialties: on ? d.specialties.filter((x) => x !== s) : [...d.specialties, s] })} className={`rounded-full px-3 py-1.5 text-xs border inline-flex items-center gap-1.5 ${on ? "bg-ink-900 text-white border-ink-900" : "bg-white border-paper-200 text-paper-700"}`}>
                    <i className={SPECIALTY_ICONS[s]} aria-hidden="true"></i>
                    {pick(SPECIALTY_LABELS[s])}
                  </button>
                );
              })}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label={t("سنوات الخبرة", "Years of experience")}>
                <input type="number" min={0} max={60} value={d.yearsExp} onChange={(e) => set({ yearsExp: Number(e.target.value) })} className={fieldCls} />
              </Field>
              <Field label={t("يبدأ من (ر.س)", "From (SAR)")}>
                <input type="number" min={0} step={500} value={d.rateFrom ?? ""} onChange={(e) => set({ rateFrom: e.target.value === "" ? null : Number(e.target.value) })} className={fieldCls} />
              </Field>
              <Field label={t("مدة التسليم (أيام)", "Turnaround (days)")}>
                <input type="number" min={1} max={365} value={d.turnaroundDays ?? ""} onChange={(e) => set({ turnaroundDays: e.target.value === "" ? null : Number(e.target.value) })} className={fieldCls} />
              </Field>
            </div>
          </Card>

          <Card className="p-5 space-y-3" title={t("الظهور", "Visibility")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Toggle label={t("منشور في الموقع", "Published on the site")} checked={d.published} onChange={(published) => set({ published })} />
              <Toggle label={t("متاح لمشاريع جديدة", "Taking new projects")} checked={d.available} onChange={(available) => set({ available })} />
              <Toggle label={t("مميّز (يظهر أولاً)", "Featured (shown first)")} checked={d.featured} onChange={(featured) => set({ featured })} />
              <Toggle label={t("ملف توضيحي", "Sample profile")} checked={d.sample} onChange={(sample) => set({ sample })} hint={t("ليس مصمماً متعاقداً — يرى الزائر شارة توضيحية.", "Not a contracted creative — visitors see a sample badge.")} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("حساب الفريق المرتبط", "Linked team account")} hint={t("مصمم من الفريق — لربط المشاريع به لاحقاً.", "A designer on the team — to link projects later.")}>
                <select value={d.profileId ?? ""} onChange={(e) => set({ profileId: e.target.value || null })} className={fieldCls}>
                  <option value="">{t("بلا ربط (مصمم مستقل)", "Not linked (freelancer)")}</option>
                  {designers.map((m) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("الترتيب", "Order")}>
                <input type="number" value={d.sort} onChange={(e) => set({ sort: Number(e.target.value) })} className={fieldCls} />
              </Field>
            </div>
          </Card>

          <div className="flex flex-wrap justify-between gap-3">
            {!isNew ? (
              <Btn variant="danger" type="button" onClick={remove}>
                <i className="ri-delete-bin-line" aria-hidden="true"></i>
                {t("حذف المصمم", "Delete creative")}
              </Btn>
            ) : <span />}
            <Btn type="submit">{isNew ? t("إنشاء الملف", "Create profile") : t("حفظ الملف", "Save profile")}</Btn>
          </div>
        </form>

        <section className="xl:col-span-5 xl:sticky xl:top-6" aria-labelledby="ed-works">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 id="ed-works" className="text-sm text-ink-900">
                {t("الأعمال", "Work")} <span className="font-mono text-xs text-paper-500">{num(works.length)}</span>
              </h2>
              {!isNew && creative && (
                <Btn type="button" onClick={() => setEditing("new")}>
                  <i className="ri-add-line" aria-hidden="true"></i>
                  {t("عمل جديد", "New work")}
                </Btn>
              )}
            </div>
            {isNew ? (
              <p className="text-sm text-paper-500">{t("أنشئ الملف أولاً ثم أضف أعماله.", "Create the profile first, then add work.")}</p>
            ) : works.length === 0 ? (
              <Empty icon="ri-gallery-line" title={t("لا أعمال بعد", "No work yet")} hint={t("أضف عملاً بصورة واحدة على الأقل.", "Add a work with at least one image.")} />
            ) : (
              <ul className="space-y-2">
                {works.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 rounded-xl border border-paper-200 bg-white p-2">
                    <CImg src={w.images[0]} alt="" className="w-16 h-16 rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-900 truncate">{pick(w.title)}</p>
                      <p className="text-[11px] text-paper-500">
                        {pick(SPECIALTY_LABELS[w.category])} · {w.year} · {t(`${num(w.images.length)} صور`, `${w.images.length} images`)}
                        {w.concept ? ` · ${t("تصوّري", "Concept")}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => toggleWork(w)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${w.published ? "bg-[#E6F2EC] text-[#1F6B4F]" : "bg-paper-100 text-paper-600"}`} aria-label={w.published ? t(`إخفاء «${pick(w.title)}»`, `Hide “${pick(w.title)}”`) : t(`نشر «${pick(w.title)}»`, `Publish “${pick(w.title)}”`)}>
                      {w.published ? t("منشور", "Live") : t("مخفي", "Hidden")}
                    </button>
                    <button type="button" onClick={() => setEditing(w)} className="w-8 h-8 rounded-full hover:bg-paper-100 shrink-0" aria-label={t(`تعديل «${pick(w.title)}»`, `Edit “${pick(w.title)}”`)}>
                      <i className="ri-edit-line" aria-hidden="true"></i>
                    </button>
                    <button type="button" onClick={() => removeWork(w)} className="w-8 h-8 rounded-full hover:bg-paper-100 text-red-700 shrink-0" aria-label={t(`حذف «${pick(w.title)}»`, `Delete “${pick(w.title)}”`)}>
                      <i className="ri-delete-bin-line" aria-hidden="true"></i>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {creative && (
        <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? t("عمل جديد", "New work") : t("تعديل العمل", "Edit work")}>
          <header className="sticky top-0 z-10 bg-paper-50/95 backdrop-blur border-b border-paper-200 px-6 py-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-ink-900">{editing === "new" ? t("عمل جديد", "New work") : t("تعديل العمل", "Edit work")}</h2>
            <button type="button" onClick={() => setEditing(null)} className="w-9 h-9 rounded-full hover:bg-paper-100" aria-label={t("إغلاق", "Close")}>
              <i className="ri-close-line text-lg" aria-hidden="true"></i>
            </button>
          </header>
          {editing !== null && (
            <WorkForm
              key={editing === "new" ? "new" : editing.id}
              creative={creative}
              work={editing === "new" ? null : editing}
              onDone={(saved) => {
                setEditing(null);
                if (saved) void load();
              }}
            />
          )}
        </Drawer>
      )}
    </>
  );
}
