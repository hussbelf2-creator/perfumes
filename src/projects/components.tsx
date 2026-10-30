import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { CImg } from "@/creatives/components/ui";
import { isPdf, resolveImage } from "@/creatives/images";
import { briefLines, workLink } from "@/start/briefs";
import { workspaceOf } from "@/start/workspaces";
import { stageLabel, stagesFor } from "./stages";
import { ITEM_STATUS_LABELS, KIND_ICONS, KIND_LABELS, type ProjectComment, type ProjectItem, type ProjectStage } from "./types";

// مكوّنات مشتركة بين لوحة العميل ولوحة الإدارة

export function StageTracker({ stage, track, compact = false }: { stage: ProjectStage; track?: string | null; compact?: boolean }) {
  const { pick, t } = useI18n();
  const stages = stagesFor(track);
  const at = stages.findIndex((s) => s.id === stage);
  const label = pick(stageLabel(track, stage));
  return (
    <ol className="flex items-start gap-1.5" aria-label={t(`المرحلة الحالية: ${label}`, `Current stage: ${label}`)}>
      {stages.map((s, i) => (
        <li key={s.id} className="flex-1 min-w-0" aria-current={i === at ? "step" : undefined}>
          <span className={`block h-1.5 rounded-full ${i < at ? "bg-ink-900" : i === at ? "bg-accent2" : "bg-paper-200"}`} aria-hidden="true" />
          {!compact && (
            <>
              <span className={`mt-2 block text-[11px] truncate ${i === at ? "text-ink-900" : "text-paper-500"}`}>{pick(s.label)}</span>
              {s.time && <span className="block text-[10px] text-paper-400 truncate">{pick(s.time)}</span>}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

const STATUS_STYLE: Record<ProjectItem["status"], string> = {
  pending: "bg-accent2-soft text-accent2-ink",
  approved: "bg-[#E6F2EC] text-[#1F6B4F]",
  changes: "bg-[#FDF0E6] text-[#9A4B12]",
  superseded: "bg-paper-100 text-paper-500",
  submitted: "bg-[#EAF0FA] text-[#2B4C7E]",
};

export function ItemStatus({ status, staff = false }: { status: ProjectItem["status"]; staff?: boolean }) {
  const { pick, t } = useI18n();
  // للفريق: «بانتظار العميل» بدل «بانتظار اعتمادك»
  const label = staff && status === "pending" ? t("بانتظار العميل", "Awaiting client") : pick(ITEM_STATUS_LABELS[status]);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap ${STATUS_STYLE[status]}`}>{label}</span>;
}

/** عارض صور بسيط (Esc، أسهم، إعادة التركيز) */
function ImageViewer({ files, start, title, onClose }: { files: string[]; start: number; title: string; onClose: () => void }) {
  const { t, num, dir } = useI18n();
  const [i, setI] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
      prev?.focus?.();
    };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const next = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
      if (e.key === next) setI((x) => Math.min(files.length - 1, x + 1));
      if (e.key === back) setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [files.length, onClose, dir]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] flex flex-col text-white" style={{ backgroundColor: "#15101D" }}>
      <header className="flex items-center justify-between px-4 py-3">
        <p className="text-sm text-white/70 truncate">{title} · <span className="font-mono">{num(i + 1)}/{num(files.length)}</span></p>
        <button ref={closeRef} type="button" onClick={onClose} className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20" aria-label={t("إغلاق", "Close")}>
          <i className="ri-close-line text-xl" aria-hidden="true"></i>
        </button>
      </header>
      <div className="relative flex-1 min-h-0 mx-4 mb-4">
        <CImg key={files[i]} src={files[i]} alt={`${title} — ${num(i + 1)}`} fit="contain" eager className="absolute inset-0 !bg-transparent" />
      </div>
      {files.length > 1 && (
        <div className="flex justify-center gap-3 pb-5">
          <button type="button" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="rounded-full bg-white/10 px-4 py-2 text-sm disabled:opacity-30">{t("السابقة", "Previous")}</button>
          <button type="button" onClick={() => setI((x) => Math.min(files.length - 1, x + 1))} disabled={i === files.length - 1} className="rounded-full bg-white/10 px-4 py-2 text-sm disabled:opacity-30">{t("التالية", "Next")}</button>
        </div>
      )}
    </div>,
    document.body,
  );
}

function PdfTile({ src }: { src: string }) {
  const { t } = useI18n();
  const open = async () => {
    // نفتح النافذة فوراً (قبل الانتظار) حتى لا يحجبها المتصفح
    const w = window.open("", "_blank");
    try {
      const url = await resolveImage(src);
      if (w) w.location.href = url;
    } catch {
      w?.close();
    }
  };
  return (
    <button type="button" onClick={open} className="aspect-square rounded-xl border border-paper-200 bg-paper-50 hover:border-ink-900 flex flex-col items-center justify-center gap-1 text-ink-900">
      <i className="ri-file-pdf-2-line text-2xl" aria-hidden="true"></i>
      <span className="text-[11px]">{t("فتح PDF", "Open PDF")}</span>
    </button>
  );
}

export function FileGrid({ files, title, eager = false }: { files: string[]; title: string; eager?: boolean }) {
  const { t, num } = useI18n();
  const images = files.filter((f) => !isPdf(f));
  const [open, setOpen] = useState<number | null>(null);
  if (!files.length) return null;
  return (
    <>
      <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {files.map((f, k) =>
          isPdf(f) ? (
            <li key={f}><PdfTile src={f} /></li>
          ) : (
            <li key={f}>
              <button type="button" onClick={() => setOpen(images.indexOf(f))} className="block w-full rounded-xl overflow-hidden border border-paper-200 hover:border-ink-900" aria-label={t(`تكبير الصورة ${num(k + 1)}`, `Enlarge image ${k + 1}`)}>
                <CImg src={f} alt="" className="aspect-square" eager={eager} imgClassName={eager ? "!transition-none" : ""} />
              </button>
            </li>
          ),
        )}
      </ul>
      {open !== null && <ImageViewer files={images} start={open} title={title} onClose={() => setOpen(null)} />}
    </>
  );
}

/** تصميم للاعتماد: أحدث نسخة، ملفاتها، القرار، وسجل النسخ السابقة */
export function ItemCard({ latest, history, staff, actions, children }: { latest: ProjectItem; history: ProjectItem[]; staff?: boolean; actions?: ReactNode; children?: ReactNode }) {
  const { t, pick, num, date } = useI18n();
  const [showHistory, setShowHistory] = useState(false);
  const older = history.filter((h) => h.id !== latest.id).sort((a, b) => b.version - a.version);
  return (
    <article className="rounded-2xl border border-paper-200 bg-white p-4 md:p-5" aria-labelledby={`it-title-${latest.id}`}>
      <header className="flex flex-wrap items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-sand-soft flex items-center justify-center text-ink-900 shrink-0">
          <i className={KIND_ICONS[latest.kind]} aria-hidden="true"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`it-title-${latest.id}`} className="text-ink-900 font-medium leading-snug">{latest.title}</h3>
          <p className="text-xs text-paper-500 mt-0.5">
            {pick(KIND_LABELS[latest.kind])}
            {!latest.byClient && ` · ${t(`النسخة ${num(latest.version)}`, `Version ${latest.version}`)}`}
            {` · ${date(new Date(latest.createdAt), { day: "numeric", month: "short" })}`}
          </p>
        </div>
        <ItemStatus status={latest.status} staff={staff} />
      </header>
      {latest.note && <p className="mt-3 text-sm text-paper-700 leading-[1.8] whitespace-pre-line">{latest.note}</p>}
      {latest.studio && (
        <Link to={latest.studio.link} className="mt-3 flex items-center gap-3 rounded-xl bg-sand-soft px-4 py-3 text-sm text-ink-900 hover:bg-sand">
          <i className="ri-shapes-line text-lg" aria-hidden="true"></i>
          <span className="min-w-0 flex-1">
            <span className="block">{t("فتح التصميم في استوديو 3D", "Open the design in the 3D studio")}</span>
            <span className="block text-xs text-paper-600 truncate">{latest.studio.summary}</span>
          </span>
        </Link>
      )}
      <div className="mt-3"><FileGrid files={latest.files} title={latest.title} /></div>
      {(latest.status === "approved" || latest.status === "changes") && (
        <p className={`mt-3 text-xs rounded-xl px-3 py-2 ${latest.status === "approved" ? "bg-[#E6F2EC] text-[#1F6B4F]" : "bg-[#FDF0E6] text-[#9A4B12]"}`}>
          {latest.status === "approved" ? t("اعتُمد", "Approved") : t("طُلب تعديل", "Changes requested")}
          {latest.decidedAt && ` · ${date(new Date(latest.decidedAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`}
          {latest.decisionNote && <span className="block mt-1 text-paper-700 whitespace-pre-line">«{latest.decisionNote}»</span>}
        </p>
      )}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      {children}
      {older.length > 0 && (
        <div className="mt-4 border-t border-paper-100 pt-3">
          <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} className="text-xs text-paper-600 hover:text-ink-900 inline-flex items-center gap-1">
            <i className={showHistory ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} aria-hidden="true"></i>
            {t(`النسخ السابقة (${num(older.length)})`, `Earlier versions (${older.length})`)}
          </button>
          {showHistory && (
            <ol className="mt-3 space-y-3">
              {older.map((h) => (
                <li key={h.id} className="rounded-xl bg-paper-50 p-3">
                  <p className="text-xs text-paper-600 mb-2">
                    {t(`النسخة ${num(h.version)}`, `Version ${h.version}`)} · {date(new Date(h.createdAt), { day: "numeric", month: "short" })}
                    {h.decisionNote && <span className="block mt-1 text-paper-700">«{h.decisionNote}»</span>}
                  </p>
                  <FileGrid files={h.files} title={`${h.title} v${h.version}`} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  );
}

/** نقاش المشروع: رسائل العميل والفريق (يراه الطرفان) */
export function CommentThread({ comments, items, onSend, viewerIsClient }: { comments: ProjectComment[]; items: ProjectItem[]; onSend: (body: string) => Promise<boolean>; viewerIsClient: boolean }) {
  const { t, date } = useI18n();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const titleOf = (id?: string | null) => items.find((i) => i.id === id);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    if (await onSend(body)) setBody("");
    setBusy(false);
  };
  return (
    <div>
      {comments.length === 0 ? (
        <p className="text-sm text-paper-500">{t("لا رسائل بعد.", "No messages yet.")}</p>
      ) : (
        <ol className="space-y-3" aria-label={t("الرسائل", "Messages")}>
          {comments.map((c) => {
            const mine = c.fromClient === viewerIsClient;
            const it = titleOf(c.itemId);
            return (
              <li key={c.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${c.fromClient ? "bg-sand-soft text-ink-900" : "bg-ink-900 text-white"}`}>
                  <p className={`text-[11px] mb-1 ${c.fromClient ? "text-paper-600" : "text-white/60"}`}>
                    {c.authorName || (c.fromClient ? t("العميل", "Client") : t("فريق المنصة", "Platform team"))}
                    {!c.fromClient && viewerIsClient && ` · ${t("فريق المنصة", "Platform team")}`}
                    {" · "}
                    {date(new Date(c.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                  {it && <p className={`text-[11px] mb-1 ${c.fromClient ? "text-paper-500" : "text-white/50"}`}>{t("بخصوص", "Re:")} {it.title}{!it.byClient && ` (v${it.version})`}</p>}
                  <p className="text-sm leading-[1.8] whitespace-pre-line break-words">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <form onSubmit={send} className="mt-4 flex items-end gap-2">
        <label className="flex-1 min-w-0">
          <span className="sr-only">{t("رسالة جديدة", "New message")}</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={4000} placeholder={viewerIsClient ? t("اكتب للفريق…", "Write to the team…") : t("اكتب للعميل… (يراه العميل)", "Write to the client… (the client sees this)")} className="w-full bg-white border border-paper-200 focus:border-ink-900 rounded-xl px-4 py-3 text-sm outline-none resize-none" />
        </label>
        <button type="submit" disabled={busy || !body.trim()} className="rounded-full bg-ink-900 text-white px-5 py-3 text-sm disabled:opacity-40">{t("إرسال", "Send")}</button>
      </form>
    </div>
  );
}

/** تجميع العناصر: أحدث نسخة + سجلها، بترتيب: ما ينتظر القرار أولاً */
export function groupItems(items: ProjectItem[]) {
  const threads = new Map<string, ProjectItem[]>();
  for (const i of items) threads.set(i.threadId, [...(threads.get(i.threadId) ?? []), i]);
  const order: Record<ProjectItem["status"], number> = { pending: 0, changes: 1, submitted: 2, approved: 3, superseded: 4 };
  return [...threads.values()]
    .map((h) => ({ latest: h.reduce((a, b) => (b.version > a.version ? b : a)), history: h }))
    .sort((a, b) => order[a.latest.status] - order[b.latest.status] || b.latest.createdAt.localeCompare(a.latest.createdAt));
}

export function Notice({ notice, onClose }: { notice: { ok: boolean; text: string } | null; onClose: () => void }) {
  const { t } = useI18n();
  if (!notice) return null;
  return (
    <div className="fixed bottom-5 inset-x-3 z-[80] flex justify-center pointer-events-none">
      <div role={notice.ok ? "status" : "alert"} className={`pointer-events-auto rounded-full px-5 py-3 text-sm shadow-lg flex items-center gap-3 ${notice.ok ? "bg-ink-900 text-white" : "bg-red-700 text-white"}`}>
        {notice.text}
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100" aria-label={t("إغلاق", "Close")}>
          <i className="ri-close-line" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}

/** ما أرسله العميل في «ابدأ مسارك» — يراه هو والفريق بالصياغة نفسها */
export function BriefSummary({ brief }: { brief?: Record<string, string> | null }) {
  const { t, pick } = useI18n();
  const lines = briefLines(brief, pick, t);
  const link = workLink(brief);
  const ws = workspaceOf(brief?.track);
  if (!lines.length) return null;
  return (
    <details className="group rounded-2xl bg-white border border-paper-200" open>
      <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 font-display text-xl text-ink-900">
        {t("ملخص الطلب", "Request summary")}
        <i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180" aria-hidden="true"></i>
      </summary>
      {link && ws && (
        <Link to={link} className="mx-5 mb-4 flex items-center gap-3 rounded-xl bg-paper-50 border border-paper-200 hover:border-ink-900 px-4 py-3 text-sm text-ink-900 transition-colors" data-testid="work-link">
          <i className={`${ws.icon} text-lg`} aria-hidden="true"></i>
          <span className="flex-1 min-w-0">{t(`افتح ${pick(ws.label)} بالتصميم المرفق`, `Open the ${ws.label.en.toLowerCase()} with the attached design`)}</span>
          <i className="ri-arrow-left-line flip-ltr text-paper-500" aria-hidden="true"></i>
        </Link>
      )}
      <dl className="px-5 pb-5 space-y-3">
        {lines.map((x) => (
          <div key={x.q}>
            <dt className="text-xs text-paper-500">{x.q}</dt>
            <dd className="text-sm text-ink-900 break-words whitespace-pre-line">{x.a}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
