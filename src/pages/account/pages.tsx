import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { serviceById } from "@/data/services";
import { PageTitle, Panel } from "./ui";
import { BriefSummary, CommentThread, ItemCard, StageTracker, groupItems } from "@/projects/components";
import { projectsRepo } from "@/projects/repo";
import { KIND_LABELS, STATUS_LABELS, type Project, type ProjectItem, type SavedDesign } from "@/projects/types";
import { useAccount } from "./AccountLayout";
import { ClientQuotes, useMoney } from "@/projects/quotes";
import { clientActions, type ClientAction } from "@/projects/next";
import { stageLabel } from "@/projects/stages";
import { verifyPayment } from "@/lib/payments";
import ClientContracts from "./ClientContracts";
import { ManufacturingRequirements } from "@/components/feature/Requirements";

const btn = "rounded-full px-5 py-2.5 text-sm transition-colors disabled:opacity-40";

function Empty({ icon, title, hint, children }: { icon: string; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-paper-300 bg-white/60 p-8 md:p-10 text-center">
      <i className={`${icon} text-3xl text-paper-400`} aria-hidden="true"></i>
      <p className="mt-3 font-display text-xl text-ink-900">{title}</p>
      <p className="mt-2 text-sm text-paper-600 max-w-md mx-auto leading-[1.8]">{hint}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

function ProjectCard({ p, items }: { p: Project; items: ProjectItem[] }) {
  const { t, pick, num } = useI18n();
  const mine = items.filter((i) => i.projectId === p.id);
  const pending = mine.filter((i) => i.status === "pending").length;
  const track = p.track ? serviceById(p.track as never) : null;
  return (
    <Link to={`/account/projects/${p.id}`} className="block rounded-2xl bg-white border border-paper-200 hover:border-ink-900 p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl text-ink-900 truncate">{p.title}</p>
          <p className="mt-1 text-xs text-paper-500">{[track ? pick(track.title) : null, pick(STATUS_LABELS[p.status])].filter(Boolean).join(" · ")}</p>
        </div>
        {pending > 0 && <span className="shrink-0 rounded-full bg-accent2 text-white text-xs px-2.5 py-1">{t(`${num(pending)} بانتظارك`, `${pending} waiting`)}</span>}
      </div>
      <div className="mt-5"><StageTracker stage={p.stage} track={p.track} /></div>
    </Link>
  );
}

function Loading() {
  const { t } = useI18n();
  return <div className="h-48 rounded-2xl shimmer bg-paper-100" aria-label={t("جاري التحميل", "Loading")} />;
}

// ─── نظرة عامة ─────────────────────────────────────────────────────

/** خطوة واحدة واضحة: ما المطلوب منك الآن؟ (وإن لم يكن شيء: على ماذا يعمل الفريق) */
function NextStep() {
  const { t, pick, num } = useI18n();
  const { data } = useAccount();
  const money = useMoney();
  if (!data) return null;
  const actions = clientActions(data);
  const title = (id: string) => data.projects.find((p) => p.id === id)?.title ?? "";
  const text = (a: ClientAction) =>
    a.kind === "deposit"
      ? { head: t(`ادفع عربون «${title(a.projectId)}»`, `Pay the deposit for “${title(a.projectId)}”`), sub: t(`${money(a.quote.deposit)} — بعدها يبدأ العمل مباشرة`, `${money(a.quote.deposit)} — work starts right after`), cta: t("ادفع العربون", "Pay deposit") }
      : a.kind === "contract"
        ? { head: t(`وقّع عقد «${title(a.projectId)}»`, `Sign the contract for “${title(a.projectId)}”`), sub: `${a.contract.ref} · ${a.contract.title}`, cta: t("راجِع ووقّع", "Review & sign") }
      : a.kind === "quote"
        ? { head: t(`راجع عرض السعر لـ«${title(a.projectId)}»`, `Review the quote for “${title(a.projectId)}”`), sub: t(`${a.quote.ref} · ${money(a.quote.total)} شامل الضريبة`, `${a.quote.ref} · ${money(a.quote.total)} incl. VAT`), cta: t("راجِع واعتمد", "Review") }
        : { head: t(`اعتمد «${a.item.title}»`, `Approve “${a.item.title}”`), sub: `${title(a.projectId)} · ${t(`النسخة ${num(a.item.version)}`, `v${a.item.version}`)}`, cta: t("راجِع واعتمد", "Review") };
  if (!actions.length) {
    const active = data.projects.filter((p) => p.status === "active").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return (
      <section aria-labelledby="ov-next" className="rounded-2xl bg-white border border-paper-200 p-5 md:p-7">
        <p className="text-sm text-paper-500">{t("خطوتك التالية", "Your next step")}</p>
        <h2 id="ov-next" className="mt-1 font-display text-2xl text-ink-900">{t("لا شيء مطلوب منك الآن", "Nothing needs you right now")}</h2>
        {active && <p className="mt-2 text-paper-600">{t(`الفريق يعمل على «${pick(stageLabel(active.track, active.stage))}» في «${active.title}». سنخبرك حين يصلك شيء للاعتماد.`, `The team is on “${pick(stageLabel(active.track, active.stage))}” for “${active.title}”. We'll tell you when something needs your approval.`)}</p>}
      </section>
    );
  }
  const [first, ...rest] = actions;
  const f = text(first);
  return (
    <section aria-labelledby="ov-next" className="rounded-2xl bg-ink-900 text-white overflow-hidden">
      <div className="p-5 md:p-7 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[14rem]">
          <p className="text-sm text-white/60 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent2" aria-hidden="true" />{t("خطوتك التالية", "Your next step")}</p>
          <h2 id="ov-next" className="mt-1 font-display text-2xl">{f.head}</h2>
          <p className="mt-1 text-white/70 text-sm">{f.sub}</p>
        </div>
        <Link to={first.to} aria-label={`${f.cta}: ${f.head}`} className="shrink-0 rounded-full bg-white text-ink-900 px-5 py-2.5 text-sm">{f.cta}</Link>
      </div>
      {rest.length > 0 && (
        <div className="border-t border-white/10">
          <p className="px-5 md:px-7 pt-3 text-xs text-white/50">{t(`وبعدها (${num(rest.length)})`, `Then (${rest.length})`)}</p>
          <ul>
            {rest.map((a, i) => {
              const x = text(a);
              return (
                <li key={i} className="border-b border-white/5 last:border-0">
                  <Link to={a.to} className="flex items-center gap-4 px-5 md:px-7 py-3 hover:bg-white/5">
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm">{x.head}</span>
                      <span className="block text-xs text-white/50 truncate">{x.sub}</span>
                    </span>
                    <span className="shrink-0 text-xs text-white/70">{x.cta}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
// قائمة التفعيل (على طريقة بوابات الدفع): خطوات واضحة تُعلَّم تلقائياً من بيانات الحساب
function GettingStarted() {
  const { t } = useI18n();
  const { data, actor } = useAccount();
  const [designs, setDesigns] = useState<number | null>(null);
  useEffect(() => {
    if (actor) void projectsRepo.listDesigns(actor).then((d) => setDesigns(d.length)).catch(() => setDesigns(0));
  }, [actor]);
  if (!data) return null;
  const hasProject = data.projects.length > 0;
  const quoted = data.quotes.some((q) => q.status !== "draft" && q.status !== "void");
  const paid = data.quotes.some((q) => q.status === "paid");
  const steps = [
    { id: "account", done: true, head: t("أنشأت حسابك", "Account created"), sub: t("بريدك هو مفتاح كل مشاريعك", "Your email is the key to all your projects"), to: "" },
    { id: "design", done: (designs ?? 0) > 0 || hasProject, head: t("صمّم في الاستوديو أو احسب التكلفة", "Design in the studio or calculate the cost"), sub: t("اختياري، لكنه يسرّع العرض", "Optional, but it speeds up the quote"), to: "/studio-3d?track=C" },
    { id: "request", done: hasProject, head: t("أرسل طلبك", "Send your request"), sub: t("اختر المسار وأجب عن أسئلة سريعة", "Pick a track and answer quick questions"), to: "/services" },
    { id: "quote", done: quoted, head: t("استلم عرض السعر", "Receive the quote"), sub: t("خلال يوم عمل من مدير مشروعك", "Within one business day from your project manager"), to: "" },
    { id: "deposit", done: paid, head: t("اعتمد وادفع العربون", "Approve and pay the deposit"), sub: t("50٪ — ويبدأ العمل مباشرة", "50% — and work starts right away"), to: "" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  return (
    <section aria-labelledby="gs-title" className="rounded-2xl bg-white border border-paper-200 p-5 md:p-7" data-testid="getting-started">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-paper-500">{t("ابدأ خلال دقائق", "Start in minutes")}</p>
          <h2 id="gs-title" className="mt-1 font-display text-2xl text-ink-900">{t(`${doneCount} من ${steps.length} خطوات مكتملة`, `${doneCount} of ${steps.length} steps done`)}</h2>
        </div>
        <div className="h-1.5 w-40 rounded-full bg-paper-200 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label={t("تقدّم التفعيل", "Activation progress")}>
          <div className="h-full bg-accent3 rounded-full transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="mt-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map((s, i) => {
          const next = !s.done && steps.slice(0, i).every((x) => x.done);
          const inner = (
            <>
              <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs ${s.done ? "bg-accent3 text-white" : next ? "bg-ink-900 text-white" : "border border-paper-300 text-paper-500"}`} aria-hidden="true">{s.done ? <i className="ri-check-line"></i> : i + 1}</span>
              <span className="min-w-0">
                <span className={`block text-sm ${s.done ? "text-paper-500 line-through decoration-paper-300" : "text-ink-900"}`}>{s.head}</span>
                <span className="block text-xs text-paper-500 mt-0.5">{s.sub}</span>
              </span>
            </>
          );
          const cls = `flex items-start gap-3 rounded-xl p-3 border ${next ? "border-ink-900 bg-paper-50" : "border-paper-200"}`;
          return (
            <li key={s.id} aria-current={next ? "step" : undefined}>
              {s.to && !s.done ? <Link to={s.to} className={`${cls} hover:border-ink-900 transition-colors`}>{inner}</Link> : <div className={cls}>{inner}</div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function AccountOverview() {
  const { user } = useAuth();
  const { t, date, num } = useI18n();
  const { data, error, claimed } = useAccount();
  const [params] = useSearchParams();
  const greeting = new Date().getHours() < 12 ? t("صباح الخير", "Good morning") : t("مساء الخير", "Good evening");
  // قادم من «ابدأ مسارك»: افتح المشروع الذي أُنشئ للتو
  if (params.get("started") && data && claimed[0]) return <Navigate to={`/account/projects/${claimed[0]}?new=1`} replace />;
  return (
    <>
      <PageTitle kicker={date(new Date(), { weekday: "long", day: "numeric", month: "long" })} title={`${greeting}${t("، ", ", ")}${user?.firstName ?? ""}`} />
      {error ? (
        <p role="alert" className="text-paper-600">{t("تعذّر تحميل مشاريعك. حدّث الصفحة بعد قليل.", "Couldn't load your projects. Refresh in a moment.")}</p>
      ) : !data ? (
        <Loading />
      ) : data.projects.length === 0 ? (
        <div className="space-y-8">
          <GettingStarted />
          <Empty icon="ri-folder-open-line" title={t("لا مشاريع في حسابك بعد", "No projects in your account yet")} hint={t("حين يبدأ مشروعك معنا يظهر هنا بمراحله، وتصلك التصاميم لاعتمادها. سيُربط تلقائياً ببريدك.", "Once your project starts, it appears here with its stages and the designs to approve. It links to your email automatically.")}>
            <Link to="/services" className={`${btn} bg-ink-900 text-white`}>{t("ابدأ مشروعك", "Start your project")}</Link>
            <Link to="/book" className={`${btn} border border-paper-300 text-ink-900`}>{t("احجز مكالمة مجانية", "Book a free call")}</Link>
            <Link to="/studio-3d" className={`${btn} border border-paper-300 text-ink-900`}>{t("جرّب استوديو 3D", "Try the 3D studio")}</Link>
          </Empty>
        </div>
      ) : (
        <div className="space-y-8">
          <GettingStarted />
          <NextStep />
          <section aria-labelledby="ov-projects">
            <h2 id="ov-projects" className="font-display text-xl text-ink-900 mb-4">{t("مشاريعك", "Your projects")}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {data.projects.map((p) => <ProjectCard key={p.id} p={p} items={data.items} />)}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function AccountProjects() {
  const { t } = useI18n();
  const { data } = useAccount();
  return (
    <>
      <PageTitle kicker={t("حسابي", "My account")} title={t("مشاريعي", "My projects")} />
      {!data ? <Loading /> : data.projects.length === 0 ? (
        <Empty icon="ri-folder-open-line" title={t("لا مشاريع بعد", "No projects yet")} hint={t("سيظهر مشروعك هنا بمجرد أن يفتحه فريقنا ببريدك.", "Your project appears here once our team opens it with your email.")}>
          <Link to="/book" className={`${btn} bg-ink-900 text-white`}>{t("احجز مكالمة مجانية", "Book a free call")}</Link>
        </Empty>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">{data.projects.map((p) => <ProjectCard key={p.id} p={p} items={data.items} />)}</div>
      )}
    </>
  );
}

// ─── قرار الاعتماد ───────────────────────────────────────────────
function Decision({ item }: { item: ProjectItem }) {
  const { t, num } = useI18n();
  const { run } = useAccount();
  const [mode, setMode] = useState<"" | "changes">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    if (!window.confirm(t(`اعتماد النسخة ${num(item.version)} من «${item.title}»؟ سنبدأ التنفيذ عليها.`, `Approve version ${item.version} of “${item.title}”? We'll proceed with it.`))) return;
    setBusy(true);
    await run((a) => projectsRepo.decide(item.id, "approved", "", a), t("شكراً، اعتُمد التصميم", "Thanks — design approved"));
    setBusy(false);
  };
  const changes = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (await run((a) => projectsRepo.decide(item.id, "changes", note, a), t("وصل طلبك للفريق، سنرسل نسخة معدّلة", "Sent to the team — we'll send a revised version"))) {
      setNote("");
      setMode("");
    }
    setBusy(false);
  };
  if (mode === "changes")
    return (
      <form onSubmit={changes} className="w-full space-y-2">
        <label className="block">
          <span className="block text-xs text-paper-600 mb-1.5">{t("ما الذي تريد تعديله؟", "What would you like changed?")}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} required autoFocus className="w-full bg-white border border-paper-200 focus:border-ink-900 rounded-xl px-4 py-3 text-sm outline-none resize-none" placeholder={t("مثال: نريد اسم العطر أكبر، واللون الذهبي أدفأ.", "e.g. Make the name bigger and the gold warmer.")} />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={busy || !note.trim()} className={`${btn} bg-ink-900 text-white`}>{t("أرسل طلب التعديل", "Send change request")}</button>
          <button type="button" onClick={() => setMode("")} className={`${btn} text-paper-600`}>{t("إلغاء", "Cancel")}</button>
        </div>
      </form>
    );
  return (
    <>
      <button type="button" onClick={approve} disabled={busy} className={`${btn} bg-[#1F6B4F] text-white inline-flex items-center gap-2`}>
        <i className="ri-check-line" aria-hidden="true"></i>
        {t("اعتماد", "Approve")}
      </button>
      <button type="button" onClick={() => setMode("changes")} disabled={busy} className={`${btn} border border-paper-300 text-ink-900 inline-flex items-center gap-2`}>
        <i className="ri-edit-2-line" aria-hidden="true"></i>
        {t("طلب تعديل", "Request changes")}
      </button>
    </>
  );
}

function SendDesign({ projectId }: { projectId: string }) {
  const { t, pick } = useI18n();
  const { actor, run } = useAccount();
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null);
  const [pick_, setPick] = useState("");
  const [kind, setKind] = useState<ProjectItem["kind"]>("bottle");
  const [note, setNote] = useState("");
  const uid = useId();
  useEffect(() => {
    if (actor) void projectsRepo.listDesigns(actor).then(setDesigns);
  }, [actor]);
  if (!designs) return null;
  if (!designs.length)
    return (
      <p className="text-sm text-paper-600">
        {t("لا تصاميم محفوظة في حسابك.", "No saved designs in your account.")} <Link to="/studio-3d" className="underline underline-offset-4 text-ink-900">{t("صمّم في استوديو 3D واحفظه", "Design in the 3D studio and save it")}</Link>
      </p>
    );
  const d = designs.find((x) => x.id === pick_);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!d) return;
    if (await run((a) => projectsRepo.addItem({ projectId, kind, title: d.name, files: [], studio: { link: d.link, summary: d.summary }, note }, a), t("أُرسل التصميم للفريق", "Design sent to the team"))) {
      setPick("");
      setNote("");
    }
  };
  return (
    <form onSubmit={send} className="grid sm:grid-cols-[1fr_10rem] gap-3 items-end">
      <div>
        <label htmlFor={`${uid}-d`} className="block text-xs text-paper-600 mb-1.5">{t("التصميم", "Design")}</label>
        <select id={`${uid}-d`} value={pick_} onChange={(e) => setPick(e.target.value)} required className="w-full bg-white border border-paper-200 rounded-xl px-3 py-2.5 text-sm">
          <option value="">{t("اختر من تصاميمك", "Choose from your designs")}</option>
          {designs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-k`} className="block text-xs text-paper-600 mb-1.5">{t("النوع", "Type")}</label>
        <select id={`${uid}-k`} value={kind} onChange={(e) => setKind(e.target.value as ProjectItem["kind"])} className="w-full bg-white border border-paper-200 rounded-xl px-3 py-2.5 text-sm">
          {(["bottle", "label", "box", "identity", "other"] as const).map((k) => <option key={k} value={k}>{pick(KIND_LABELS[k])}</option>)}
        </select>
      </div>
      <label className="block sm:col-span-2">
        <span className="block text-xs text-paper-600 mb-1.5">{t("ملاحظة للفريق (اختياري)", "Note for the team (optional)")}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="w-full bg-white border border-paper-200 rounded-xl px-3 py-2.5 text-sm" />
      </label>
      <button type="submit" disabled={!d} className={`${btn} bg-ink-900 text-white sm:col-span-2 justify-self-start`}>{t("أرسل للفريق", "Send to the team")}</button>
    </form>
  );
}

// ─── المشروع ───────────────────────────────────────────────────────
export function AccountProject() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const { t, pick, date } = useI18n();
  const { data, run, reload } = useAccount();
  const { user } = useAuth();
  const p = data?.projects.find((x) => x.id === projectId);
  const items = useMemo(() => data?.items.filter((i) => i.projectId === projectId) ?? [], [data, projectId]);
  const quotes = data?.quotes.filter((q) => q.projectId === projectId) ?? [];
  // العودة من مويسر: ?pay=<العرض>&id=<الدفعة> — التحقق على الخادم لا من معاملات الرابط
  const payId = params.get("pay") ? params.get("id") : null;
  const [payState, setPayState] = useState<"checking" | "paid" | "failed" | "review" | null>(payId ? "checking" : null);
  useEffect(() => {
    if (!payId) return;
    let live = true;
    void verifyPayment(payId).then(async (r) => {
      if (!live) return;
      // خُصم المبلغ لكن تعذّر تسجيله تلقائياً: الفريق يراجعه — لا ندعو العميل للدفع مرة أخرى
      setPayState(r.paid ? "paid" : ["needs_review", "db_unreachable", "record_failed", "unverified", "gateway_unreachable"].includes(r.status) ? "review" : "failed");
      if (r.paid) await reload();
    });
    return () => {
      live = false;
    };
  }, [payId, reload]);
  const groups = useMemo(() => groupItems(items), [items]);
  const comments = data?.comments.filter((c) => c.projectId === projectId) ?? [];

  // الانتقال لعنصر محدد من رابط (#it-…)
  useEffect(() => {
    if (!data || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ block: "center" });
  }, [data]);

  if (!data) return <Loading />;
  if (!p)
    return (
      <Empty icon="ri-folder-forbid-line" title={t("لم نجد هذا المشروع في حسابك", "This project isn't in your account")} hint={t("ربما أُرسل الرابط لبريد آخر.", "The link may belong to another email.")}>
        <Link to="/account" className={`${btn} bg-ink-900 text-white`}>{t("العودة لحسابي", "Back to my account")}</Link>
      </Empty>
    );
  const track = p.track ? serviceById(p.track as never) : null;
  return (
    <>
      <PageTitle kicker={[track ? pick(track.title) : t("مشروع", "Project"), pick(STATUS_LABELS[p.status]), p.dueDate ? t(`التسليم المتوقع ${date(new Date(p.dueDate), { day: "numeric", month: "long" })}`, `Due ${date(new Date(p.dueDate), { day: "numeric", month: "long" })}`) : null].filter(Boolean).join(" · ")} title={p.title} />
      <div className="mb-8 rounded-2xl bg-white border border-paper-200 p-5"><StageTracker stage={p.stage} track={p.track} /></div>
      {payState && (
        <p role={payState === "checking" ? undefined : "status"} aria-live="polite" className={`mb-6 rounded-xl px-4 py-3 text-sm ${payState === "paid" ? "bg-[#E6F2EC] text-[#1F6B4F]" : payState === "failed" ? "bg-red-50 text-red-800" : "bg-paper-100 text-paper-600"}`}>
          {payState === "checking" ? t("نتحقق من الدفع…", "Verifying your payment…") : payState === "paid" ? t("تم الدفع — استلمنا العربون وبدأ العمل.", "Payment received — your deposit is in and work has started.") : payState === "review" ? t("وصلتنا عملية الدفع وتحتاج تأكيداً من الفريق. لا تدفع مرة أخرى — سنتواصل معك خلال يوم عمل.", "We received your payment and the team needs to confirm it. Don't pay again — we'll contact you within one business day.") : t("لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى أو التحويل بنكياً.", "The payment didn't go through. Try again or pay by bank transfer.")}
        </p>
      )}
      {p.stage === "brief" && items.length === 0 && quotes.length === 0 && (
        <section role={params.get("new") ? "status" : undefined} className="mb-8 rounded-2xl bg-ink-900 text-white p-5 md:p-7" aria-labelledby="pj-next">
          <p className="text-sm text-white/60">{params.get("new") ? t("استلمنا طلبك", "We've got your request") : t("الخطوة التالية", "Next step")}</p>
          <h2 id="pj-next" className="mt-1 font-display text-2xl">{t("مدير مشروع يتصل بك خلال يوم عمل", "A project manager will call you within one business day")}</h2>
          <p className="mt-2 text-white/75 leading-[1.8] max-w-2xl">{t("نؤكد التفاصيل معك ونرسل العرض. بعدها تصلك التصاميم هنا لتعتمدها أو تطلب تعديلها، وتتابع كل مرحلة من هذه الصفحة.", "We'll confirm the details with you and send the proposal. After that, designs arrive here for you to approve or adjust, and you follow every stage from this page.")}</p>
        </section>
      )}
      <div className="grid xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-7 space-y-4" aria-labelledby="pj-designs">
          <ClientContracts contracts={data.contracts.filter((c) => c.projectId === p.id)} run={run} defaultName={user ? `${user.firstName} ${user.lastName}`.trim() : ""} />
          <ClientQuotes
            quotes={quotes}
            onDecide={(q, decision, note) => run((a) => projectsRepo.decideQuote(q.id, decision, note, a), decision === "accepted" ? t("اعتُمد العرض", "Quote approved") : t("وصل طلبك للفريق", "Your request reached the team"))}
            onTransferNote={(body) => run((a) => projectsRepo.comment(p.id, null, body, a))}
            payReturn={(q) => `/account/projects/${p.id}?pay=${q.id}`}
          />
          <h2 id="pj-designs" className="font-display text-xl text-ink-900">{t("التصاميم", "Designs")}</h2>
          {groups.length === 0 ? (
            <Empty icon="ri-palette-line" title={t("لا تصاميم بعد", "No designs yet")} hint={t("حين يرسل الفريق تصميماً تراه هنا وتعتمده أو تطلب تعديله.", "When the team sends a design, you'll see it here to approve or request changes.")} />
          ) : (
            groups.map((g) => (
              <div key={g.latest.id} id={`it-${g.latest.id}`} className="scroll-mt-24">
                <ItemCard latest={g.latest} history={g.history} actions={g.latest.status === "pending" ? <Decision item={g.latest} /> : undefined} />
              </div>
            ))
          )}
          <Panel title={t("أرسل تصميماً من حسابك", "Send a design from your account")} kicker={t("من استوديو 3D", "From the 3D studio")}>
            <SendDesign projectId={p.id} />
          </Panel>
        </section>
        <section className="xl:col-span-5 xl:sticky xl:top-6 space-y-6" aria-labelledby="pj-chat">
          <BriefSummary brief={p.brief} />
          {track && (
            <details className="group rounded-2xl bg-white border border-paper-200" open={p.stage === "brief"}>
              <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 font-display text-xl text-ink-900">
                {t("ما نحتاجه منك", "What we need from you")}
                <i className="ri-arrow-down-s-line text-xl transition-transform group-open:rotate-180" aria-hidden="true"></i>
              </summary>
              <div className="px-5 pb-5">
                <ManufacturingRequirements track={track.id} only="client" compact />
              </div>
            </details>
          )}
          <div className="rounded-2xl bg-white border border-paper-200 p-5">
            <h2 id="pj-chat" className="font-display text-xl text-ink-900 mb-4">{t("النقاش مع الفريق", "Talk to the team")}</h2>
            <CommentThread comments={comments} items={items} viewerIsClient onSend={(body) => run((a) => projectsRepo.comment(p.id, null, body, a))} />
          </div>
        </section>
      </div>
    </>
  );
}

export function AccountApprovals() {
  const { t } = useI18n();
  const { data } = useAccount();
  const pending = data?.items.filter((i) => i.status === "pending") ?? [];
  const recent = data?.items.filter((i) => i.status === "approved" || i.status === "changes").sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "")).slice(0, 6) ?? [];
  const projectOf = (id: string) => data?.projects.find((p) => p.id === id)?.title ?? "";
  return (
    <>
      <PageTitle kicker={t("حسابي", "My account")} title={t("بانتظار اعتمادي", "Awaiting my approval")} />
      {!data ? <Loading /> : (
        <div className="space-y-8">
          {pending.length === 0 ? (
            <Empty icon="ri-checkbox-circle-line" title={t("لا شيء بانتظارك", "Nothing waiting on you")} hint={t("كل التصاميم المرسلة حُسم أمرها. سنخبرك هنا بأي جديد.", "Every design sent has been decided. New ones will appear here.")} />
          ) : (
            <div className="space-y-4">
              {pending.map((i) => (
                <div key={i.id}>
                  <p className="text-xs text-paper-500 mb-2">{projectOf(i.projectId)}</p>
                  <ItemCard latest={i} history={data.items.filter((x) => x.threadId === i.threadId)} actions={<Decision item={i} />} />
                </div>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <section aria-labelledby="ap-recent">
              <h2 id="ap-recent" className="font-display text-xl text-ink-900 mb-3">{t("قراراتك الأخيرة", "Your recent decisions")}</h2>
              <ul className="space-y-2">
                {recent.map((i) => (
                  <li key={i.id}>
                    <Link to={`/account/projects/${i.projectId}`} className="flex items-center gap-3 rounded-xl bg-white border border-paper-200 px-4 py-3 hover:border-ink-900">
                      <i className={i.status === "approved" ? "ri-checkbox-circle-fill text-[#1F6B4F]" : "ri-edit-2-fill text-[#9A4B12]"} aria-hidden="true"></i>
                      <span className="flex-1 min-w-0 truncate text-sm text-ink-900">{i.title} <span className="text-paper-500">· {projectOf(i.projectId)}</span></span>
                      <span className="text-xs text-paper-500">{i.status === "approved" ? t("معتمد", "Approved") : t("طلبت تعديلاً", "Changes asked")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}

// ─── التصاميم المحفوظة ─────────────────────────────────────────────
export function AccountDesigns() {
  const { t, date } = useI18n();
  const { actor, run } = useAccount();
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null);
  const load = useMemo(() => async () => actor && setDesigns(await projectsRepo.listDesigns(actor)), [actor]);
  useEffect(() => {
    void load();
  }, [load]);
  const rename = async (d: SavedDesign) => {
    const name = window.prompt(t("اسم التصميم", "Design name"), d.name)?.trim();
    if (!name || name === d.name) return;
    if (await run((a) => projectsRepo.saveDesign({ name, link: d.link, summary: d.summary, thumb: d.thumb, label: d.label, box: d.box }, d.id, a), t("غُيّر الاسم", "Renamed"))) await load();
  };
  const remove = async (d: SavedDesign) => {
    if (!window.confirm(t(`حذف «${d.name}»؟`, `Delete “${d.name}”?`))) return;
    if (await run((a) => projectsRepo.deleteDesign(d.id, a), t("حُذف التصميم", "Design deleted"))) await load();
  };
  return (
    <>
      <PageTitle kicker={t("محفوظة في حسابك — تفتحها من أي جهاز", "Saved to your account — open them on any device")} title={t("تصاميمي", "My designs")}>
        <Link to="/studio-3d" className={`${btn} bg-ink-900 text-white inline-flex items-center gap-2`}>
          <i className="ri-add-line" aria-hidden="true"></i>
          {t("تصميم جديد", "New design")}
        </Link>
      </PageTitle>
      {!designs ? <Loading /> : designs.length === 0 ? (
        <Empty icon="ri-shapes-line" title={t("لا تصاميم محفوظة", "No saved designs")} hint={t("صمّم عبوتك وملصقها وعلبتها في استوديو 3D، ثم اضغط «احفظ في حسابي».", "Design your bottle, label and box in the 3D studio, then press “Save to my account”.")}>
          <Link to="/studio-3d" className={`${btn} bg-ink-900 text-white`}>{t("افتح الاستوديو", "Open the studio")}</Link>
        </Empty>
      ) : (
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {designs.map((d) => (
            <li key={d.id} className="rounded-2xl bg-white border border-paper-200 overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-[#F3F1EC] flex items-center justify-center">
                {d.thumb ? <img src={d.thumb} alt="" className="w-full h-full object-contain" /> : <i className="ri-shapes-line text-4xl text-paper-400" aria-hidden="true"></i>}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <p className="text-ink-900 font-medium truncate">{d.name}</p>
                <p className="mt-1 text-xs text-paper-500 line-clamp-2">{d.summary}</p>
                <p className="mt-1 text-[11px] text-paper-400">{date(new Date(d.updatedAt), { day: "numeric", month: "short", year: "numeric" })}</p>
                <div className="mt-auto pt-4 flex flex-wrap gap-2">
                  <Link to={`${d.link}${d.link.includes("?") ? "&" : "?"}design=${encodeURIComponent(d.id)}`} className={`${btn} !px-4 !py-2 bg-ink-900 text-white`}>{t("فتح في الاستوديو", "Open in studio")}</Link>
                  <button type="button" onClick={() => rename(d)} className={`${btn} !px-3 !py-2 border border-paper-300 text-ink-900`} aria-label={t(`إعادة تسمية «${d.name}»`, `Rename “${d.name}”`)}>{t("تسمية", "Rename")}</button>
                  <button type="button" onClick={() => remove(d)} className={`${btn} !px-3 !py-2 text-red-700`} aria-label={t(`حذف «${d.name}»`, `Delete “${d.name}”`)}>{t("حذف", "Delete")}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
