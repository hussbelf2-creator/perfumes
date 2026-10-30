import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { studioRepo } from "@/studio/repo";
import ProfileIcon from "@/studio/ProfileIcon";
import { estimateCapacityMl } from "@/studio/profile";
import type { PackKind, PackModel } from "@/studio/types";
import type { Role } from "@/lib/rbac";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, Empty, PageTitle } from "../components/ui";

export default function Studio() {
  const { t, pick, num } = useI18n();
  const { run } = useCrm();
  const [kind, setKind] = useState<PackKind>("bottle");
  const [items, setItems] = useState<PackModel[] | null>(null);

  const load = useCallback(() => studioRepo.listAll().then(setItems), []);
  useEffect(() => {
    void load();
  }, [load]);

  const list = items?.filter((m) => m.kind === kind) ?? [];
  const mutate = async (fn: (role: Role) => Promise<unknown>, ok: string) => {
    if (await run((_, a) => fn(a.role), ok)) await load();
  };

  return (
    <>
      <PageTitle
        title={t("استوديو العبوات", "Packaging studio")}
        sub={t("حوّل صور العبوات والأغطية إلى نماذج ثلاثية الأبعاد يراها العملاء في استوديو 3D.", "Turn bottle and cap photos into 3D models clients see in the 3D studio.")}
        actions={
          <>
            <a href="/studio-3d" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm text-ink-900 hover:border-ink-900">
              <i className="ri-external-link-line" aria-hidden="true"></i>
              {t("معاينة كما يراها العميل", "Preview as a client")}
            </a>
            <Link to="/admin/studio/ai" className="inline-flex items-center gap-2 rounded-full bg-accent2 text-white px-4 py-2 text-sm hover:opacity-90">
              <i className="ri-sparkling-2-line" aria-hidden="true"></i>
              {t("منتج من صورة بالذكاء الاصطناعي", "Product from photo with AI")}
            </Link>
            <Link to={`/admin/studio/new?kind=${kind}`} className="inline-flex items-center gap-2 rounded-full bg-ink-900 text-white px-4 py-2 text-sm hover:bg-ink-700">
              <i className="ri-image-add-line" aria-hidden="true"></i>
              {kind === "bottle" ? t("عبوة جديدة من صورة", "New bottle from photo") : t("غطاء جديد من صورة", "New cap from photo")}
            </Link>
          </>
        }
      />

      <div className="inline-flex rounded-full bg-paper-100 p-1 mb-4" role="tablist" aria-label={t("النوع", "Type")}>
        {(["bottle", "cap"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-full px-5 py-1.5 text-sm ${kind === k ? "bg-white text-ink-900 shadow-sm" : "text-paper-600"}`}>
            {k === "bottle" ? t("العبوات", "Bottles") : t("الأغطية", "Caps")}
            <span className="ms-2 font-mono text-xs text-paper-500">{num(items?.filter((m) => m.kind === k).length ?? 0)}</span>
          </button>
        ))}
      </div>

      {!items ? (
        <div className="h-48 rounded-2xl shimmer bg-paper-100" />
      ) : list.length === 0 ? (
        <Card>
          <Empty icon="ri-box-3-line" title={t("لا نماذج بعد", "No models yet")} hint={t("ابدأ برفع صورة أمامية على خلفية فاتحة.", "Start by uploading a front photo on a light background.")} />
        </Card>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {list.map((m) => {
            const brim = m.kind === "bottle" ? estimateCapacityMl(m.profile, { squareness: m.squareness, depthRatio: m.depthRatio, neckMm: m.neckMm }) : 0;
            return (
              <li key={m.id} className="rounded-2xl bg-white border border-paper-200 overflow-hidden flex flex-col">
                <Link to={`/admin/studio/${m.id}`} className="block bg-[#F3F1EC] p-4 h-40" aria-label={t(`تعديل ${pick(m.name)}`, `Edit ${pick(m.name)}`)}>
                  {m.thumb && m.kind === "bottle" ? <img src={m.thumb} alt="" className="h-full w-full object-contain" /> : <ProfileIcon model={m} className="h-full w-full text-ink-900" />}
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-sm text-ink-900 flex items-center gap-2">
                    {pick(m.name)}
                    {m.source === "ai" && <span className="rounded-full bg-accent2-soft text-accent2-ink px-2 py-0.5 text-[10px]">AI</span>}
                  </p>
                  <p className="mt-1 text-xs text-paper-500">
                    {m.kind === "bottle"
                      ? t(`${num(m.capacityMl ?? 0)} مل · حتى الحافة ≈ ${num(brim)} · ${num(m.heightMm)} مم`, `${m.capacityMl ?? 0} ml · brimful ≈ ${brim} · ${m.heightMm} mm`)
                      : t(`${num(m.heightMm)} مم`, `${m.heightMm} mm`)}
                  </p>
                  <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-paper-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.published}
                        onChange={(e) => mutate((role) => studioRepo.update(m.id, { published: e.target.checked }, role), e.target.checked ? t("نُشر للعملاء", "Published") : t("أُخفي عن العملاء", "Hidden from clients"))}
                        className="w-4 h-4 accent-ink-900"
                      />
                      {t("منشور", "Published")}
                    </label>
                    <Btn
                      variant="ghost"
                      className="!px-2 !py-1 text-xs"
                      onClick={() => {
                        if (window.confirm(t(`حذف «${pick(m.name)}» نهائياً؟`, `Delete “${pick(m.name)}” permanently?`))) void mutate((role) => studioRepo.remove(m.id, role), t("حُذف النموذج", "Model deleted"));
                      }}
                    >
                      <i className="ri-delete-bin-line" aria-hidden="true"></i>
                      <span className="sr-only">{t("حذف", "Delete")}</span>
                    </Btn>
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
