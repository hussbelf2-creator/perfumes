import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/hooks/useAuth";
import { useContent } from "@/cms/ContentProvider";
import { projectsRepo } from "@/projects/repo";
import { usePActor } from "@/projects/useProjects";
import type { Project, Quote } from "@/projects/types";
import { newContract } from "@/contracts/template";
import { editable, type Contract, type ContractDraft } from "@/contracts/types";
import { ContractDocument, ContractEditor, ContractStatusBadge, SignBox } from "@/contracts/components";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card } from "../components/ui";

// العقود في صفحة المشروع (الفريق): مسودة من القالب ← تحرير البنود والملحق ← إرسال للعميل ← توقيع الطرفين
const draftOf = (c: Contract): ContractDraft => ({ projectId: c.projectId, quoteId: c.quoteId, title: c.title, company: c.company, client: c.client, sections: c.sections, specs: c.specs });

export default function ContractsPanel({ project, contracts, quotes, clientName, manage, reload }: { project: Project; contracts: Contract[]; quotes: Quote[]; clientName: string; manage: boolean; reload: () => Promise<void> }) {
  const { t, num } = useI18n();
  const { run } = useCrm();
  const { can, user } = useAuth();
  const actor = usePActor();
  const site = useContent("site");
  // تحرير: عقد قائم (معرّفه) أو جديد (null)؛ undefined = لا تحرير
  const [editing, setEditing] = useState<{ id: string | null; v: ContractDraft } | undefined>();
  const [signing, setSigning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = contracts.filter((c) => c.status !== "void");
  const voided = contracts.filter((c) => c.status === "void");
  // العرض الأحدث المعتمد أو المدفوع أولاً، وإلا المرسل
  const quote = quotes.find((q) => q.status === "paid" || q.status === "accepted") ?? quotes.find((q) => q.status === "sent") ?? null;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      const done = await run(fn, ok);
      if (done) await reload();
      return done;
    } finally {
      setBusy(false);
    }
  };
  const save = async (send: boolean) => {
    if (!editing || !actor) return;
    const ok = await act(async () => {
      const c = await projectsRepo.saveContract(editing.v, editing.id, actor);
      // المحفوظة صارت مسودة قائمة: المحاولة التالية تعدّلها لا تنشئ أخرى
      setEditing((e) => (e ? { ...e, id: c.id } : e));
      if (send) await projectsRepo.sendContract(c.id, actor);
    }, send ? t("أُرسل العقد للعميل", "Contract sent to the client") : t("حُفظت مسودة العقد", "Contract draft saved"));
    // فشل الإرسال بعد الحفظ: نبقي المحرر على المسودة المحفوظة (لا مسودة ثانية)
    if (ok) setEditing(undefined);
    else await reload();
  };

  return (
    <Card className="p-5 mb-6">
      <div id="pj-contract" className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-xl text-ink-900">{t("العقود", "Contracts")}</h2>
        {manage && !editing && (
          <Btn variant="secondary" onClick={() => setEditing({ id: null, v: newContract({ project, quote, site, clientName }) })}>
            <i className="ri-file-text-line" aria-hidden="true"></i>
            {t("أنشئ عقداً", "Create contract")}
          </Btn>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          {!editing.id && quote && <p className="text-xs text-paper-500">{t(`القالب مملوء من عرض السعر ${quote.ref}: البنود والقيمة والأصناف. راجعها وعدّلها قبل الإرسال.`, `Pre-filled from quote ${quote.ref}: clauses, value and items. Review and edit before sending.`)}</p>}
          <ContractEditor v={editing.v} set={(v) => setEditing({ ...editing, v })} />
          <div className="flex flex-wrap gap-2 border-t border-paper-200 pt-4">
            <Btn onClick={() => save(true)} disabled={busy}>{t("احفظ وأرسل للعميل", "Save & send to client")}</Btn>
            <Btn variant="secondary" onClick={() => save(false)} disabled={busy}>{t("احفظ كمسودة", "Save draft")}</Btn>
            <Btn variant="ghost" onClick={() => setEditing(undefined)}>{t("إلغاء", "Cancel")}</Btn>
          </div>
        </div>
      ) : live.length === 0 ? (
        <p className="text-sm text-paper-500">{manage ? t("لا عقود بعد. أنشئ عقداً من القالب، أضف المواصفات والكميات والصور، ثم أرسله للعميل ليوقّع.", "No contracts yet. Create one from the template, add specifications, quantities and images, then send it for signature.") : t("لا عقود بعد.", "No contracts yet.")}</p>
      ) : (
        <div className="space-y-6">
          {live.map((c) => (
            <div key={c.id} data-contract={c.ref}>
              {c.status === "changes" && c.changeNote && (
                <p className="mb-3 rounded-xl bg-[#FBEFE6] text-[#9A4B12] px-4 py-3 text-sm" role="status">{t("طلب العميل تعديل العقد:", "The client asked for changes:")} «{c.changeNote}»</p>
              )}
              <ContractDocument
                c={c}
                actions={
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {manage && editable(c) && <Btn onClick={() => setEditing({ id: c.id, v: draftOf(c) })}>{t("حرّر العقد", "Edit contract")}</Btn>}
                      {manage && editable(c) && <Btn variant="secondary" disabled={busy} onClick={() => actor && act(() => projectsRepo.sendContract(c.id, actor), t("أُرسل العقد للعميل", "Contract sent to the client"))}>{c.status === "changes" ? t("أعد الإرسال", "Send again") : t("أرسل للعميل", "Send to client")}</Btn>}
                      {manage && c.status === "sent" && (
                        <Btn variant="secondary" disabled={busy} onClick={() => actor && window.confirm(t("إعادة العقد للتحرير؟ سيختفي من عند العميل حتى تعيد إرساله، ويُمسح توقيع المنشأة إن وُجد.", "Reopen for editing? The client won't see it until you send it again, and any company signature is cleared.")) && act(() => projectsRepo.reopenContract(c.id, actor), t("أُعيد العقد للتحرير", "Contract reopened for editing"))}>
                          {t("أعده للتحرير", "Reopen for editing")}
                        </Btn>
                      )}
                      {can("contracts.sign") && (c.status === "sent" || c.status === "client_signed") && !c.companySignature && signing !== c.id && (
                        <Btn variant="secondary" onClick={() => setSigning(c.id)}><i className="ri-quill-pen-line" aria-hidden="true"></i>{t("وقّع عن المنشأة", "Sign for the company")}</Btn>
                      )}
                      {(c.status === "signed" || c.status === "client_signed" || c.status === "sent") && (
                        <Link to={`/contract/${c.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full border border-paper-300 px-4 py-2 text-sm hover:border-ink-900">
                          <i className="ri-printer-line" aria-hidden="true"></i>{t("نسخة للطباعة / PDF", "Printable / PDF")}
                        </Link>
                      )}
                      {manage && c.status === "draft" && !c.sentAt && (
                        <Btn variant="danger" disabled={busy} onClick={() => actor && window.confirm(t(`حذف المسودة ${c.ref}؟`, `Delete draft ${c.ref}?`)) && act(() => projectsRepo.deleteContract(c.id, actor), t("حُذفت المسودة", "Draft deleted"))}>{t("احذف المسودة", "Delete draft")}</Btn>
                      )}
                      {manage && c.sentAt && (c.status !== "signed" || can("contracts.sign")) && (
                        <Btn variant="ghost" disabled={busy} onClick={() => actor && window.confirm(t(`إلغاء العقد ${c.ref}؟ يبقى في السجل ملغى ولا يُستعاد.`, `Void contract ${c.ref}? It stays on record as void and can't be restored.`)) && act(() => projectsRepo.voidContract(c.id, actor), t("أُلغي العقد", "Contract voided"))}>{t("ألغِ العقد", "Void contract")}</Btn>
                      )}
                    </div>
                    {signing === c.id && c.contentHash && (
                      <div className="rounded-xl border border-paper-200 p-4">
                        <SignBox
                          c={c}
                          side="company"
                          defaultName={c.company.representative || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
                          onSign={async (sig, name) => {
                            const ok = !!actor && (await act(() => projectsRepo.signContract(c.id, "company", sig, name, c.contentHash!, actor), t("وُقّع العقد عن المنشأة", "Signed for the company")));
                            if (ok) setSigning(null);
                            return ok;
                          }}
                        />
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          ))}
        </div>
      )}
      {voided.length > 0 && !editing && (
        <details className="mt-4 text-sm text-paper-600">
          <summary className="cursor-pointer">{t(`عقود ملغاة (${num(voided.length)})`, `Void contracts (${voided.length})`)}</summary>
          <ul className="mt-2 space-y-1">
            {voided.map((c) => <li key={c.id} className="flex items-center gap-2"><span className="font-mono" dir="ltr">{c.ref}</span> {c.title} <ContractStatusBadge c={c} /></li>)}
          </ul>
        </details>
      )}
    </Card>
  );
}
