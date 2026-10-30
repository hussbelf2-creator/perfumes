import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { ALL_TRACKS, trackInfo } from "@/data/tracks";
import { storeProjectFile, isPdf } from "@/creatives/images";
import { validationText } from "@/creatives/messages";
import { CImg } from "@/creatives/components/ui";
import { projectsRepo, accessOf, type CostInput, type ProjectsData } from "@/projects/repo";
import { mapStage, stageLabel, stagesFor } from "@/projects/stages";
import { MarkPaid, QuoteBody, QuoteEditor, QuoteStatus, useMoney, type EditorContext } from "@/projects/quotes";
import { inventoryRepo, type InventoryData } from "@/inventory/repo";
import { INV_UNIT_LABELS } from "@/inventory/types";
import { DEFAULT_POLICY, capFor, pricingRepo, type PricingPolicy } from "@/pricing/repo";
import { BriefSummary, CommentThread, ItemCard, StageTracker, groupItems } from "@/projects/components";
import { usePActor, useCanSeeProjects } from "@/projects/useProjects";
import { ITEM_KINDS, KIND_LABELS, PROJECT_STATUSES, STATUS_LABELS, isEmail, quoteMargin, COST_KINDS, COST_KIND_LABELS, type CostKind, type NewProject, type Project, type ProjectItem, type Quote, type QuoteCost, type QuoteDraft } from "@/projects/types";
import { useCrm } from "../data/CrmProvider";
import ContractsPanel from "./ContractsPanel";
import { ValidationError } from "../data/types";
import { Btn, Card, Drawer, Empty, PageTitle, fieldCls } from "../components/ui";
import { ManufacturingRequirements } from "@/components/feature/Requirements";

function Denied() {
  const { t } = useI18n();
  return (
    <Card>
      <Empty icon="ri-lock-line" title={t("ليست لديك صلاحية لهذه الصفحة", "You don't have access to this page")} hint={t("اطلب من المدير منحك الصلاحية.", "Ask an admin for access.")} />
    </Card>
  );
}

function useProjects() {
  const actor = usePActor();
  const [data, setData] = useState<ProjectsData | null>(null);
  const reload = useMemo(() => async () => actor && setData(await projectsRepo.load(actor)), [actor]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { actor, data, reload };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-paper-500 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-paper-400">{hint}</span>}
    </label>
  );
}

function ProjectForm({ initial, onSubmit, submitLabel }: { initial: NewProject; onSubmit: (p: NewProject) => Promise<void>; submitLabel: string }) {
  const { t, pick } = useI18n();
  const { data: crm } = useCrm();
  const [d, setD] = useState<NewProject>(initial);
  const set = (p: Partial<NewProject>) => setD((x) => ({ ...x, ...p }));
  const designers = crm?.team.filter((m) => m.active && m.role === "designer") ?? [];
  const contacts = crm?.contacts ?? [];
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(d);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("اسم المشروع", "Project name")}>
        <input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} required className={fieldCls} />
      </Field>
      {contacts.length > 0 && (
        <Field label={t("العميل في الـCRM (اختياري)", "CRM client (optional)")} hint={t("يملأ البريد ويسجّل نشاط المشروع في ملفه", "Fills the email and logs project activity on their profile")}>
          <select value={d.contactId ?? ""} onChange={(e) => {
            const c = contacts.find((x) => x.id === e.target.value);
            // البريد يُملأ من العميل إن كان فارغاً فقط: تغييره ينقل المشروع لحساب آخر
            set({ contactId: c?.id ?? null, ...(c?.email && !d.clientEmail.trim() ? { clientEmail: c.email } : {}) });
          }} className={fieldCls}>
            <option value="">{t("بلا ربط", "Not linked")}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>)}
          </select>
        </Field>
      )}
      <Field label={t("بريد العميل", "Client email")} hint={t("يرى العميل المشروع في حسابه بهذا البريد — الآن أو حين يسجّل", "The client sees the project in their account with this email — now or when they sign up")}>
        <input type="email" dir="ltr" value={d.clientEmail} onChange={(e) => set({ clientEmail: e.target.value })} required className={fieldCls} aria-invalid={!!d.clientEmail && !isEmail(d.clientEmail)} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("المسار", "Track")}>
          <select value={d.track ?? ""} onChange={(e) => set({ track: e.target.value || null, stage: mapStage(d.track, e.target.value || null, d.stage) })} className={fieldCls}>
            <option value="">—</option>
            {ALL_TRACKS.map((s) => <option key={s.id} value={s.id}>{pick(s.title)}</option>)}
          </select>
        </Field>
        <Field label={t("المصمم المسند", "Assigned designer")} hint={t("يرى هذا المشروع فقط ويرفع تصاميمه", "Sees only this project and uploads its designs")}>
          <select value={d.designerId ?? ""} onChange={(e) => set({ designerId: e.target.value || null })} className={fieldCls}>
            <option value="">{t("بلا مصمم", "No designer")}</option>
            {designers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
          </select>
        </Field>
        <Field label={t("المرحلة", "Stage")}>
          <select value={d.stage} onChange={(e) => set({ stage: e.target.value as NewProject["stage"] })} className={fieldCls}>
            {stagesFor(d.track).map((s) => <option key={s.id} value={s.id}>{pick(s.label)}</option>)}
          </select>
        </Field>
        <Field label={t("الحالة", "Status")}>
          <select value={d.status} onChange={(e) => set({ status: e.target.value as NewProject["status"] })} className={fieldCls}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{pick(STATUS_LABELS[s])}</option>)}
          </select>
        </Field>
        <Field label={t("التسليم المتوقع", "Due date")}>
          <input type="date" value={d.dueDate ?? ""} onChange={(e) => set({ dueDate: e.target.value || null })} className={fieldCls} />
        </Field>
      </div>
      <div className="flex justify-end"><Btn type="submit" disabled={busy}>{submitLabel}</Btn></div>
    </form>
  );
}

