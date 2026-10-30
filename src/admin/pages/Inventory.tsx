import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { inventoryRepo, type InventoryData } from "@/inventory/repo";
import { INV_CATEGORIES, INV_CATEGORY_LABELS, INV_UNITS, INV_UNIT_LABELS, MOVE_KINDS, MOVE_LABELS, SKU_RE, available, needsReorder, type InventoryItem, type ItemInput, type MoveKind } from "@/inventory/types";
import { projectsRepo } from "@/projects/repo";
import { usePActor } from "@/projects/useProjects";
import { useMoney } from "@/projects/quotes";
import type { Project } from "@/projects/types";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, Drawer, Empty, PageTitle, Stat, download, fieldCls, inlineFieldCls, toCsv, useFormat } from "../components/ui";

// المخزون: ما لدينا، وما هو محجوز للمشاريع، وما يحتاج إعادة طلب — والحركات سجل لا يُعدَّل

const blank: ItemInput = { sku: "", name: "", category: "bottle", unit: "pcs", reorderLevel: 0, supplier: "", notes: "", active: true };

function ItemForm({ initial, onSubmit }: { initial: ItemInput; onSubmit: (v: ItemInput) => Promise<boolean> }) {
  const { t, pick } = useI18n();
  const [v, setV] = useState(initial);
  const skuBad = !!v.sku && !SKU_RE.test(v.sku.toUpperCase());
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await onSubmit(v); }}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("رمز المادة (SKU)", "SKU")}</span>
          <input value={v.sku} dir="ltr" maxLength={40} required onChange={(e) => setV({ ...v, sku: e.target.value.toUpperCase().replace(/\s/g, "") })} aria-invalid={skuBad} className={`${fieldCls} ${skuBad ? "!border-red-400" : ""}`} placeholder="BTL-50-CLR" />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("الاسم", "Name")}</span>
          <input value={v.name} maxLength={120} required onChange={(e) => setV({ ...v, name: e.target.value })} className={fieldCls} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("الفئة", "Category")}</span>
          <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as ItemInput["category"] })} className={fieldCls}>
            {INV_CATEGORIES.map((c) => <option key={c} value={c}>{pick(INV_CATEGORY_LABELS[c])}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("الوحدة", "Unit")}</span>
          <select value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value as ItemInput["unit"] })} className={fieldCls}>
            {INV_UNITS.map((u) => <option key={u} value={u}>{pick(INV_UNIT_LABELS[u])}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("حد إعادة الطلب", "Reorder level")}</span>
          <input type="number" min={0} step="any" value={v.reorderLevel} onChange={(e) => setV({ ...v, reorderLevel: Number(e.target.value) })} className={fieldCls} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("المورّد", "Supplier")}</span>
          <input value={v.supplier} maxLength={120} onChange={(e) => setV({ ...v, supplier: e.target.value })} className={fieldCls} />
        </label>
      </div>
      <label className="block">
        <span className="block text-xs text-paper-500 mb-1.5">{t("ملاحظات", "Notes")}</span>
        <textarea value={v.notes} rows={2} maxLength={1000} onChange={(e) => setV({ ...v, notes: e.target.value })} className={`${fieldCls} resize-none`} />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-900">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="w-4 h-4 accent-ink-900" />
        {t("نشطة (تظهر في عروض الأسعار)", "Active (available in quotes)")}
      </label>
      <Btn type="submit">{t("حفظ المادة", "Save item")}</Btn>
    </form>
  );
}

