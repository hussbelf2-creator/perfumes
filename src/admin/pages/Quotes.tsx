import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { projectsRepo, type ProjectsData } from "@/projects/repo";
import { usePActor } from "@/projects/useProjects";
import { QuoteStatus, useMoney } from "@/projects/quotes";
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS, type QuoteStatus as Status } from "@/projects/types";
import { Btn, Card, Empty, PageTitle, Stat, download, inlineFieldCls, toCsv, useFormat } from "../components/ui";
import { arCount, enCount } from "@/i18n/plural";

// كل عروض الأسعار عبر المشاريع: ما ينتظر العميل، وما اعتُمد ولم يُدفع، وما حُصّل

export default function Quotes() {
  const { t, pick, num } = useI18n();
  const actor = usePActor();
  const f = useFormat();
  const money = useMoney();
  const [data, setData] = useState<ProjectsData | null>(null);
  const [status, setStatus] = useState<Status | "open" | "all">("open");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!actor) return;
    let live = true;
    void projectsRepo.load(actor).then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [actor]);
  if (!data) return <div className="h-48 rounded-2xl shimmer bg-paper-100" />;

  const project = (id: string) => data.projects.find((p) => p.id === id);
  const sum = (xs: typeof data.quotes, k: "total" | "deposit") => xs.reduce((s, x) => s + x[k], 0);
  const sent = data.quotes.filter((x) => x.status === "sent");
  const accepted = data.quotes.filter((x) => x.status === "accepted");
  const paid = data.quotes.filter((x) => x.status === "paid");
  const needle = q.trim().toLowerCase();
  const rows = data.quotes
    .filter((x) => (status === "all" ? true : status === "open" ? ["draft", "sent", "accepted", "changes"].includes(x.status) : x.status === status))
    .filter((x) => !needle || [x.ref, project(x.projectId)?.title, project(x.projectId)?.clientEmail].some((s) => s?.toLowerCase().includes(needle)));

  return (
    <>
      <PageTitle
        title={t("عروض الأسعار", "Quotes")}
        sub={t("كل العروض عبر المشاريع. تُنشأ وتُرسل من صفحة كل مشروع.", "All quotes across projects. Create and send them from each project's page.")}
        actions={
          <Btn
            variant="secondary"
            onClick={() =>
              download(
                `quotes-${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv([["ref", "project", "client_email", "status", "subtotal_sar", "vat_sar", "total_sar", "deposit_sar", "paid_sar", "payment_method", "payment_ref", "sent_at", "paid_at"], ...rows.map((x) => [x.ref, project(x.projectId)?.title, project(x.projectId)?.clientEmail, x.status, x.subtotal, x.vat, x.total, x.deposit, x.paidAmount, x.paymentMethod, x.paymentRef, x.sentAt, x.paidAt])]),
              )
            }
          >
            <i className="ri-download-2-line" aria-hidden="true"></i>
            {t("تصدير CSV", "Export CSV")}
          </Btn>
        }
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4">
        <Stat icon="ri-hourglass-line" label={t("بانتظار العميل", "Awaiting client")} value={f.statMoney(sum(sent, "total"))} hint={t(arCount(sent.length, { one: "عرض واحد", two: "عرضان", few: "عروض", many: "عرضاً" }, num), enCount(sent.length, "quote", "quotes"))} />
        <Stat icon="ri-checkbox-circle-line" label={t("عربون مستحق", "Deposits due")} value={f.statMoney(sum(accepted, "deposit"))} tone={accepted.length ? "warn" : "plain"} hint={t(`${num(accepted.length)} عرض معتمد`, `${accepted.length} approved`)} />
        <Stat icon="ri-money-dollar-circle-line" label={t("عربون محصّل", "Deposits collected")} value={f.statMoney(paid.reduce((s, x) => s + (x.paidAmount ?? 0), 0))} tone="good" hint={t(arCount(paid.length, { one: "عرض واحد", two: "عرضان", few: "عروض", many: "عرضاً" }, num), enCount(paid.length, "quote", "quotes"))} />
        <Stat icon="ri-scales-3-line" label={t("قيمة المدفوع منها", "Value of paid quotes")} value={f.statMoney(sum(paid, "total"))} hint={t("الإجمالي شامل الضريبة", "Total incl. VAT")} />
      </div>
      <Card>
        <div className="p-4 border-b border-paper-100 flex flex-wrap gap-2 justify-between">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث برقم العرض أو المشروع أو البريد", "Search by quote, project or email")} aria-label={t("بحث", "Search")} className={`${inlineFieldCls} min-w-[16rem]`} />
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inlineFieldCls} aria-label={t("الحالة", "Status")}>
            <option value="open">{t("المفتوحة", "Open")}</option>
            <option value="all">{t("الكل", "All")}</option>
            {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{s === "sent" ? t("بانتظار العميل", "Awaiting client") : pick(QUOTE_STATUS_LABELS[s])}</option>)}
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty icon="ri-file-list-3-line" title={t("لا عروض هنا", "No quotes here")} hint={t("أنشئ عرض السعر من صفحة المشروع.", "Create a quote from the project page.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-paper-500 border-b border-paper-100">
                  <th scope="col" className="text-start font-normal px-5 py-3">{t("العرض", "Quote")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3">{t("المشروع", "Project")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3">{t("الحالة", "Status")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3 hidden md:table-cell">{t("أُرسل", "Sent")}</th>
                  <th scope="col" className="text-end font-normal px-3 py-3">{t("الإجمالي", "Total")}</th>
                  <th scope="col" className="text-end font-normal px-5 py-3 hidden sm:table-cell">{t("العربون", "Deposit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-100">
                {rows.map((x) => {
                  const p = project(x.projectId);
                  return (
                    <tr key={x.id}>
                      <td className="px-5 py-3 font-mono text-ink-900" dir="ltr" style={{ textAlign: "start" }}>{x.ref}</td>
                      <td className="px-3 py-3"><Link to={`/admin/projects/${x.projectId}`} className="text-ink-900 hover:underline underline-offset-4">{p?.title ?? "—"}</Link></td>
                      <td className="px-3 py-3"><QuoteStatus q={x} staff /></td>
                      <td className="px-3 py-3 hidden md:table-cell text-paper-600 whitespace-nowrap">{x.sentAt ? f.ago(x.sentAt) : "—"}</td>
                      <td className="px-3 py-3 text-end whitespace-nowrap text-ink-900">{money(x.total)}</td>
                      <td className="px-5 py-3 text-end whitespace-nowrap hidden sm:table-cell text-paper-600">{money(x.status === "paid" ? (x.paidAmount ?? x.deposit) : x.deposit)}</td>
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
