import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, Empty, PageTitle, Stat, download, fieldCls, inlineFieldCls, toCsv, useFormat } from "../components/ui";

const METHOD: Record<string, string> = { mada: "مدى · mada", visa: "Visa", mastercard: "Mastercard", applepay: "Apple Pay", stcpay: "STC Pay", creditcard: "Card" };

export default function Payments() {
  const { t, num } = useI18n();
  const { data } = useCrm();
  const f = useFormat();
  const [status, setStatus] = useState("all");

  const byEmail = useMemo(() => new Map(data?.contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c])), [data]);
  if (!data) return null;

  const paid = data.payments.filter((p) => p.status === "paid");
  const failed = data.payments.filter((p) => p.status !== "paid");
  const total = paid.reduce((s, p) => s + p.amount / 100, 0);
  const rate = data.payments.length ? Math.round((paid.length / data.payments.length) * 100) : 0;
  const rows = data.payments.filter((p) => status === "all" || (status === "paid" ? p.status === "paid" : p.status !== "paid"));

  return (
    <>
      <PageTitle
        title={t("المدفوعات", "Payments")}
        sub={t("مدفوعات مويسر المتحقق منها على الخادم.", "Moyasar payments verified on the server.")}
        actions={
          <Btn
            variant="secondary"
            onClick={() =>
              download(`payments-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([["id", "order_ref", "email", "method", "amount_sar", "status", "created_at"], ...rows.map((p) => [p.id, p.orderRef, p.email, p.method, p.amount / 100, p.status, p.createdAt])]))
            }
          >
            <i className="ri-download-2-line" aria-hidden="true"></i>
            {t("تصدير CSV", "Export CSV")}
          </Btn>
        }
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4">
        <Stat icon="ri-money-dollar-circle-line" label={t("إجمالي المحصّل", "Collected")} value={f.statMoney(total)} tone="good" hint={t(`${num(paid.length)} دفعة`, `${paid.length} payments`)} />
        <Stat icon="ri-percent-line" label={t("نسبة النجاح", "Success rate")} value={`${num(rate)}%`} />
        <Stat icon="ri-close-circle-line" label={t("مرفوضة", "Failed")} value={num(failed.length)} tone={failed.length ? "warn" : "plain"} hint={failed.length ? t("تابع أصحابها — غالباً يحتاجون وسيلة أخرى", "Follow up — they often need another method") : undefined} />
        <Stat icon="ri-shopping-bag-3-line" label={t("متوسط الطلب", "Average order")} value={f.money(paid.length ? total / paid.length : 0)} />
      </div>

      <Card>
        <div className="p-4 border-b border-paper-100 flex justify-end">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inlineFieldCls} aria-label={t("الحالة", "Status")}>
            <option value="all">{t("كل المدفوعات", "All payments")}</option>
            <option value="paid">{t("الناجحة", "Paid")}</option>
            <option value="failed">{t("المرفوضة", "Failed")}</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty icon="ri-bank-card-line" title={t("لا مدفوعات بعد", "No payments yet")} hint={t("تظهر هنا بعد تفعيل مويسر وأول عملية دفع.", "They appear here once Moyasar is enabled and the first payment comes in.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-paper-500 border-b border-paper-100">
                  <th scope="col" className="text-start font-normal px-5 py-3">{t("رقم الطلب", "Order")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3">{t("العميل", "Client")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3 hidden md:table-cell">{t("الوسيلة", "Method")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3 hidden sm:table-cell">{t("التاريخ", "Date")}</th>
                  <th scope="col" className="text-end font-normal px-5 py-3">{t("المبلغ", "Amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-100">
                {rows.map((p) => {
                  const c = p.email ? byEmail.get(p.email.toLowerCase()) : undefined;
                  const ok = p.status === "paid";
                  return (
                    <tr key={p.id}>
                      <td className="px-5 py-3 font-mono text-ink-900" dir="ltr" style={{ textAlign: "start" }}>{p.orderRef ?? p.id.slice(0, 8)}</td>
                      <td className="px-3 py-3">{c ? <Link to={`/admin/contacts/${c.id}`} className="text-ink-900 hover:underline underline-offset-4">{c.name}</Link> : <span className="text-paper-500" dir="ltr">{p.email ?? "—"}</span>}</td>
                      <td className="px-3 py-3 hidden md:table-cell text-paper-600">{METHOD[p.method ?? ""] ?? p.method ?? "—"}</td>
                      <td className="px-3 py-3 hidden sm:table-cell text-paper-600 whitespace-nowrap">{f.date(p.createdAt)}</td>
                      <td className="px-5 py-3 text-end whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 ${ok ? "text-[#1F6B4F]" : "text-red-700"}`}>
                          <i className={ok ? "ri-checkbox-circle-line" : "ri-close-circle-line"} aria-hidden="true"></i>
                          <span className="sr-only">{ok ? t("مدفوع", "Paid") : t("مرفوض", "Failed")}</span>
                          <span className={`font-mono ${ok ? "" : "line-through"}`}>{f.money(p.amount / 100)}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
