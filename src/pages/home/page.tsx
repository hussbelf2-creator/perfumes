import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import NotesMarquee from "./components/NotesMarquee";
import ServicesShowcase from "./components/ServicesShowcase";
import WhySection from "./components/WhySection";
import JourneySection from "./components/JourneySection";
import CostTeaser from "./components/CostTeaser";
import ConceptsSection from "./components/ConceptsSection";
import FAQSection from "./components/FAQSection";
import ContactSection from "./components/ContactSection";
import ClosingCTA from "./components/ClosingCTA";
import EntryOffers from "./components/EntryOffers";
import PersonalScent from "./components/PersonalScent";
import FooterSection from "./components/FooterSection";
import ScrollProgress from "@/components/base/ScrollProgress";
import TrackChooser from "@/components/feature/TrackChooser";
import Reveal from "@/components/base/Reveal";
import TrustStrip from "./components/TrustStrip";
import FeesSection from "./components/FeesSection";

const Home = () => {
  return (
    <div className="min-h-screen bg-paper-50 text-paper-800">
      <ScrollProgress />
      <Navbar />
      <main>
        <Hero />
        <TrustStrip />
        <NotesMarquee />
        <ServicesShowcase />
        <section className="px-5 md:px-8 pb-24 md:pb-32">
          <Reveal className="max-w-7xl mx-auto">
            <TrackChooser dark />
          </Reveal>
        </section>
        <EntryOffers />
        <PersonalScent />
        <WhySection />
        <JourneySection />
        <CostTeaser />
        <ConceptsSection />
        <FeesSection />
        <FAQSection />
        <ContactSection />
        <ClosingCTA />
      </main>
      <FooterSection />
    </div>
  );
};

export default Home;
