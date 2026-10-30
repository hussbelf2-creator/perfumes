import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, DAY } from "@/admin/reports/metrics";
const now = Date.UTC(2026, 9, 20, 12);
const d = (days: number) => new Date(now - days * DAY).toISOString();
const eq = (a: unknown, b: unknown, m: string) => test(m, () => assert.deepEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))));
const lead = (id: string, ago: number, track: string, projectId: string | null = null) => ({ id, kind: "brief" as const, payload: { track }, createdAt: d(ago), status: "new" as const, projectId });
const proj = (id: string, ago: number, track: string, stage = "brief") => ({ id, title: id, track, clientEmail: "x@y.sa", stage, status: "active" as const, createdAt: d(ago), updatedAt: d(ago) });
const quote = (id: string, projectId: string, o: Record<string, unknown>) => ({ id, projectId, ref: id, lines: [], vatRate: 15, depositPct: 50, subtotal: 0, vat: 0, total: 1000, deposit: 500, notes: "", createdAt: d(10), status: "sent", ...o });
const leads = [
  lead("L1", 5, "A", "P1"), // → مدفوع
  lead("L2", 6, "A", "P2"), // → معتمد بلا عربون
  lead("L3", 7, "C", "P3"), // → عرض مرسل
  lead("L4", 8, "C", "P4"), // → مشروع بلا عرض
  lead("L5", 9, "D"), // لم ينشئ حساباً
  lead("L6", 0.2, "D"), // حديث جداً: ليس تسرباً بعد
  lead("L7", 45, "A", "P7"), // خارج فترة 30 يوماً
  { ...lead("L8", 3, "A"), kind: "contact" as const },
];
const projects = [proj("P1", 5, "A", "formula"), proj("P2", 6, "A"), proj("P3", 7, "C"), proj("P4", 8, "C"), proj("P7", 45, "A")];
const quotes = [
  quote("Q1a", "P1", { status: "void", sentAt: d(4), total: 2000 }),
  quote("Q1", "P1", { status: "paid", sentAt: d(3), decidedAt: d(2), paidAt: d(1), paidAmount: 1500, total: 3000, deposit: 1500, paymentMethod: "bank" }),
  quote("Q2", "P2", { status: "accepted", sentAt: d(5), decidedAt: d(4), total: 4000, deposit: 2000 }),
  quote("Q3", "P3", { status: "sent", sentAt: d(6), total: 5000 }),
  quote("Q7", "P7", { status: "paid", sentAt: d(44), paidAt: d(40), paidAmount: 999 }),
  quote("Q4d", "P4", { status: "draft" }),
];
const payments = [
  { id: "k1", kind: "kit", amount: 75000, currency: "SAR", status: "paid", createdAt: d(2) },
  { id: "pay_Q", kind: "deposit", amount: 150000, currency: "SAR", status: "paid", createdAt: d(1) },
  { id: "k2", kind: "kit", amount: 75000, currency: "SAR", status: "failed", createdAt: d(2) },
];
const m = computeMetrics({ leads, payments, projects, quotes, now, days: 30 } as never);
eq(m.funnel.map((s) => s.count), [6, 4, 3, 2, 1], "funnel for briefs in period (start → project → quoted → accepted → paid)");
eq([m.sent, m.won, m.avgQuote], [3, 1, 4000], "quotes sent in period ignore voided versions; average 4,000");
eq(m.winRate.toFixed(3), "0.333", "win rate");
eq([m.collected, m.collectedDeposits, m.collectedOther], [2250, 1500, 750], "collected: deposit once + kit, failed and out-of-period excluded");
eq(m.leaks.briefsNoAccount.map((x) => x.item.id), ["L5"], "brief without account (older than a day)");
eq(m.leaks.projectsNoQuote.map((x) => [x.item.id, x.age]), [["P4", 8]], "project in brief with only a draft quote");
eq(m.leaks.waitingClient.map((x) => [x.item.id, x.age]), [["Q3", 6]], "sent quote waiting on the client");
eq(m.leaks.acceptedUnpaid.map((x) => [x.item.id, x.age]), [["Q2", 4]], "approved but deposit unpaid");
eq([m.pendingValue, m.depositsDue], [5000, 2000], "pending value and deposits due");
eq(m.tracks.filter((x) => x.briefs || x.paid).map((x) => [x.track, x.briefs, x.paid, x.revenue]), [["A", 2, 1, 1500], ["C", 2, 0, 0], ["D", 2, 0, 0]], "by track");
eq(m.timeToQuote, 1, "median days from project start to first sent quote (P1:1, P2:1, P3:1)");
eq(m.weeks.length === 8 && m.weeks[7].value === 2250 && m.weeks.slice(0, 7).every((w) => w.value === 0 || w.value === 999), true, "weekly revenue: last week holds this week's money");
const m7 = computeMetrics({ leads, payments, projects, quotes, now, days: 7 } as never);
eq(m7.funnel[0].count, 4, "7-day window");
// الربحية: Q1 مدفوع بإيراد 3,000 قبل الضريبة (subtotal) وتكلفة متوقعة 1,800؛ وتكاليف فعلية 2,100 على P1
const withMoney = quotes.map((q) => (q.id === "Q1" ? { ...q, lines: [{ label: "x", qty: 100, unit: 30 }], subtotal: 3000 } : q.id === "Q3" ? { ...q, lines: [{ label: "y", qty: 10, unit: 434.78 }], subtotal: 4347.8 } : q));
const mm = computeMetrics({ leads, payments, projects, quotes: withMoney, now, days: 30, marginFloor: 25,
  quoteCosts: [{ quoteId: "Q1", lines: [{ unitCost: 15 }], extraCost: 300 }, { quoteId: "Q3", lines: [{ unitCost: 400 }], extraCost: 0 }],
  costs: [{ id: "c1", projectId: "P1", kind: "materials", amount: 1500, note: "", createdAt: d(1) }, { id: "c2", projectId: "P1", kind: "factory", amount: 600, note: "", createdAt: d(1) }, { id: "c3", projectId: "P3", kind: "other", amount: 99, note: "", createdAt: d(1) }],
  items: [{ id: "i1", sku: "BTL", name: "زجاجة", category: "bottle", unit: "pcs", onHand: 100, reserved: 60, avgCost: 7, reorderLevel: 50, supplier: "", notes: "", active: true, createdAt: d(9), updatedAt: d(9) }, { id: "i2", sku: "CAP", name: "غطاء", category: "cap", unit: "pcs", onHand: 500, reserved: 0, avgCost: 1, reorderLevel: 50, supplier: "", notes: "", active: true, createdAt: d(9), updatedAt: d(9) }] } as never);
