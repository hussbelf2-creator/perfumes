import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { useCrm } from "../data/CrmProvider";
import { SOURCE_ICONS, SOURCE_LABELS, STAGES, STAGE_LABELS, type Contact, type Stage } from "../data/types";
import { Avatar, PageTitle, STAGE_DOT, fieldCls, inlineFieldCls, useFormat } from "../components/ui";

export default function Pipeline() {
  const { t, pick, num } = useI18n();
  const { can, user } = useAuth();
  const { data, member, run } = useCrm();
  const f = useFormat();
  const [owner, setOwner] = useState<string>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const editable = can("crm.edit");

  if (!data) return null;

  const contacts = data.contacts.filter((c) => owner === "all" || (owner === "none" ? !c.ownerId : c.ownerId === owner));
  const move = (c: Contact, stage: Stage) => {
    if (c.stage === stage) return;
    void run((r, a) => r.updateContact(c.id, { stage }, a), t(`نُقل ${c.name} إلى «${pick(STAGE_LABELS[stage])}»`, `${c.name} moved to “${pick(STAGE_LABELS[stage])}”`));
  };

  const openValue = contacts.filter((c) => c.stage !== "won" && c.stage !== "lost").reduce((s, c) => s + c.value, 0);

  return (
    <>
      <PageTitle
        title={t("مراحل البيع", "Pipeline")}
        sub={t(`${num(contacts.length)} عميل · قيمة مفتوحة ${f.money(openValue)}`, `${contacts.length} clients · ${f.money(openValue)} open`)}
        actions={
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inlineFieldCls} aria-label={t("المسؤول", "Owner")}>
            <option value="all">{t("كل الفريق", "Whole team")}</option>
            {user && <option value={user.id}>{t("عملائي", "My clients")}</option>}
            <option value="none">{t("بلا مسؤول", "Unassigned")}</option>
            {data.team
              .filter((m) => m.id !== user?.id && (m.role === "sales" || m.role === "admin" || m.role === "owner"))
              .map((m) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
              ))}
          </select>
        }
      />
      {editable && <p className="-mt-4 mb-5 text-xs text-paper-500">{t("اسحب البطاقة إلى مرحلة أخرى، أو استخدم قائمة «نقل إلى» في البطاقة.", "Drag a card to another stage, or use the “Move to” menu on the card.")}</p>}

      <div className="relative overflow-x-auto -mx-4 md:-mx-8 px-4 md:px-8 pb-4">
        <div className="grid grid-flow-col auto-cols-[17rem] gap-3 min-w-max">
          {STAGES.map((stage) => {
            const items = contacts.filter((c) => c.stage === stage).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
            const total = items.reduce((s, c) => s + c.value, 0);
            return (
              <section
                key={stage}
                aria-label={pick(STAGE_LABELS[stage])}
                onDragOver={(e) => {
                  if (!editable || !dragId) return;
                  e.preventDefault();
                  setOver(stage);
                }}
                onDragLeave={() => setOver((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  const c = data.contacts.find((x) => x.id === dragId);
                  setOver(null);
                  setDragId(null);
                  if (c) move(c, stage);
                }}
                className={`rounded-2xl border p-2 min-h-[24rem] transition-colors ${over === stage ? "border-ink-900 bg-sand-soft" : "border-paper-200 bg-paper-100/60"}`}
              >
                <header className="px-2 pt-1 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: STAGE_DOT[stage] }} aria-hidden="true" />
                    <h2 className="text-sm text-ink-900 font-medium">{pick(STAGE_LABELS[stage])}</h2>
                    <span className="ms-auto text-xs font-mono text-paper-500">{num(items.length)}</span>
                  </div>
                  <p className="mt-1 text-xs text-paper-500">{f.money(total)}</p>
                </header>
                <ul className="space-y-2">
                  {items.map((c) => {
                    const who = member(c.ownerId);
                    return (
                      <li
                        key={c.id}
                        draggable={editable}
                        onDragStart={(e) => {
                          setDragId(c.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOver(null);
                        }}
                        className={`rounded-xl bg-white border border-paper-200 p-3 ${editable ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === c.id ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <Link to={`/admin/contacts/${c.id}`} className="min-w-0 flex-1 group">
                            <p className="text-sm text-ink-900 truncate group-hover:underline underline-offset-4">{c.name}</p>
                            {c.company && <p className="text-xs text-paper-500 truncate">{c.company}</p>}
                          </Link>
                          <i className={`${SOURCE_ICONS[c.source]} text-paper-400`} title={pick(SOURCE_LABELS[c.source])} aria-label={pick(SOURCE_LABELS[c.source])}></i>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="font-display text-ink-900">{c.value ? f.compactMoney(c.value) : "—"}</span>
                          <span className="flex items-center gap-1.5 text-[11px] text-paper-500">
                            {f.ago(c.lastActivityAt)}
                            {who ? <Avatar m={who} /> : <i className="ri-user-unfollow-line" aria-label={t("بلا مسؤول", "Unassigned")}></i>}
                          </span>
                        </div>
                        {editable && (
                          <label className="mt-2 block">
                            <span className="sr-only">{t(`نقل ${c.name} إلى`, `Move ${c.name} to`)}</span>
                            <select value={c.stage} onChange={(e) => move(c, e.target.value as Stage)} className="w-full bg-paper-50 border border-paper-200 rounded-lg px-2 py-1.5 text-xs text-paper-700 outline-none focus:border-ink-900">
                              {STAGES.map((s) => (
                                <option key={s} value={s}>{s === c.stage ? pick(STAGE_LABELS[s]) : `${t("نقل إلى", "Move to")} ${pick(STAGE_LABELS[s])}`}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
