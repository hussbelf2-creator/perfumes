import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import ContactForm from "@/components/feature/ContactForm";
import { contactChannels } from "@/config/site";
import { useContent } from "@/cms/ContentProvider";

const ContactSection = ({ withHeading = true }: { withHeading?: boolean }) => {
  const { t, pick } = useI18n();
  const site = useContent("site");
  return (
    <section id="contact" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-12 gap-12">
        <Reveal className="lg:col-span-5">
          {withHeading && (
            <>
              <p className="inline-flex items-center gap-2 text-sm text-paper-500 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
                {t("تواصل", "Contact")}
              </p>
              <h2 className="font-display text-[2.1rem] leading-[1.2] md:text-5xl text-ink-900">{t("أخبرنا عن فكرتك.", "Tell us about your idea.")}</h2>
              <p className="mt-5 text-paper-600 leading-[1.8] max-w-md">
                {t("سطران يكفيان: ما الذي تريد بناءه، ولمن. نرد خلال يوم عمل بالخطوة التالية المقترحة.", "Two lines are enough: what you want to build, and for whom. We reply within one business day with a suggested next step.")}
              </p>
            </>
          )}
          <ul className="mt-10 space-y-3">
            {contactChannels(site).map((c) => {
              const body = (
                <>
                  <span className="w-11 h-11 rounded-full bg-white border border-paper-200 flex items-center justify-center text-ink-900"><i className={c.icon} aria-hidden="true"></i></span>
                  <span>
                    <span className="block text-sm text-paper-500">{pick(c.title)}</span>
                    {pick(c.lines).map((l) => <span key={l} className="block text-ink-900" dir="auto">{l}</span>)}
                  </span>
                </>
              );
              return (
                <li key={c.title.en}>
                  {c.href ? (
                    <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-4 hover:opacity-80">{body}</a>
                  ) : (
                    <div className="flex items-center gap-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Reveal>
        <Reveal index={1} className="lg:col-span-7">
          <ContactForm />
        </Reveal>
      </div>
    </section>
  );
};

export default ContactSection;
