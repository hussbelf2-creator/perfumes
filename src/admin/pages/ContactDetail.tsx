import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { SAUDI_CITIES } from "@/config/offers";
import { useCrm } from "../data/CrmProvider";
import { ACTIVITY_ICONS, ACTIVITY_LABELS, SOURCE_ICONS, SOURCE_LABELS, STAGES, STAGE_LABELS, type ActivityType, type Contact, type Stage } from "../data/types";
import { Avatar, Btn, Card, Empty, StageBadge, fieldCls, useFormat, waLink } from "../components/ui";
import TaskList from "../components/TaskList";
import { LeadStatusBadge } from "./Inbox";
import PhoneField from "@/components/feature/PhoneField";
import { countryByIso, flag } from "@/lib/phone";

const MANUAL: ActivityType[] = ["note", "call", "whatsapp", "email", "meeting"];

function EditInfo({ c, onDone }: { c: Contact; onDone: () => void }) {
  const { t, pick } = useI18n();
  const { run } = useCrm();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) || "").trim() || null;
    if (await run((r, a) => r.updateContact(c.id, { name: get("name") ?? c.name, phone: get("phone"), email: get("email")?.toLowerCase() ?? null, company: get("company"), city: get("city"), country: get("phone") ? get("country") : c.country ?? null }, a), t("حُفظت البيانات", "Details saved"))) onDone();
  };
  return (
    <form onSubmit={submit} className="p-5 grid gap-3">
      <input name="name" defaultValue={c.name} required aria-label={t("الاسم", "Name")} className={fieldCls} />
      <PhoneField id="cd-phone" name="phone" defaultValue={c.phone ?? ""} defaultCountry={c.country ?? undefined} className={fieldCls} />
      <input name="email" type="email" defaultValue={c.email ?? ""} dir="ltr" aria-label={t("البريد", "Email")} placeholder="name@…" className={fieldCls} />
      <input name="company" defaultValue={c.company ?? ""} aria-label={t("الشركة", "Company")} placeholder={t("الشركة / البراند", "Company / brand")} className={fieldCls} />
      <input name="city" list="cd-cities" defaultValue={c.city ?? ""} maxLength={60} aria-label={t("المدينة", "City")} placeholder={t("المدينة", "City")} className={fieldCls} />
      <datalist id="cd-cities">
        {SAUDI_CITIES.map((x) => <option key={x.en} value={x.en}>{pick(x)}</option>)}
      </datalist>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onDone}>{t("إلغاء", "Cancel")}</Btn>
        <Btn type="submit">{t("حفظ", "Save")}</Btn>
      </div>
    </form>
  );
}

