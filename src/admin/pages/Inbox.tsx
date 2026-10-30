import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, type Bi } from "@/i18n/context";
import { googleCalendarUrl } from "@/lib/calendar";
import { trackInfo } from "@/data/tracks";
import { answerText, briefLines } from "@/start/briefs";
import { BUDGETS, SPECIALTY_LABELS, type Specialty } from "@/creatives/types";
import { useCrm } from "../data/CrmProvider";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, SOURCE_ICONS, SOURCE_LABELS, type Lead, type LeadStatus, type Payment } from "../data/types";
import { Avatar, Btn, Card, Drawer, Empty, PageTitle, fieldCls, inlineFieldCls, useFormat, waLink } from "../components/ui";

type Tab = "all" | "brief" | "booking" | "kit" | "design" | "contact";

const FIELD_LABELS: Record<string, Bi> = {
  firstName: { ar: "الاسم الأول", en: "First name" },
  lastName: { ar: "اسم العائلة", en: "Last name" },
  email: { ar: "البريد", en: "Email" },
  phone: { ar: "الجوال", en: "Mobile" },
  city: { ar: "المدينة", en: "City" },
  address: { ar: "العنوان", en: "Address" },
  subject: { ar: "الموضوع / المسار", en: "Subject / track" },
  message: { ar: "الرسالة", en: "Message" },
  slot_riyadh: { ar: "الموعد (الرياض)", en: "Slot (Riyadh)" },
  channel: { ar: "قناة المكالمة", en: "Call channel" },
  order_ref: { ar: "رقم الطلب", en: "Order ref" },
  directions: { ar: "الاتجاهات المختارة", en: "Chosen directions" },
  quiz: { ar: "إجابات الاختبار", en: "Quiz answers" },
  payment: { ar: "طريقة الدفع", en: "Payment mode" },
  language: { ar: "لغة العميل", en: "Client language" },
  creative_name: { ar: "المصمم المطلوب", en: "Requested creative" },
  service: { ar: "الخدمة", en: "Service" },
  budget: { ar: "الميزانية", en: "Budget" },
  deadline: { ar: "موعد التسليم المرغوب", en: "Wanted by" },
  studio_design: { ar: "تصميمه في استوديو 3D", en: "Their 3D studio design" },
  studio_link: { ar: "رابط التصميم", en: "Design link" },
};
const HIDDEN = new Set(["slot_utc", "request_type", "firstName", "lastName", "creative"]);
// طلب «ابدأ مسارك»: الإجابات تُعرض بنصوصها من briefLines
// رموز الإجابات (a_) وتركيبة «عطرك الخاص» (p_) تظهر بنصوصها في الملخص
const BRIEF_SHOWN = (k: string) => !k.startsWith("a_") && !k.startsWith("p_") && !["slot_riyadh", "slot_utc", "track", "track_title", "brand", "message", "ref_link", "subject"].includes(k);

const CHANNEL: Record<string, Bi> = {
  video: { ar: "فيديو", en: "Video" },
  phone: { ar: "هاتف", en: "Phone" },
  whatsapp: { ar: "واتساب", en: "WhatsApp" },
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-[#EAF0FA] text-[#2B4C7E]",
  in_progress: "bg-sand-soft text-ink-900",
  done: "bg-[#E3F2EC] text-[#1F6B4F]",
  archived: "bg-paper-100 text-paper-500",
};
const STATUS_ICON: Record<LeadStatus, string> = {
  new: "ri-sparkling-line",
  in_progress: "ri-loader-2-line",
  done: "ri-check-line",
  archived: "ri-archive-line",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { pick } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs whitespace-nowrap ${STATUS_STYLE[status]}`}>
      <i className={STATUS_ICON[status]} aria-hidden="true"></i>
      {pick(LEAD_STATUS_LABELS[status])}
    </span>
  );
}

function PaymentPill({ p }: { p?: Payment }) {
  const { t } = useI18n();
  if (!p) return <span className="text-xs text-paper-500">{t("لم يُدفع بعد", "Not paid yet")}</span>;
  const ok = p.status === "paid";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-[#1F6B4F]" : "text-red-700"}`}>
      <i className={ok ? "ri-checkbox-circle-line" : "ri-close-circle-line"} aria-hidden="true"></i>
      {ok ? t("مدفوع", "Paid") : t("دفع مرفوض", "Payment failed")}
    </span>
  );
}