eq([mm.margins.revenue, mm.margins.expectedCost, mm.margins.expectedProfit, Math.round(mm.margins.expectedPct)], [3000, 1800, 1200, 40], "expected margin on paid quotes: 3,000 − (100×15 + 300) = 1,200 (40%)");
eq([mm.margins.actualCost, mm.margins.actualProfit, Math.round(mm.margins.actualPct)], [2100, 900, 30], "actual margin uses costs recorded on paid projects only");
eq(mm.leaks.belowFloor.map((x) => x.item.id), ["Q3"], "quote below the 25% floor (8%)");
eq(mm.leaks.lowStock.map((x) => x.item.sku), ["BTL"], "low stock: available 40 ≤ reorder 50");
eq(mm.tracks.find((x) => x.track === "A")?.profit, 1200, "expected profit by track");
// عرض مدفوع بلا تكلفة لا يضخّم الهامش المتوقع
const mx = computeMetrics({ leads, payments, projects, quotes: [...withMoney, { ...withMoney.find((q) => q.id === "Q1")!, id: "Q9", projectId: "P2", subtotal: 10000, lines: [{ label: "z", qty: 1, unit: 10000 }] }], now, days: 30, marginFloor: 25, quoteCosts: [{ quoteId: "Q1", lines: [{ unitCost: 15 }], extraCost: 300 }] } as never);
eq([mx.margins.revenue, mx.margins.costedRevenue, Math.round(mx.margins.expectedPct), mx.margins.uncosted], [13000, 3000, 40, 1], "uncosted paid quote excluded from expected margin (still 40%, not 86%)");
