import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import type { Stage, TeamMember } from "../data/types";
import { STAGE_LABELS } from "../data/types";
import { waDigits } from "@/lib/phone";

// مكوّنات لوحة الإدارة — نفس نظام التصميم: حبر وورق ورمل، وحالات بلون + أيقونة + نص دائماً

export function PageTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6 md:mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-2xl md:text-3xl text-ink-900">{title}</h1>
        {sub && <p className="mt-1 text-sm text-paper-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-2xl bg-white border border-paper-200 ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 pt-5">
          <h2 className="text-[0.95rem] font-medium text-ink-900">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "plain", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "plain" | "warn" | "good"; icon: string }) {
  const toneCls = tone === "warn" ? "text-accent2-ink" : tone === "good" ? "text-[#1F7A5C]" : "text-paper-500";
  return (
    <div className="min-w-0 rounded-2xl bg-white border border-paper-200 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-paper-500 truncate">{label}</p>
        <span className="w-8 h-8 rounded-full bg-sand-soft text-ink-900 hidden sm:flex items-center justify-center shrink-0">
          <i className={icon} aria-hidden="true"></i>
        </span>
      </div>
      <p className="mt-3 font-display text-xl sm:text-2xl md:text-3xl text-ink-900 whitespace-nowrap">{value}</p>
      {hint && <p className={`mt-1 text-xs ${toneCls}`}>{hint}</p>}
    </div>
  );
}

const STAGE_STYLE: Record<Stage, { cls: string; icon: string }> = {
  new: { cls: "bg-[#EAF0FA] text-[#2B4C7E]", icon: "ri-sparkling-line" },
  contacted: { cls: "bg-sand-soft text-ink-900", icon: "ri-chat-check-line" },
  qualified: { cls: "bg-[#EEF3EA] text-[#3E5C2B]", icon: "ri-checkbox-circle-line" },
  proposal: { cls: "bg-accent2-soft text-accent2-ink", icon: "ri-file-text-line" },
  won: { cls: "bg-[#E3F2EC] text-[#1F6B4F]", icon: "ri-trophy-line" },
  lost: { cls: "bg-paper-100 text-paper-600", icon: "ri-close-circle-line" },
};

export function StageBadge({ stage }: { stage: Stage }) {
  const { pick } = useI18n();
  const s = STAGE_STYLE[stage];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs whitespace-nowrap ${s.cls}`}>
      <i className={s.icon} aria-hidden="true"></i>
      {pick(STAGE_LABELS[stage])}
    </span>
  );
}

export const STAGE_DOT: Record<Stage, string> = {
  new: "#3B6FB6",
  contacted: "#A89F8E",
  qualified: "#6B8F4E",
  proposal: "#E4612E",
  won: "#2A9D8F",
  lost: "#B5B2AC",
};

export function Avatar({ m, size = "sm" }: { m?: Pick<TeamMember, "firstName" | "lastName"> | { name: string } | null; size?: "sm" | "md" }) {
  const name = !m ? "" : "name" in m ? m.name : `${m.firstName} ${m.lastName}`;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("") || "—";
  const dim = size === "md" ? "w-10 h-10 text-sm" : "w-7 h-7 text-[11px]";
  return (
    <span className={`${dim} shrink-0 rounded-full bg-sand text-ink-900 font-display flex items-center justify-center`} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="py-14 px-6 text-center">
      <span className="w-12 h-12 mx-auto rounded-full bg-sand-soft text-ink-900 flex items-center justify-center">
        <i className={`${icon} text-xl`} aria-hidden="true"></i>
      </span>
      <p className="mt-4 text-ink-900">{title}</p>
      {hint && <p className="mt-1 text-sm text-paper-500">{hint}</p>}
    </div>
  );
}

const fieldBase =
  "bg-white border border-paper-200 focus:border-ink-900 rounded-xl px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-paper-400 outline-none transition-colors disabled:bg-paper-50 disabled:text-paper-500";
export const fieldCls = `w-full ${fieldBase}`;
/** حقل بعرض محتواه (فلاتر الشريط العلوي للصفحات) */
export const inlineFieldCls = `w-auto ${fieldBase}`;

export function Btn({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const v = {
    primary: "bg-ink-900 text-white hover:bg-ink-700",
    secondary: "bg-white border border-paper-300 text-ink-900 hover:border-ink-900",
    ghost: "text-paper-600 hover:text-ink-900 hover:bg-paper-100",
    danger: "bg-white border border-red-200 text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${v} ${className}`}>
      {children}
    </button>
  );
}

/** لوحة جانبية: تُغلق بـ Esc وبالنقر خارجها، وتعيد التركيز للعنصر السابق */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="close" tabIndex={-1} className="absolute inset-0 bg-ink-900/30" onClick={onClose} />
      <div ref={panel} tabIndex={-1} className="absolute inset-y-0 end-0 w-full max-w-xl bg-paper-50 border-s border-paper-200 overflow-y-auto drawer-in outline-none">
        {children}
      </div>
    </div>
  );
}

export function useFormat() {
  const { lang, num } = useI18n();
  const locale = lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return {
    money: (sar: number) => `${num(sar, Number.isInteger(sar) ? 0 : 2)} ${lang === "ar" ? "ر.س" : "SAR"}`,
    compactMoney: (sar: number) =>
      `${new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(sar)} ${lang === "ar" ? "ر.س" : "SAR"}`,
    /** للبطاقات الكبيرة: الرقم بارز والعملة صغيرة */
    statMoney: (sar: number) => (
      <>
        {new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(sar)}
        <span className="ms-1 text-sm font-sans text-paper-500">{lang === "ar" ? "ر.س" : "SAR"}</span>
      </>
    ),
    ago: (iso: string) => {
      const diff = (new Date(iso).getTime() - Date.now()) / 1000;
      const abs = Math.abs(diff);
      if (abs < 60) return rtf.format(0, "second");
      if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
      if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
      return rtf.format(Math.round(diff / (86400 * 30)), "month");
    },
    date: (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => new Date(iso).toLocaleDateString(locale, opts),
    riyadh: (iso: string) =>
      new Date(iso).toLocaleString(locale, { timeZone: "Asia/Riyadh", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
  };
}

/** رابط واتساب من رقم بأي صيغة (محلي سعودي أو دولي) */
export function waLink(phone?: string | null, text = "") {
  const d = waDigits(phone) || (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    // حماية من حقن الصيغ في Excel
    const safe = typeof v !== "number" && /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  // BOM ليفتح Excel العربية بشكل صحيح
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
}

export function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
