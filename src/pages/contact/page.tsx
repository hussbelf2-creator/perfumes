import Navbar from "@/pages/home/components/Navbar";
import FooterSection from "@/pages/home/components/FooterSection";
import ContactSection from "@/pages/home/components/ContactSection";
import PageHeader from "@/components/base/PageHeader";
import Button from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";

const ContactPage = () => {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-paper-50">
      <Navbar />
      <PageHeader
        label={t("تواصل", "Contact")}
        title={<>{t("أخبرنا عن فكرتك،", "Tell us your idea,")} <span className="text-paper-400">{t("ونرد بالخطوة التالية.", "we'll reply with the next step.")}</span></>}
        intro={t("سطران يكفيان: ما الذي تريد بناءه، ولمن. نرد خلال يوم عمل.", "Two lines are enough: what you want to build, and for whom. We reply within one business day.")}
      >
        <Button to="/book" variant="secondary" arrow>{t("أو احجز مكالمة مجانية", "Or book a free call")}</Button>
      </PageHeader>
      <div className="-mt-24">
        <ContactSection withHeading={false} />
      </div>
      <FooterSection />
    </div>
  );
};

export default ContactPage;
