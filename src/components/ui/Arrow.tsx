// سهم "إلى الأمام" ينقلب تلقائياً مع اتجاه اللغة
export default function Arrow({ className = "" }: { className?: string }) {
  return <i className={`ri-arrow-left-line flip-ltr nudge inline-block ${className}`} aria-hidden="true"></i>;
}