export default function ContactDetail() {
  const { id } = useParams();
  const { t, pick } = useI18n();
  const { can, user } = useAuth();
  const { data, contact, member, run } = useCrm();
  const f = useFormat();
  // تغييرات المرحلة والقيمة تُسجَّل برموز («new → proposal»، «0 → 5000») وتُعرض هنا بلغة الواجهة
  const activityText = (type: ActivityType, body: string) => {
    const m = body.match(/^(\S+) → (\S+)$/);
    if (!m) return body;
    if (type === "stage" && m[1] in STAGE_LABELS && m[2] in STAGE_LABELS) return `${pick(STAGE_LABELS[m[1] as Stage])} → ${pick(STAGE_LABELS[m[2] as Stage])}`;
    if (type === "value" && !Number.isNaN(Number(m[1])) && !Number.isNaN(Number(m[2]))) return `${f.money(Number(m[1]))} → ${f.money(Number(m[2]))}`;
    return body;
  };
  const [type, setType] = useState<ActivityType>("note");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(() => {
    const d = new Date(Date.now() + 864e5);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [taskWho, setTaskWho] = useState(user?.id ?? "");

  const c = contact(id);
  if (!data) return null;
  if (!c) {
    return (
      <Card>
        <Empty icon="ri-user-unfollow-line" title={t("العميل غير موجود أو خارج صلاحياتك", "Client not found or outside your permissions")} />
      </Card>
    );
  }

  const edit = can("crm.edit");
  const owner = member(c.ownerId);
  const timeline = data.activities.filter((a) => a.contactId === c.id);
  const leads = data.leads.filter((l) => l.contactId === c.id);
  const payments = data.payments.filter((p) => c.email && p.email?.toLowerCase() === c.email.toLowerCase());
  const tasks = data.tasks.filter((x) => x.contactId === c.id).sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt.localeCompare(b.dueAt));
  const wa = waLink(c.phone);

  const log = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (await run((r, a) => r.addActivity({ contactId: c.id, type, body }, a), t("سُجّل النشاط", "Activity logged"))) setBody("");
  };

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    const ok = await run((r, a) => r.addTask({ title: taskTitle, dueAt: new Date(taskDue).toISOString(), contactId: c.id, assigneeId: taskWho || a.id }, a), t("أُضيفت المهمة", "Task added"));
    if (ok) setTaskTitle("");
  };

  return (
    <>
      <nav className="text-sm text-paper-500 mb-4" aria-label={t("مسار التنقل", "Breadcrumb")}>
        <Link to="/admin/contacts" className="hover:text-ink-900">{t("العملاء", "Clients")}</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="text-ink-900">{c.name}</span>
      </nav>

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar m={{ name: c.name }} size="md" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl md:text-3xl text-ink-900">{c.name}</h1>
            <p className="mt-1 text-sm text-paper-500 flex flex-wrap gap-x-3">
              {c.company && <span>{c.company}</span>}
              {c.city && <span>{pick(SAUDI_CITIES.find((x) => x.en === c.city) ?? { ar: c.city, en: c.city })}</span>}
              {countryByIso(c.country) && <span>{flag(c.country!)} {pick(countryByIso(c.country)!.name)}</span>}
              <span className="inline-flex items-center gap-1"><i className={SOURCE_ICONS[c.source]} aria-hidden="true"></i>{pick(SOURCE_LABELS[c.source])}</span>
              <span>{t("منذ", "Since")} {f.date(c.createdAt)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#1F6B4F] text-white px-4 py-2 text-sm">
                <i className="ri-whatsapp-line" aria-hidden="true"></i>{t("واتساب", "WhatsApp")}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm">
                <i className="ri-phone-line" aria-hidden="true"></i>{t("اتصال", "Call")}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm">
                <i className="ri-mail-line" aria-hidden="true"></i>{t("بريد", "Email")}
              </a>
            )}
            {can("projects.manage") && (
              <Link to={`/admin/projects?new=1&contact=${encodeURIComponent(c.id)}`} className="inline-flex items-center gap-2 rounded-full bg-ink-900 text-white px-4 py-2 text-sm">
                <i className="ri-folder-add-line" aria-hidden="true"></i>{t("مشروع جديد", "New project")}
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("المرحلة", "Stage")}</span>
            {edit ? (
              <select value={c.stage} onChange={(e) => run((r, a) => r.updateContact(c.id, { stage: e.target.value as Stage }, a), t("حُدّثت المرحلة", "Stage updated"))} className={fieldCls}>
                {STAGES.map((s) => <option key={s} value={s}>{pick(STAGE_LABELS[s])}</option>)}
              </select>
            ) : (
              <StageBadge stage={c.stage} />
            )}
          </label>
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("القيمة المتوقعة (ر.س)", "Expected value (SAR)")}</span>
            {edit ? (
              <input
                key={c.value}
                type="number"
                min={0}
                step={500}
                defaultValue={c.value}
                onBlur={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  if (v !== c.value) void run((r, a) => r.updateContact(c.id, { value: v }, a), t("حُدّثت القيمة", "Value updated"));
                }}
                className={`${fieldCls} font-mono`}
              />
            ) : (
              <p className="font-display text-xl">{f.money(c.value)}</p>
            )}
          </label>
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("المسؤول", "Owner")}</span>
            {can("crm.assign") ? (
              <select value={c.ownerId ?? ""} onChange={(e) => run((r, a) => r.updateContact(c.id, { ownerId: e.target.value || null }, a), t("أُسند العميل", "Client assigned"))} className={fieldCls}>
                <option value="">{t("بلا مسؤول", "Unassigned")}</option>
                {data.team.filter((m) => m.active && ["sales", "admin", "owner"].includes(m.role)).map((m) => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            ) : (
              <p className="flex items-center gap-2 py-2 text-sm">{owner ? <><Avatar m={owner} />{owner.firstName} {owner.lastName}</> : t("بلا مسؤول", "Unassigned")}</p>
            )}
          </label>
        </div>
      </Card>

      <div className="mt-4 grid xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 space-y-4 min-w-0">
          {edit && (
            <Card className="p-5">
              <form onSubmit={log}>
                <div className="flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label={t("نوع النشاط", "Activity type")}>
                  {MANUAL.map((x) => (
                    <button key={x} type="button" role="radio" aria-checked={type === x} onClick={() => setType(x)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border ${type === x ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 text-paper-700 hover:border-ink-900"}`}>
                      <i className={ACTIVITY_ICONS[x]} aria-hidden="true"></i>
                      {pick(ACTIVITY_LABELS[x])}
                    </button>
                  ))}
                </div>
                <label htmlFor="act-body" className="sr-only">{t("التفاصيل", "Details")}</label>
                <textarea id="act-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} className={`${fieldCls} resize-none`} placeholder={t("ماذا دار؟ ما الاتفاق؟ ما الخطوة التالية؟", "What was discussed? What was agreed? What's next?")} />
                <div className="mt-2 flex justify-end">
                  <Btn type="submit" disabled={!body.trim()}>{t("تسجيل", "Log")}</Btn>
                </div>
              </form>
            </Card>
          )}

          <Card title={t("السجل الزمني", "Timeline")}>
            {timeline.length === 0 ? (
              <Empty icon="ri-time-line" title={t("لا نشاطات بعد", "No activity yet")} />
            ) : (
              <ol className="p-5 space-y-5">
                {timeline.map((a) => {
                  const who = member(a.actorId);
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className="w-8 h-8 rounded-full bg-sand-soft text-ink-900 flex items-center justify-center shrink-0">
                        <i className={ACTIVITY_ICONS[a.type]} aria-hidden="true"></i>
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-xs text-paper-500">
                          <span className="text-ink-900">{pick(ACTIVITY_LABELS[a.type])}</span>
                          {" · "}
                          {who ? `${who.firstName} ${who.lastName}` : t("النظام", "System")}
                          {" · "}
                          <time dateTime={a.createdAt} title={new Date(a.createdAt).toLocaleString()}>{f.ago(a.createdAt)}</time>
                        </p>
                        <p className="mt-1 text-sm text-paper-700 whitespace-pre-line break-words">{activityText(a.type, a.body)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          <Card title={t("بيانات التواصل", "Contact details")} action={edit && !editing ? <button type="button" onClick={() => setEditing(true)} className="text-sm text-paper-500 hover:text-ink-900">{t("تعديل", "Edit")}</button> : undefined}>
            {editing ? (
              <EditInfo c={c} onDone={() => setEditing(false)} />
            ) : (
              <dl className="p-5 space-y-3 text-sm">
                {[
                  { k: t("الجوال", "Mobile"), v: c.phone, ltr: true },
                  { k: t("البريد", "Email"), v: c.email, ltr: true },
                  { k: t("الشركة", "Company"), v: c.company },
                ].map((x) => (
                  <div key={x.k} className="flex justify-between gap-3">
                    <dt className="text-paper-500">{x.k}</dt>
                    <dd className="text-ink-900 truncate" dir={x.ltr ? "ltr" : undefined}>{x.v || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          <Card title={t("المهام", "Tasks")}>
            <TaskList tasks={tasks} compact />
            <form onSubmit={addTask} className="p-5 pt-3 border-t border-paper-100 space-y-2">
              <label htmlFor="task-title" className="sr-only">{t("مهمة جديدة", "New task")}</label>
              <input id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} maxLength={300} placeholder={t("مهمة متابعة جديدة…", "New follow-up task…")} className={fieldCls} />
              <div className="grid grid-cols-2 gap-2">
                <input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} aria-label={t("الموعد", "Due")} className={fieldCls} />
                <select value={taskWho} onChange={(e) => setTaskWho(e.target.value)} aria-label={t("المكلّف", "Assignee")} className={fieldCls} disabled={!edit}>
                  {data.team.filter((m) => m.active).map((m) => (
                    <option key={m.id} value={m.id}>{m.firstName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <Btn type="submit" variant="secondary" disabled={!taskTitle.trim()}>{t("إضافة مهمة", "Add task")}</Btn>
              </div>
            </form>
          </Card>

          <Card title={t("الطلبات", "Requests")}>
            {leads.length === 0 ? (
              <Empty icon="ri-inbox-line" title={t("لا طلبات من الموقع", "No website requests")} />
            ) : (
              <ul className="divide-y divide-paper-100 mt-2">
                {leads.map((l) => (
                  <li key={l.id}>
                    <Link to={`/admin/inbox?status=all&open=${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper-50">
                      <i className={`${SOURCE_ICONS[l.kind]} text-paper-500`} aria-hidden="true"></i>
                      <span className="flex-1 text-sm text-ink-900">{pick(SOURCE_LABELS[l.kind])}<span className="block text-xs text-paper-500">{f.date(l.createdAt)}</span></span>
                      <LeadStatusBadge status={l.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {can("payments.view") && (
            <Card title={t("المدفوعات", "Payments")}>
              {payments.length === 0 ? (
                <Empty icon="ri-bank-card-line" title={t("لا مدفوعات", "No payments")} />
              ) : (
                <ul className="divide-y divide-paper-100 mt-2">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span>
                        <span className="font-mono text-ink-900" dir="ltr">{p.orderRef ?? p.id}</span>
                        <span className="block text-xs text-paper-500">{f.date(p.createdAt)} · {p.method}</span>
                      </span>
                      <span className={p.status === "paid" ? "text-[#1F6B4F]" : "text-red-700"}>
                        <i className={p.status === "paid" ? "ri-checkbox-circle-line me-1" : "ri-close-circle-line me-1"} aria-hidden="true"></i>
                        {f.money(p.amount / 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
