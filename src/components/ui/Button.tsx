import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Arrow from "./Arrow";

type Variant = "primary" | "secondary" | "light" | "ghost";

const STYLES: Record<Variant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-700",
  secondary: "bg-white text-ink-900 border border-paper-300 hover:border-ink-900",
  light: "bg-white text-ink-900 hover:bg-sand-soft",
  ghost: "text-ink-900 hover:bg-ink-900/5",
};

interface ButtonProps {
  to?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  arrow?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

// زر بشكل كبسولة مع دائرة سهم — أسلوب الواجهة الجديدة
export default function Button({ to, href, onClick, type = "button", variant = "primary", arrow = false, disabled, className = "", children }: ButtonProps) {
  const cls = `group inline-flex items-center justify-center gap-3 rounded-full ps-6 ${arrow ? "pe-1.5" : "pe-6"} py-1.5 min-h-[3rem] text-[0.95rem] font-medium transition-all active:scale-[0.98] disabled:opacity-50 ${STYLES[variant]} ${className}`;
  const inner = (
    <>
      <span>{children}</span>
      {arrow && (
        <span className={`w-9 h-9 rounded-full flex items-center justify-center ${variant === "primary" ? "bg-white/15" : "bg-ink-900 text-white"}`}>
          <Arrow />
        </span>
      )}
    </>
  );
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href) return <a href={href} className={cls} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{inner}</button>;
}
