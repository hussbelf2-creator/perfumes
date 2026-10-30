import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import { ROLE_LABELS, ROLE_PERMISSIONS, type Role } from "@/lib/rbac";
import { pricingRepo, DEFAULT_POLICY, COUPON_RE, type Coupon, type CouponInput, type PricingPolicy } from "@/pricing/repo";
import { usePActor } from "@/projects/useProjects";
import { useMoney } from "@/projects/quotes";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import { useCrm } from "../data/CrmProvider";
import { Btn, Card, Empty, PageTitle, fieldCls } from "../components/ui";

// التسعير والربحية: سياسة الخصم والهامش، والكوبونات، ورابط قائمة الأسعار العامة

/** الأدوار التي ترسل عروض الأسعار */
const QUOTING_ROLES = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((r) => ROLE_PERMISSIONS[r].includes("projects.manage"));

function PolicyCard() {
  const { t, pick } = useI18n();
  const { run } = useCrm();
  const actor = usePActor();
  const [v, setV] = useState<PricingPolicy | null>(null);
  useEffect(() => {
    if (actor) void pricingRepo.policy(actor).then(setV).catch(() => setV(DEFAULT_POLICY));
  }, [actor]);
  if (!v) return <div className="h-40 rounded-2xl shimmer bg-paper-100" />;
  return (
    <Card className="p-5" title={t("سياسة الخصم والهامش", "Discount & margin policy")}>
      <p className="text-sm text-paper-600 mb-4 leading-[1.8]">{t("سقف الخصم: أقصى نسبة يرسلها كل دور في عرض سعر — ما فوقها يحفظه مسودة ويرسله دور أعلى. الخادم يفرض السقف عند الإرسال.", "Discount cap: the most each role can send in a quote — above it, they save a draft for a higher role to send. The server enforces it on send.")}</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {QUOTING_ROLES.map((r) => (
          <label key={r} className="block">
            <span className="block text-xs text-paper-500 mb-1.5">{t(`سقف خصم ${pick(ROLE_LABELS[r])} ٪`, `${pick(ROLE_LABELS[r])} discount cap %`)}</span>
            <input type="number" min={0} max={100} step={1} value={v.discountCaps[r] ?? 0} onChange={(e) => setV({ ...v, discountCaps: { ...v.discountCaps, [r]: Number(e.target.value) } })} className={fieldCls} />
          </label>
        ))}
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("حد الهامش الأدنى ٪", "Margin floor %")}</span>
          <input type="number" min={0} max={100} step={1} value={v.marginFloor} onChange={(e) => setV({ ...v, marginFloor: Number(e.target.value) })} className={fieldCls} />
          <span className="block mt-1 text-[11px] text-paper-400">{t("تنبيه في المحرر والتقارير حين يقل الهامش المتوقع عنه", "Flags quotes in the editor and reports when the expected margin is below it")}</span>
        </label>
      </div>
      <div className="mt-4">
        <Btn onClick={() => actor && run(() => pricingRepo.savePolicy({ discountCaps: v.discountCaps, marginFloor: v.marginFloor }, actor), t("حُفظت السياسة", "Policy saved"))}>{t("حفظ السياسة", "Save policy")}</Btn>
      </div>
    </Card>
  );
}

function SpamCard() {
  const { t } = useI18n();
  const { run } = useCrm();
  const actor = usePActor();
  const [v, setV] = useState<PricingPolicy | null>(null);
  useEffect(() => {
    if (actor) void pricingRepo.policy(actor).then(setV).catch(() => setV(DEFAULT_POLICY));
  }, [actor]);
  if (!v) return null;
  const on = v.captchaRequired === true;
  const toggle = async () => {
    const next = { ...v, captchaRequired: !on };
    if (actor && (await run(() => pricingRepo.savePolicy({ captchaRequired: next.captchaRequired }, actor), next.captchaRequired ? t("فُعّل التحقق البشري", "Human check enabled") : t("أُوقف التحقق البشري", "Human check disabled")))) setV(next);
  };
  return (
    <Card className="p-5" title={t("الحماية من الرسائل المزعجة", "Spam protection")}>
      <ul className="text-sm text-paper-600 leading-[1.9] list-disc ps-5">
        <li>{t("مفعّلة دائماً على الخادم: 5 طلبات لكل عنوان كل 10 دقائق (30 يومياً)، و3 لكل بريد، و10 محاولات كوبون لكل عنوان.", "Always on, server-side: 5 requests per address per 10 minutes (30 a day), 3 per email, and 10 coupon attempts per address.")}</li>
        <li>{t("التحقق البشري (Cloudflare Turnstile) يظهر للزائر فقط حين يشتبه به. فعّله إن بدأت طلبات وهمية بالوصول.", "The human check (Cloudflare Turnstile) only shows when a visitor looks suspicious. Turn it on if fake requests start arriving.")}</li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-ink-900">
          <input type="checkbox" checked={on} disabled={!TURNSTILE_SITE_KEY && !on} onChange={() => void toggle()} className="w-4 h-4 accent-ink-900" data-testid="captcha-toggle" />
          {t("إلزام الزوار بالتحقق البشري قبل الإرسال", "Require visitors to pass the human check before sending")}
        </label>
        {!TURNSTILE_SITE_KEY && <span className="text-xs text-paper-500">{t("يحتاج ضبط VITE_TURNSTILE_SITE_KEY وTURNSTILE_SECRET_KEY أولاً.", "Set VITE_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY first.")}</span>}
      </div>
    </Card>
  );
}

