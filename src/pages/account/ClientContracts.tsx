import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { projectsRepo, type PActor } from "@/projects/repo";
import type { Contract } from "@/contracts/types";
import { ContractDocument, SignBox } from "@/contracts/components";

const btn = "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors disabled:opacity-50";
const field = "w-full bg-white border border-paper-200 focus:border-ink-900 rounded-xl px-4 py-3 text-ink-900 outline-none";

// العقد عند العميل: يقرؤه مع ملحق المواصفات وصوره، ثم يوقّع أو يطلب تعديلاً؛ ونسخة للطباعة بعد التوقيع
function ClientContract({ c, run, defaultName }: { c: Contract; run: (fn: (a: PActor) => Promise<unknown>, ok?: string) => Promise<boolean>; defaultName: string }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"idle" | "sign" | "changes">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const noteId = useId();
  const waiting = c.status === "sent" && !c.clientSignature;
  return (
    <ContractDocument
      c={c}
      actions={
        <div className="space-y-4">
          {c.status === "changes" && <p className="text-sm text-paper-600" role="status">{t("وصل طلب التعديل للفريق؛ سيصلك العقد المحدّث هنا.", "Your change request reached the team; the updated contract will arrive here.")}</p>}
          {c.status === "client_signed" && <p className="text-sm text-[#1F6B4F]" role="status">{t("وقّعت العقد. بانتظار توقيع المصنع، وسنخبرك عند اكتماله.", "You signed. Awaiting the manufacturer's signature — we'll let you know.")}</p>}
          {c.status === "signed" && <p className="text-sm text-[#1F6B4F]" role="status">{t("اكتمل توقيع العقد من الطرفين.", "The contract is signed by both parties.")}</p>}
          {waiting && mode === "idle" && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode("sign")} className={`${btn} bg-[#1F6B4F] text-white`}>{t("راجعت العقد — أوقّع", "I've reviewed it — sign")}</button>
              <button type="button" onClick={() => setMode("changes")} className={`${btn} border border-paper-300 text-ink-900 hover:border-ink-900`}>{t("طلب تعديل", "Request changes")}</button>
            </div>
          )}
          {waiting && mode === "sign" && c.contentHash && (
            <SignBox c={c} side="client" defaultName={c.client.representative || defaultName} onSign={(sig, name) => run((a) => projectsRepo.signContract(c.id, "client", sig, name, c.contentHash!, a), t("وُقّع العقد — شكراً لك", "Contract signed — thank you"))} />
          )}
          {waiting && mode === "changes" && (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                const ok = await run((a) => projectsRepo.contractChanges(c.id, note, a), t("وصل طلبك للفريق", "Your request reached the team")).finally(() => setBusy(false));
                if (ok) setMode("idle");
              }}
            >
              <label htmlFor={noteId} className="block text-sm text-paper-600">{t("ما الذي تريد تعديله في العقد أو الملحق؟", "What should change in the contract or annex?")}</label>
              <textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} required className={`${field} resize-none`} />
              <div className="flex gap-2">
                <button type="submit" disabled={!note.trim() || busy} className={`${btn} bg-ink-900 text-white`}>{t("أرسل طلب التعديل", "Send request")}</button>
                <button type="button" onClick={() => setMode("idle")} className={`${btn} text-paper-600`}>{t("إلغاء", "Cancel")}</button>
              </div>
            </form>
          )}
          {c.status !== "changes" && (
            <Link to={`/contract/${c.id}`} target="_blank" rel="noopener" className={`${btn} border border-paper-300 text-ink-900 hover:border-ink-900`}>
              <i className="ri-printer-line" aria-hidden="true"></i>{t("نسخة للطباعة / PDF", "Printable / PDF")}
            </Link>
          )}
        </div>
      }
    />
  );
}

export default function ClientContracts({ contracts, run, defaultName }: { contracts: Contract[]; run: (fn: (a: PActor) => Promise<unknown>, ok?: string) => Promise<boolean>; defaultName: string }) {
  const { t } = useI18n();
  const live = contracts.filter((c) => c.status !== "void");
  if (!live.length) return null;
  return (
    <section id="pj-contract" className="scroll-mt-24 space-y-4" aria-labelledby="pj-contract-h">
      <h2 id="pj-contract-h" className="font-display text-xl text-ink-900">{t("العقد", "Contract")}</h2>
      {live.map((c) => <ClientContract key={c.id} c={c} run={run} defaultName={defaultName} />)}
    </section>
  );
}