function MoveForm({ item, projects, onSubmit }: { item: InventoryItem; projects: Project[]; onSubmit: (kind: MoveKind, qty: number, unitCost: number | null, projectId: string | null, note: string) => Promise<boolean> }) {
  const { t, pick } = useI18n();
  const [kind, setKind] = useState<MoveKind>("receive");
  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState(0);
  const [project, setProject] = useState("");
  const [note, setNote] = useState("");
  const needsProject = kind === "reserve" || kind === "release";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await onSubmit(kind, qty, kind === "receive" ? cost : null, project || null, note)) {
      setQty(0);
      setNote("");
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("الحركة", "Movement")}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as MoveKind)} className={fieldCls}>
            {MOVE_KINDS.map((k) => <option key={k} value={k}>{pick(MOVE_LABELS[k])}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t(`الكمية (${pick(INV_UNIT_LABELS[item.unit])})`, `Quantity (${pick(INV_UNIT_LABELS[item.unit])})`)}</span>
          <input type="number" step="any" value={qty || ""} onChange={(e) => setQty(Number(e.target.value))} required className={fieldCls} />
        </label>
        {kind === "receive" && (
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t("تكلفة الوحدة (ر.س)", "Unit cost (SAR)")}</span>
            <input type="number" min={0} step="0.0001" value={cost} onChange={(e) => setCost(Number(e.target.value))} required className={fieldCls} />
          </label>
        )}
        {kind !== "receive" && kind !== "adjust" && (
          <label className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{needsProject ? t("المشروع", "Project") : t("المشروع (يُحمَّل بالتكلفة)", "Project (gets the cost)")}</span>
            <select value={project} onChange={(e) => setProject(e.target.value)} required={needsProject} className={fieldCls}>
              <option value="">{needsProject ? t("اختر", "Choose") : t("بلا مشروع", "No project")}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="block">
        <span className="block text-xs text-paper-500 mb-1.5">{kind === "adjust" ? t("سبب التسوية (إلزامي) — الكمية بالسالب للنقص", "Reason (required) — negative quantity for a shortfall") : t("ملاحظة", "Note")}</span>
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} required={kind === "adjust"} className={fieldCls} />
      </label>
      <Btn type="submit" disabled={!qty}>{t("سجّل الحركة", "Record movement")}</Btn>
    </form>
  );
}

