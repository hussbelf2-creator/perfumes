import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { PERMISSIONS, PERMISSION_LABELS, ROLE_HINTS, ROLE_LABELS, ROLE_PERMISSIONS, STAFF_ROLES, canGrant, type Role } from "@/lib/rbac";
import { useCrm } from "../data/CrmProvider";
import { Avatar, Btn, Card, PageTitle, fieldCls, inlineFieldCls, useFormat } from "../components/ui";

export default function Team() {
  const { t, pick, num } = useI18n();
  const { can, user, isDemoMode } = useAuth();
  const { data, run, mode } = useCrm();
  const f = useFormat();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("sales");

  if (!data || !user) return null;
  const manage = can("team.manage");
  const grantable = STAFF_ROLES.filter((r) => canGrant(user.role, r));
  const team = [...data.team].sort((a, b) => STAFF_ROLES.indexOf(a.role as never) - STAFF_ROLES.indexOf(b.role as never));

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await run((r, a) => r.addMember(email, role, a), t(`مُنح دور «${pick(ROLE_LABELS[role])}»`, `Granted “${pick(ROLE_LABELS[role])}”`))) setEmail("");
  };

  return (
    <>
      <PageTitle title={t("الفريق والصلاحيات", "Team & roles")} sub={t(`${num(team.filter((m) => m.active).length)} عضو نشط`, `${team.filter((m) => m.active).length} active members`)} />

      {manage && (
        <Card className="p-5 mb-4">
          <form onSubmit={add} className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] gap-2 items-end">
            <label className="block">
              <span className="block text-xs text-paper-500 mb-1.5">{t("بريد العضو", "Member email")}</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="name@company.sa" className={fieldCls} />
            </label>
            <label className="block">
              <span className="block text-xs text-paper-500 mb-1.5">{t("الدور", "Role")}</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={fieldCls}>
                {grantable.map((r) => <option key={r} value={r}>{pick(ROLE_LABELS[r])}</option>)}
              </select>
            </label>
            <Btn type="submit">{t("منح الدور", "Grant role")}</Btn>
          </form>
          <p className="mt-3 text-xs text-paper-500">
            {mode === "supabase" || !isDemoMode
              ? t("يجب أن يكون العضو قد أنشأ حساباً في الموقع أولاً؛ كل حساب جديد يبدأ عميلاً حتى تمنحه دوراً هنا.", "The member must sign up on the website first; every new account starts as a client until you grant a role here.")
              : t("في الوضع التجريبي يُضاف العضو مباشرة.", "In demo mode the member is added directly.")}
          </p>
        </Card>
      )}

      <Card>
        <ul className="divide-y divide-paper-100">
          {team.map((m) => {
            const self = m.id === user.id;
            const editable = manage && !self && (m.role !== "owner" || user.role === "owner");
            return (
              <li key={m.id} className={`flex flex-wrap items-center gap-3 px-5 py-4 ${m.active ? "" : "opacity-60"}`}>
                <Avatar m={m} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-900">
                    {m.firstName} {m.lastName}
                    {self && <span className="ms-2 text-xs text-paper-500">{t("(أنت)", "(you)")}</span>}
                    {!m.active && <span className="ms-2 text-xs text-red-700">{t("معطّل", "Disabled")}</span>}
                  </p>
                  <p className="text-xs text-paper-500 truncate" dir="ltr" style={{ textAlign: "start" }}>{m.email}</p>
                </div>
                {editable ? (
                  <>
                    <label className="sr-only" htmlFor={`role-${m.id}`}>{t(`دور ${m.firstName}`, `${m.firstName}'s role`)}</label>
                    <select
                      id={`role-${m.id}`}
                      value={m.role}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        if (role === "client" && !window.confirm(t(`سحب صلاحيات ${m.firstName} من لوحة الإدارة؟`, `Revoke ${m.firstName}'s admin access?`))) return;
                        void run((r, a) => r.setRole(m.id, role, a), t("حُدّث الدور", "Role updated"));
                      }}
                      className={inlineFieldCls}
                    >
                      {[...new Set([m.role, ...grantable, "client" as Role])].map((r) => (
                        <option key={r} value={r}>{r === "client" ? t("سحب الصلاحيات (عميل)", "Revoke access (client)") : pick(ROLE_LABELS[r])}</option>
                      ))}
                    </select>
                    <Btn variant={m.active ? "danger" : "secondary"} onClick={() => (!m.active || window.confirm(t(`تعطيل حساب ${m.firstName}؟ لن يستطيع الدخول للوحة.`, `Disable ${m.firstName}'s account? They won't be able to sign in to the console.`))) && run((r, a) => r.setActive(m.id, !m.active, a), m.active ? t("عُطّل الحساب", "Account disabled") : t("فُعّل الحساب", "Account enabled"))}>
                      {m.active ? t("تعطيل", "Disable") : t("تفعيل", "Enable")}
                    </Btn>
                  </>
                ) : (
                  <span className="rounded-full bg-sand-soft px-3 py-1 text-xs text-ink-900">{pick(ROLE_LABELS[m.role])}</span>
                )}
                <span className="hidden lg:block w-28 text-end text-xs text-paper-500">{f.date(m.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title={t("مصفوفة الصلاحيات", "Permission matrix")} className="mt-4">
        <p className="px-5 mt-1 text-xs text-paper-500">{t("تُطبَّق هذه المصفوفة في قاعدة البيانات نفسها، لا في الواجهة فقط.", "This matrix is enforced in the database itself, not just the interface.")}</p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-paper-100 text-xs text-paper-500">
                <th scope="col" className="text-start font-normal px-5 py-3 min-w-[12rem]">{t("الصلاحية", "Permission")}</th>
                {STAFF_ROLES.map((r) => (
                  <th key={r} scope="col" className="font-normal px-2 py-3 text-center whitespace-nowrap" title={pick(ROLE_HINTS[r])}>{pick(ROLE_LABELS[r])}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-100">
              {PERMISSIONS.map((p) => (
                <tr key={p}>
                  <th scope="row" className="text-start font-normal px-5 py-2.5 text-paper-700">{pick(PERMISSION_LABELS[p])}</th>
                  {STAFF_ROLES.map((r) => {
                    const yes = ROLE_PERMISSIONS[r].includes(p);
                    return (
                      <td key={r} className="text-center px-2 py-2.5">
                        {yes ? <span className="text-[#1F6B4F] font-medium" aria-label={t("نعم", "Yes")}>✓</span> : <span className="text-paper-300" aria-label={t("لا", "No")}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
