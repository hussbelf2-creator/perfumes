import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { creativesRepo, type Catalog } from "@/creatives/repo";
import { CImg, Monogram } from "@/creatives/components/ui";
import { SPECIALTY_LABELS, type Creative } from "@/creatives/types";
import { useCrm } from "../data/CrmProvider";
import { Card, Empty, PageTitle } from "../components/ui";

const pill = (on: boolean) => `rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-[#E6F2EC] text-[#1F6B4F]" : "bg-paper-100 text-paper-600"}`;

export default function Creatives() {
  const { t, pick, num } = useI18n();
  const { run } = useCrm();
  const [cat, setCat] = useState<Catalog | null>(null);
  const load = useCallback(() => creativesRepo.listAll().then(setCat), []);
  useEffect(() => {
    void load();
  }, [load]);

  const togglePublish = async (c: Creative) => {
    const { id, createdAt, updatedAt, ...rest } = c;
    void createdAt;
    void updatedAt;
    if (await run((_, a) => creativesRepo.saveCreative({ ...rest, published: !c.published }, id, a.role), c.published ? t("أُخفي الملف من الموقع", "Profile hidden from the site") : t("نُشر الملف في الموقع", "Profile published"))) await load();
  };

  return (
    <>
      <PageTitle
        title={t("استوديو المبدعين", "Creative studio")}
        sub={t("ملفات المصممين وأعمالهم كما تظهر في /creatives. طلبات العملاء تصل إلى صندوق الوارد (تبويب «تصميم»).", "Creative profiles and their work as shown on /creatives. Client briefs arrive in the inbox (Design tab).")}
        actions={
          <>
            <a href="/creatives" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm text-ink-900 hover:border-ink-900">
              <i className="ri-external-link-line" aria-hidden="true"></i>
              {t("معاينة كما يراها العميل", "Preview as a client")}
            </a>
            <Link to="/admin/creatives/new" className="inline-flex items-center gap-2 rounded-full bg-ink-900 text-white px-4 py-2 text-sm hover:bg-ink-700">
              <i className="ri-user-add-line" aria-hidden="true"></i>
              {t("مصمم جديد", "New creative")}
            </Link>
          </>
        }
      />
      {!cat ? (
        <div className="h-48 rounded-2xl shimmer bg-paper-100" />
      ) : cat.creatives.length === 0 ? (
        <Card>
          <Empty icon="ri-palette-line" title={t("لا مصممين بعد", "No creatives yet")} hint={t("أضف أول مصمم ثم أعماله، وانشره ليظهر في الموقع.", "Add your first creative and their work, then publish to show it on the site.")} />
        </Card>
      ) : (
        <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cat.creatives.map((c) => {
            const works = cat.works.filter((w) => w.creativeId === c.id);
            const live = works.filter((w) => w.published).length;
            return (
              <li key={c.id} className="rounded-2xl bg-white border border-paper-200 overflow-hidden flex flex-col">
                <Link to={`/admin/creatives/${c.id}`} className="grid grid-cols-4 gap-0.5 h-24 bg-paper-100" aria-label={t(`تعديل ${pick(c.name)}`, `Edit ${pick(c.name)}`)}>
                  {[0, 1, 2, 3].map((k) => (works[k] ? <CImg key={k} src={works[k].images[0]} alt="" className="h-full" /> : <span key={k} className="bg-sand-soft" />))}
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start gap-3">
                    <Monogram creative={c} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/admin/creatives/${c.id}`} className="block text-sm text-ink-900 hover:underline truncate">{pick(c.name)}</Link>
                      <p className="text-xs text-paper-500 truncate">{c.specialties.map((s) => pick(SPECIALTY_LABELS[s])).join(" · ")}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={pill(c.published)}>{c.published ? t("منشور", "Published") : t("مسودة", "Draft")}</span>
                    {c.featured && <span className={pill(true)}>{t("مميّز", "Featured")}</span>}
                    {c.sample && <span className={pill(false)}>{t("توضيحي", "Sample")}</span>}
                    {!c.available && <span className={pill(false)}>{t("محجوز", "Booked")}</span>}
                    <span className={pill(false)}>{t(`${num(live)}/${num(works.length)} أعمال منشورة`, `${live}/${works.length} works live`)}</span>
                  </div>
                  <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                    <a href={`/creatives/${c.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-paper-500 hover:text-ink-900 font-mono truncate" dir="ltr">/creatives/{c.slug}</a>
                    <button type="button" onClick={() => togglePublish(c)} className="shrink-0 rounded-full border border-paper-300 px-3 py-1.5 text-xs text-ink-900 hover:border-ink-900">
                      {c.published ? t("إخفاء", "Unpublish") : t("نشر", "Publish")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