export default function Inventory() {
  const { t, pick, num } = useI18n();
  const { can } = useAuth();
  const { run } = useCrm();
  const actor = usePActor();
  const f = useFormat();
  const money = useMoney();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<InventoryData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [onlyLow, setOnlyLow] = useState(params.get("low") === "1");
  const [adding, setAdding] = useState(false);
  const manage = can("inventory.manage");

  const reload = useCallback(async () => {
    if (!actor) return;
    setData(await inventoryRepo.load(actor));
  }, [actor]);
  useEffect(() => {
    void reload();
    if (actor) void projectsRepo.load(actor).then((d) => setProjects(d.projects.filter((p) => p.status !== "done"))).catch(() => undefined);
  }, [actor, reload]);

  const openId = params.get("item");
  const open = data?.items.find((i) => i.id === openId) ?? null;
  const setOpen = (id: string | null) => {
    const n = new URLSearchParams(params);
    if (id) n.set("item", id);
    else n.delete("item");
    setParams(n, { replace: true });
  };
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.items ?? [])
      .filter((i) => cat === "all" || i.category === cat)
      .filter((i) => !onlyLow || needsReorder(i))
      .filter((i) => !needle || i.sku.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle) || i.supplier.toLowerCase().includes(needle))
      .sort((a, b) => Number(needsReorder(b)) - Number(needsReorder(a)) || a.name.localeCompare(b.name));
  }, [data, q, cat, onlyLow]);
  if (!data) return <div className="h-48 rounded-2xl shimmer bg-paper-100" />;

  const value = data.items.reduce((s, i) => s + i.onHand * i.avgCost, 0);
  const low = data.items.filter(needsReorder);
  const short = data.items.filter((i) => available(i) < 0);
  const projectTitle = (id?: string | null) => projects.find((p) => p.id === id)?.title;
  const save = (v: ItemInput, id: string | null) => (actor ? run(() => inventoryRepo.saveItem(v, id, actor), t("حُفظت المادة", "Item saved")).then(async (ok) => (ok && (await reload()), ok)) : Promise.resolve(false));

  return (
    <>
      <PageTitle
        title={t("المخزون", "Stock")}
        sub={t("المواد والرصيد والمحجوز للمشاريع. الرصيد ومتوسط التكلفة تحسبهما الحركات، ولا تُعدَّل الحركات بعد تسجيلها.", "Materials, balances and project reservations. Balances and average cost come from movements, which can't be edited once recorded.")}
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => download(`stock-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([["sku", "name", "category", "unit", "on_hand", "reserved", "available", "avg_cost_sar", "value_sar", "reorder_level", "supplier"], ...data.items.map((i) => [i.sku, i.name, i.category, i.unit, i.onHand, i.reserved, available(i), i.avgCost, Math.round(i.onHand * i.avgCost * 100) / 100, i.reorderLevel, i.supplier])]))}>
              <i className="ri-download-2-line" aria-hidden="true"></i>
              {t("تصدير CSV", "Export CSV")}
            </Btn>
            {manage && <Btn onClick={() => setAdding(true)}>{t("مادة جديدة", "New item")}</Btn>}
          </div>
        }
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4">
        <Stat icon="ri-stack-line" label={t("قيمة المخزون", "Stock value")} value={<span data-testid="stock-value" data-value={Math.round(value * 100) / 100}>{f.statMoney(value)}</span>} hint={t("الرصيد × متوسط التكلفة", "On hand × average cost")} />
        <Stat icon="ri-archive-line" label={t("المواد", "Items")} value={num(data.items.filter((i) => i.active).length)} />
        <Stat icon="ri-alarm-warning-line" label={t("تحتاج إعادة طلب", "Need reordering")} value={<span data-testid="low-count">{num(low.length)}</span>} tone={low.length ? "warn" : "plain"} hint={t("المتاح عند حد الطلب أو دونه", "Available at or below the reorder level")} />
        <Stat icon="ri-error-warning-line" label={t("عجز محجوز", "Reserved shortfall")} value={num(short.length)} tone={short.length ? "warn" : "plain"} hint={t("محجوز للمشاريع أكثر من الرصيد", "More reserved than on hand")} />
      </div>
      <Card>
        <div className="p-4 border-b border-paper-100 flex flex-wrap gap-2 items-center">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث بالرمز أو الاسم أو المورّد", "Search SKU, name or supplier")} aria-label={t("بحث في المخزون", "Search stock")} className={`${inlineFieldCls} flex-1 min-w-[12rem]`} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={inlineFieldCls} aria-label={t("الفئة", "Category")}>
            <option value="all">{t("كل الفئات", "All categories")}</option>
            {INV_CATEGORIES.map((c) => <option key={c} value={c}>{pick(INV_CATEGORY_LABELS[c])}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-ink-900">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="w-4 h-4 accent-ink-900" />
            {t("يحتاج إعادة طلب فقط", "Reorder only")}
          </label>
        </div>
        {rows.length === 0 ? (
          <Empty icon="ri-archive-line" title={data.items.length ? t("لا مواد بهذا البحث", "No items match") : t("لا مواد بعد", "No items yet")} hint={t("أضف المواد (زجاجات، أغطية، علب، زيوت…) ثم سجّل استلامها بتكلفتها.", "Add materials (bottles, caps, boxes, oils…) then record their receipt with cost.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-paper-500 border-b border-paper-100">
                  <th scope="col" className="text-start font-normal px-5 py-3">{t("المادة", "Item")}</th>
                  <th scope="col" className="text-end font-normal px-3 py-3">{t("الرصيد", "On hand")}</th>
                  <th scope="col" className="text-end font-normal px-3 py-3 hidden sm:table-cell">{t("محجوز", "Reserved")}</th>
                  <th scope="col" className="text-end font-normal px-3 py-3">{t("المتاح", "Available")}</th>
                  <th scope="col" className="text-end font-normal px-3 py-3 hidden md:table-cell">{t("متوسط التكلفة", "Avg cost")}</th>
                  <th scope="col" className="text-end font-normal px-5 py-3 hidden md:table-cell">{t("القيمة", "Value")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-100">
                {rows.map((i) => {
                  const av = available(i);
                  return (
                    <tr key={i.id} data-sku={i.sku} className={i.active ? "" : "opacity-50"}>
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => setOpen(i.id)} className="text-start">
                          <span className="block text-ink-900 hover:underline underline-offset-4">{i.name}</span>
                          <span className="block text-xs text-paper-500"><bdi dir="ltr">{i.sku}</bdi> · {pick(INV_CATEGORY_LABELS[i.category])}</span>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-end font-mono">{num(i.onHand)}</td>
                      <td className="px-3 py-3 text-end font-mono hidden sm:table-cell text-paper-600">{num(i.reserved)}</td>
                      <td className={`px-3 py-3 text-end font-mono ${av < 0 ? "text-red-700" : needsReorder(i) ? "text-accent2-ink" : "text-ink-900"}`} data-available={av}>
                        {num(av)} <span className="text-xs text-paper-500">{pick(INV_UNIT_LABELS[i.unit])}</span>
                        {needsReorder(i) && <span className="sr-only">{t(" — يحتاج إعادة طلب", " — needs reordering")}</span>}
                      </td>
                      <td className="px-3 py-3 text-end whitespace-nowrap hidden md:table-cell text-paper-600">{money(i.avgCost)}</td>
                      <td className="px-5 py-3 text-end whitespace-nowrap hidden md:table-cell">{money(Math.round(i.onHand * i.avgCost * 100) / 100)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={adding} onClose={() => setAdding(false)} title={t("مادة جديدة", "New item")}>
        <div className="p-6">
          <h2 className="font-display text-xl text-ink-900 mb-4">{t("مادة جديدة", "New item")}</h2>
          {adding && <ItemForm initial={blank} onSubmit={async (v) => { const ok = await save(v, null); if (ok) setAdding(false); return ok; }} />}
        </div>
      </Drawer>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        {open && (
          <div className="p-6 space-y-6">
            <header>
              <p className="text-xs text-paper-500"><bdi dir="ltr">{open.sku}</bdi> · {pick(INV_CATEGORY_LABELS[open.category])}{open.supplier ? ` · ${open.supplier}` : ""}</p>
              <h2 className="font-display text-2xl text-ink-900">{open.name}</h2>
              <p className="mt-2 text-sm text-paper-600">
                {t("الرصيد", "On hand")} {num(open.onHand)} · {t("محجوز", "reserved")} {num(open.reserved)} · {t("متاح", "available")} <span data-testid="drawer-available">{num(available(open))}</span> {pick(INV_UNIT_LABELS[open.unit])} · {t("متوسط التكلفة", "avg cost")} <span data-testid="drawer-avg">{money(open.avgCost)}</span>
              </p>
            </header>
            {manage && (
              <section aria-label={t("حركة جديدة", "New movement")}>
                <h3 className="text-sm font-medium text-ink-900 mb-3">{t("حركة جديدة", "New movement")}</h3>
                <MoveForm item={open} projects={projects} onSubmit={(kind, qty, unitCost, projectId, note) => (actor ? run(() => inventoryRepo.addMove({ itemId: open.id, kind, qty, unitCost, projectId, note }, actor), t("سُجّلت الحركة", "Movement recorded")).then(async (ok) => (ok && (await reload()), ok)) : Promise.resolve(false))} />
              </section>
            )}
            <section aria-label={t("سجل الحركات", "Movement history")}>
              <h3 className="text-sm font-medium text-ink-900 mb-2">{t("سجل الحركات", "Movement history")}</h3>
              <ul className="divide-y divide-paper-100 text-sm">
                {data.moves.filter((m) => m.itemId === open.id).slice(0, 50).map((m) => (
                  <li key={m.id} className="py-2 flex items-center gap-3">
                    <span className="text-xs rounded-full bg-paper-100 px-2 py-0.5 text-paper-600 shrink-0">{pick(MOVE_LABELS[m.kind])}</span>
                    <span className="flex-1 min-w-0 truncate text-paper-700">
                      {m.projectId ? <Link to={`/admin/projects/${m.projectId}`} className="underline underline-offset-4">{projectTitle(m.projectId) ?? t("مشروع", "Project")}</Link> : null}
                      {m.note ? ` ${m.note}` : ""}
                    </span>
                    <span className="font-mono whitespace-nowrap">{m.kind === "issue" || m.kind === "reserve" ? "−" : m.kind === "adjust" && m.qty < 0 ? "" : "+"}{num(m.qty)}</span>
                    <span className="text-xs text-paper-400 whitespace-nowrap">{f.ago(m.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
            {manage && (
              <details>
                <summary className="cursor-pointer text-sm text-paper-600">{t("تعديل بيانات المادة", "Edit item details")}</summary>
                <div className="mt-3">
                  <ItemForm key={open.id} initial={{ sku: open.sku, name: open.name, category: open.category, unit: open.unit, reorderLevel: open.reorderLevel, supplier: open.supplier, notes: open.notes, active: open.active }} onSubmit={(v) => save(v, open.id)} />
                </div>
              </details>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