function CouponsCard() {
  const { t, num, date } = useI18n();
  const { run } = useCrm();
  const actor = usePActor();
  const money = useMoney();
  const [list, setList] = useState<Coupon[] | null>(null);
  const [c, setC] = useState<CouponInput>({ code: "", kind: "pct", value: 10, validUntil: "", maxUses: null, note: "" });
  const reload = useCallback(async () => actor && setList(await pricingRepo.coupons(actor)), [actor]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const codeBad = !!c.code && !COUPON_RE.test(c.code);
  const status = (x: Coupon) => {
    if (!x.active) return t("معطّل", "Disabled");
    if (x.validUntil && x.validUntil < new Date().toISOString().slice(0, 10)) return t("منتهٍ", "Expired");
    if (x.maxUses != null && x.uses >= x.maxUses) return t("استُنفد", "Used up");
    return t("فعّال", "Active");
  };
  return (
    <Card className="p-5" title={t("الكوبونات", "Coupons")}>
      <p className="text-sm text-paper-600 mb-4 leading-[1.8]">{t("لما يُدفع مباشرة من الموقع (عينة الاكتشاف). العميل يكتب الكود عند الدفع، والخادم يحسب السعر ويسجّل الاستخدام بعد التحقق من الدفعة. للمشاريع استخدم خصم عرض السعر.", "For what's paid directly on the site (the discovery kit). The client enters the code at checkout; the server computes the price and records the use after verifying payment. For projects, use the quote discount.")}</p>
      <form
        className="grid sm:grid-cols-6 gap-2 items-end mb-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (actor && (await run(() => pricingRepo.saveCoupon({ ...c, validUntil: c.validUntil || null }, actor), t("أُنشئ الكوبون", "Coupon created")))) {
            setC({ ...c, code: "", note: "" });
            await reload();
          }
        }}
      >
        <label className="block sm:col-span-2">
          <span className="block text-xs text-paper-500 mb-1.5">{t("الكود", "Code")}</span>
          <input value={c.code} dir="ltr" maxLength={24} required onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} aria-invalid={codeBad} className={fieldCls} placeholder="RAMADAN" />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("النوع", "Type")}</span>
          <select value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as CouponInput["kind"] })} className={fieldCls}>
            <option value="pct">{t("نسبة ٪", "Percent %")}</option>
            <option value="amount">{t("مبلغ ر.س", "Amount SAR")}</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("القيمة", "Value")}</span>
          <input type="number" min={0.01} step="0.01" value={c.value} onChange={(e) => setC({ ...c, value: Number(e.target.value) })} className={fieldCls} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("ينتهي في", "Expires")}</span>
          <input type="date" value={c.validUntil ?? ""} onChange={(e) => setC({ ...c, validUntil: e.target.value })} className={fieldCls} />
        </label>
        <label className="block">
          <span className="block text-xs text-paper-500 mb-1.5">{t("حد الاستخدام", "Max uses")}</span>
          <input type="number" min={1} step={1} value={c.maxUses ?? ""} onChange={(e) => setC({ ...c, maxUses: e.target.value ? Number(e.target.value) : null })} className={fieldCls} placeholder={t("بلا حد", "Unlimited")} />
        </label>
        <div className="sm:col-span-6"><Btn type="submit" disabled={!c.code || codeBad}>{t("أنشئ الكوبون", "Create coupon")}</Btn></div>
      </form>
      {!list ? null : list.length === 0 ? (
        <Empty icon="ri-coupon-3-line" title={t("لا كوبونات بعد", "No coupons yet")} hint={t("أنشئ كوداً لحملة أو شريك.", "Create a code for a campaign or a partner.")} />
      ) : (
        <ul className="divide-y divide-paper-100 text-sm">
          {list.map((x) => (
            <li key={x.code} className="py-2.5 flex flex-wrap items-center gap-3" data-coupon={x.code}>
              <span className="font-mono text-ink-900 min-w-[7rem]" dir="ltr">{x.code}</span>
              <span className="text-paper-700">{x.kind === "pct" ? `${num(x.value)}%` : money(x.value)}</span>
              <span className="text-paper-500 text-xs flex-1">
                {t(`استُخدم ${num(x.uses)}`, `Used ${x.uses}`)}{x.maxUses != null ? t(` من ${num(x.maxUses)}`, ` of ${x.maxUses}`) : ""}
                {x.validUntil ? t(` · حتى ${date(new Date(x.validUntil), { day: "numeric", month: "short" })}`, ` · until ${date(new Date(x.validUntil), { day: "numeric", month: "short" })}`) : ""}
              </span>
              <span className="text-xs rounded-full bg-paper-100 px-2 py-0.5 text-paper-600">{status(x)}</span>
              <button type="button" onClick={() => actor && run(() => pricingRepo.setCouponActive(x.code, !x.active, actor), x.active ? t("عُطّل الكوبون", "Coupon disabled") : t("فُعّل الكوبون", "Coupon enabled")).then((ok) => ok && reload())} className="text-xs underline underline-offset-4 text-paper-600">
                {x.active ? t("تعطيل", "Disable") : t("تفعيل", "Enable")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Pricing() {
  const { t } = useI18n();
  return (
    <>
      <PageTitle title={t("التسعير والربحية", "Pricing & margins")} sub={t("سياسة الخصم وحد الهامش، والكوبونات. قائمة الأسعار العامة (الحاسبة، الباقات، العينة، العلب) في «محتوى الموقع».", "Discount policy, margin floor and coupons. The public price list (calculator, packages, kit, boxes) lives in “Site content”.")} actions={<Link to="/admin/cms?doc=pricing" className="inline-flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-2 text-sm text-ink-900 hover:border-ink-900">{t("قائمة الأسعار", "Price list")}</Link>} />
      <div className="space-y-4">
        <PolicyCard />
        <CouponsCard />
        <SpamCard />
      </div>
    </>
  );
}
