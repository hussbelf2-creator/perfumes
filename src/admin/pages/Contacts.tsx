import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { SAUDI_CITIES } from "@/config/offers";
import { useCrm } from "../data/CrmProvider";
import { SOURCES, SOURCE_LABELS, STAGES, STAGE_LABELS, type Contact } from "../data/types";
import { Avatar, Btn, Card, Drawer, Empty, PageTitle, StageBadge, download, fieldCls, toCsv, useFormat } from "../components/ui";
import PhoneField from "@/components/feature/PhoneField";

type SortKey = "lastActivityAt" | "value" | "name" | "createdAt";

function NewContactForm({ onDone }: { onDone: () => void }) {
  const { t, pick } = useI18n();
  const { can, user } = useAuth();
  const { run, data } = useCrm();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) || "").trim();
    setBusy(true);
    let id = "";
    const ok = await run(async (r, a) => {
      const c = await r.createContact(
        { name: get("name"), email: get("email"), phone: get("phone"), city: get("city"), country: get("phone") ? get("country") : null, company: get("company"), value: Number(get("value") || 0), ownerId: get("owner") || null },
        a,
      );
      id = c.id;
    }, t("أُضيف العميل", "Client added"));
    setBusy(false);
    if (ok) {
      onDone();
      if (id) navigate(`/admin/contacts/${id}`);
    }
  };

  return (
    <form onSubmit={submit} className="p-6 space-y-4">
      <h2 className="font-display text-xl text-ink-900">{t("عميل جديد", "New client")}</h2>
      <label className="block">
        <span className="block text-xs text-paper-500 mb-1.5">{t("الاسم", "Name")} *</span>
        <input name="name" required maxLength={120} className={fieldCls} />
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("الجوال", "Mobile")}</span>
          <PhoneField id="nc-phone" name="phone" className={fieldCls} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("البريد", "Email")}</span>
          <input name="email" type="email" dir="ltr" className={fieldCls} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("الشركة / البراند", "Company / brand")}</span>
          <input name="company" className={fieldCls} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("المدينة", "City")}</span>
          <input name="city" list="nc-cities" maxLength={60} className={fieldCls} />
          <datalist id="nc-cities">
            {SAUDI_CITIES.map((c) => (
              <option key={c.en} value={c.en}>{pick(c)}</option>
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("القيمة المتوقعة (ر.س)", "Expected value (SAR)")}</span>
          <input name="value" type="number" min={0} step={500} defaultValue={0} className={fieldCls} />
        </label>
        {can("crm.assign") && (
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("المسؤول", "Owner")}</span>
            <select name="owner" defaultValue={user?.id} className={fieldCls}>
              <option value="">{t("بلا مسؤول", "Unassigned")}</option>
              {data?.team.filter((m) => m.active && ["sales", "admin", "owner"].includes(m.role)).map((m) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Btn variant="ghost" onClick={onDone}>{t("إلغاء", "Cancel")}</Btn>
        <Btn type="submit" disabled={busy}>{t("إضافة", "Add")}</Btn>
      </div>
    </form>
  );
}

export default function Contacts() {
  const { t, pick, num } = useI18n();
  const { can } = useAuth();
  const { data, member } = useCrm();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [stage, setStage] = useState("all");
  const [source, setSource] = useState("all");
  const [owner, setOwner] = useState("all");
  const [sort, setSort] = useState<SortKey>("lastActivityAt");
  const [adding, setAdding] = useState(false);
  // البحث من الشريط العلوي أثناء الوجود في هذه الصفحة
  const urlQ = params.get("q");
  useEffect(() => {
    if (urlQ !== null) setQ(urlQ);
  }, [urlQ]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const list = data.contacts.filter(
      (c) =>
        (stage === "all" || c.stage === stage) &&
        (source === "all" || c.source === source) &&
        (owner === "all" || (owner === "none" ? !c.ownerId : c.ownerId === owner)) &&
        (!needle || [c.name, c.email, c.phone, c.company, c.city].some((v) => v?.toLowerCase().includes(needle))),
    );
    const cmp: Record<SortKey, (a: Contact, b: Contact) => number> = {
      lastActivityAt: (a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt),
      createdAt: (a, b) => b.createdAt.localeCompare(a.createdAt),
      value: (a, b) => b.value - a.value,
      name: (a, b) => a.name.localeCompare(b.name, "ar"),
    };
    return list.sort(cmp[sort]);
  }, [data, q, stage, source, owner, sort]);

  if (!data) return null;

  const exportCsv = () => {
    download(
      `clients-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([
        ["name", "company", "email", "phone", "city", "source", "stage", "value_sar", "owner", "created_at", "last_activity_at"],
        ...rows.map((c) => {
          const m = member(c.ownerId);
          return [c.name, c.company, c.email, c.phone, c.city, c.source, c.stage, c.value, m ? `${m.firstName} ${m.lastName}` : "", c.createdAt, c.lastActivityAt];
        }),
      ]),
    );
  };

  return (
    <>
      <PageTitle
        title={t("العملاء", "Clients")}
        sub={t(`${num(rows.length)} من ${num(data.contacts.length)}`, `${rows.length} of ${data.contacts.length}`)}
        actions={
          <>
            <Btn variant="secondary" onClick={exportCsv}>
              <i className="ri-download-2-line" aria-hidden="true"></i>
              {t("تصدير CSV", "Export CSV")}
            </Btn>
            {can("crm.edit") && (
              <Btn onClick={() => setAdding(true)}>
                <i className="ri-user-add-line" aria-hidden="true"></i>
                {t("عميل جديد", "New client")}
              </Btn>
            )}
          </>
        }
      />

      <Card>
        <div className="p-4 grid sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-3 border-b border-paper-100">
          <label className="relative">
            <span className="sr-only">{t("بحث", "Search")}</span>
            <i className="ri-search-line absolute top-1/2 -translate-y-1/2 start-3 text-paper-400" aria-hidden="true"></i>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (params.get("q")) setParams({}, { replace: true });
              }}
              placeholder={t("اسم، جوال، بريد، شركة، مدينة…", "Name, phone, email, company, city…")}
              className={`${fieldCls} ps-9`}
            />
          </label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={fieldCls} aria-label={t("المرحلة", "Stage")}>
            <option value="all">{t("كل المراحل", "All stages")}</option>
            {STAGES.map((s) => <option key={s} value={s}>{pick(STAGE_LABELS[s])}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={fieldCls} aria-label={t("المصدر", "Source")}>
            <option value="all">{t("كل المصادر", "All sources")}</option>
            {SOURCES.map((s) => <option key={s} value={s}>{pick(SOURCE_LABELS[s])}</option>)}
          </select>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={fieldCls} aria-label={t("المسؤول", "Owner")}>
            <option value="all">{t("كل المسؤولين", "All owners")}</option>
            <option value="none">{t("بلا مسؤول", "Unassigned")}</option>
            {data.team.filter((m) => ["sales", "admin", "owner"].includes(m.role)).map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={fieldCls} aria-label={t("الترتيب", "Sort")}>
            <option value="lastActivityAt">{t("آخر نشاط", "Last activity")}</option>
            <option value="createdAt">{t("الأحدث", "Newest")}</option>
            <option value="value">{t("الأعلى قيمة", "Highest value")}</option>
            <option value="name">{t("الاسم", "Name")}</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <Empty icon="ri-user-search-line" title={t("لا عملاء يطابقون البحث", "No clients match")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-paper-500 border-b border-paper-100">
                  <th scope="col" className="text-start font-normal px-5 py-3">{t("العميل", "Client")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3 hidden md:table-cell">{t("المصدر", "Source")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3">{t("المرحلة", "Stage")}</th>
                  <th scope="col" className="text-end font-normal px-3 py-3 hidden sm:table-cell">{t("القيمة", "Value")}</th>
                  <th scope="col" className="text-start font-normal px-3 py-3 hidden lg:table-cell">{t("المسؤول", "Owner")}</th>
                  <th scope="col" className="text-end font-normal px-5 py-3 hidden sm:table-cell">{t("آخر نشاط", "Last activity")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-100">
                {rows.map((c) => {
                  const m = member(c.ownerId);
                  return (
                    <tr key={c.id} className="hover:bg-paper-50">
                      <td className="px-5 py-3">
                        <Link to={`/admin/contacts/${c.id}`} className="flex items-center gap-3 group">
                          <Avatar m={{ name: c.name }} />
                          <span className="min-w-0">
                            <span className="block text-ink-900 truncate group-hover:underline underline-offset-4">{c.name}</span>
                            <span className="block text-xs text-paper-500 truncate">{[c.company, c.city].filter(Boolean).join(" · ") || c.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-paper-600">{pick(SOURCE_LABELS[c.source])}</td>
                      <td className="px-3 py-3"><StageBadge stage={c.stage} /></td>
                      <td className="px-3 py-3 text-end font-mono hidden sm:table-cell">{c.value ? f.money(c.value) : "—"}</td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        {m ? (
                          <span className="flex items-center gap-2"><Avatar m={m} />{m.firstName}</span>
                        ) : (
                          <span className="text-paper-400">{t("بلا مسؤول", "Unassigned")}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-end text-xs text-paper-500 hidden sm:table-cell whitespace-nowrap">{f.ago(c.lastActivityAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={adding} onClose={() => setAdding(false)} title={t("عميل جديد", "New client")}>
        <NewContactForm onDone={() => setAdding(false)} />
      </Drawer>
    </>
  );
}
