import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n, type Bi } from "@/i18n/context";
import { useCrm } from "../data/CrmProvider";
import { Avatar, Btn, Card, Empty, PageTitle, download, fieldCls, inlineFieldCls, toCsv, useFormat } from "../components/ui";

const ACTIONS: Record<string, Bi & { icon: string }> = {
  "team.role": { ar: "تغيير دور", en: "Role change", icon: "ri-shield-user-line" },
  "team.activate": { ar: "تفعيل حساب", en: "Account enabled", icon: "ri-user-follow-line" },
  "team.deactivate": { ar: "تعطيل حساب", en: "Account disabled", icon: "ri-user-forbid-line" },
  "crm.assign": { ar: "إسناد", en: "Assignment", icon: "ri-user-shared-line" },
  "crm.stage": { ar: "تغيير مرحلة", en: "Stage change", icon: "ri-arrow-left-right-line" },
  "crm.lead_status": { ar: "حالة طلب", en: "Request status", icon: "ri-inbox-line" },
  "crm.create": { ar: "إضافة عميل", en: "Client created", icon: "ri-user-add-line" },
  "studio.create": { ar: "إضافة عبوة", en: "Model added", icon: "ri-box-3-line" },
  "studio.delete": { ar: "حذف عبوة", en: "Model deleted", icon: "ri-delete-bin-line" },
  "studio.publish": { ar: "نشر عبوة", en: "Model published", icon: "ri-eye-line" },
  "studio.unpublish": { ar: "إخفاء عبوة", en: "Model hidden", icon: "ri-eye-off-line" },
  "content.publish": { ar: "نشر محتوى", en: "Content published", icon: "ri-upload-cloud-line" },
  "content.restore": { ar: "استعادة نسخة محتوى", en: "Content version restored", icon: "ri-history-line" },
  "project.create": { ar: "إنشاء مشروع", en: "Project created", icon: "ri-folder-add-line" },
  "project.stage": { ar: "مرحلة مشروع", en: "Project stage", icon: "ri-flag-line" },
  "project.approve": { ar: "اعتماد تصميم", en: "Design approved", icon: "ri-checkbox-circle-line" },
  "project.changes": { ar: "طلب تعديل تصميم", en: "Design changes asked", icon: "ri-edit-2-line" },
  "quote.send": { ar: "إرسال عرض سعر", en: "Quote sent", icon: "ri-send-plane-line" },
  "quote.accept": { ar: "اعتماد عرض سعر", en: "Quote accepted", icon: "ri-thumb-up-line" },
  "quote.changes": { ar: "طلب تعديل عرض", en: "Quote changes asked", icon: "ri-edit-line" },
  "quote.paid": { ar: "دفع عربون", en: "Deposit paid", icon: "ri-bank-card-line" },
  "pricing.settings": { ar: "سياسة التسعير", en: "Pricing policy", icon: "ri-price-tag-3-line" },
};

export default function Audit() {
  const { t, pick } = useI18n();
  const { data, member, contact } = useCrm();
  const f = useFormat();
  const [action, setAction] = useState("all");
  if (!data) return null;
  const rows = data.audit.filter((a) => action === "all" || a.action.startsWith(action));

  const target = (entity: string, id?: string | null) => {
    if (!id) return "—";
    if (entity === "contact") {
      const c = contact(id);
      return c ? <Link to={`/admin/contacts/${id}`} className="text-ink-900 hover:underline underline-offset-4">{c.name}</Link> : id;
    }
    if (entity === "profile") {
      const m = member(id);
      return m ? `${m.firstName} ${m.lastName}` : id;
    }
    if (entity === "lead") return <Link to={`/admin/inbox?status=all&open=${id}`} className="text-ink-900 hover:underline underline-offset-4">{t("طلب", "Request")}</Link>;
    return id;
  };

  return (
    <>
      <PageTitle
        title={t("سجل التدقيق", "Audit log")}
        sub={t("من غيّر ماذا ومتى. يُكتب في قاعدة البيانات ولا يمكن تعديله أو حذفه.", "Who changed what, and when. Written by the database; it can't be edited or deleted.")}
        actions={
          <>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={inlineFieldCls} aria-label={t("نوع الإجراء", "Action type")}>
              <option value="all">{t("كل الإجراءات", "All actions")}</option>
              <option value="team">{t("الفريق والأدوار", "Team & roles")}</option>
              <option value="crm">{t("العملاء", "Clients")}</option>
            </select>
            <Btn variant="secondary" onClick={() => download(`audit-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([["at", "actor", "action", "entity", "entity_id", "detail"], ...rows.map((a) => [a.createdAt, a.actorId, a.action, a.entity, a.entityId, a.detail])]))}>
              <i className="ri-download-2-line" aria-hidden="true"></i>
              CSV
            </Btn>
          </>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <Empty icon="ri-file-shield-2-line" title={t("لا إجراءات مسجّلة", "No recorded actions")} />
        ) : (
          <ol className="divide-y divide-paper-100">
            {rows.map((a) => {
              const who = member(a.actorId);
              const meta = ACTIONS[a.action];
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
                  <span className="w-8 h-8 rounded-full bg-sand-soft flex items-center justify-center shrink-0">
                    <i className={meta?.icon ?? "ri-history-line"} aria-hidden="true"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink-900">
                      {meta ? pick(meta) : a.action} <span className="text-paper-400">·</span> {target(a.entity, a.entityId)}
                    </p>
                    {a.detail && <p className="text-xs text-paper-500 font-mono mt-0.5" dir="ltr" style={{ textAlign: "start" }}>{a.detail}</p>}
                  </div>
                  <span className="flex items-center gap-2 text-xs text-paper-500">
                    {who ? <><Avatar m={who} />{who.firstName}</> : t("النظام", "System")}
                  </span>
                  <time dateTime={a.createdAt} className="w-28 text-end text-xs text-paper-500">{f.ago(a.createdAt)}</time>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </>
  );
}
