import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { useCrm } from "../data/CrmProvider";
import type { Task } from "../data/types";
import { Avatar, Empty, useFormat } from "./ui";

export function dueState(iso: string, done: boolean): "done" | "overdue" | "today" | "later" {
  if (done) return "done";
  const due = new Date(iso);
  const now = new Date();
  if (due.getTime() < now.getTime()) return "overdue";
  return due.toDateString() === now.toDateString() ? "today" : "later";
}

export default function TaskList({ tasks, compact = false, showAssignee = true }: { tasks: Task[]; compact?: boolean; showAssignee?: boolean }) {
  const { t } = useI18n();
  const { run, contact, member } = useCrm();
  const { can, user } = useAuth();
  const f = useFormat();

  if (!tasks.length) return <Empty icon="ri-task-line" title={t("لا مهام هنا", "No tasks here")} />;

  return (
    <ul className={`divide-y divide-paper-100 ${compact ? "mt-2" : ""}`}>
      {tasks.map((x) => {
        const st = dueState(x.dueAt, x.done);
        const c = contact(x.contactId);
        const who = member(x.assigneeId);
        return (
          <li key={x.id} className="flex items-start gap-3 px-5 py-3">
            <input
              type="checkbox"
              checked={x.done}
              // الخادم: من يملك crm.edit أو المسنَدة إليه فقط
              disabled={!can("crm.edit") && x.assigneeId !== user?.id}
              onChange={(e) => run((r, a) => r.setTaskDone(x.id, e.target.checked, a), e.target.checked ? t("أُنجزت المهمة", "Task completed") : undefined)}
              className="mt-1 w-4 h-4 accent-ink-900 shrink-0"
              aria-label={x.title}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${x.done ? "line-through text-paper-400" : "text-ink-900"}`}>{x.title}</p>
              <p className="mt-0.5 text-xs text-paper-500 flex flex-wrap gap-x-2">
                {c && (
                  <Link to={`/admin/contacts/${c.id}`} className="hover:text-ink-900 underline-offset-4 hover:underline">
                    {c.name}
                  </Link>
                )}
                <span className={st === "overdue" ? "text-accent2-ink" : st === "today" ? "text-ink-900" : ""}>
                  {st === "overdue" && <i className="ri-alarm-warning-line me-1" aria-hidden="true"></i>}
                  {st === "overdue" ? t("متأخرة · ", "Overdue · ") : st === "today" ? t("اليوم · ", "Today · ") : ""}
                  {f.date(x.dueAt, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </span>
              </p>
            </div>
            {showAssignee && who && (
              <span className="flex items-center gap-2 text-xs text-paper-500 shrink-0" title={`${who.firstName} ${who.lastName}`}>
                <Avatar m={who} />
                <span className="hidden sm:inline">{who.firstName}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
