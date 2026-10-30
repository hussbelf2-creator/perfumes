import { useState } from "react";
import { Link } from "react-router-dom";
import { SITE, socialLinks } from "@/config/site";
import { useContent } from "@/cms/ContentProvider";
import { SERVICE_TRACKS } from "@/data/services";
import { submitForm } from "@/lib/forms";
import { useI18n } from "@/i18n/context";
import LangToggle from "@/components/base/LangToggle";

const FooterSection = () => {
  const { t, pick } = useI18n();
  const site = useContent("site");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const PLATFORM_LINKS = [
    { label: t("كل الخدمات", "All services"), to: "/services" },
    { label: t("مكالمة اكتشاف مجانية", "Free discovery call"), to: "/book" },
    { label: t("عينة الاكتشاف", "Discovery kit"), to: "/discovery-kit" },
    { label: t("عطرك الخاص (للأفراد)", "Your signature scent"), to: "/bespoke" },
    { label: t("حاسبة التكلفة", "Cost calculator"), to: "/pricing" },
    { label: t("نماذج تصوّرية", "Concepts"), to: "/portfolio" },
    { label: t("عن المنصة", "About"), to: "/about" },
    { label: t("الأسئلة الشائعة", "FAQ"), to: "/faq" },
    { label: t("تواصل معنا", "Contact"), to: "/contact" },
  ];

  const handleNewsletterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("loading");
    setError("");
    const result = await submitForm("newsletter", new FormData(form));
    if (result.ok) {
      setStatus("success");
      form.reset();
    } else {
      setError(t(result.message, "Couldn't subscribe right now. Please try again shortly."));
      setStatus("error");
    }
  };

  return (
    <footer className="bg-ink-900 text-white">
      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-20 pb-10">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 md:grid-cols-12 pb-16 border-b border-white/10">
          <div className="md:col-span-5">
            <p className="font-display text-3xl md:text-4xl leading-[1.25] max-w-md">
              {t("كل عطر يبدأ بسطرٍ في بريف.", "Every fragrance starts with a line in a brief.")}
            </p>
            <Link to="/book" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-ink-900 px-6 py-3 text-sm hover:bg-sand-soft transition-colors">
              {t("احجز مكالمة مجانية", "Book a free call")}
            </Link>
          </div>

          <nav aria-label={t("روابط المنصة", "Platform links")} className="md:col-span-2">
            <p className="text-sm text-white/40 mb-5">{t("المنصة", "Platform")}</p>
            <ul className="space-y-3 text-sm">
              {PLATFORM_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-white/75 hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t("مسارات الخدمة", "Service tracks")} className="md:col-span-2">
            <p className="text-sm text-white/40 mb-5">{t("المسارات", "Tracks")}</p>
            <ul className="space-y-3 text-sm">
              {SERVICE_TRACKS.map((s) => (
                <li key={s.id}>
                  <Link to={`/services/${s.id}`} className="text-white/75 hover:text-white transition-colors">{pick(s.title)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-3">
            <p className="text-sm text-white/40 mb-5">{t("رسائل متباعدة", "Newsletter")}</p>
            <p className="text-sm text-white/65 leading-[1.8] mb-5">
              {t("مقالات عن صناعة العطور وبناء البراندات، مرة في الشهر على الأكثر.", "Notes on perfumery and brand building, once a month at most.")}
            </p>
            {status === "success" ? (
              <p role="status" className="text-sm">{t("تم الاشتراك. شكراً لك.", "You're subscribed. Thank you.")}</p>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex items-center gap-2 rounded-full bg-white/10 p-1.5 focus-within:bg-white/15 transition-colors">
                <label htmlFor="newsletter-email" className="sr-only">{t("بريدك الإلكتروني", "Your email")}</label>
                <input
                  id="newsletter-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder={t("بريدك الإلكتروني", "Your email")}
                  className="flex-1 min-w-0 bg-transparent border-0 focus:ring-0 outline-none px-4 py-2 text-white placeholder:text-white/40"
                />
                <input type="text" name="website_alt" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                <button type="submit" disabled={status === "loading"} className="rounded-full bg-white text-ink-900 text-sm px-4 py-2 disabled:opacity-50">
                  {status === "loading" ? "…" : t("اشترك", "Subscribe")}
                </button>
              </form>
            )}
            {status === "error" && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-white/45">
          <span className="font-display text-white text-lg">{pick(SITE.shortName)}</span>
          <div className="flex flex-wrap items-center gap-6">
            {socialLinks(site).map((s) => (
              <a key={s.icon} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="hover:text-white transition-colors">
                <i className={`${s.icon} text-lg`} aria-hidden="true"></i>
              </a>
            ))}
            <Link to="/privacy" className="hover:text-white transition-colors">{t("الخصوصية", "Privacy")}</Link>
            <Link to="/terms" className="hover:text-white transition-colors">{t("الشروط", "Terms")}</Link>
            <Link to="/refund" className="hover:text-white transition-colors">{t("الاسترجاع", "Refunds")}</Link>
            <span>© {new Date().getFullYear()} {site.billing.legalName || pick(SITE.name)} · {pick(site.address)}{site.billing.cr ? t(` · س.ت ${site.billing.cr}`, ` · CR ${site.billing.cr}`) : ""}{site.billing.vatNumber ? t(` · الرقم الضريبي ${site.billing.vatNumber}`, ` · VAT ${site.billing.vatNumber}`) : ""}</span>
            <LangToggle className="!text-white/60 hover:!text-white" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
