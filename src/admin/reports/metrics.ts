// مؤشرات تقرير المالك من البيانات الفعلية: أين يتسرب العميل بين «ابدأ مسارك» والعربون؟
// دالة نقية (بلا واجهة) حتى تُختبر بأرقام معروفة.
import type { Lead, Payment } from "../data/types";
import { quoteMargin, type Project, type ProjectCost, type Quote, type QuoteCost } from "@/projects/types";
import { needsReorder, type InventoryItem } from "@/inventory/types";

export const DAY = 864e5;

export interface MetricsInput {
  leads: Lead[];
  payments: Payment[];
  projects: Project[];
  quotes: Quote[];
  now: number;
  days: number;
  /** داخلية (اختيارية): تكاليف العروض والمشاريع، وحد الهامش، والمخزون */
  quoteCosts?: QuoteCost[];
  costs?: ProjectCost[];
  marginFloor?: number;
  items?: InventoryItem[];
}

export interface FunnelStep {
  key: "brief" | "project" | "quoted" | "accepted" | "paid";
  count: number;
}

export interface Leak<T> {
  item: T;
  /** أيام الانتظار */
  age: number;
}

const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeMetrics({ leads, payments, projects, quotes, now, days, quoteCosts = [], costs = [], marginFloor = 0, items = [] }: MetricsInput) {
  const since = now - days * DAY;
  const inPeriod = (iso?: string | null) => ms(iso) >= since && ms(iso) <= now;
  const ageDays = (iso?: string | null) => Math.max(0, Math.floor((now - ms(iso)) / DAY));
  const byProject = new Map<string, Quote[]>();
  for (const q of quotes) byProject.set(q.projectId, [...(byProject.get(q.projectId) ?? []), q]);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  // ── القمع: دفعة طلبات الفترة، وأين وصلت (مهما تأخر تقدمها)
  const briefs = leads.filter((l) => l.kind === "brief" && inPeriod(l.createdAt));
  const reached = (l: Lead, test: (q: Quote) => boolean) => !!l.projectId && (byProject.get(l.projectId) ?? []).some(test);
  const funnel: FunnelStep[] = [
    { key: "brief", count: briefs.length },
    { key: "project", count: briefs.filter((l) => l.projectId && projectById.has(l.projectId)).length },
    { key: "quoted", count: briefs.filter((l) => reached(l, (q) => !!q.sentAt)).length },
    { key: "accepted", count: briefs.filter((l) => reached(l, (q) => q.status === "accepted" || q.status === "paid")).length },
    { key: "paid", count: briefs.filter((l) => reached(l, (q) => q.status === "paid")).length },
  ];

  // ── العروض المرسلة في الفترة (النسخ الملغاة لا تُحسب مرتين)
  const sent = quotes.filter((q) => q.sentAt && inPeriod(q.sentAt) && q.status !== "void");
  const won = sent.filter((q) => q.status === "paid");
  const avgQuote = sent.length ? r2(sent.reduce((s, q) => s + q.total, 0) / sent.length) : 0;
  const winRate = sent.length ? won.length / sent.length : 0;

  // ── المحصّل: مدفوعات مويسر (العينة وغيرها) + عربون العروض؛ عربون مويسر مسجّل في الاثنين فيُحسب مرة
  const paidQuotes = quotes.filter((q) => q.status === "paid" && inPeriod(q.paidAt));
  const otherPayments = payments.filter((p) => p.status === "paid" && p.kind !== "deposit" && inPeriod(p.createdAt));
  const collectedDeposits = r2(paidQuotes.reduce((s, q) => s + (q.paidAmount ?? 0), 0));
  const collectedOther = r2(otherPayments.reduce((s, p) => s + p.amount / 100, 0));
  const collected = r2(collectedDeposits + collectedOther);

  // ── زمن إرسال العرض: من بدء المشروع حتى أول عرض مرسل
  const firstSent = projects
    .map((p) => {
      const t = (byProject.get(p.id) ?? []).map((q) => ms(q.sentAt)).filter((x) => !Number.isNaN(x));
      // عرض أُدخل قبل تسجيل المشروع (بيانات مستوردة) لا يُحسب بزمن سالب
      return t.length && inPeriod(p.createdAt) ? Math.max(0, (Math.min(...t) - ms(p.createdAt)) / DAY) : null;
    })
    .filter((x): x is number => x !== null);
  const timeToQuote = median(firstSent);

  // ── الربحية: المتوقع من تكلفة العروض المدفوعة، والفعلي من التكاليف المسجلة على مشاريعها
  const costOf = (q: Quote) => quoteMargin(q, quoteCosts.find((c) => c.quoteId === q.id));
  const revenue = r2(paidQuotes.reduce((s, q) => s + q.subtotal, 0));
  // المتوقع على العروض المسجلة تكلفتها فقط: عرض بلا تكلفة يُحسب إيراده بتكلفة صفر فيضخّم الهامش
  const costed = paidQuotes.filter((q) => costOf(q));
  const costedRevenue = r2(costed.reduce((s, q) => s + q.subtotal, 0));
  const expectedCost = r2(costed.reduce((s, q) => s + (costOf(q)?.cost ?? 0), 0));
  const paidProjects = new Set(paidQuotes.map((q) => q.projectId));
  const actualCost = r2(costs.filter((c) => paidProjects.has(c.projectId)).reduce((s, c) => s + c.amount, 0));
  const pct = (profit: number) => (revenue > 0 ? (profit / revenue) * 100 : 0);
  const margins = {
    revenue,
    /** عروض مدفوعة بلا تكلفة مسجلة: الهامش المتوقع لا يشملها */
    uncosted: paidQuotes.filter((q) => !costOf(q)).length,
    costedRevenue,
    expectedCost,
    expectedProfit: r2(costedRevenue - expectedCost),
    expectedPct: costedRevenue > 0 ? ((costedRevenue - expectedCost) / costedRevenue) * 100 : 0,
    actualCost,
    actualProfit: r2(revenue - actualCost),
    actualPct: pct(revenue - actualCost),
  };

  // ── التسرب: ما يحتاج تدخلاً الآن، الأقدم أولاً
  const sortAge = <T,>(xs: Leak<T>[]) => xs.sort((a, b) => b.age - a.age);
  const leaks = {
    /** بدأ المسار ولم يُنشئ حساباً (بعد يوم) — اتصل به */
    briefsNoAccount: sortAge(leads.filter((l) => l.kind === "brief" && !l.projectId && now - ms(l.createdAt) > DAY && now - ms(l.createdAt) < 90 * DAY).map((item) => ({ item, age: ageDays(item.createdAt) }))),
    /** مشروع في الملخص بلا عرض مرسل (بعد يومين) — الفريق مدين بعرض */
    projectsNoQuote: sortAge(projects.filter((p) => p.status === "active" && p.stage === "brief" && !(byProject.get(p.id) ?? []).some((q) => q.sentAt) && now - ms(p.createdAt) > 2 * DAY).map((item) => ({ item, age: ageDays(item.createdAt) }))),
    /** طلب العميل تعديل العرض — الفريق مدين بعرض محدّث */
    changesRequested: sortAge(quotes.filter((q) => q.status === "changes").map((item) => ({ item, age: ageDays(item.decidedAt) }))),
    /** عرض مرسل بلا قرار (بعد 3 أيام) */
    waitingClient: sortAge(quotes.filter((q) => q.status === "sent" && now - ms(q.sentAt) > 3 * DAY).map((item) => ({ item, age: ageDays(item.sentAt) }))),
    /** اعتمد ولم يدفع العربون (بعد يومين) */
    acceptedUnpaid: sortAge(quotes.filter((q) => q.status === "accepted" && now - ms(q.decidedAt) > 2 * DAY).map((item) => ({ item, age: ageDays(item.decidedAt) }))),
    /** عروض الفترة بهامش متوقع تحت الحد */
    belowFloor: sortAge(sent.filter((q) => { const m = costOf(q); return !!m && m.pct < marginFloor; }).map((item) => ({ item, age: ageDays(item.sentAt) }))),
    /** مواد عند حد إعادة الطلب أو دونه */
    lowStock: items.filter(needsReorder).map((item) => ({ item, age: 0 })),
  };

  // ── حسب المسار
  const tracks = ["A", "B", "C", "D", "E", "F", "P"].map((track) => ({
    track,
    briefs: briefs.filter((l) => l.payload.track === track).length,
    paid: paidQuotes.filter((q) => projectById.get(q.projectId)?.track === track).length,
    revenue: r2(paidQuotes.filter((q) => projectById.get(q.projectId)?.track === track).reduce((s, q) => s + (q.paidAmount ?? 0), 0)),
    /** الربح المتوقع للعروض المدفوعة (بعد الخصم وقبل الضريبة − التكلفة) */
    profit: r2(paidQuotes.filter((q) => projectById.get(q.projectId)?.track === track).reduce((s, q) => s + (costOf(q)?.profit ?? 0), 0)),
  }));

  // ── المحصّل أسبوعياً (آخر 8 أسابيع، الأحدث آخراً)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const within = (iso?: string | null) => ms(iso) > start && ms(iso) <= end;
    const value =
      quotes.filter((q) => q.status === "paid" && within(q.paidAt)).reduce((s, q) => s + (q.paidAmount ?? 0), 0) +
      payments.filter((p) => p.status === "paid" && p.kind !== "deposit" && within(p.createdAt)).reduce((s, p) => s + p.amount / 100, 0);
    return { end, value: r2(value) };
  });

  // ── قيمة معلّقة: عروض مرسلة لم تُحسم، وعربون معتمد لم يُدفع
  const pendingValue = r2(quotes.filter((q) => q.status === "sent").reduce((s, q) => s + q.total, 0));
  const depositsDue = r2(quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + q.deposit, 0));

  return { funnel, sent: sent.length, won: won.length, avgQuote, winRate, collected, collectedDeposits, collectedOther, timeToQuote, leaks, tracks, weeks, pendingValue, depositsDue, margins };
}

export type Metrics = ReturnType<typeof computeMetrics>;
