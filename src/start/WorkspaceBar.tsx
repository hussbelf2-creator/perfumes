import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { serviceById } from "@/data/services";
import { saveWork, workspaceOf, type Work } from "./workspaces";

// شريط «لوحة العمل»: يظهر فوق الاستوديو أو الحاسبة أو المكوّن حين يصل العميل من مسار (?track=…).
// يذكّره بالمسار والخطوة، وزر «أكمل الطلب» يحفظ ما أنجزه ثم ينقله إلى البريف فالتسجيل فلوحة التحكم.

export interface WorkDraft {
  summary: string;
  link: string;
  fields?: Record<string, string>;
  design?: Work["design"];
}

/** يحفظ العمل وينتقل إلى «ابدأ مسارك» (يُستخدم من الشريط ومن أزرار الصفحة نفسها) */
export function useCompleteWork(track: string | null | undefined) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const t = serviceById(track ?? undefined);
  if (!t) return null;
  return (w: WorkDraft) => {
    saveWork({ track: t.id, summary: w.summary.slice(0, 600), link: w.link.slice(0, 1500), at: new Date().toISOString(), fields: w.fields, design: w.design });
    const pkg = params.get("package");
    navigate(`/start/${t.id}?from=work${pkg !== null ? `&package=${encodeURIComponent(pkg)}` : ""}`);
  };
}

export default function WorkspaceBar({ track, work, ready = true }: { track: string | null | undefined; work: () => WorkDraft; ready?: boolean }) {
  const { t, pick, num } = useI18n();
  const complete = useCompleteWork(track);
  const svc = serviceById(track ?? undefined);
  const ws = workspaceOf(track);
  if (!svc || !ws || !complete) return null;
  return (
    <div className="sticky top-[4.25rem] z-40 bg-ink-900 text-white" role="region" aria-label={t("لوحة العمل", "Workspace")}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-2.5 flex items-center gap-3 sm:gap-5">
        <ol className="flex items-center gap-2 text-xs sm:text-sm min-w-0" aria-label={t("خطوات الطلب", "Request steps")}>
          {[
            { n: 1, l: pick(ws.verb), on: true },
            { n: 2, l: t("أسئلة سريعة", "Quick questions"), on: false },
            { n: 3, l: t("حسابك ولوحة التحكم", "Your account & dashboard"), on: false },
          ].map((s, i) => (
            <li key={s.n} className={`flex items-center gap-2 min-w-0 ${i > 0 ? "hidden md:flex" : ""}`} aria-current={s.on ? "step" : undefined}>
              {i > 0 && <span className="w-5 h-px bg-white/30" aria-hidden="true" />}
              <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] tabular-nums ${s.on ? "bg-white text-ink-900" : "border border-white/40 text-white/70"}`}>{num(s.n)}</span>
              <span className={`truncate ${s.on ? "text-white" : "text-white/60"}`}>{s.l}</span>
            </li>
          ))}
        </ol>
        <span className="hidden lg:inline text-xs text-white/50 truncate">{pick(svc.title)} · {pick(ws.captures)}</span>
        <button
          type="button"
          onClick={() => complete(work())}
          disabled={!ready}
          className="ms-auto shrink-0 inline-flex items-center gap-2 rounded-full bg-white text-ink-900 hover:bg-sand-soft px-4 sm:px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {t("أكمل الطلب", "Complete the request")}
          <i className="ri-arrow-left-line flip-ltr" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}
