import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n, type Bi } from "@/i18n/context";
import BarList from "@/components/charts/BarList";
import { trackInfo } from "@/data/tracks";
import { projectsRepo, type ProjectsData } from "@/projects/repo";
import { usePActor } from "@/projects/useProjects";
import { useMoney } from "@/projects/quotes";
import { useCrm } from "../data/CrmProvider";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_POLICY, pricingRepo, type PricingPolicy } from "@/pricing/repo";
import { inventoryRepo } from "@/inventory/repo";
import type { InventoryItem } from "@/inventory/types";
import { computeMetrics, type FunnelStep, type Leak } from "../reports/metrics";
import { Card, Empty, PageTitle, Stat, useFormat } from "../components/ui";
import { arCount, enCount } from "@/i18n/plural";

// تقرير المالك: من «ابدأ مسارك» إلى العربون — الأرقام الفعلية، وأين يتسرب العملاء، وما يحتاج تدخلاً اليوم

const PERIODS = [7, 30, 90] as const;
const STEP_LABELS: Record<FunnelStep["key"], Bi> = {
  brief: { ar: "بدأ مساراً", en: "Started a track" },
  project: { ar: "أنشأ حساباً (مشروع)", en: "Created an account (project)" },
  quoted: { ar: "وصله عرض سعر", en: "Received a quote" },
  accepted: { ar: "اعتمد العرض", en: "Approved the quote" },
  paid: { ar: "دفع العربون", en: "Paid the deposit" },
};

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const { t, pick, num } = useI18n();
  const start = steps[0].count;
  // أكبر تسرب بين خطوتين متتاليتين (بالعدد)
  let worst = -1;
  let worstDrop = 0;
  steps.forEach((s, i) => {
    if (i && steps[i - 1].count - s.count > worstDrop) {
      worstDrop = steps[i - 1].count - s.count;
      worst = i;
    }
  });
  if (!start) return <Empty icon="ri-filter-3-line" title={t("لا طلبات في هذه الفترة", "No requests in this period")} hint={t("القمع يبدأ من طلبات «ابدأ مسارك».", "The funnel starts from “Start your track” requests.")} />;
  return (
    <ol className="space-y-3" aria-label={t("قمع التحويل", "Conversion funnel")}>
      {steps.map((s, i) => {
        const pct = Math.round((s.count / start) * 100);
        const fromPrev = i ? (steps[i - 1].count ? Math.round((s.count / steps[i - 1].count) * 100) : 0) : 100;
        return (
          <li key={s.key} data-step={s.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
              <span className="text-ink-900">{pick(STEP_LABELS[s.key])}</span>
              <span className="text-paper-600 whitespace-nowrap">
                <span className="font-mono text-ink-900">{num(s.count)}</span> · {num(pct)}%
                {i > 0 && <span className="text-paper-400"> · {t(`${num(fromPrev)}% من السابقة`, `${fromPrev}% of previous`)}</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-paper-100 overflow-hidden">
              <div className={`h-full rounded-full ${i === worst ? "bg-accent2" : "bg-ink-900"}`} style={{ width: `${Math.max(pct, s.count ? 2 : 0)}%` }} />
            </div>
            {i === worst && <p className="mt-1.5 text-xs text-accent2-ink">{t(`أكبر تسرب: ${num(worstDrop)} توقفوا قبل هذه الخطوة`, `Biggest leak: ${worstDrop} stopped before this step`)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function LeakList<T>({ title, hint, items, render, empty }: { title: string; hint: string; items: Leak<T>[]; render: (x: T) => { to: string; label: string; sub?: string }; empty: string }) {
  const { t, num } = useI18n();
  return (
    <section aria-label={title} className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm text-ink-900 font-medium">{title}</h3>
        <span className={`font-mono text-xs rounded-full px-2 py-0.5 ${items.length ? "bg-accent2-soft text-accent2-ink" : "bg-paper-100 text-paper-500"}`}>{num(items.length)}</span>
      </div>
      <p className="text-xs text-paper-500 mt-0.5">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[#1F6B4F]">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-paper-100">
          {items.slice(0, 6).map(({ item, age }, i) => {
            const r = render(item);
            return (
              <li key={i}>
                <Link to={r.to} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-paper-50 -mx-2 px-2 rounded-lg">
                  <span className="min-w-0">
                    <span className="block truncate text-ink-900">{r.label}</span>
                    {r.sub && <span className="block truncate text-xs text-paper-500">{r.sub}</span>}
                  </span>
                  <span className={`shrink-0 text-xs ${age >= 7 ? "text-red-700" : "text-paper-500"}`}>{age === 0 ? t("اليوم", "today") : t(`منذ ${arCount(age, { one: "يوم", two: "يومين", few: "أيام", many: "يوماً" }, num)}`, `${age}d ago`)}</span>
                </Link>
              </li>
            );
          })}
          {items.length > 6 && <li className="pt-2 text-xs text-paper-500">{t(`و${num(items.length - 6)} غيرها`, `and ${items.length - 6} more`)}</li>}
        </ul>
      )}
    </section>
  );
}

export default function Reports() {
  const { t, pick, num, date } = useI18n();
  const { data } = useCrm();
  const actor = usePActor();
  const f = useFormat();
  const money = useMoney();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [pdata, setPdata] = useState<ProjectsData | null>(null);
  const [now] = useState(() => Date.now());
  const { can } = useAuth();
  const [policy, setPolicy] = useState<PricingPolicy>(DEFAULT_POLICY);
  const [items, setItems] = useState<InventoryItem[]>([]);
  useEffect(() => {
    if (!actor) return;
    void pricingRepo.policy(actor).then(setPolicy).catch(() => undefined);
    if (can("inventory.view")) void inventoryRepo.load(actor).then((d) => setItems(d.items)).catch(() => undefined);
  }, [actor, can]);

  useEffect(() => {
    if (!actor) return;
    let live = true;
    void projectsRepo.load(actor).then((d) => live && setPdata(d)).catch(() => live && setPdata({ projects: [], items: [], comments: [], quotes: [], quoteCosts: [], costs: [], contracts: [] }));
    return () => {
      live = false;
    };
  }, [actor]);

  const m = useMemo(() => (data && pdata ? computeMetrics({ leads: data.leads, payments: data.payments, projects: pdata.projects, quotes: pdata.quotes, now, days, quoteCosts: pdata.quoteCosts, costs: pdata.costs, marginFloor: policy.marginFloor, items }) : null), [data, pdata, now, days, policy.marginFloor, items]);
  if (!m || !pdata) return <div className="h-48 rounded-2xl shimmer bg-paper-100" />;

  const project = (id: string) => pdata.projects.find((p) => p.id === id);
  const trackTitle = (id?: string | null) => {
    const s = trackInfo(id);
    return s ? pick(s.title) : "—";
  };

  return (
    <>
      <PageTitle
        title={t("التقارير", "Reports")}
        sub={t("من أول طلب إلى العربون: الأرقام الفعلية، وأين يتسرب العملاء، وما يحتاج تدخلاً اليوم.", "From first request to deposit: the real numbers, where clients drop off, and what needs action today.")}
        actions={
          <div role="group" aria-label={t("الفترة", "Period")} className="inline-flex rounded-full bg-white border border-paper-200 p-1">
            {PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)} className={`rounded-full px-3.5 py-1.5 text-sm ${days === p ? "bg-ink-900 text-white" : "text-paper-600 hover:text-ink-900"}`}>
                {t(`${num(p)} يوماً`, `${p} days`)}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4">
        <Stat icon="ri-money-dollar-circle-line" tone="good" label={t("المحصّل", "Collected")} value={<span data-testid="kpi-collected" data-value={m.collected}>{f.statMoney(m.collected)}</span>} hint={t(`عربون ${money(m.collectedDeposits)} · أخرى ${money(m.collectedOther)}`, `Deposits ${money(m.collectedDeposits)} · other ${money(m.collectedOther)}`)} />
        <Stat icon="ri-file-list-3-line" label={t("عروض أُرسلت", "Quotes sent")} value={<span data-testid="kpi-sent">{num(m.sent)}</span>} hint={t(`تحوّل ${num(Math.round(m.winRate * 100))}% منها لعربون`, `${Math.round(m.winRate * 100)}% converted to a deposit`)} />
        <Stat icon="ri-scales-3-line" label={t("متوسط قيمة العرض", "Average quote")} value={f.statMoney(m.avgQuote)} hint={t("شامل الضريبة", "incl. VAT")} />
        <Stat icon="ri-timer-line" label={t("زمن إرسال العرض", "Time to quote")} value={m.timeToQuote === null ? "—" : t(`${num(Math.round(m.timeToQuote * 10) / 10, 1)} يوم`, `${Math.round(m.timeToQuote * 10) / 10} d`)} tone={m.timeToQuote !== null && m.timeToQuote > 3 ? "warn" : "plain"} hint={t("الوسيط: من بدء المشروع حتى أول عرض", "Median: project start to first quote")} />
      </div>

      <Card className="p-5 mb-4" title={t("الربحية: العروض المدفوعة في الفترة", "Profitability: quotes paid in this period")}>
        <div className="grid sm:grid-cols-3 gap-3 text-sm" data-testid="margins">
          <div className="rounded-xl bg-paper-50 border border-paper-200 p-3">
            <p className="text-xs text-paper-500">{t("الإيراد (بعد الخصم وقبل الضريبة)", "Revenue (after discount, excl. VAT)")}</p>
            <p className="mt-1 font-display text-xl text-ink-900" data-value={m.margins.revenue}>{money(m.margins.revenue)}</p>
          </div>
          <div className={`rounded-xl border p-3 ${m.margins.costedRevenue && m.margins.expectedPct < policy.marginFloor ? "bg-red-50 border-red-200" : "bg-paper-50 border-paper-200"}`}>
            <p className="text-xs text-paper-500">{t("الربح المتوقع (من تكلفة العروض)", "Expected profit (quote costs)")}</p>
            <p className="mt-1 font-display text-xl text-ink-900" data-value={m.margins.expectedProfit}>{money(m.margins.expectedProfit)} <span className="text-sm text-paper-500">· {num(Math.round(m.margins.expectedPct * 10) / 10, 1)}%</span></p>
            {m.margins.uncosted > 0 && <p className="mt-1 text-xs text-accent2-ink">{t(`على ${money(m.margins.costedRevenue)} فقط — ${num(m.margins.uncosted)} عرض بلا تكلفة مسجلة لا يدخل`, `On ${money(m.margins.costedRevenue)} only — ${m.margins.uncosted} quote(s) without costs excluded`)}</p>}
          </div>
          <div className={`rounded-xl border p-3 ${m.margins.revenue && m.margins.actualPct < policy.marginFloor ? "bg-red-50 border-red-200" : "bg-paper-50 border-paper-200"}`}>
            <p className="text-xs text-paper-500">{t("الربح الفعلي حتى الآن (التكاليف المسجلة)", "Actual profit so far (recorded costs)")}</p>
            <p className="mt-1 font-display text-xl text-ink-900" data-value={m.margins.actualProfit}>{money(m.margins.actualProfit)} <span className="text-sm text-paper-500">· {num(Math.round(m.margins.actualPct * 10) / 10, 1)}%</span></p>
            <p className="mt-1 text-xs text-paper-500">{t(`تكاليف ${money(m.margins.actualCost)} · حد الهامش ${num(policy.marginFloor)}٪`, `Costs ${money(m.margins.actualCost)} · floor ${policy.marginFloor}%`)}</p>
          </div>
        </div>
      </Card>

      <div className="grid xl:grid-cols-12 gap-4 mb-4">
        <Card className="p-5 xl:col-span-7" title={t("القمع: طلبات الفترة إلى أين وصلت؟", "Funnel: where did this period's requests get to?")}>
          <Funnel steps={m.funnel} />
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-paper-50 border border-paper-200 p-3">
              <p className="text-xs text-paper-500">{t("عروض بانتظار قرار العميل", "Quotes awaiting the client")}</p>
              <p className="mt-1 font-display text-xl text-ink-900">{money(m.pendingValue)}</p>
            </div>
            <div className="rounded-xl bg-paper-50 border border-paper-200 p-3">
              <p className="text-xs text-paper-500">{t("عربون معتمد لم يُدفع", "Approved deposits unpaid")}</p>
              <p className="mt-1 font-display text-xl text-ink-900">{money(m.depositsDue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 xl:col-span-5" title={t("يحتاج تدخلاً اليوم", "Needs action today")}>
          <div className="divide-y divide-paper-100">
            <LeakList title={t("بدأ مساراً ولم ينشئ حساباً", "Started a track, no account")} hint={t("الطلب عندنا والعميل لم يكمل — اتصل به", "We have the request; they didn't finish — call them")} items={m.leaks.briefsNoAccount} empty={t("لا أحد ينتظر اتصالاً", "Nobody waiting for a call")} render={(l) => ({ to: `/admin/inbox?open=${l.id}`, label: [l.payload.firstName, l.payload.lastName].filter(Boolean).join(" ") || l.payload.email || "—", sub: [l.payload.track_title, l.payload.phone].filter(Boolean).join(" · ") })} />
            <LeakList title={t("مشروع بلا عرض سعر", "Project without a quote")} hint={t("أكثر من يومين في «الملخص» — الفريق مدين بعرض", "Over two days in brief — the team owes a quote")} items={m.leaks.projectsNoQuote} empty={t("كل المشاريع وصلها عرض", "Every project has a quote")} render={(p) => ({ to: `/admin/projects/${p.id}`, label: p.title, sub: trackTitle(p.track) })} />
            <LeakList title={t("طلب تعديل العرض", "Quote changes requested")} hint={t("العميل ينتظر عرضاً محدّثاً", "The client is waiting for an updated quote")} items={m.leaks.changesRequested} empty={t("لا طلبات تعديل معلّقة", "No pending change requests")} render={(q) => ({ to: `/admin/projects/${q.projectId}`, label: `${q.ref} · ${project(q.projectId)?.title ?? ""}`, sub: q.decisionNote ?? undefined })} />
            <LeakList title={t("عرض بلا رد", "Quote with no reply")} hint={t("أُرسل منذ أكثر من 3 أيام", "Sent over 3 days ago")} items={m.leaks.waitingClient} empty={t("لا عروض متأخرة", "No overdue quotes")} render={(q) => ({ to: `/admin/projects/${q.projectId}`, label: `${q.ref} · ${money(q.total)}`, sub: project(q.projectId)?.title })} />
            <LeakList title={t("هامش تحت الحد", "Margin below the floor")} hint={t(`عروض الفترة بهامش متوقع أقل من ${num(policy.marginFloor)}٪`, `This period's quotes with expected margin under ${policy.marginFloor}%`)} items={m.leaks.belowFloor} empty={t("كل العروض فوق الحد", "Every quote is above the floor")} render={(q) => ({ to: `/admin/projects/${q.projectId}`, label: `${q.ref} · ${money(q.subtotal)}`, sub: project(q.projectId)?.title })} />
            {can("inventory.view") && <LeakList title={t("مواد تحتاج إعادة طلب", "Stock to reorder")} hint={t("المتاح عند حد الطلب أو دونه", "Available at or below the reorder level")} items={m.leaks.lowStock} empty={t("المخزون كافٍ", "Stock is sufficient")} render={(it) => ({ to: `/admin/inventory?item=${it.id}`, label: `${it.sku} · ${it.name}`, sub: t(`متاح ${num(Math.round((it.onHand - it.reserved) * 1000) / 1000)} · حد الطلب ${num(it.reorderLevel)}`, `${Math.round((it.onHand - it.reserved) * 1000) / 1000} available · reorder at ${it.reorderLevel}`) })} />}
            <LeakList title={t("اعتمد ولم يدفع العربون", "Approved, deposit unpaid")} hint={t("أكثر من يومين بعد الاعتماد", "Over two days after approval")} items={m.leaks.acceptedUnpaid} empty={t("لا عربون متأخر", "No overdue deposits")} render={(q) => ({ to: `/admin/projects/${q.projectId}`, label: `${q.ref} · ${money(q.deposit)}`, sub: project(q.projectId)?.title })} />
          </div>
        </Card>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card className="p-5" title={t("حسب المسار", "By track")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-paper-500 border-b border-paper-100">
                <th scope="col" className="text-start font-normal py-2">{t("المسار", "Track")}</th>
                <th scope="col" className="text-end font-normal py-2">{t("طلبات", "Requests")}</th>
                <th scope="col" className="text-end font-normal py-2">{t("عربون", "Deposits")}</th>
                <th scope="col" className="text-end font-normal py-2">{t("المحصّل", "Collected")}</th>
                <th scope="col" className="text-end font-normal py-2">{t("الربح المتوقع", "Exp. profit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-100">
              {m.tracks.map((r) => (
                <tr key={r.track} data-track={r.track}>
                  <td className="py-2.5 text-ink-900">{trackTitle(r.track)}</td>
                  <td className="py-2.5 text-end font-mono">{num(r.briefs)}</td>
                  <td className="py-2.5 text-end font-mono">{num(r.paid)}</td>
                  <td className="py-2.5 text-end whitespace-nowrap">{money(r.revenue)}</td>
                  <td className="py-2.5 text-end whitespace-nowrap">{money(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-5" title={t("المحصّل أسبوعياً", "Collected per week")}>
          <BarList ariaLabel={t("المحصّل في آخر 8 أسابيع", "Collected over the last 8 weeks")} format={(n) => money(n)} max={Math.max(1, ...m.weeks.map((w) => w.value))} items={m.weeks.map((w) => ({ label: t(`أسبوع ${date(new Date(w.end), { day: "numeric", month: "short" })}`, `Week to ${date(new Date(w.end), { day: "numeric", month: "short" })}`), value: w.value }))} />
        </Card>
      </div>
    </>
  );
}
