import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import BarList from "@/components/charts/BarList";
import { ROLE_HINTS, ROLE_LABELS } from "@/lib/rbac";
import { useCrm } from "../data/CrmProvider";
import { SOURCE_ICONS, SOURCE_LABELS, STAGES, STAGE_LABELS, SOURCES } from "../data/types";
import { Avatar, Card, Empty, PageTitle, Stat, useFormat } from "../components/ui";
import TaskList from "../components/TaskList";

const DAY = 864e5;

export default function Overview() {
  const { t, pick, num } = useI18n();
  const { user, can } = useAuth();
  const { data, member, contact } = useCrm();
  const f = useFormat();
  if (!data || !user) return null;

  const now = Date.now();
  const crm = can("crm.view");
  const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Riyadh", hour: "numeric", hour12: false }));
  const greet = hour < 12 ? t("صباح الخير", "Good morning") : t("مساء الخير", "Good evening");

  const myTasks = data.tasks.filter((x) => !x.done && x.assigneeId === user.id).sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  if (!crm) {
    return (
      <>
        <PageTitle title={`${greet}${t("، ", ", ")}${user.firstName}`} sub={pick(ROLE_HINTS[user.role])} />
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title={t("مهامي", "My tasks")} className="lg:col-span-2">
            <TaskList tasks={myTasks} compact />
          </Card>
          <Card className="p-5">
            <p className="text-sm text-paper-500">{t("دورك", "Your role")}</p>
            <p className="mt-1 font-display text-2xl text-ink-900">{pick(ROLE_LABELS[user.role])}</p>
            {can("studio.manage") ? (
              <Link to="/admin/studio" className="mt-4 flex items-center gap-3 rounded-xl bg-sand-soft px-4 py-3 text-sm text-ink-900 hover:bg-sand">
                <i className="ri-box-3-line text-lg" aria-hidden="true"></i>
                <span className="flex-1">{t("استوديو العبوات: حوّل صورة عبوة إلى نموذج 3D", "Packaging studio: turn a bottle photo into a 3D model")}</span>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-paper-600 leading-[1.8]">
                {t("أدوات المحتوى تُضاف في المراحل القادمة وتظهر هنا حسب صلاحياتك.", "Content tools arrive in upcoming phases and will appear here according to your permissions.")}
              </p>
            )}
          </Card>
        </div>
      </>
    );
  }

  const week = data.leads.filter((l) => now - new Date(l.createdAt).getTime() < 7 * DAY);
  const prevWeek = data.leads.filter((l) => {
    const age = now - new Date(l.createdAt).getTime();
    return age >= 7 * DAY && age < 14 * DAY;
  });
  const open = data.contacts.filter((c) => c.stage !== "won" && c.stage !== "lost");
  const pipelineValue = open.reduce((s, c) => s + c.value, 0);
  const won = data.contacts.filter((c) => c.stage === "won");
  const lost = data.contacts.filter((c) => c.stage === "lost");
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;
  // مدفوعات العينات فقط (عربون العروض له تقاريره)
  const paid = data.payments.filter((p) => p.status === "paid" && p.kind !== "deposit");
  const paidTotal = paid.reduce((s, p) => s + p.amount / 100, 0);

  const calls = data.leads
    .filter((l) => l.kind === "booking" && l.payload.slot_utc && l.status !== "archived" && l.status !== "done")
    .map((l) => ({ l, at: new Date(l.payload.slot_utc).getTime() }))
    .filter((x) => x.at > now - 2 * 3_600_000 && x.at < now + 7 * DAY)
    .sort((a, b) => a.at - b.at);

  const unassigned = data.leads.filter((l) => l.status === "new" && !l.assigneeId && l.kind !== "newsletter");
  const overdue = data.tasks.filter((x) => !x.done && new Date(x.dueAt).getTime() < now);

  const byStage = STAGES.map((s) => ({ s, items: data.contacts.filter((c) => c.stage === s) }));
  const bySource = SOURCES.map((s) => ({ s, n: data.contacts.filter((c) => c.source === s).length })).filter((x) => x.n > 0);

  const delta = week.length - prevWeek.length;

  return (
    <>
      <PageTitle
        title={`${greet}${t("، ", ", ")}${user.firstName}`}
        sub={t(`${num(unassigned.length)} طلب بلا مسؤول · ${num(overdue.length)} مهمة متأخرة · ${num(calls.length)} مكالمة هذا الأسبوع`, `${unassigned.length} unassigned · ${overdue.length} overdue tasks · ${calls.length} calls this week`)}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <Stat
          icon="ri-inbox-archive-line"
          label={t("طلبات آخر 7 أيام", "Requests, last 7 days")}
          value={num(week.length)}
          hint={delta === 0 ? t("مثل الأسبوع السابق", "Same as last week") : t(`${delta > 0 ? "+" : "−"}${num(Math.abs(delta))} عن الأسبوع السابق`, `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs last week`)}
          tone={delta > 0 ? "good" : "plain"}
        />
        <Stat icon="ri-funds-line" label={t("قيمة الصفقات المفتوحة", "Open pipeline")} value={f.statMoney(pipelineValue)} hint={t(`${num(open.length)} عميل`, `${open.length} clients`)} />
        <Stat icon="ri-trophy-line" label={t("نسبة الإغلاق", "Win rate")} value={`${num(winRate)}%`} hint={t(`${num(won.length)} تعاقد · ${num(lost.length)} لم يتم`, `${won.length} won · ${lost.length} lost`)} />
        {can("payments.view") && <Stat icon="ri-bank-card-line" label={t("مدفوعات العينات", "Kit payments")} value={f.statMoney(paidTotal)} hint={t(`${num(paid.length)} دفعة ناجحة`, `${paid.length} successful`)} tone="good" />}
      </div>

      <div className="mt-4 grid xl:grid-cols-3 gap-4">
        <Card title={t("يحتاج انتباهك", "Needs attention")} className="xl:col-span-2" action={<Link to="/admin/inbox" className="text-sm text-paper-500 hover:text-ink-900">{t("صندوق الوارد", "Inbox")}</Link>}>
          {unassigned.length === 0 && overdue.length === 0 ? (
            <Empty icon="ri-check-double-line" title={t("لا شيء متأخر", "Nothing overdue")} hint={t("كل الطلبات مسندة والمهام في موعدها.", "Every request is assigned and tasks are on time.")} />
          ) : (
            <ul className="divide-y divide-paper-100 mt-2">
              {unassigned.slice(0, 5).map((l) => {
                const c = contact(l.contactId);
                return (
                  <li key={l.id}>
                    <Link to={`/admin/inbox?open=${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper-50">
                      <span className="w-9 h-9 rounded-full bg-[#EAF0FA] text-[#2B4C7E] flex items-center justify-center shrink-0"><i className={SOURCE_ICONS[l.kind]} aria-hidden="true"></i></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink-900 truncate">{c?.name ?? l.payload.email}</span>
                        <span className="block text-xs text-paper-500">{pick(SOURCE_LABELS[l.kind])} · {f.ago(l.createdAt)}</span>
                      </span>
                      <span className="text-xs text-accent2-ink whitespace-nowrap">{t("بلا مسؤول", "Unassigned")}</span>
                    </Link>
                  </li>
                );
              })}
              {overdue.slice(0, 5).map((x) => (
                <li key={x.id}>
                  <Link to={x.contactId ? `/admin/contacts/${x.contactId}` : "/admin/tasks"} className="flex items-center gap-3 px-5 py-3 hover:bg-paper-50">
                    <span className="w-9 h-9 rounded-full bg-accent2-soft text-accent2-ink flex items-center justify-center shrink-0"><i className="ri-alarm-warning-line" aria-hidden="true"></i></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink-900 truncate">{x.title}</span>
                      <span className="block text-xs text-paper-500">{contact(x.contactId)?.name ?? "—"} · {member(x.assigneeId)?.firstName ?? "—"}</span>
                    </span>
                    <span className="text-xs text-accent2-ink whitespace-nowrap">{t("متأخرة", "Overdue")} {f.ago(x.dueAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("مكالمات الاكتشاف القادمة", "Upcoming discovery calls")}>
          {calls.length === 0 ? (
            <Empty icon="ri-calendar-line" title={t("لا مكالمات هذا الأسبوع", "No calls this week")} />
          ) : (
            <ul className="mt-2 divide-y divide-paper-100">
              {calls.slice(0, 6).map(({ l }) => {
                const c = contact(l.contactId);
                return (
                  <li key={l.id}>
                    <Link to={`/admin/inbox?open=${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper-50">
                      <Avatar m={c ? { name: c.name } : null} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink-900 truncate">{c?.name}</span>
                        <span className="block text-xs text-paper-500">{f.riyadh(l.payload.slot_utc)}</span>
                      </span>
                      <span className="text-xs text-paper-500">{member(l.assigneeId)?.firstName ?? t("بلا مسؤول", "Unassigned")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid lg:grid-cols-3 gap-4">
        <Card title={t("العملاء حسب المرحلة", "Clients by stage")} className="lg:col-span-2" action={<Link to="/admin/pipeline" className="text-sm text-paper-500 hover:text-ink-900">{t("مراحل البيع", "Pipeline")}</Link>}>
          <div className="p-5">
            <BarList
              items={byStage.map(({ s, items }) => ({ label: `${pick(STAGE_LABELS[s])} · ${f.compactMoney(items.reduce((a, c) => a + c.value, 0))}`, value: items.length }))}
              format={(n) => num(n)}
              max={Math.max(1, ...byStage.map((x) => x.items.length))}
              ariaLabel={t("عدد العملاء في كل مرحلة", "Number of clients in each stage")}
            />
          </div>
        </Card>
        <Card title={t("من أين يأتي العملاء", "Where clients come from")}>
          <div className="p-5">
            <BarList
              items={bySource.map(({ s, n }) => ({ label: pick(SOURCE_LABELS[s]), value: n }))}
              format={(n) => num(n)}
              max={Math.max(1, ...bySource.map((x) => x.n))}
              color="#E4612E"
              ariaLabel={t("عدد العملاء حسب المصدر", "Clients by source")}
            />
          </div>
        </Card>
      </div>

      <Card title={t("مهامي", "My tasks")} className="mt-4" action={<Link to="/admin/tasks" className="text-sm text-paper-500 hover:text-ink-900">{t("كل المهام", "All tasks")}</Link>}>
        <TaskList tasks={myTasks.slice(0, 6)} compact />
      </Card>
    </>
  );
}
