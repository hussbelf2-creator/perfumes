import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { projectsRepo } from "@/projects/repo";
import { usePActor } from "@/projects/useProjects";
import type { Contract } from "@/contracts/types";
import { ContractDocument } from "@/contracts/components";

// نسخة العقد للطباعة أو الحفظ PDF (من نافذة الطباعة في المتصفح) — لمن يرى المشروع فقط
export default function ContractPrintPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const actor = usePActor();
  const [c, setC] = useState<Contract | null | undefined>();
  useEffect(() => {
    if (!actor) return;
    void projectsRepo
      .load(actor)
      .then((d) => setC(d.contracts.find((x) => x.id === id) ?? null))
      .catch(() => setC(null));
  }, [actor, id]);
  useEffect(() => {
    if (c) document.title = `${c.ref} · ${c.title}`;
  }, [c]);
  return (
    <div className="min-h-screen bg-paper-50 print:bg-white">
      <div className="max-w-4xl mx-auto px-4 py-6 print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link to={c ? (actor?.role === "client" ? `/account/projects/${c.projectId}#pj-contract` : `/admin/projects/${c.projectId}`) : "/"} className="text-sm text-paper-600 underline underline-offset-4">{t("رجوع", "Back")}</Link>
          {c && (
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-ink-900 text-white px-5 py-2.5 text-sm">
              <i className="ri-printer-line" aria-hidden="true"></i>{t("اطبع أو احفظ PDF", "Print or save as PDF")}
            </button>
          )}
        </div>
        {c === undefined ? (
          <div className="h-64 rounded-2xl shimmer bg-paper-100" />
        ) : c === null ? (
          <p className="rounded-2xl bg-white border border-paper-200 p-8 text-center text-paper-600">{t("لم نجد هذا العقد في حسابك.", "This contract isn't in your account.")}</p>
        ) : (
          <ContractDocument c={c} />
        )}
      </div>
    </div>
  );
}
