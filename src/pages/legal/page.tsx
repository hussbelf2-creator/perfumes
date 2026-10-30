import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import PageHeader from "@/components/base/PageHeader";
import { useI18n } from "@/i18n/context";
import { useContent } from "@/cms/ContentProvider";
import { SITE } from "@/config/site";
import { LEGAL_KINDS, LEGAL_PATHS, type LegalKind } from "@/data/legal";

// الصفحات القانونية: نصها من «محتوى الموقع ← الصفحات القانونية»، وبيانات المنشأة من «التواصل والحسابات»

/** «- » بند قائمة، والسطر الفارغ يفصل الفقرات */
function Body({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.split("\n").filter((l) => l.trim()));
  return (
    <>
      {blocks.map((lines, i) => {
        const items = lines.filter((l) => /^\s*-\s+/.test(l));
        const prose = lines.filter((l) => !/^\s*-\s+/.test(l));
        return (
          <Fragment key={i}>
            {prose.length > 0 && <p className="mt-3">{prose.join(" ")}</p>}
            {items.length > 0 && (
              <ul className="mt-3 space-y-2 list-disc ps-5 marker:text-paper-400">
                {items.map((l, k) => <li key={k}>{l.replace(/^\s*-\s+/, "")}</li>)}
              </ul>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const { t, pick, date } = useI18n();
  const legal = useContent("legal");
  const site = useContent("site");
  const offers = useContent("offers");
  const page = legal[kind];
  const b = site.billing;
  const vars: Record<string, string> = {
    legalName: b.legalName || pick(SITE.name),
    cr: b.cr || "—",
    vat: b.vatNumber || "—",
    email: site.email || "—",
    phone: site.phone || "—",
    address: pick(site.address),
    kitCreditDays: String(offers.kit.creditDays),
  };
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  const label: Record<LegalKind, string> = { privacy: t("الخصوصية", "Privacy"), terms: t("الشروط", "Terms"), refund: t("الإلغاء والاسترجاع", "Refunds") };
  const updated = /^\d{4}-\d{2}-\d{2}$/.test(legal.updated) ? date(new Date(legal.updated), { day: "numeric", month: "long", year: "numeric" }) : "";
  const link = (k: LegalKind, children: ReactNode) => (
    <Link to={LEGAL_PATHS[k]} aria-current={k === kind ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm border transition-colors ${k === kind ? "bg-ink-900 text-white border-ink-900" : "border-paper-200 bg-white text-paper-700 hover:border-ink-900"}`}>
      {children}
    </Link>
  );

  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <PageHeader label={t("قانوني", "Legal")} title={pick(page.title)} intro={fill(pick(page.intro))}>
        <div className="flex flex-wrap items-center gap-2">
          {LEGAL_KINDS.map((k) => <Fragment key={k}>{link(k, label[k])}</Fragment>)}
          {updated && <span className="text-sm text-paper-500 ms-2">{t(`آخر تحديث: ${updated}`, `Last updated: ${updated}`)}</span>}
        </div>
      </PageHeader>
      <main className="max-w-7xl mx-auto px-5 md:px-8 pb-24 grid lg:grid-cols-12 gap-10">
        <nav aria-label={t("محتويات الصفحة", "On this page")} className="lg:col-span-4 lg:sticky lg:top-24 self-start">
          <ol className="space-y-2 text-sm">
            {page.sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-paper-600 hover:text-ink-900">{i + 1}. {pick(s.title)}</a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="lg:col-span-8 text-paper-700 leading-[1.9]">
          {page.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 border-t border-paper-200 py-8 first:border-t-0 first:pt-0">
              <h2 className="font-display text-2xl text-ink-900">{i + 1}. {pick(s.title)}</h2>
              <Body text={fill(pick(s.body) || s.body.ar)} />
            </section>
          ))}
          <p className="mt-6 text-sm text-paper-500">
            {t("لأي استفسار عن هذه الصفحة: ", "Questions about this page: ")}
            <Link to="/contact" className="underline underline-offset-4">{t("تواصل معنا", "contact us")}</Link>
          </p>
        </article>
      </main>
      <FooterSection />
    </div>
  );
}
