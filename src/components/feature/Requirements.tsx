import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { EXPORT, PHASES, REQUIREMENTS, type Requirement } from "@/data/requirements";
import type { ServiceTrack } from "@/data/services";
import Reveal from "@/components/base/Reveal";

// متطلبات التصنيع: ما نحتاجه من العميل وما يسلّمه المصنع، مرتبة بمراحل المشروع.
// تظهر في صفحة المسار كاملة، وفي مشروع العميل مختصرة على ما يخصه.

export function ManufacturingRequirements({ track, only, compact = false }: { track: ServiceTrack["id"]; only?: Requirement["who"]; compact?: boolean }) {
  const { t, pick } = useI18n();
  const list = REQUIREMENTS[track].filter((x) => !only || x.who === only);
  if (!list.length) return null;
  return (
    <div className={compact ? "space-y-4" : "grid md:grid-cols-2 gap-4"}>
      {PHASES.map((ph) => {
        const items = list.filter((x) => x.phase === ph.id);
        if (!items.length) return null;
        return (
          <section key={ph.id} aria-labelledby={`req-${track}-${ph.id}`} className={compact ? "" : "rounded-2xl bg-white border border-paper-200 p-5"}>
            <h3 id={`req-${track}-${ph.id}`} className={`flex items-center gap-2 ${compact ? "text-xs text-paper-500 mb-2" : "text-sm text-paper-500 mb-4"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
              {pick(ph.label)}
            </h3>
            <ul className={compact ? "space-y-2" : "space-y-3"}>
              {items.map((x) => (
                <li key={x.id} className="flex items-start gap-3">
                  <span className={`shrink-0 rounded-xl flex items-center justify-center ${compact ? "w-8 h-8 text-sm" : "w-10 h-10 text-lg"} ${x.who === "client" ? "bg-sand-soft text-ink-900" : "bg-ink-900 text-white"}`} aria-hidden="true">
                    <i className={x.icon}></i>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={`${compact ? "text-sm" : ""} text-ink-900 font-medium`}>{pick(x.label)}</span>
                      {!only && <span className={`text-[10px] rounded-full px-2 py-0.5 ${x.who === "client" ? "bg-sand-soft text-ink-900" : "bg-ink-900 text-white"}`}>{x.who === "client" ? t("منك", "From you") : t("من المصنع", "From the factory")}</span>}
                      {x.required === false && <span className="text-[10px] text-paper-500">{t("اختياري", "Optional")}</span>}
                    </span>
                    <span className={`block ${compact ? "text-xs" : "text-sm"} text-paper-600 leading-[1.7] mt-0.5`}>{pick(x.desc)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** من السعودية إلى العالم: الشحن والمستندات والتسجيل — عرض تفاعلي بحسب السوق */
export function ExportSection({ dark = false }: { dark?: boolean }) {
  const { t, pick } = useI18n();
  const [tab, setTab] = useState<keyof typeof EXPORT>("markets");
  const tabs: { id: keyof typeof EXPORT; label: string; icon: string }[] = [
    { id: "markets", label: t("الأسواق", "Markets"), icon: "ri-earth-line" },
    { id: "shipping", label: t("الشحن", "Shipping"), icon: "ri-ship-line" },
    { id: "incoterms", label: t("شروط التسليم", "Delivery terms"), icon: "ri-hand-coin-line" },
    { id: "docs", label: t("المستندات", "Documents"), icon: "ri-file-shield-2-line" },
  ];
  const txt = dark ? "text-white" : "text-ink-900";
  const sub = dark ? "text-white/65" : "text-paper-600";
  return (
    <Reveal className={`rounded-[2rem] p-6 md:p-10 ${dark ? "bg-ink-900 text-white" : "bg-white border border-paper-200"}`}>
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4">
          <p className={`inline-flex items-center gap-2 text-sm mb-4 ${dark ? "text-white/60" : "text-paper-500"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {t("من السعودية إلى العالم", "From Saudi Arabia to the world")}
          </p>
          <h3 className={`font-display text-3xl md:text-4xl leading-[1.2] ${txt}`}>{t("نصنّع في السعودية، ونسلّم حيث تبيع.", "Made in Saudi Arabia, delivered where you sell.")}</h3>
          <p className={`mt-4 leading-[1.8] ${sub}`}>{t("كل شحنة تخرج بمستنداتها وتسجيلها وتغليفها المعتمد للعطور. اختر السوق وشروط التسليم، ونتولى الباقي.", "Every shipment leaves with its documents, registration and certified perfume packing. Pick the market and delivery terms; we handle the rest.")}</p>
          <div className="mt-6 flex flex-wrap gap-1.5" role="tablist" aria-label={t("التصدير", "Export")}>
            {tabs.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`rounded-full px-3.5 py-2 text-sm border inline-flex items-center gap-1.5 transition-colors ${tab === x.id ? (dark ? "bg-white text-ink-900 border-white" : "bg-ink-900 text-white border-ink-900") : dark ? "border-white/20 text-white/80 hover:border-white" : "border-paper-300 text-paper-700 hover:border-ink-900"}`}>
                <i className={x.icon} aria-hidden="true"></i>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <ul key={tab} role="tabpanel" className="lg:col-span-8 grid sm:grid-cols-2 gap-3 panel-in">
          {EXPORT[tab].map((x, i) => (
            <li key={x.id} className={`rounded-2xl p-5 lift ${dark ? "bg-white/5 border border-white/10" : "bg-paper-50 border border-paper-200"}`} style={{ ["--d" as string]: i }}>
              <i className={`${x.icon} text-2xl ${dark ? "text-accent2" : "text-accent2-ink"}`} aria-hidden="true"></i>
              <p className={`mt-3 font-medium ${txt}`}>{pick(x.title)}</p>
              <p className={`mt-1 text-sm leading-[1.7] ${sub}`}>{pick(x.desc)}</p>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
