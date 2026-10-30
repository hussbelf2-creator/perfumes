import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, PageTitle, fieldCls } from "../components/ui";
import TaskList, { dueState } from "../components/TaskList";

export default function Tasks() {
  const { t, num } = useI18n();
  const { can, user } = useAuth();
  const { data, run } = useCrm();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [who, setWho] = useState(user?.id ?? "");
  const [due, setDue] = useState(() => {
    const d = new Date(Date.now() + 864e5);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  if (!data || !user) return null;
  const seeAll = can("crm.view");
  const list = data.tasks.filter((x) => scope === "all" || x.assigneeId === user.id).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const groups = [
    { key: "overdue", label: t("متأخرة", "Overdue"), items: list.filter((x) => dueState(x.dueAt, x.done) === "overdue") },
    { key: "today", label: t("اليوم", "Today"), items: list.filter((x) => dueState(x.dueAt, x.done) === "today") },
    { key: "later", label: t("القادمة", "Upcoming"), items: list.filter((x) => dueState(x.dueAt, x.done) === "later") },
  ];
  const done = list.filter((x) => x.done).reverse();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const ok = await run((r, a) => r.addTask({ title, dueAt: new Date(due).toISOString(), contactId: contactId || null, assigneeId: who || a.id }, a), t("أُضيفت المهمة", "Task added"));
    if (ok) setTitle("");
  };

  return (
    <>
      <PageTitle
        title={t("المهام", "Tasks")}
        sub={t(`${num(groups[0].items.length)} متأخرة · ${num(groups[1].items.length)} اليوم`, `${groups[0].items.length} overdue · ${groups[1].items.length} today`)}
        actions={
          seeAll && (
            <div className="inline-flex rounded-full bg-paper-100 p-1" role="tablist">
              {(["mine", "all"] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={scope === s} onClick={() => setScope(s)} className={`rounded-full px-4 py-1.5 text-sm ${scope === s ? "bg-white text-ink-900 shadow-sm" : "text-paper-600"}`}>
                  {s === "mine" ? t("مهامي", "Mine") : t("كل الفريق", "Whole team")}
                </button>
              ))}
            </div>
          )
        }
      />

      <Card className="p-4 mb-4">
        <form onSubmit={add} className="grid md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] gap-2">
          <label className="sr-only" htmlFor="new-task">{t("مهمة جديدة", "New task")}</label>
          <input id="new-task" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder={t("مهمة جديدة…", "New task…")} className={fieldCls} />
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t("الموعد", "Due")} className={fieldCls} />
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label={t("العميل", "Client")} className={fieldCls} disabled={!seeAll}>
            <option value="">{t("بلا عميل", "No client")}</option>
            {data.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label={t("المكلّف", "Assignee")} className={fieldCls} disabled={!can("crm.edit")}>
            {data.team.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
          </select>
          <Btn type="submit" disabled={!title.trim()}>{t("إضافة", "Add")}</Btn>
        </form>
      </Card>

      <div className="space-y-4">
        {groups.map((g) =>
          g.items.length ? (
            <Card key={g.key} title={`${g.label} · ${num(g.items.length)}`}>
              <TaskList tasks={g.items} compact showAssignee={scope === "all"} />
            </Card>
          ) : null,
        )}
        {groups.every((g) => !g.items.length) && (
          <Card>
            <TaskList tasks={[]} />
          </Card>
        )}
        {done.length > 0 && (
          <div>
            <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="text-sm text-paper-500 hover:text-ink-900 inline-flex items-center gap-1">
              <i className={`ri-arrow-down-s-line transition-transform ${showDone ? "rotate-180" : ""}`} aria-hidden="true"></i>
              {t(`المنجزة (${num(done.length)})`, `Completed (${done.length})`)}
            </button>
            {showDone && (
              <Card className="mt-2">
                <TaskList tasks={done} compact showAssignee={scope === "all"} />
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
