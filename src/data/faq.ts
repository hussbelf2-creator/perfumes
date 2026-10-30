// الأسئلة العامة (أسئلة كل مسار موجودة داخل بياناته في services.ts)
import type { Bi } from "@/i18n/context";

export type FaqTopic = "start" | "cost" | "process" | "ownership";

export const FAQ_TOPICS: { key: FaqTopic; label: Bi }[] = [
  { key: "start", label: { ar: "البداية", en: "Getting started" } },
  { key: "cost", label: { ar: "التكلفة", en: "Cost" } },
  { key: "process", label: { ar: "سير العمل", en: "Process" } },
  { key: "ownership", label: { ar: "الملكية والتسجيل", en: "Ownership & registration" } },
];

export const FAQS: { topic: FaqTopic; q: Bi; a: Bi }[] = [
  {
    topic: "process",
    q: { ar: "كم تستغرق عملية إنشاء براند عطور كامل؟", en: "How long does a full fragrance brand take?" },
    a: {
      ar: "من 3 إلى 6 أشهر حسب تعقيد المشروع، وتشمل: الاستراتيجية، تطوير العطر مع العينات، الهوية، العبوة، والتصنيع. بعض المراحل تسير بالتوازي لاختصار الوقت.",
      en: "Three to six months depending on complexity, covering strategy, fragrance development with samples, identity, packaging and manufacturing. Some stages run in parallel to save time.",
    },
  },
  {
    topic: "cost",
    q: { ar: "هل يمكنني البدء بميزانية محدودة؟", en: "Can I start with a limited budget?" },
    a: {
      ar: "نعم. كل مسار مستقل، فيمكنك البدء بتطوير العطر أو الهوية فقط ثم التوسع لاحقاً دون أن تبدأ من الصفر.",
      en: "Yes. Each track is independent, so you can start with the fragrance or the identity only and expand later without starting over.",
    },
  },
  {
    topic: "cost",
    q: { ar: "كيف أعرف التكلفة قبل أن أبدأ؟", en: "How do I know the cost before I start?" },
    a: {
      ar: "حاسبة التكلفة تعطيك تقديراً فورياً لتكلفة الوحدة والإجمالي. وبعد مراجعة البريف يصلك عرض سعر رسمي مفصّل.",
      en: "The cost calculator gives an instant estimate of unit and total cost. After reviewing your brief, you receive a detailed formal quote.",
    },
  },
  {
    topic: "start",
    q: { ar: "هل أحتاج خبرة سابقة في العطور؟", en: "Do I need prior fragrance experience?" },
    a: {
      ar: "لا. مدير مشروعك وخبراء العطور يرشدونك في كل مرحلة، وكل قرار يُعرض عليك بوضوح قبل اعتماده.",
      en: "No. Your project manager and perfumers guide you at every stage, and every decision is presented clearly before you approve it.",
    },
  },
  {
    topic: "start",
    q: { ar: "ما الذي أحتاجه لأبدأ؟", en: "What do I need to get started?" },
    a: {
      ar: "فكرة، وجمهور تتخيله، وسعر بيع تقريبي. نساعدك في تحويلها إلى بريف مكتوب في الأسبوع الأول.",
      en: "An idea, an audience in mind and a rough retail price. We help turn them into a written brief in week one.",
    },
  },
  {
    topic: "process",
    q: { ar: "كيف أتابع تقدّم مشروعي؟", en: "How do I follow my project's progress?" },
    a: {
      ar: "من لوحة التحكم: مراحل المشروع، وعروض الأسعار، والعينات، والاعتمادات المطلوبة منك، والرسائل مع الفريق، كلها في مكان واحد.",
      en: "From your dashboard: project stages, quotes, samples, approvals waiting for you and messages with the team — all in one place.",
    },
  },
  {
    topic: "ownership",
    q: { ar: "هل أملك التركيبة والتصاميم؟", en: "Do I own the formula and designs?" },
    a: {
      ar: "تُحدَّد الملكية والحصرية في العقد قبل البدء. التصاميم تنتقل ملكيتها لك بعد السداد، والتركيبة تُمنح لعلامتك بحق استخدام حصري.",
      en: "Ownership and exclusivity are set in the contract before we start. Designs transfer to you on payment, and the formula is licensed exclusively to your brand.",
    },
  },
  {
    topic: "ownership",
    q: { ar: "هل تساعدون في تسجيل المنتج والعلامة؟", en: "Do you help with product and trademark registration?" },
    a: {
      ar: "نعم، كخدمة إضافية: تجهيز ملف التسجيل لدى هيئة الغذاء والدواء، وإجراءات تسجيل العلامة التجارية.",
      en: "Yes, as an add-on: preparing the SFDA registration file and the trademark filing process.",
    },
  },
];
