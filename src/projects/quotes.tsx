import { useId, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/context";
import { useContent } from "@/cms/ContentProvider";
import { PAYMENTS } from "@/config/payments";
import { isSupabaseEnabled } from "@/lib/supabase";
import PaymentForm from "@/components/feature/PaymentForm";
import { QUOTE_STATUS_LABELS, VAT_RATE, lineTotal, quoteMargin, quoteTotals, type Quote, type QuoteCost, type QuoteCostLine, type QuoteDraft, type QuoteLine } from "./types";
import type { CostInput } from "./repo";
import { INV_UNIT_LABELS, available, type InventoryItem } from "@/inventory/types";
import LegalConsent from "@/components/feature/LegalConsent";

// عرض السعر: الفريق يكتبه ويرسله، والعميل يعتمده ويدفع العربون (مويسر أو تحويل بنكي) من صفحة مشروعه.
// المبالغ المعروضة هنا للمعاينة؛ الخادم يعيد حسابها ويتحقق من مبلغ الدفع.

type Decide = (q: Quote, decision: "accepted" | "changes", note: string) => Promise<boolean>;

const btn = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors disabled:opacity-50";
const field = "w-full bg-paper-50 border border-paper-200 focus:border-ink-900 focus:bg-white rounded-xl px-3 py-2.5 text-ink-900 outline-none";

export function useMoney() {
  const { t, num } = useI18n();
  return (n: number) => t(`${num(n, 2)} ر.س`, `SAR ${num(n, 2)}`);
}

const STATUS_STYLE: Record<Quote["status"], string> = {
  draft: "bg-paper-100 text-paper-600",
  sent: "bg-accent2-soft text-accent2-ink",
  accepted: "bg-[#EAF0FA] text-[#2B4C7E]",
  changes: "bg-[#FDF0E6] text-[#9A4B12]",
  paid: "bg-[#E6F2EC] text-[#1F6B4F]",
  void: "bg-paper-100 text-paper-500",
};

export function QuoteStatus({ q, staff = false }: { q: Quote; staff?: boolean }) {
  const { pick, t } = useI18n();
  const label = staff && q.status === "sent" ? t("بانتظار العميل", "Awaiting client") : pick(QUOTE_STATUS_LABELS[q.status]);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap ${STATUS_STYLE[q.status]}`}>{label}</span>;
}

/** البنود والمجاميع كما يراها العميل (وتطبعها المتصفحات) */
export function QuoteBody({ q }: { q: Pick<Quote, "lines" | "gross" | "discount" | "discountKind" | "discountValue" | "subtotal" | "vat" | "total" | "deposit" | "depositPct" | "vatRate"> }) {
  const { t, num } = useI18n();
  const money = useMoney();
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-paper-500 border-b border-paper-200">
            <th scope="col" className="text-start font-normal py-2">{t("البند", "Item")}</th>
            <th scope="col" className="text-end font-normal py-2 px-2">{t("الكمية", "Qty")}</th>
            <th scope="col" className="text-end font-normal py-2 px-2 hidden sm:table-cell">{t("سعر الوحدة", "Unit price")}</th>
            <th scope="col" className="text-end font-normal py-2">{t("المبلغ", "Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {q.lines.map((l, i) => (
            <tr key={i} className="border-b border-paper-100 align-top">
              <td className="py-2.5 text-ink-900">{l.label}</td>
              <td className="py-2.5 px-2 text-end text-paper-600 whitespace-nowrap">{num(l.qty)}</td>
              <td className="py-2.5 px-2 text-end text-paper-600 whitespace-nowrap hidden sm:table-cell">{money(l.unit)}</td>
              <td className="py-2.5 text-end text-ink-900 whitespace-nowrap">{money(lineTotal(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 ms-auto max-w-xs text-sm space-y-1.5">
        {q.discount > 0 && (
          <>
            <div className="flex justify-between gap-4 text-paper-600"><dt>{t("مجموع البنود", "Items total")}</dt><dd>{money(q.gross)}</dd></div>
            <div className="flex justify-between gap-4 text-[#1F6B4F]"><dt>{q.discountKind === "pct" ? t(`خصم ${num(q.discountValue)}٪`, `Discount ${q.discountValue}%`) : t("خصم", "Discount")}</dt><dd data-testid="quote-discount">− {money(q.discount)}</dd></div>
          </>
        )}
        <div className="flex justify-between gap-4 text-paper-600"><dt>{t("المجموع قبل الضريبة", "Subtotal")}</dt><dd>{money(q.subtotal)}</dd></div>
        <div className="flex justify-between gap-4 text-paper-600"><dt>{t(`ضريبة القيمة المضافة ${num(q.vatRate)}٪`, `VAT ${q.vatRate}%`)}</dt><dd>{money(q.vat)}</dd></div>
        <div className="flex justify-between gap-4 text-ink-900 font-medium border-t border-paper-200 pt-1.5"><dt>{t("الإجمالي شامل الضريبة", "Total incl. VAT")}</dt><dd data-testid="quote-total">{money(q.total)}</dd></div>
        {q.depositPct > 0 && (
          <div className="flex justify-between gap-4 text-accent2-ink"><dt>{t(`العربون (${num(q.depositPct)}٪)`, `Deposit (${q.depositPct}%)`)}</dt><dd data-testid="quote-deposit">{money(q.deposit)}</dd></div>
        )}
      </dl>
    </div>
  );
}

function SellerLine() {
  const { t } = useI18n();
  const b = useContent("site").billing;
  const parts = [b.legalName, b.vatNumber && t(`الرقم الضريبي ${b.vatNumber}`, `VAT No. ${b.vatNumber}`), b.cr && t(`س.ت ${b.cr}`, `CR ${b.cr}`)].filter(Boolean);
  return parts.length ? <p className="text-xs text-paper-500">{parts.join(" · ")}</p> : null;
}

// ─── العميل ─────────────────────────────────────────────────────────

/** آخر عرض سارٍ للعميل مع الاعتماد والدفع؛ والعروض السابقة مطوية */
export function ClientQuotes({ quotes, onDecide, onTransferNote, payReturn }: { quotes: Quote[]; onDecide: Decide; onTransferNote: (body: string) => Promise<boolean>; payReturn: (q: Quote) => string }) {
  const { t } = useI18n();
  const current = quotes.find((q) => q.status !== "void");
  const older = quotes.filter((q) => q !== current);
  if (!current) return null;
  return (
    <section aria-labelledby="pj-quote" className="rounded-2xl bg-white border border-paper-200 p-5 md:p-6">
      <ClientQuote q={current} onDecide={onDecide} onTransferNote={onTransferNote} payReturn={payReturn} />
      {older.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-paper-600">{t("عروض سابقة", "Earlier quotes")}</summary>
          <ul className="mt-2 space-y-1">
            {older.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 text-paper-600">
                <span dir="ltr">{q.ref}</span>
                <QuoteStatus q={q} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ClientQuote({ q, onDecide, onTransferNote, payReturn }: { q: Quote; onDecide: Decide; onTransferNote: (body: string) => Promise<boolean>; payReturn: (q: Quote) => string }) {
  const { t, date } = useI18n();
  const money = useMoney();
  const billing = useContent("site").billing;
  const [mode, setMode] = useState<"idle" | "confirm" | "changes" | "pay">("idle");
  const [note, setNote] = useState("");
  const [trx, setTrx] = useState("");
  const [told, setTold] = useState(false);
  // ضغطة واحدة لكل إجراء: الضغطة الثانية كانت تُظهر خطأً بعد نجاح الأولى
  const [busy, setBusy] = useState(false);
  const once = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const noteId = useId();
  const trxId = useId();
  const expired = !!q.validUntil && q.validUntil < new Date().toISOString().slice(0, 10);
  const online = PAYMENTS.enabled && isSupabaseEnabled && q.deposit > 0;
  const due = q.status === "accepted" || (q.status === "sent" && q.depositPct === 0);

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-paper-500">{t("عرض السعر", "Quote")} · <bdi dir="ltr">{q.ref}</bdi>{q.sentAt ? ` · ${date(new Date(q.sentAt), { day: "numeric", month: "long" })}` : ""}</p>
          <h2 id="pj-quote" className="mt-1 font-display text-2xl text-ink-900">{money(q.total)}</h2>
          <SellerLine />
        </div>
        <QuoteStatus q={q} />
      </header>
      <div className="mt-5"><QuoteBody q={q} /></div>
      {q.notes && <p className="mt-4 text-sm text-paper-600 whitespace-pre-line leading-[1.8]">{q.notes}</p>}
      {q.validUntil && q.status === "sent" && (
        <p className={`mt-3 text-xs ${expired ? "text-red-700" : "text-paper-500"}`}>
          {expired ? t("انتهت صلاحية العرض — اطلب من الفريق عرضاً محدّثاً.", "This quote has expired — ask the team for an updated one.") : t(`ساري حتى ${date(new Date(q.validUntil), { day: "numeric", month: "long" })}`, `Valid until ${date(new Date(q.validUntil), { day: "numeric", month: "long" })}`)}
        </p>
      )}

      {q.status === "sent" && !expired && mode === "idle" && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("confirm")} className={`${btn} bg-[#1F6B4F] text-white hover:bg-[#185a42]`}>{t("اعتمد العرض", "Approve quote")}</button>
          <button type="button" onClick={() => setMode("changes")} className={`${btn} border border-paper-300 text-ink-900 hover:border-ink-900`}>{t("طلب تعديل", "Request changes")}</button>
        </div>
      )}
      {mode === "confirm" && (
        <div className="mt-5 rounded-xl bg-paper-50 border border-paper-200 p-4">
          <p className="text-sm text-ink-900 leading-[1.8]">
            {t(`باعتمادك توافق على البنود أعلاه بإجمالي ${money(q.total)} شامل الضريبة`, `By approving, you agree to the items above for ${money(q.total)} incl. VAT`)}
            {q.depositPct > 0 ? t(`، ويبدأ العمل بعد دفع العربون ${money(q.deposit)}.`, `; work starts once the ${money(q.deposit)} deposit is paid.`) : "."}
          </p>
          <LegalConsent refund action={{ ar: "وباعتمادك", en: "approving" }} className="mt-1" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => once(async () => { if (await onDecide(q, "accepted", "")) setMode("pay"); })} className={`${btn} bg-ink-900 text-white`}>{t("تأكيد الاعتماد", "Confirm approval")}</button>
            <button type="button" onClick={() => setMode("idle")} className={`${btn} text-paper-600`}>{t("رجوع", "Back")}</button>
          </div>
        </div>
      )}
      {mode === "changes" && (
        <form
          className="mt-5 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            const ok = await onDecide(q, "changes", note).finally(() => setBusy(false));
            if (ok) {
              setMode("idle");
              setNote("");
            }
          }}
        >
          <label htmlFor={noteId} className="block text-sm text-paper-600">{t("ما الذي تريد تعديله في العرض؟", "What should change in the quote?")}</label>
          <textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} required className={`${field} resize-none`} />
          <div className="flex gap-2">
            <button type="submit" disabled={!note.trim() || busy} className={`${btn} bg-ink-900 text-white`}>{t("أرسل طلب التعديل", "Send request")}</button>
            <button type="button" onClick={() => setMode("idle")} className={`${btn} text-paper-600`}>{t("إلغاء", "Cancel")}</button>
          </div>
        </form>
      )}

      {due && q.deposit > 0 && (
        <div className="mt-6 border-t border-paper-200 pt-5 space-y-5">
          <h3 className="font-display text-xl text-ink-900">{t(`ادفع العربون ${money(q.deposit)} ليبدأ العمل`, `Pay the ${money(q.deposit)} deposit to start`)}</h3>
          {online && (
            <PaymentForm amountSar={q.deposit} description={t(`عربون ${q.ref}`, `Deposit ${q.ref}`)} callbackPath={payReturn(q)} metadata={{ kind: "deposit", quote_id: q.id, order_ref: q.ref }} />
          )}
          {billing.iban && (
            <div className="rounded-xl bg-paper-50 border border-paper-200 p-4">
              <p className="text-sm text-ink-900">{online ? t("أو بتحويل بنكي:", "Or by bank transfer:") : t("بتحويل بنكي:", "By bank transfer:")}</p>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1 text-sm">
                {billing.legalName && (<><dt className="text-paper-500">{t("المستفيد", "Beneficiary")}</dt><dd className="text-ink-900">{billing.legalName}</dd></>)}
                {billing.bankName && (<><dt className="text-paper-500">{t("البنك", "Bank")}</dt><dd className="text-ink-900">{billing.bankName}</dd></>)}
                <dt className="text-paper-500">{t("الآيبان", "IBAN")}</dt><dd className="text-ink-900 font-mono" dir="ltr" style={{ textAlign: "start" }} data-testid="iban">{billing.iban.replace(/(.{4})/g, "$1 ").trim()}</dd>
                <dt className="text-paper-500">{t("اكتب في الملاحظة", "Reference")}</dt><dd className="text-ink-900 font-mono" dir="ltr" style={{ textAlign: "start" }}>{q.ref}</dd>
              </dl>
              {told ? (
                <p role="status" className="mt-3 text-sm text-[#1F6B4F]">{t("أبلغنا الفريق؛ يؤكد الاستلام خلال يوم عمل.", "The team has been told; they'll confirm receipt within a business day.")}</p>
              ) : (
                <form
                  className="mt-3 flex flex-col sm:flex-row gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const body = t(`حوّلت العربون لعرض ${q.ref} (${money(q.deposit)})${trx.trim() ? ` — مرجع التحويل: ${trx.trim()}` : ""}`, `I transferred the deposit for ${q.ref} (${money(q.deposit)})${trx.trim() ? ` — transfer ref: ${trx.trim()}` : ""}`);
                    await once(async () => { if (await onTransferNote(body)) setTold(true); });
                  }}
                >
                  <label htmlFor={trxId} className="sr-only">{t("مرجع التحويل (اختياري)", "Transfer reference (optional)")}</label>
                  <input id={trxId} value={trx} onChange={(e) => setTrx(e.target.value)} maxLength={60} placeholder={t("مرجع التحويل (اختياري)", "Transfer reference (optional)")} className={field} />
                  <button type="submit" disabled={busy} className={`${btn} border border-paper-300 text-ink-900 hover:border-ink-900 shrink-0`}>{t("حوّلت العربون", "I've transferred")}</button>
                </form>
              )}
            </div>
          )}
          {!online && !billing.iban && <p className="text-sm text-paper-600">{t("سيتواصل معك الفريق لترتيب دفع العربون.", "The team will contact you to arrange the deposit.")}</p>}
        </div>
      )}
      {q.status === "paid" && (
        <p role="status" className="mt-5 rounded-xl bg-[#E6F2EC] text-[#1F6B4F] px-4 py-3 text-sm">
          {t(`استلمنا العربون ${money(q.paidAmount ?? q.deposit)} — بدأ العمل على مشروعك.`, `Deposit of ${money(q.paidAmount ?? q.deposit)} received — work on your project has started.`)}
        </p>
      )}
      {q.status === "changes" && <p className="mt-5 text-sm text-paper-600">{t("وصل طلب التعديل للفريق، وسيرسل عرضاً محدّثاً.", "Your change request reached the team; they'll send an updated quote.")}</p>}
    </div>
  );
}