const blank = (contactId?: string | null, email = ""): NewProject => ({ title: "", track: null, contactId: contactId ?? null, clientEmail: email, designerId: null, ownerId: null, stage: "brief", status: "active", dueDate: null });

// ─── القائمة ───────────────────────────────────────────────────────
export default function Projects() {
  const { t, pick, num } = useI18n();
  const allowed = useCanSeeProjects();
  const { can } = useAuth();
  const { run, member, data: crm } = useCrm();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { actor, data, reload } = useProjects();
  const [q, setQ] = useState("");
  const creating = params.get("new") === "1";
  const contactId = params.get("contact");
  const contact = crm?.contacts.find((c) => c.id === contactId);
  if (!allowed) return <Denied />;

  const counts = (p: Project) => {
    const its = groupItems(data?.items.filter((i) => i.projectId === p.id) ?? []).map((g) => g.latest);
    return { pending: its.filter((i) => i.status === "pending").length, changes: its.filter((i) => i.status === "changes").length, submitted: its.filter((i) => i.status === "submitted").length };
  };
  const needle = q.trim().toLowerCase();
  const rows = (data?.projects ?? []).filter((p) => !needle || [p.title, p.clientEmail].some((v) => v.toLowerCase().includes(needle)));
  const closeNew = () => {
    const next = new URLSearchParams(params);
    next.delete("new");
    next.delete("contact");
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageTitle
        title={t("مشاريع العملاء", "Client projects")}
        sub={t("أرسل التصاميم للعميل ليعتمدها من حسابه، وتابع قراراته ونقاشه في مكان واحد.", "Send designs to clients to approve from their account, and follow decisions and discussion in one place.")}
        actions={can("projects.manage") ? <Btn onClick={() => setParams({ new: "1" })}><i className="ri-add-line" aria-hidden="true"></i>{t("مشروع جديد", "New project")}</Btn> : undefined}
      />
      <div className="mb-4">
        <label className="relative block max-w-sm">
          <span className="sr-only">{t("بحث", "Search")}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("اسم المشروع أو بريد العميل", "Project name or client email")} className={`${fieldCls} ps-9`} />
          <i className="ri-search-line absolute start-3 top-1/2 -translate-y-1/2 text-paper-400" aria-hidden="true"></i>
        </label>
      </div>
      {!data ? (
        <div className="h-48 rounded-2xl shimmer bg-paper-100" />
      ) : rows.length === 0 ? (
        <Card><Empty icon="ri-folder-3-line" title={t("لا مشاريع", "No projects")} hint={can("projects.manage") ? t("أنشئ مشروعاً من هنا أو من ملف العميل.", "Create one here or from a client's profile.") : t("ستظهر هنا المشاريع المسندة إليك.", "Projects assigned to you appear here.")} /></Card>
      ) : (
        <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((p) => {
            const c = counts(p);
            const designer = member(p.designerId ?? null);
            return (
              <li key={p.id}>
                <Link to={`/admin/projects/${p.id}`} className="block rounded-2xl bg-white border border-paper-200 hover:border-ink-900 p-4 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-ink-900 font-medium truncate">{p.title}</p>
                    <span className="text-[11px] text-paper-500 shrink-0">{pick(STATUS_LABELS[p.status])}</span>
                  </div>
                  <p className="mt-1 text-xs text-paper-500 truncate" dir="ltr" style={{ textAlign: "start" }}>{p.clientEmail}</p>
                  <div className="mt-4"><StageTracker stage={p.stage} track={p.track} compact /></div>
                  <p className="mt-2 text-[11px] text-paper-500">{pick(stageLabel(p.track, p.stage))}{designer ? ` · ${designer.firstName} ${designer.lastName}` : ""}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.changes > 0 && <span className="rounded-full bg-[#FDF0E6] text-[#9A4B12] px-2 py-0.5 text-[11px]">{t(`${num(c.changes)} طلب تعديل`, `${c.changes} change request${c.changes > 1 ? "s" : ""}`)}</span>}
                    {c.submitted > 0 && <span className="rounded-full bg-[#EAF0FA] text-[#2B4C7E] px-2 py-0.5 text-[11px]">{t(`${num(c.submitted)} من العميل`, `${c.submitted} from client`)}</span>}
                    {c.pending > 0 && <span className="rounded-full bg-accent2-soft text-accent2-ink px-2 py-0.5 text-[11px]">{t(`${num(c.pending)} بانتظار العميل`, `${c.pending} awaiting client`)}</span>}
                    {!p.clientId && <span className="rounded-full bg-paper-100 text-paper-600 px-2 py-0.5 text-[11px]">{t("العميل لم يسجّل بعد", "Client not signed up yet")}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Drawer open={creating && can("projects.manage")} onClose={closeNew} title={t("مشروع جديد", "New project")}>
        <header className="sticky top-0 z-10 bg-paper-50/95 backdrop-blur border-b border-paper-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink-900">{t("مشروع جديد", "New project")}</h2>
          <button type="button" onClick={closeNew} className="w-9 h-9 rounded-full hover:bg-paper-100" aria-label={t("إغلاق", "Close")}><i className="ri-close-line text-lg" aria-hidden="true"></i></button>
        </header>
        <div className="p-6">
          {creating && (
            <ProjectForm
              key={contactId ?? "new"}
              initial={blank(contact?.id, contact?.email ?? "")}
              submitLabel={t("إنشاء المشروع", "Create project")}
              onSubmit={async (d) => {
                let id = "";
                if (!actor) return;
                const ok = await run(async () => {
                  id = (await projectsRepo.createProject(d, actor)).id;
                }, t("أُنشئ المشروع — أرسل أول تصميم", "Project created — send the first design"));
                if (ok) {
                  await reload();
                  nav(`/admin/projects/${id}`);
                }
              }}
            />
          )}
        </div>
      </Drawer>
    </>
  );
}

// ─── رفع تصميم/نسخة ────────────────────────────────────────────────
function Uploader({ project, thread, onDone, onCancel }: { project: Project; thread: ProjectItem | null; onDone: () => void; onCancel?: () => void }) {
  const { t, pick, num } = useI18n();
  const { run } = useCrm();
  const actor = usePActor();
  const [kind, setKind] = useState<ProjectItem["kind"]>(thread?.kind ?? "label");
  const [title, setTitle] = useState(thread?.title ?? "");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const add = async (list: FileList) => {
    setErr("");
    const arr = Array.from(list).slice(0, 12 - files.length);
    setBusy(arr.length);
    let acc = files;
    for (const f of arr) {
      try {
        acc = [...acc, await storeProjectFile(f, project.id)];
        setFiles(acc);
      } catch (e) {
        setErr(validationText(e instanceof Error ? e.message : "upload_failed", t));
      }
      setBusy((n) => n - 1);
    }
  };
  const [sending, setSending] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!actor || sending) return;
    setSending(true);
    const ok = await run(() => projectsRepo.addItem({ projectId: project.id, threadId: thread?.id ?? null, kind, title, files, studio: null, note }, actor), thread ? t("أُرسلت النسخة الجديدة للعميل", "New version sent to the client") : t("أُرسل التصميم للعميل لاعتماده", "Design sent to the client for approval"));
    setSending(false);
    if (ok) {
      setFiles([]);
      setNote("");
      if (!thread) setTitle("");
      onDone();
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {thread ? (
        <p className="text-sm text-ink-900">{t(`نسخة جديدة من «${thread.title}» (ستكون النسخة ${num(thread.version + 1)})`, `New version of “${thread.title}” (will be v${thread.version + 1})`)}</p>
      ) : (
        <div className="grid sm:grid-cols-[10rem_1fr] gap-3">
          <Field label={t("النوع", "Type")}>
            <select value={kind} onChange={(e) => setKind(e.target.value as ProjectItem["kind"])} className={fieldCls}>
              {ITEM_KINDS.map((k) => <option key={k} value={k}>{pick(KIND_LABELS[k])}</option>)}
            </select>
          </Field>
          <Field label={t("العنوان", "Title")}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={fieldCls} placeholder={t("مثال: الملصق الأمامي", "e.g. Front label")} />
          </Field>
        </div>
      )}
      <div className="rounded-2xl border-2 border-dashed border-paper-300 bg-paper-50 p-4 text-center">
        <button type="button" onClick={() => input.current?.click()} disabled={files.length >= 12} className="rounded-full bg-ink-900 text-white px-4 py-2 text-sm disabled:opacity-40">{t("أضف صوراً أو PDF", "Add images or PDF")}</button>
        <input ref={input} type="file" multiple accept="image/*,application/pdf" className="sr-only" aria-label={t("ملفات التصميم", "Design files")} onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = ""; }} />
        <p className="mt-2 text-[11px] text-paper-400">{t("حتى 12 ملفاً · الصور تُصغَّر إلى 2400 بكسل · تُحفظ في تخزين خاص لا يراه إلا فريق المشروع والعميل", "Up to 12 files · images resized to 2400 px · stored privately, visible only to the project team and client")}</p>
        {busy > 0 && <p role="status" className="mt-2 text-xs text-paper-600">{t(`جاري رفع ${num(busy)}…`, `Uploading ${busy}…`)}</p>}
        {err && <p role="alert" className="mt-2 text-xs text-red-700">{err}</p>}
      </div>
      {files.length > 0 && (
        <ul className="grid grid-cols-4 gap-2" aria-label={t("الملفات المرفوعة", "Uploaded files")}>
          {files.map((f, i) => (
            <li key={f} className="relative">
              {isPdf(f) ? <span className="aspect-square rounded-lg border border-paper-200 bg-white flex items-center justify-center"><i className="ri-file-pdf-2-line text-xl" aria-hidden="true"></i></span> : <CImg src={f} alt="" className="aspect-square rounded-lg" />}
              <button type="button" onClick={() => setFiles(files.filter((x) => x !== f))} className="absolute top-1 end-1 w-6 h-6 rounded-full bg-white/90 text-red-700 text-xs" aria-label={t(`احذف الملف ${num(i + 1)}`, `Remove file ${i + 1}`)}><i className="ri-close-line" aria-hidden="true"></i></button>
            </li>
          ))}
        </ul>
      )}
      <Field label={t("ملاحظة للعميل (اختياري)", "Note to the client (optional)")}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className={`${fieldCls} resize-none`} placeholder={thread ? t("ما الذي تغيّر في هذه النسخة؟", "What changed in this version?") : ""} />
      </Field>
      <div className="flex gap-2 justify-end">
        {onCancel && <Btn variant="ghost" onClick={onCancel}>{t("إلغاء", "Cancel")}</Btn>}
        <Btn type="submit" disabled={!files.length || !title.trim() || busy > 0 || sending}>{t("أرسل للعميل", "Send to client")}</Btn>
      </div>
    </form>
  );
}

// ─── صفحة المشروع ──────────────────────────────────────────────────
/** الهامش المتوقع للعرض (داخلي) */
function InternalMargin({ q, cost, floor }: { q: Quote; cost: QuoteCost | null; floor: number }) {
  const { t, num } = useI18n();
  const money = useMoney();
  const m = quoteMargin(q, cost);
  if (!m) return null;
  const low = m.pct < floor;
  return (
    <p className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${low ? "bg-red-50 text-red-800" : "bg-sand-soft/60 text-paper-700"}`} data-testid="quote-margin">
      {t("داخلي: التكلفة", "Internal: cost")} {money(m.cost)} · {t("الربح المتوقع", "expected profit")} {money(m.profit)} ({num(Math.round(m.pct * 10) / 10, 1)}%){low ? t(` — أقل من حد ${num(floor)}٪`, ` — below the ${floor}% floor`) : ""}
    </p>
  );
}

/** التكاليف الفعلية والهامش الفعلي للمشروع، والمواد المحجوزة له مع صرفها */
function CostsPanel({ project, data, stock, manage, reload }: { project: Project; data: ProjectsData; stock: InventoryData; manage: boolean; reload: () => Promise<void> }) {
  const { t, pick, num, date } = useI18n();
  const { run } = useCrm();
  const { can } = useAuth();
  const actor = usePActor();
  const money = useMoney();
  const [kind, setKind] = useState<CostKind>("factory");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const costs = data.costs.filter((c) => c.projectId === project.id);
  const actual = Math.round(costs.reduce((s, c) => s + c.amount, 0) * 100) / 100;
  // الإيراد: العرض المعتمد أو المدفوع (بعد الخصم وقبل الضريبة)
  const won = data.quotes.find((q) => q.projectId === project.id && (q.status === "paid" || q.status === "accepted"));
  const revenue = won?.subtotal ?? 0;
  const profit = Math.round((revenue - actual) * 100) / 100;
  // المحجوز للمشروع من كل مادة
  const held = stock.items
    .map((it) => ({ it, qty: stock.moves.filter((m) => m.itemId === it.id && m.projectId === project.id).reduce((s, m) => s + (m.kind === "reserve" ? m.qty : m.kind === "release" || m.kind === "issue" ? -m.qty : 0), 0) }))
    .filter((x) => x.qty > 0.0005);
  const move = (itemId: string, kind: "issue" | "release", qty: number) =>
    actor ? run(() => inventoryRepo.addMove({ itemId, kind, qty, projectId: project.id, note: kind === "issue" ? `صرف لمشروع ${project.title}` : `فك حجز ${project.title}` }, actor), kind === "issue" ? t("صُرفت المواد وسُجّلت تكلفتها", "Materials issued and costed") : t("فُك الحجز", "Reservation released")).then(async (ok) => (ok && (await reload()), ok)) : Promise.resolve(false);
  return (
    <Card className="p-5 mb-6">
      <h2 className="font-display text-xl text-ink-900 mb-1">{t("التكاليف والهامش الفعلي", "Actual costs & margin")}</h2>
      <p className="text-xs text-paper-500 mb-4">{t("داخلي — لا يراه العميل. صرف المواد من المخزون يُسجَّل هنا تلقائياً.", "Internal — hidden from the client. Issuing stock is recorded here automatically.")}</p>
      <div className="grid grid-cols-3 gap-3 text-sm mb-4">
        <div className="rounded-xl bg-paper-50 border border-paper-200 p-3"><p className="text-xs text-paper-500">{t("الإيراد (قبل الضريبة)", "Revenue (excl. VAT)")}</p><p className="mt-1 text-ink-900">{won ? money(revenue) : "—"}</p></div>
        <div className="rounded-xl bg-paper-50 border border-paper-200 p-3"><p className="text-xs text-paper-500">{t("التكلفة الفعلية", "Actual cost")}</p><p className="mt-1 text-ink-900" data-testid="actual-cost">{money(actual)}</p></div>
        <div className={`rounded-xl border p-3 ${won && profit < 0 ? "bg-red-50 border-red-200" : "bg-paper-50 border-paper-200"}`}><p className="text-xs text-paper-500">{t("الربح حتى الآن", "Profit so far")}</p><p className="mt-1 text-ink-900" data-testid="actual-profit">{won ? `${money(profit)} · ${num(revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0, 1)}%` : "—"}</p></div>
      </div>
      {held.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-paper-500 mb-2">{t("مواد محجوزة لهذا المشروع", "Stock reserved for this project")}</p>
          <ul className="divide-y divide-paper-100 text-sm">
            {held.map(({ it, qty }) => (
              <li key={it.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1 min-w-0 truncate text-ink-900">{it.sku} · {it.name}</span>
                <span className="text-paper-600">{num(qty)} {pick(INV_UNIT_LABELS[it.unit])}</span>
                {can("inventory.manage") && (
                  <>
                    <button type="button" onClick={() => move(it.id, "issue", Math.min(qty, it.onHand))} disabled={it.onHand <= 0} className="rounded-full bg-ink-900 text-white px-3 py-1.5 text-xs disabled:opacity-40">{t(`صرف ${num(Math.min(qty, it.onHand))}`, `Issue ${Math.min(qty, it.onHand)}`)}</button>
                    <button type="button" onClick={() => move(it.id, "release", qty)} className="rounded-full border border-paper-300 px-3 py-1.5 text-xs">{t("فك الحجز", "Release")}</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {costs.length > 0 && (
        <ul className="divide-y divide-paper-100 text-sm mb-4" aria-label={t("التكاليف المسجّلة", "Recorded costs")}>
          {costs.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <span className="text-xs rounded-full bg-paper-100 px-2 py-0.5 text-paper-600 shrink-0">{pick(COST_KIND_LABELS[c.kind])}</span>
              <span className="flex-1 min-w-0 truncate text-paper-700">{c.note || "—"} <span className="text-xs text-paper-400">· {date(new Date(c.createdAt), { day: "numeric", month: "short" })}</span></span>
              <span className="text-ink-900 whitespace-nowrap">{money(c.amount)}</span>
              {manage && !c.moveId && <button type="button" onClick={() => actor && run(() => projectsRepo.deleteCost(c.id, actor), t("حُذفت التكلفة", "Cost removed")).then((ok) => ok && reload())} aria-label={t("احذف التكلفة", "Remove cost")} className="text-red-700 text-xs">{t("حذف", "Remove")}</button>}
            </li>
          ))}
        </ul>
      )}
      {manage && (
        <form
          className="grid sm:grid-cols-4 gap-2 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (actor && (await run(() => projectsRepo.addCost({ projectId: project.id, kind, amount, note }, actor), t("سُجّلت التكلفة", "Cost recorded")))) {
              setAmount(0);
              setNote("");
              await reload();
            }
          }}
        >
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("البند", "Type")}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as CostKind)} className={fieldCls}>
              {COST_KINDS.filter((k) => k !== "materials").map((k) => <option key={k} value={k}>{pick(COST_KIND_LABELS[k])}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("المبلغ (ر.س)", "Amount (SAR)")}</span>
            <input type="number" min={0.01} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} required className={fieldCls} />
          </label>
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("ملاحظة", "Note")}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={fieldCls} />
          </label>
          <Btn type="submit" disabled={!(amount > 0)}>{t("سجّل التكلفة", "Record cost")}</Btn>
        </form>
      )}
    </Card>
  );
}

/** عرض السعر: مسودة يحررها الفريق، ثم الإرسال، ثم الاعتماد والعربون (مويسر تلقائياً أو تسجيل يدوي للتحويل) */
function QuotePanel({ project, quotes, quoteCosts, ctx, manage, reload }: { project: Project; quotes: Quote[]; quoteCosts: QuoteCost[]; ctx: EditorContext; manage: boolean; reload: () => Promise<void> }) {
  const { t, date } = useI18n();
  const { run } = useCrm();
  const { can } = useAuth();
  const actor = usePActor();
  const money = useMoney();
  const [composing, setComposing] = useState(false);
  const draft = quotes.find((q) => q.status === "draft") ?? null;
  const active = quotes.find((q) => q.status !== "draft" && q.status !== "void") ?? null;
  const older = quotes.filter((q) => q.status === "void");
  const done = async (ok: boolean) => {
    if (ok) {
      setComposing(false);
      await reload();
    }
    return ok;
  };
  const save = async (d: QuoteDraft, c: CostInput) => actor ? done(await run(() => projectsRepo.saveQuote(d, draft?.id ?? null, actor, c), t("حُفظت مسودة العرض", "Quote draft saved"))) : false;
  const send = async (d: QuoteDraft, c: CostInput) => {
    if (!actor) return false;
    const ok = await run(async () => {
      // ما يرفضه الخادم عند الإرسال يُرفض قبل حفظ المسودة (لا مسودات يتيمة بأرقام عروض جديدة)
      if (d.validUntil && d.validUntil < new Date().toISOString().slice(0, 10)) throw new ValidationError("valid_until_past");
      if (!d.lines.some((l) => Number(l.qty) * Number(l.unit) > 0)) throw new ValidationError("quote_empty");
      const q = await projectsRepo.saveQuote(d, draft?.id ?? null, actor, c);
      await projectsRepo.sendQuote(q.id, actor);
    }, t("أُرسل العرض للعميل", "Quote sent to the client"));
    // فشل الإرسال بعد حفظ المسودة: نحمّلها لتُعدَّل هي لا تُنشأ أخرى
    if (!ok) await reload();
    return done(ok);
  };
  const costOf = (id?: string) => quoteCosts.find((c) => c.quoteId === id) ?? null;
  const editing = manage && (composing || !!draft);
  const seed = draft ?? (active ? { ...active, status: "draft" as const } : null);
  return (
    <Card className="p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-xl text-ink-900">{t("عرض السعر", "Quote")}</h2>
        {manage && !editing && (
          <Btn variant="secondary" onClick={() => setComposing(true)}>{active ? t("عرض محدّث", "Updated quote") : t("أنشئ عرض السعر", "Create quote")}</Btn>
        )}
      </div>
      {editing && (
        <div className="mb-6 rounded-xl border border-dashed border-paper-300 p-4">
          <p className="text-xs text-paper-500 mb-3">{draft ? t(`مسودة ${draft.ref} — لا يراها العميل حتى ترسلها`, `Draft ${draft.ref} — hidden from the client until sent`) : active ? t("نسخة جديدة من العرض الحالي — إرسالها يلغي السابق", "A new version of the current quote — sending it supersedes the previous one") : t("مسودة جديدة — لا يراها العميل حتى ترسلها", "New draft — hidden from the client until sent")}</p>
          <QuoteEditor
            key={draft?.id ?? "new"}
            projectId={project.id}
            initial={seed}
            initialCost={costOf(draft?.id ?? active?.id)}
            ctx={ctx}
            onSave={save}
            onSend={send}
            onDelete={draft ? async () => { if (actor && window.confirm(t("حذف المسودة؟", "Delete the draft?"))) await done(await run(() => projectsRepo.deleteQuote(draft.id, actor), t("حُذفت المسودة", "Draft deleted"))); } : () => setComposing(false)}
          />
        </div>
      )}
      {active ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm text-paper-600"><bdi dir="ltr">{active.ref}</bdi>{active.sentAt ? ` · ${t("أُرسل", "sent")} ${date(new Date(active.sentAt), { day: "numeric", month: "long" })}` : ""}</p>
            <QuoteStatus q={active} staff />
          </div>
          <QuoteBody q={active} />
          <InternalMargin q={active} cost={costOf(active.id)} floor={ctx.marginFloor} />
          {active.decisionNote && <p className="mt-3 rounded-xl bg-[#FDF0E6] text-[#9A4B12] px-4 py-2.5 text-sm">{t("ملاحظة العميل: ", "Client note: ")}{active.decisionNote}</p>}
          {active.status === "paid" && (
            <p className="mt-3 rounded-xl bg-[#E6F2EC] text-[#1F6B4F] px-4 py-2.5 text-sm">
              {t(`استُلم ${money(active.paidAmount ?? 0)}`, `Received ${money(active.paidAmount ?? 0)}`)} · {active.paymentMethod === "moyasar" ? t("مويسر", "Moyasar") : active.paymentMethod === "cash" ? t("نقداً", "Cash") : t("تحويل بنكي", "Bank transfer")} · <bdi dir="ltr">{active.paymentRef}</bdi>
            </p>
          )}
          {manage && can("payments.view") && (active.status === "sent" || active.status === "accepted") && (
            <div className="mt-4">
              <MarkPaid q={active} onMark={async (method, ref, amount) => (actor ? done(await run(() => projectsRepo.markQuotePaid(active.id, method, ref, amount, actor), t("سُجّلت الدفعة", "Payment recorded"))) : false)} />
            </div>
          )}
        </div>
      ) : (
        !editing && <p className="text-sm text-paper-500">{manage ? t("لا عرض بعد. اكتب البنود والأسعار، والضريبة والعربون يُحسبان تلقائياً.", "No quote yet. Enter the lines and prices; VAT and the deposit are calculated automatically.") : t("لا عرض بعد.", "No quote yet.")}</p>
      )}
      {older.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-paper-600">{t("عروض سابقة", "Earlier quotes")}</summary>
          <ul className="mt-2 space-y-1">
            {older.map((q) => <li key={q.id} className="flex justify-between gap-3 text-paper-600"><bdi dir="ltr">{q.ref}</bdi><span>{money(q.total)}</span></li>)}
          </ul>
        </details>
      )}
    </Card>
  );
}

export function ProjectAdmin() {
  const { id } = useParams();
  const { t, pick } = useI18n();
  const allowed = useCanSeeProjects();
  const { run, member, contact } = useCrm();
  const nav = useNavigate();
  const { actor, data, reload } = useProjects();
  const [newVersionOf, setNewVersionOf] = useState<ProjectItem | null>(null);
  const [editing, setEditing] = useState(false);
  const { can, user } = useAuth();
  const [stock, setStock] = useState<InventoryData>({ items: [], moves: [] });
  const [policy, setPolicy] = useState<PricingPolicy>(DEFAULT_POLICY);
  const loadStock = useMemo(() => async () => {
    if (actor && (can("inventory.view") || can("inventory.manage"))) setStock(await inventoryRepo.load(actor).catch(() => ({ items: [], moves: [] })));
  }, [actor, can]);
  useEffect(() => {
    void loadStock();
    if (actor) void pricingRepo.policy(actor).then(setPolicy).catch(() => undefined);
  }, [actor, loadStock]);
  const editorCtx: EditorContext = { items: stock.items, cap: user ? capFor(policy, user.role) : 0, marginFloor: policy.marginFloor };
  if (!allowed) return <Denied />;
  if (!data) return <div className="h-48 rounded-2xl shimmer bg-paper-100" />;
  const p = data.projects.find((x) => x.id === id);
  if (!p) return <Card><Empty icon="ri-folder-forbid-line" title={t("لم نجد المشروع", "Project not found")} hint={t("ربما حُذف أو لم يُسند إليك.", "It may have been deleted or not assigned to you.")} /></Card>;
  const acc = accessOf(p, actor);
  const canUpload = acc === "manage" || acc === "designer";
  const items = data.items.filter((i) => i.projectId === p.id);
  const groups = groupItems(items);
  const comments = data.comments.filter((c) => c.projectId === p.id);
  const designer = member(p.designerId ?? null);
  const track = trackInfo(p.track);
  const after = async () => {
    setNewVersionOf(null);
    await reload();
  };
  const remove = async () => {
    if (!actor || !window.confirm(t(`حذف «${p.title}» وكل تصاميمه ونقاشه نهائياً؟`, `Delete “${p.title}” with all its designs and messages permanently?`))) return;
    if (await run(() => projectsRepo.deleteProject(p.id, actor), t("حُذف المشروع", "Project deleted"))) nav("/admin/projects");
  };

  return (
    <>
      <Link to="/admin/projects" className="inline-flex items-center gap-2 text-sm text-paper-600 hover:text-ink-900 mb-3">
        <i className="ri-arrow-right-line inline-block flip-ltr" aria-hidden="true"></i>
        {t("كل المشاريع", "All projects")}
      </Link>
      <PageTitle
        title={p.title}
        sub={<span>{[track ? pick(track.title) : null, pick(STATUS_LABELS[p.status]), designer ? t(`المصمم: ${designer.firstName} ${designer.lastName}`, `Designer: ${designer.firstName} ${designer.lastName}`) : null].filter(Boolean).join(" · ")}</span>}
        actions={acc === "manage" ? <Btn variant="secondary" onClick={() => setEditing(true)}><i className="ri-settings-3-line" aria-hidden="true"></i>{t("إعدادات المشروع", "Project settings")}</Btn> : undefined}
      />
      <Card className="p-5 mb-6">
        <StageTracker stage={p.stage} track={p.track} />
        <p className="mt-4 text-xs text-paper-500 flex flex-wrap items-center gap-2">
          <span dir="ltr">{p.clientEmail}</span>
          {p.clientId ? <span className="rounded-full bg-[#E6F2EC] text-[#1F6B4F] px-2 py-0.5">{t("مرتبط بحساب العميل", "Linked to client account")}</span> : <span className="rounded-full bg-paper-100 text-paper-600 px-2 py-0.5">{t("يُربط عند تسجيل العميل بهذا البريد", "Links when the client signs up with this email")}</span>}
          {p.contactId && <Link to={`/admin/contacts/${p.contactId}`} className="underline underline-offset-4 hover:text-ink-900">{t("ملف العميل في الـCRM", "CRM profile")}</Link>}
        </p>
      </Card>
      {(acc === "manage" || acc === "view") && <QuotePanel project={p} quotes={data.quotes.filter((q) => q.projectId === p.id)} quoteCosts={data.quoteCosts} ctx={editorCtx} manage={acc === "manage"} reload={async () => { await reload(); await loadStock(); }} />}
      {(acc === "manage" || acc === "view") && (
        <ContractsPanel
          project={p}
          contracts={data.contracts.filter((c) => c.projectId === p.id)}
          quotes={data.quotes.filter((q) => q.projectId === p.id)}
          clientName={contact(p.contactId ?? null)?.name || [p.brief?.firstName, p.brief?.lastName].filter(Boolean).join(" ") || p.clientEmail}
          manage={acc === "manage"}
          reload={reload}
        />
      )}
      {(acc === "manage" || acc === "view") && <CostsPanel project={p} data={data} stock={stock} manage={acc === "manage"} reload={async () => { await reload(); await loadStock(); }} />}
      <div className="grid xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-7 space-y-4" aria-labelledby="pa-designs">
          <h2 id="pa-designs" className="font-display text-xl text-ink-900">{t("التصاميم والاعتمادات", "Designs & approvals")}</h2>
          {canUpload && !newVersionOf && (
            <Card className="p-5" title={t("أرسل تصميماً جديداً للاعتماد", "Send a new design for approval")}>
              <Uploader project={p} thread={null} onDone={after} />
            </Card>
          )}
          {groups.length === 0 ? (
            <Card><Empty icon="ri-palette-line" title={t("لا تصاميم بعد", "No designs yet")} hint={t("أول تصميم ترسله يظهر للعميل في حسابه ليعتمده.", "The first design you send appears in the client's account to approve.")} /></Card>
          ) : (
            groups.map((g) => (
              <ItemCard
                key={g.latest.id}
                latest={g.latest}
                history={g.history}
                staff
                actions={canUpload && !g.latest.byClient && newVersionOf?.id !== g.latest.id ? (
                  <Btn variant={g.latest.status === "changes" ? "primary" : "secondary"} onClick={() => setNewVersionOf(g.latest)}>
                    <i className="ri-upload-2-line" aria-hidden="true"></i>
                    {g.latest.status === "changes" ? t("أرسل نسخة معدّلة", "Send revised version") : t("نسخة جديدة", "New version")}
                  </Btn>
                ) : undefined}
              >
                {newVersionOf?.id === g.latest.id && (
                  <div className="mt-4 border-t border-paper-100 pt-4">
                    <Uploader project={p} thread={g.latest} onDone={after} onCancel={() => setNewVersionOf(null)} />
                  </div>
                )}
              </ItemCard>
            ))
          )}
        </section>
        <section className="xl:col-span-5 xl:sticky xl:top-6 space-y-6" aria-labelledby="pa-chat">
          <BriefSummary brief={p.brief} />
          {p.track && p.track !== "P" && (
            <details className="group rounded-2xl bg-white border border-paper-200">
              <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 font-display text-xl text-ink-900">
                {t("متطلبات التصنيع", "Manufacturing requirements")}
                <i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180" aria-hidden="true"></i>
              </summary>
              <div className="px-5 pb-5">
                <ManufacturingRequirements track={p.track as "A"} compact />
              </div>
            </details>
          )}
          <Card className="p-5">
            <h2 id="pa-chat" className="font-display text-xl text-ink-900 mb-1">{t("النقاش مع العميل", "Discussion with the client")}</h2>
            <p className="text-xs text-paper-500 mb-4">{t("كل رسالة هنا يراها العميل.", "The client sees every message here.")}</p>
            <CommentThread comments={comments} items={items} viewerIsClient={false} onSend={(body) => (actor ? run(() => projectsRepo.comment(p.id, null, body, actor)).then(async (ok) => (await reload(), ok)) : Promise.resolve(false))} />
          </Card>
        </section>
      </div>
      <Drawer open={editing} onClose={() => setEditing(false)} title={t("إعدادات المشروع", "Project settings")}>
        <header className="sticky top-0 z-10 bg-paper-50/95 backdrop-blur border-b border-paper-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink-900">{t("إعدادات المشروع", "Project settings")}</h2>
          <button type="button" onClick={() => setEditing(false)} className="w-9 h-9 rounded-full hover:bg-paper-100" aria-label={t("إغلاق", "Close")}><i className="ri-close-line text-lg" aria-hidden="true"></i></button>
        </header>
        <div className="p-6 space-y-6">
          {editing && (
            <ProjectForm
              initial={{ title: p.title, track: p.track ?? null, contactId: p.contactId ?? null, clientEmail: p.clientEmail, designerId: p.designerId ?? null, ownerId: p.ownerId ?? null, stage: p.stage, status: p.status, dueDate: p.dueDate ?? null }}
              submitLabel={t("حفظ", "Save")}
              onSubmit={async (d) => {
                if (actor && (await run(() => projectsRepo.updateProject(p.id, d, actor), t("حُفظ المشروع", "Project saved")))) {
                  setEditing(false);
                  await reload();
                }
              }}
            />
          )}
          {/* الحذف يمحو العروض والتكاليف: للمالك والمدير فقط (كالخادم) */}
          {can("team.manage") && <div className="border-t border-paper-200 pt-4">
            <Btn variant="danger" onClick={remove}><i className="ri-delete-bin-line" aria-hidden="true"></i>{t("حذف المشروع", "Delete project")}</Btn>
          </div>}
        </div>
      </Drawer>
    </>
  );
}
