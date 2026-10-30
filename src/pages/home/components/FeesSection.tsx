import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/context";
import Reveal from "@/components/base/Reveal";
import SectionHead from "@/components/ui/SectionHead";
import { SERVICE_TRACKS } from "@/data/services";
import { useServicePrice } from "@/pricing/usePrices";
import { VAT_RATE } from "@/projects/types";

// «أسعار بلا مفاجآت» على طريقة بوابات الدفع: ما هو مجاني، ومتى تدفع وكم، وما يُسعَّر في العرض.
// الأرقام من مصدر واحد (الأسعار في محتوى الموقع والضريبة في نظام العروض) فلا تتناقض مع العروض الفعلية.
export default function FeesSection({ compact = false }: { compact?: boolean }) {
  const { t, pick, num } = useI18n();
  const priceOf = useServicePrice();
  const free = [
    { icon: "ri-phone-line", head: t("مكالمة الاكتشاف", "Discovery call"), sub: t("30 دقيقة مع خبير، بلا التزام", "30 minutes with an expert, no obligation") },
    { icon: "ri-shapes-line", head: t("الاستوديو ثلاثي الأبعاد", "The 3D studio"), sub: t("صمّم العبوة والملصق والعلبة وصدّر الملفات", "Design bottle, label and box and export the files") },
    { icon: "ri-calculator-line", head: t("حاسبة التكلفة", "Cost calculator"), sub: t("تكلفة الوحدة والإجمالي وسعر التجزئة فوراً", "Unit cost, total and suggested retail instantly") },
    { icon: "ri-file-text-line", head: t("عرض السعر المفصّل", "The itemised quote"), sub: t("بنود وكميات وضريبة ومدة — قبل أي دفع", "Items, quantities, VAT and timing — before any payment") },
  ];
  const pay = [
    { k: t("رسوم تأسيس أو اشتراك", "Setup or subscription fees"), v: t("لا يوجد", "None"), hot: true },
    { k: t("العربون عند اعتماد العرض", "Deposit on quote approval"), v: t("50٪ من قيمة العرض", "50% of the quote") },
    { k: t("الباقي", "Balance"), v: t("قبل التسليم أو الشحن", "Before delivery or shipping") },
    { k: t("ضريبة القيمة المضافة", "VAT"), v: t(`${num(VAT_RATE)}٪ تظهر سطراً مستقلاً في كل عرض`, `${VAT_RATE}% shown as its own line on every quote`) },
    { k: t("الشحن الدولي", "International shipping"), v: t("يُسعَّر في العرض حسب الدولة وشروط التسليم", "Priced in the quote by country and delivery terms") },
    { k: t("الإلغاء قبل بدء التنفيذ", "Cancelling before work starts"), v: t("استرداد العربون كاملاً", "Full deposit refund") },
  ];
  return (
    <section className={compact ? "" : "py-24 md:py-32 bg-white border-y border-paper-200"} aria-labelledby="fees-title">
      <div className={compact ? "" : "max-w-7xl mx-auto px-5 md:px-8"}>
        {!compact && (
          <SectionHead
            eyebrow={t("الأسعار والرسوم", "Pricing & fees")}
            title={<span id="fees-title">{t("أسعار بلا مفاجآت.", "No-surprise pricing.")}</span>}
            intro={t("ما هو مجاني، ومتى تدفع وكم — قبل أن تبدأ. والعرض الرسمي يفصّل كل بند.", "What's free, when you pay and how much — before you start. The formal quote itemises everything.")}
            action={<Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-paper-300 px-5 py-2.5 text-sm text-ink-900 hover:border-ink-900">{t("افتح حاسبة التكلفة", "Open the cost calculator")}<i className="ri-arrow-left-line flip-ltr" aria-hidden="true"></i></Link>}
          />
        )}
        <div className="grid lg:grid-cols-12 gap-6">
          <Reveal className="lg:col-span-5 rounded-[1.75rem] bg-accent3-soft/60 border border-accent3/20 p-6 md:p-8">
            <p className="text-sm text-accent3-ink font-medium flex items-center gap-2"><i className="ri-gift-2-line" aria-hidden="true"></i>{t("مجاني دائماً", "Always free")}</p>
            <ul className="mt-5 space-y-4">
              {free.map((x) => (
                <li key={x.head} className="flex items-start gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-white text-accent3-ink flex items-center justify-center" aria-hidden="true"><i className={x.icon}></i></span>
                  <span><span className="block text-ink-900">{x.head}</span><span className="block text-sm text-paper-600">{x.sub}</span></span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal index={1} className="lg:col-span-7 rounded-[1.75rem] bg-paper-50 border border-paper-200 p-6 md:p-8">
            <p className="text-sm text-paper-500 font-medium flex items-center gap-2"><i className="ri-bank-card-line" aria-hidden="true"></i>{t("متى تدفع، وكم", "When you pay, and how much")}</p>
            <dl className="mt-4 divide-y divide-paper-200">
              {pay.map((x) => (
                <div key={x.k} className="py-3 flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-paper-600">{x.k}</dt>
                  <dd className={`text-sm text-end ${x.hot ? "text-accent3-ink font-medium" : "text-ink-900"}`}>{x.v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-paper-500">{t("المسارات تبدأ من:", "Tracks start from:")}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {SERVICE_TRACKS.map((s) => (
                <li key={s.id}>
                  <Link to={`/services/${s.id}`} className="inline-flex items-center gap-2 rounded-full bg-white border border-paper-200 hover:border-ink-900 px-3 py-1.5 text-xs text-ink-900 transition-colors">
                    <i className={`${s.icon} text-paper-500`} aria-hidden="true"></i>
                    {pick(s.title)} · <span className="text-paper-600">{pick(priceOf(s))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