// ─── الفريق ─────────────────────────────────────────────────────────

const blankLine = (): QuoteLine => ({ label: "", qty: 1, unit: 0 });
const blankCost = (): QuoteCostLine => ({ unitCost: 0, itemId: null, perUnit: null });
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export interface EditorContext {
  /** مواد المخزون لربطها ببنود العرض */
  items: InventoryItem[];
  /** سقف خصم دور المستخدم ٪ */
  cap: number;
  marginFloor: number;
}

export function QuoteEditor({ projectId, initial, initialCost, ctx, onSave, onSend, onDelete }: { projectId: string; initial: Quote | null; initialCost?: QuoteCost | null; ctx: EditorContext; onSave: (d: QuoteDraft, c: CostInput) => Promise<boolean>; onSend: (d: QuoteDraft, c: CostInput) => Promise<boolean>; onDelete?: () => void }) {
  const { t, num, pick } = useI18n();
  const money = useMoney();
  const start = initial?.lines.length ? initial.lines : [blankLine()];
  const [lines, setLines] = useState<QuoteLine[]>(start);
  const [costs, setCosts] = useState<QuoteCostLine[]>(start.map((_, i) => initialCost?.lines[i] ?? blankCost()));
  const [extra, setExtra] = useState(initialCost?.extraCost ?? 0);
  const [depositPct, setDepositPct] = useState(initial?.depositPct ?? 50);
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? inDays(14));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [discountKind, setDiscountKind] = useState<Quote["discountKind"]>(initial?.discountKind ?? null);
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? 0);
  const [busy, setBusy] = useState(false);
  const totals = quoteTotals(lines, VAT_RATE, depositPct, discountKind, discountValue);
  const margin = quoteMargin({ lines, subtotal: totals.subtotal }, { lines: costs, extraCost: extra });
  const discountPct = totals.gross > 0 ? (totals.discount / totals.gross) * 100 : 0;
  const overCap = discountPct > ctx.cap + 0.001;
  const underFloor = !!margin && totals.subtotal > 0 && margin.pct < ctx.marginFloor;
  const draft: QuoteDraft = { projectId, lines, depositPct, validUntil: validUntil || null, notes, discountKind, discountValue: discountKind ? discountValue : 0 };
  const cost: CostInput = { lines: costs, extraCost: extra };
  const set = (i: number, patch: Partial<QuoteLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setC = (i: number, patch: Partial<QuoteCostLine>) => setCosts(costs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const pickItem = (i: number, id: string) => {
    const it = ctx.items.find((x) => x.id === id);
    setC(i, { itemId: it?.id ?? null, unitCost: it ? Math.round(it.avgCost * 100) / 100 : costs[i].unitCost });
    if (it && !lines[i].label.trim()) set(i, { label: it.name });
  };
  const go = async (fn: (d: QuoteDraft, c: CostInput) => Promise<boolean>) => {
    setBusy(true);
    await fn(draft, cost);
    setBusy(false);
  };
  const activeItems = ctx.items.filter((x) => x.active);
  return (
    <div className="space-y-4">
      <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-paper-500" aria-hidden="true">
        <span className="col-span-4">{t("الوصف", "Description")}</span>
        <span className="col-span-1">{t("الكمية", "Qty")}</span>
        <span className="col-span-2">{t("سعر الوحدة (ر.س، قبل الضريبة)", "Unit price (SAR, excl. VAT)")}</span>
        <span className="col-span-2">{t("تكلفة الوحدة (داخلية)", "Unit cost (internal)")}</span>
        <span className="col-span-2">{t("من المخزون", "From stock")}</span>
      </div>
      <ul className="space-y-3 lg:space-y-2" aria-label={t("بنود العرض", "Quote lines")}>
        {lines.map((l, i) => {
          const it = ctx.items.find((x) => x.id === costs[i]?.itemId);
          const need = it ? l.qty * (costs[i]?.perUnit || 1) : 0;
          return (
            <li key={i} className="grid grid-cols-12 gap-2 items-center">
              <input aria-label={t(`وصف البند ${num(i + 1)}`, `Line ${i + 1} description`)} value={l.label} maxLength={200} onChange={(e) => set(i, { label: e.target.value })} placeholder={t("مثال: تصميم العلبة", "e.g. Box design")} className={`${field} col-span-12 lg:col-span-4`} />
              <input aria-label={t(`كمية البند ${num(i + 1)}`, `Line ${i + 1} quantity`)} type="number" min={0} step="any" value={l.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} className={`${field} col-span-3 lg:col-span-1`} />
              <input aria-label={t(`سعر وحدة البند ${num(i + 1)}`, `Line ${i + 1} unit price`)} type="number" min={0} step="0.01" value={l.unit} onChange={(e) => set(i, { unit: Number(e.target.value) })} className={`${field} col-span-4 lg:col-span-2`} />
              <input aria-label={t(`تكلفة وحدة البند ${num(i + 1)}`, `Line ${i + 1} unit cost`)} type="number" min={0} step="0.01" value={costs[i]?.unitCost ?? 0} onChange={(e) => setC(i, { unitCost: Number(e.target.value) })} className={`${field} col-span-4 lg:col-span-2 !bg-sand-soft/60`} />
              <select aria-label={t(`مادة البند ${num(i + 1)} من المخزون`, `Line ${i + 1} stock item`)} value={costs[i]?.itemId ?? ""} onChange={(e) => pickItem(i, e.target.value)} className={`${field} col-span-10 lg:col-span-2`}>
                <option value="">{t("بلا ربط", "None")}</option>
                {activeItems.map((x) => <option key={x.id} value={x.id}>{x.sku} · {x.name}</option>)}
              </select>
              <button type="button" onClick={() => { if (lines.length > 1) { setLines(lines.filter((_, j) => j !== i)); setCosts(costs.filter((_, j) => j !== i)); } else { setLines([blankLine()]); setCosts([blankCost()]); } }} aria-label={t(`احذف البند ${num(i + 1)}`, `Remove line ${i + 1}`)} className="col-span-2 lg:col-span-1 h-10 rounded-full text-red-700 hover:bg-red-50">
                <i className="ri-delete-bin-line" aria-hidden="true"></i>
              </button>
              {it && (
                <p className={`col-span-12 text-xs ${available(it) < need ? "text-red-700" : "text-paper-500"}`}>
                  {t(`${it.name}: متاح ${num(available(it))} ${pick(INV_UNIT_LABELS[it.unit])} — يُحجز ${num(need)} عند دفع العربون`, `${it.name}: ${available(it)} ${pick(INV_UNIT_LABELS[it.unit])} available — ${need} reserved on deposit`)}
                  {available(it) < need ? t(" (المخزون لا يكفي)", " (not enough stock)") : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {lines.length < 40 && (
        <button type="button" onClick={() => { setLines([...lines, blankLine()]); setCosts([...costs, blankCost()]); }} className="text-sm text-ink-900 underline underline-offset-4">{t("+ بند", "+ Line")}</button>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("الخصم", "Discount")}</span>
          <div className="flex gap-2">
            <select aria-label={t("نوع الخصم", "Discount type")} value={discountKind ?? ""} onChange={(e) => setDiscountKind((e.target.value || null) as Quote["discountKind"])} className={`${field} w-28 shrink-0`}>
              <option value="">{t("بلا", "None")}</option>
              <option value="pct">٪</option>
              <option value="amount">{t("ر.س", "SAR")}</option>
            </select>
            {discountKind && <input aria-label={t("قيمة الخصم", "Discount value")} type="number" min={0} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} className={field} />}
          </div>
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("العربون ٪", "Deposit %")}</span>
          <input type="number" min={0} max={100} step={5} value={depositPct} onChange={(e) => setDepositPct(Math.round(Number(e.target.value)))} className={field} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("ساري حتى", "Valid until")}</span>
          <input type="date" value={validUntil ?? ""} onChange={(e) => setValidUntil(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("تكاليف أخرى (داخلية)", "Other costs (internal)")}</span>
          <input type="number" min={0} step="0.01" value={extra} onChange={(e) => setExtra(Number(e.target.value))} className={`${field} !bg-sand-soft/60`} />
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3" aria-live="polite">
        <div className="rounded-xl bg-paper-50 border border-paper-200 px-3 py-2 text-xs text-paper-600 space-y-0.5">
          <p>{t("مجموع البنود", "Lines")}: <span className="text-ink-900">{money(totals.gross)}</span></p>
          {totals.discount > 0 && <p>{t("الخصم", "Discount")}: <span className="text-ink-900">− {money(totals.discount)}</span> ({num(Math.round(discountPct * 10) / 10, 1)}%)</p>}
          <p>{t(`الإجمالي مع الضريبة ${num(VAT_RATE)}٪`, `Total incl. ${VAT_RATE}% VAT`)}: <span className="text-ink-900" data-testid="editor-total">{money(totals.total)}</span></p>
          <p>{t("العربون", "Deposit")}: <span className="text-ink-900">{money(totals.deposit)}</span></p>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-xs space-y-0.5 ${underFloor ? "bg-red-50 border-red-200 text-red-800" : "bg-sand-soft/50 border-paper-200 text-paper-600"}`}>
          <p className="text-[11px] text-paper-500">{t("داخلي — لا يراه العميل", "Internal — hidden from the client")}</p>
          <p>{t("التكلفة", "Cost")}: <span className="text-ink-900">{money(margin?.cost ?? 0)}</span></p>
          <p>{t("الربح المتوقع", "Expected profit")}: <span className="text-ink-900" data-testid="editor-profit">{money(margin?.profit ?? 0)}</span> · <span data-testid="editor-margin">{num(Math.round((margin?.pct ?? 0) * 10) / 10, 1)}%</span></p>
          {underFloor && <p role="alert">{t(`الهامش أقل من الحد ${num(ctx.marginFloor)}٪`, `Margin is below the ${ctx.marginFloor}% floor`)}</p>}
        </div>
      </div>
      {overCap && <p role="alert" className="text-sm text-red-700">{t(`الخصم ${num(Math.round(discountPct * 10) / 10, 1)}٪ أعلى من سقف دورك (${num(ctx.cap)}٪): تحفظه مسودة، ويرسله المالك أو المدير.`, `A ${Math.round(discountPct * 10) / 10}% discount is above your role's cap (${ctx.cap}%): save it as a draft; an owner or admin can send it.`)}</p>}
      <label className="block">
        <span className="block text-xs text-paper-500 mb-1.5">{t("ملاحظات وشروط (يراها العميل)", "Notes & terms (client sees these)")}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={`${field} resize-none`} placeholder={t("مثال: يشمل جولتي تعديل. التسليم خلال 3 أسابيع من دفع العربون.", "e.g. Includes two revision rounds. Delivery within 3 weeks of the deposit.")} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || overCap} onClick={() => go(onSend)} className={`${btn} bg-ink-900 text-white`}>{t("حفظ وإرسال للعميل", "Save & send to client")}</button>
        <button type="button" disabled={busy} onClick={() => go(onSave)} className={`${btn} border border-paper-300 text-ink-900`}>{t("حفظ المسودة", "Save draft")}</button>
        {onDelete && <button type="button" disabled={busy} onClick={onDelete} className={`${btn} text-red-700 ms-auto`}>{t("حذف المسودة", "Delete draft")}</button>}
      </div>
    </div>
  );
}

export function MarkPaid({ q, onMark }: { q: Quote; onMark: (method: "bank" | "cash", ref: string, amount: number) => Promise<boolean> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"bank" | "cash">("bank");
  const [ref, setRef] = useState("");
  const [amount, setAmount] = useState(q.deposit || q.total);
  const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`${btn} border border-paper-300 text-ink-900 hover:border-ink-900`}>{t("تسجيل دفعة مستلمة", "Record a received payment")}</button>;
  return (
    <form
      className="grid sm:grid-cols-4 gap-2 items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const ok = await onMark(method, ref, amount).finally(() => setBusy(false));
        if (ok) setOpen(false);
      }}
    >
      <label className="block">
        <span className="block text-xs text-paper-500 mb-1.5">{t("الطريقة", "Method")}</span>
        <select value={method} onChange={(e) => setMethod(e.target.value as "bank" | "cash")} className={field}>
          <option value="bank">{t("تحويل بنكي", "Bank transfer")}</option>
          <option value="cash">{t("نقداً", "Cash")}</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs text-paper-500 mb-1.5">{t("المرجع", "Reference")}</span>
        <input value={ref} onChange={(e) => setRef(e.target.value)} required maxLength={120} className={field} />
      </label>
      <label className="block">
        <span className="block text-xs text-paper-500 mb-1.5">{t("المبلغ (ر.س)", "Amount (SAR)")}</span>
        <input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={field} />
      </label>
      <button type="submit" disabled={!ref.trim() || busy} className={`${btn} bg-[#1F6B4F] text-white`}>{t("تأكيد الاستلام", "Confirm receipt")}</button>
    </form>
  );
}
