import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import Photo from "@/components/base/Photo";
import CountUp from "@/components/base/CountUp";
import Button from "@/components/ui/Button";
import { useContent } from "@/cms/ContentProvider";
import { useImageSrc } from "@/creatives/images";
import { useSpotlight } from "@/hooks/useTilt";

const Hero = () => {
  const { user } = useAuth();
  const { t, pick } = useI18n();
  // النصوص والصورة والأرقام من «محتوى الموقع» (القيم الافتراضية هي النص الأصلي)
  const h = useContent("hero");
  const image = useImageSrc(h.image);
  const spot = useSpotlight<HTMLElement>();

  const notes = [
    { k: "Top", label: t("المقدمة", "Top"), v: t("برغموت · فلفل وردي", "Bergamot · Pink pepper"), pos: "top-8 -start-4 md:-start-10", float: "float-a", d: 6 },
    { k: "Heart", label: t("القلب", "Heart"), v: t("ورد طائفي · زعفران", "Taif rose · Saffron"), pos: "top-1/2 -end-4 md:-end-8", float: "float-b", d: 7 },
    { k: "Base", label: t("القاعدة", "Base"), v: t("عود · عنبر · مسك", "Oud · Amber · Musk"), pos: "bottom-10 -start-2 md:-start-6", float: "float-a", d: 8 },
  ];

  return (
    <section ref={spot.ref} onMouseMove={spot.onMouseMove} className="relative mesh-dark spot grain text-white overflow-hidden">
      <div aria-hidden="true" className="absolute -top-40 end-[-10rem] w-[44rem] h-[44rem] rounded-full opacity-40 blur-3xl pointer-events-none float-a" style={{ background: "radial-gradient(closest-side, rgba(228,97,46,0.55), transparent)" }} />
      <div aria-hidden="true" className="absolute bottom-[-14rem] start-[-8rem] w-[38rem] h-[38rem] rounded-full opacity-40 blur-3xl pointer-events-none float-b" style={{ background: "radial-gradient(closest-side, rgba(47,162,135,0.45), transparent)" }} />
      <div className="relative max-w-7xl mx-auto px-5 md:px-8 pt-32 md:pt-40 pb-16 md:pb-24 grid lg:grid-cols-12 gap-14 items-center">
        <div className="lg:col-span-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/75 fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-accent2" aria-hidden="true" />
            {pick(h.eyebrow)}
          </p>

          <h1 className="mt-8 font-display font-medium text-[2.8rem] leading-[1.12] sm:text-6xl md:text-7xl xl:text-[5.4rem] tracking-tight">
            <span className="line-mask"><span style={{ ["--d" as string]: 0 }}>{pick(h.line1)}</span></span>
            <span className="line-mask">
              <span style={{ ["--d" as string]: 1 }}>
                {pick(h.line2)}
                <span className="gradient-text">{pick(h.highlight)}</span>
              </span>
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-lg md:text-xl leading-[1.8] text-white/70 fade-up" style={{ ["--d" as string]: 3 }}>
            {pick(h.sub)}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3 fade-up" style={{ ["--d" as string]: 4 }}>
            <Button to={user ? "/account" : "/services"} variant="light" arrow>
              {user ? t("لوحة التحكم", "Go to dashboard") : pick(h.primaryCta)}
            </Button>
            <Button to="/book" variant="ghost" className="!text-white hover:!bg-white/10 border border-white/20">
              {pick(h.secondaryCta)}
            </Button>
          </div>
          <p className="mt-4 text-sm text-white/55 fade-up" style={{ ["--d" as string]: 4 }}>
            <i className="ri-shield-check-line me-1" aria-hidden="true"></i>
            {t("بلا رسوم تأسيس · عرض سعر مفصّل قبل أي دفع · العربون يُسترد قبل بدء التنفيذ", "No setup fees · an itemised quote before any payment · deposit refundable before work starts")}
          </p>
          <div className="hidden">
          </div>

          <dl className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-white/10 pt-8 fade-up" style={{ ["--d" as string]: 5 }}>
            {h.facts.map((f, i) => (
              <div key={i}>
                <dt className="sr-only">{pick(f.label)}</dt>
                <dd className="font-display text-3xl md:text-4xl" dir="ltr" style={{ textAlign: "start" }}>
                  <CountUp value={f.value} prefix={f.prefix} />
                </dd>
                <dd className="mt-1 text-sm text-white/55">{pick(f.label)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:col-span-5">
          <figure className="relative max-w-md mx-auto lg:max-w-none">
            <div className="curtain rounded-[2rem] overflow-hidden ring-gradient">
              {image ? <Photo key={image} src={image} alt={pick(h.imageAlt)} priority zoom className="aspect-[4/5]" /> : <div className="aspect-[4/5] shimmer bg-white/5" />}
            </div>
            {notes.map((n) => (
              <div key={n.k} className={`hidden sm:block absolute ${n.pos} fade-up`} style={{ ["--d" as string]: n.d }}>
                <div className={`rounded-2xl bg-white/90 backdrop-blur text-ink-900 px-4 py-3 shadow-xl ${n.float}`}>
                  <p className="label-mono">{n.label}</p>
                  <p className="text-sm">{n.v}</p>
                </div>
              </div>
            ))}
          </figure>
        </div>
      </div>
    </section>
  );
};

export default Hero;