function useSummary() {
  const { pick, t } = useI18n();
  const f = useFormat();
  return (l: Lead) => {
    const p = l.payload;
    if (l.kind === "booking" && p.slot_utc) return `${f.riyadh(p.slot_utc)} · ${pick(CHANNEL[p.channel] ?? { ar: p.channel, en: p.channel })}`;
    if (l.kind === "kit") return [p.order_ref, p.directions].filter(Boolean).join(" · ");
    if (l.kind === "brief") return [p.brand, p.track_title, p.a_package && answerText(p.track, "package", p.a_package, pick)?.a].filter(Boolean).join(" · ");
    if (l.kind === "design") return [p.creative_name || t("أي مصمم مناسب", "Any suitable creative"), p.service && SPECIALTY_LABELS[p.service as Specialty] ? pick(SPECIALTY_LABELS[p.service as Specialty]) : ""].filter(Boolean).join(" · ");
    return p.subject || p.message || t("بلا موضوع", "No subject");
  };
}

/** قيمة الحقل كما تُعرض: رموز الخدمة والميزانية تُترجم، والروابط قابلة للنقر */
function useFieldValue() {
  const { pick } = useI18n();
  return (k: string, v: string, p: Record<string, string>): ReactNode => {
    if (k === "channel") return pick(CHANNEL[v] ?? { ar: v, en: v });
    if (k === "service" && SPECIALTY_LABELS[v as Specialty]) return pick(SPECIALTY_LABELS[v as Specialty]);
    if (k === "budget") {
      const b = BUDGETS.find((x) => x.id === v);
      return b ? pick(b.label) : v;
    }
    if (k === "creative_name" && p.creative) return <a href={`/creatives/${encodeURIComponent(p.creative)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{v}</a>;
    // روابط الموقع نفسه فقط (يمنع javascript: وروابط خارجية مضللة)
    if (k === "studio_link" && v.startsWith(window.location.origin + "/")) return <a href={v} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 break-all">{v.replace(window.location.origin, "")}</a>;
    return v;
  };
}

function LeadDetail({ lead, payment, onClose }: { lead: Lead; payment?: Payment; onClose: () => void }) {
  const { t, pick } = useI18n();
  const { can, user } = useAuth();
  const { data, contact, member, run } = useCrm();
  const f = useFormat();
  const c = contact(lead.contactId);
  const [note, setNote] = useState("");
  const fieldValue = useFieldValue();
  const p = lead.payload;
  const name = c?.name ?? [p.firstName, p.lastName].filter(Boolean).join(" ");
  const track = trackInfo(p.subject);
  const wa = waLink(c?.phone ?? p.phone, t(`مرحباً ${p.firstName ?? ""}، معك فريق منصة العطور بخصوص طلبك.`, `Hi ${p.firstName ?? ""}, this is the Perfume Platform team about your request.`));

  const addNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!c || !note.trim()) return;
    if (await run((r, a) => r.addActivity({ contactId: c.id, type: "note", body: note }, a), t("أُضيفت الملاحظة", "Note added"))) setNote("");
  };

  return (
    <div>
      <header className="sticky top-0 z-10 bg-paper-50/95 backdrop-blur border-b border-paper-200 px-6 py-4 flex items-start gap-4">
        <span className="w-11 h-11 rounded-full bg-[#EAF0FA] text-[#2B4C7E] flex items-center justify-center shrink-0">
          <i className={`${SOURCE_ICONS[lead.kind]} text-lg`} aria-hidden="true"></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-paper-500">{pick(SOURCE_LABELS[lead.kind])} · {f.ago(lead.createdAt)}</p>
          <h2 className="font-display text-xl text-ink-900 truncate">{name || "—"}</h2>
        </div>
        <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-paper-100 flex items-center justify-center" aria-label={t("إغلاق", "Close")}>
          <i className="ri-close-line text-lg" aria-hidden="true"></i>
        </button>
      </header>

      <div className="p-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#1F6B4F] text-white px-4 py-2 text-sm">
              <i className="ri-whatsapp-line" aria-hidden="true"></i>
              {t("واتساب", "WhatsApp")}
            </a>
          )}
          {(c?.phone ?? p.phone) && (
            <a href={`tel:${(c?.phone ?? p.phone).replace(/\s/g, "")}`} className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm text-ink-900">
              <i className="ri-phone-line" aria-hidden="true"></i>
              {t("اتصال", "Call")}
            </a>
          )}
          {(c?.email ?? p.email) && (
            <a href={`mailto:${c?.email ?? p.email}`} className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm text-ink-900">
              <i className="ri-mail-line" aria-hidden="true"></i>
              {t("بريد", "Email")}
            </a>
          )}
          {lead.kind === "booking" && p.slot_utc && (
            <a
              href={googleCalendarUrl(t(`مكالمة اكتشاف — ${name}`, `Discovery call — ${name}`), new Date(p.slot_utc), 20, [p.phone, p.email, p.message].filter(Boolean).join("\n"))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm text-ink-900"
            >
              <i className="ri-calendar-event-line" aria-hidden="true"></i>
              {t("إلى التقويم", "Add to calendar")}
            </a>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("حالة الطلب", "Request status")}</span>
            <select
              value={lead.status}
              disabled={!can("crm.edit")}
              onChange={(e) => run((r, a) => r.updateLead(lead.id, { status: e.target.value as LeadStatus }, a), t("حُدّثت الحالة", "Status updated"))}
              className={fieldCls}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{pick(LEAD_STATUS_LABELS[s])}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("المسؤول", "Owner")}</span>
            {can("crm.assign") && c ? (
              <select
                value={c.ownerId ?? ""}
                onChange={(e) => run((r, a) => r.updateContact(c.id, { ownerId: e.target.value || null }, a), t("أُسند العميل", "Client assigned"))}
                className={fieldCls}
              >
                <option value="">{t("بلا مسؤول", "Unassigned")}</option>
                {data?.team
                  .filter((m) => m.active && (m.role === "sales" || m.role === "admin" || m.role === "owner"))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                      {m.id === user?.id ? t(" (أنا)", " (me)") : ""}
                    </option>
                  ))}
              </select>
            ) : (
              <p className={`${fieldCls} flex items-center gap-2`}>
                {member(lead.assigneeId) ? `${member(lead.assigneeId)?.firstName} ${member(lead.assigneeId)?.lastName}` : t("بلا مسؤول", "Unassigned")}
              </p>
            )}
          </label>
        </div>

        {lead.kind === "brief" && (
          <Card className="p-4 flex items-center justify-between gap-3">
            {lead.projectId ? (
              <>
                <p className="text-sm text-ink-900">{t("أصبح الطلب مشروعاً في حساب العميل.", "This request is now a project in the client's account.")}</p>
                <Link to={`/admin/projects/${lead.projectId}`} className="shrink-0 text-sm text-ink-900 underline underline-offset-4">{t("فتح المشروع", "Open project")}</Link>
              </>
            ) : (
              <p className="text-sm text-paper-600">{t("يتحول إلى مشروع تلقائياً حين يدخل العميل بحسابه بهذا البريد.", "It becomes a project automatically when the client signs in with this email.")}</p>
            )}
          </Card>
        )}

        {lead.kind === "kit" && (
          <Card className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-paper-500">{t("الدفع", "Payment")}</p>
              <PaymentPill p={payment} />
            </div>
            {payment && <p className="font-display text-xl text-ink-900">{f.money(payment.amount / 100)}</p>}
          </Card>
        )}

        <Card>
          <dl className="divide-y divide-paper-100">
            {track && (
              <div className="px-4 py-3 grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                <dt className="text-xs text-paper-500 pt-0.5">{t("المسار المهتم به", "Track of interest")}</dt>
                <dd className="text-sm text-ink-900">{pick(track.title)}</dd>
              </div>
            )}
            {lead.kind === "brief" &&
              briefLines(p, pick, t).map((x) => (
                <div key={x.q} className="px-4 py-3 grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                  <dt className="text-xs text-paper-500 pt-0.5">{x.q}</dt>
                  <dd className="text-sm text-ink-900 break-words whitespace-pre-line">{x.a}</dd>
                </div>
              ))}
            {Object.entries(p)
              .filter(([k, v]) => v && !HIDDEN.has(k) && (lead.kind !== "brief" || BRIEF_SHOWN(k)) && !(k === "subject" && track))
              .map(([k, v]) => (
                <div key={k} className="px-4 py-3 grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                  <dt className="text-xs text-paper-500 pt-0.5">{FIELD_LABELS[k] ? pick(FIELD_LABELS[k]) : k}</dt>
                  <dd className="text-sm text-ink-900 break-words" dir={k === "email" || k === "phone" || k === "order_ref" ? "ltr" : "auto"} style={{ textAlign: "start" }}>
                    {fieldValue(k, v, p)}
                  </dd>
                </div>
              ))}
          </dl>
        </Card>

        {c && can("crm.edit") && (
          <form onSubmit={addNote} className="space-y-2">
            <label htmlFor="lead-note" className="block text-xs text-paper-500">{t("ملاحظة سريعة على العميل", "Quick note on the client")}</label>
            <textarea id="lead-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} className={`${fieldCls} resize-none`} placeholder={t("ماذا حدث؟ ما الخطوة التالية؟", "What happened? What's next?")} />
            <div className="flex justify-between items-center gap-3">
              {c && (
                <Link to={`/admin/contacts/${c.id}`} className="text-sm text-paper-600 hover:text-ink-900 underline underline-offset-4">
                  {t("ملف العميل الكامل", "Full client profile")}
                </Link>
              )}
              <Btn type="submit" disabled={!note.trim()}>{t("حفظ الملاحظة", "Save note")}</Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Inbox() {
  const { t, pick, num } = useI18n();
  const { user } = useAuth();
  const { data, contact, member } = useCrm();
  const f = useFormat();
  const summary = useSummary();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "all";
  const status = params.get("status") || "open";
  const mine = params.get("mine") === "1";
  const [q, setQ] = useState("");

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v === null) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  // لكل طلب: الدفعة الناجحة إن وُجدت، وإلا أحدث محاولة (المحاولة الفاشلة لا تغطي دفعاً تالياً ناجحاً)
  const payments = useMemo(() => {
    const m = new Map<string | null | undefined, NonNullable<typeof data>["payments"][number]>();
    for (const p of [...(data?.payments ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const cur = m.get(p.orderRef);
      if (!cur || cur.status !== "paid" || p.status === "paid") m.set(p.orderRef, p);
    }
    return m;
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.leads.filter((l) => {
      if (l.kind === "newsletter") return false;
      if (tab === "contact" ? l.kind !== "contact" && l.kind !== "consultation" : tab !== "all" && l.kind !== tab) return false;
      if (status === "open" ? l.status === "done" || l.status === "archived" : status !== "all" && l.status !== status) return false;
      if (mine && l.assigneeId !== user?.id) return false;
      if (!needle) return true;
      const c = contact(l.contactId);
      return [c?.name, c?.email, c?.phone, l.payload.order_ref, l.payload.email, l.payload.phone].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [data, tab, status, mine, q, user, contact]);

  if (!data) return null;
  const openId = params.get("open");
  const opened = openId ? data.leads.find((l) => l.id === openId) : undefined;
  const count = (k: Tab) => data.leads.filter((l) => l.status === "new" && (k === "all" ? l.kind !== "newsletter" : k === "contact" ? l.kind === "contact" || l.kind === "consultation" : l.kind === k)).length;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "all", label: t("الكل", "All"), icon: "ri-inbox-2-line" },
    { id: "brief", label: t("بدء مسار", "Track starts"), icon: SOURCE_ICONS.brief },
    { id: "booking", label: t("مكالمات", "Calls"), icon: SOURCE_ICONS.booking },
    { id: "kit", label: t("عينات", "Kits"), icon: SOURCE_ICONS.kit },
    { id: "design", label: t("تصميم", "Design"), icon: SOURCE_ICONS.design },
    { id: "contact", label: t("رسائل", "Messages"), icon: SOURCE_ICONS.contact },
  ];

  return (
    <>
      <PageTitle title={t("صندوق الوارد", "Inbox")} sub={t("كل ما يصل من نماذج الموقع: الحجوزات، طلبات العينة، والرسائل.", "Everything from the website forms: bookings, kit orders and messages.")} />

      <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label={t("نوع الطلب", "Request type")}>
        {tabs.map((x) => {
          const n = count(x.id);
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => set("tab", x.id === "all" ? null : x.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border transition-colors ${tab === x.id ? "bg-ink-900 text-white border-ink-900" : "bg-white border-paper-200 text-paper-700 hover:border-ink-900"}`}
            >
              <i className={x.icon} aria-hidden="true"></i>
              {x.label}
              {n > 0 && <span className={`text-[11px] font-mono ${tab === x.id ? "text-white/70" : "text-accent2-ink"}`}>{num(n)}</span>}
            </button>
          );
        })}
      </div>

      <Card>
        <div className="p-4 flex flex-wrap gap-3 border-b border-paper-100">
          <label className="relative flex-1 min-w-[12rem]">
            <span className="sr-only">{t("بحث", "Search")}</span>
            <i className="ri-search-line absolute top-1/2 -translate-y-1/2 start-3 text-paper-400" aria-hidden="true"></i>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("اسم، جوال، بريد، رقم طلب…", "Name, phone, email, order ref…")} className={`${fieldCls} ps-9`} />
          </label>
          <select value={status} onChange={(e) => set("status", e.target.value === "open" ? null : e.target.value)} className={inlineFieldCls} aria-label={t("الحالة", "Status")}>
            <option value="open">{t("المفتوحة", "Open")}</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{pick(LEAD_STATUS_LABELS[s])}</option>
            ))}
            <option value="all">{t("الكل", "All")}</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-paper-700 px-2">
            <input type="checkbox" checked={mine} onChange={(e) => set("mine", e.target.checked ? "1" : null)} className="w-4 h-4 accent-ink-900" />
            {t("المسندة لي", "Assigned to me")}
          </label>
        </div>

        {rows.length === 0 ? (
          <Empty icon="ri-inbox-line" title={t("لا طلبات تطابق التصفية", "No requests match these filters")} hint={t("جرّب «الكل» في الحالة.", "Try “All” in status.")} />
        ) : (
          <ul className="divide-y divide-paper-100">
            {rows.map((l) => {
              const c = contact(l.contactId);
              const who = member(l.assigneeId);
              return (
                <li key={l.id}>
                  <button type="button" onClick={() => set("open", l.id)} className={`w-full text-start flex items-center gap-3 px-4 md:px-5 py-3.5 hover:bg-paper-50 ${l.status === "new" ? "bg-[#FAFBFE]" : ""}`}>
                    <span className="w-9 h-9 rounded-full bg-sand-soft text-ink-900 flex items-center justify-center shrink-0" title={pick(SOURCE_LABELS[l.kind])}>
                      <i className={SOURCE_ICONS[l.kind]} aria-hidden="true"></i>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {l.status === "new" && <span className="w-1.5 h-1.5 rounded-full bg-[#3B6FB6] shrink-0" aria-hidden="true" />}
                        <span className={`text-sm truncate ${l.status === "new" ? "text-ink-900 font-medium" : "text-ink-900"}`}>{c?.name ?? l.payload.email ?? "—"}</span>
                        {l.kind === "kit" && <span className="hidden sm:inline"><PaymentPill p={payments.get(l.payload.order_ref)} /></span>}
                      </span>
                      <span className="block text-xs text-paper-500 truncate mt-0.5">{summary(l)}</span>
                    </span>
                    <span className="hidden md:block"><LeadStatusBadge status={l.status} /></span>
                    <span className="hidden sm:flex w-8 justify-center" title={who ? `${who.firstName} ${who.lastName}` : t("بلا مسؤول", "Unassigned")}>
                      {who ? <Avatar m={who} /> : <i className="ri-user-unfollow-line text-paper-400" aria-label={t("بلا مسؤول", "Unassigned")}></i>}
                    </span>
                    <span className="text-xs text-paper-500 w-20 text-end shrink-0">{f.ago(l.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Drawer open={!!opened} onClose={() => set("open", null)} title={t("تفاصيل الطلب", "Request details")}>
        {opened && <LeadDetail lead={opened} payment={payments.get(opened.payload.order_ref)} onClose={() => set("open", null)} />}
      </Drawer>
    </>
  );
}
