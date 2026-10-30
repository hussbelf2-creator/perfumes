// مسارات الخدمة الستة — المصدر الوحيد لكل ما يُعرض عن الخدمات بالعربية والإنجليزية.
// الأسعار الابتدائية والمدد مأخوذة من الموقع الأصلي؛ الباقات الأعلى "عرض سعر مخصص" حتى تُعتمد أسعارها.
import type { Bi } from "../i18n/context";
import { PHOTOS } from "../lib/photos";

export type Capability = "strategy" | "formula" | "identity" | "packaging" | "manufacturing" | "print" | "launch";

export const CAPABILITIES: { key: Capability; label: Bi }[] = [
  { key: "strategy", label: { ar: "استراتيجية البراند", en: "Brand strategy" } },
  { key: "formula", label: { ar: "تطوير التركيبة", en: "Fragrance development" } },
  { key: "identity", label: { ar: "الهوية البصرية", en: "Visual identity" } },
  { key: "packaging", label: { ar: "العبوة والتغليف", en: "Packaging" } },
  { key: "manufacturing", label: { ar: "التعبئة والتصنيع", en: "Filling & manufacturing" } },
  { key: "print", label: { ar: "الطباعة والتشطيب", en: "Print & finishing" } },
  { key: "launch", label: { ar: "خطة الإطلاق", en: "Launch plan" } },
];

export interface ServicePackage {
  name: Bi;
  note: Bi;
  price: Bi;
  features: Bi<string[]>;
  featured?: boolean;
}

export interface ServiceTrack {
  id: "A" | "B" | "C" | "D" | "E" | "F";
  no: string;
  icon: string;
  photo: string;
  title: Bi;
  tagline: Bi;
  summary: Bi;
  price: Bi;
  duration: Bi;
  forWho: Bi<string[]>;
  outcome: Bi;
  deliverables: { title: Bi; desc: Bi; icon: string }[];
  steps: { title: Bi; desc: Bi; time: Bi }[];
  packages: ServicePackage[];
  addons: Bi<string[]>;
  faqs: { q: Bi; a: Bi }[];
  capabilities: Capability[];
  related: ServiceTrack["id"][];
}

const CUSTOM: Bi = { ar: "عرض سعر مخصص", en: "Custom quote" };

export const SERVICE_TRACKS: ServiceTrack[] = [
  {
    id: "A",
    no: "01",
    icon: "ri-award-line",
    photo: PHOTOS.shelf,
    title: { ar: "براند عطري كامل", en: "Full Fragrance Brand" },
    tagline: { ar: "من فكرة في رأسك إلى زجاجة على الرف", en: "From an idea in your head to a bottle on the shelf" },
    summary: {
      ar: "الرحلة كاملة تحت إدارة واحدة: استراتيجية، تركيبة، هوية، عبوة، تصنيع وخطة إطلاق.",
      en: "The whole journey under one manager: strategy, formula, identity, packaging, manufacturing and a launch plan.",
    },
    price: { ar: "يبدأ من 50,000 ر.س", en: "From SAR 50,000" },
    duration: { ar: "3 – 6 أشهر", en: "3 – 6 months" },
    forWho: {
      ar: ["رائد أعمال يطلق أول براند عطري", "متجر أو مؤثر يريد عطراً باسمه", "شركة تضيف خط عطور لعلامتها"],
      en: ["Founders launching their first fragrance brand", "Retailers or creators who want a scent in their name", "Companies adding a fragrance line to their brand"],
    },
    outcome: {
      ar: "براند جاهز للبيع: تركيبة معتمدة، هوية وعبوة منفّذتان، ودفعتك الأولى معبّأة ومغلّفة.",
      en: "A brand ready to sell: an approved formula, finished identity and packaging, and your first batch filled and boxed.",
    },
    deliverables: [
      { icon: "ri-compass-3-line", title: { ar: "وثيقة الاستراتيجية", en: "Strategy document" }, desc: { ar: "الجمهور والتموضع والسعر المستهدف", en: "Audience, positioning and target price" } },
      { icon: "ri-flask-line", title: { ar: "تركيبة حصرية", en: "Exclusive formula" }, desc: { ar: "جولات عينات حتى الاعتماد", en: "Sample rounds until approval" } },
      { icon: "ri-palette-line", title: { ar: "هوية كاملة", en: "Complete identity" }, desc: { ar: "اسم، شعار، دليل استخدام", en: "Name, logo and guidelines" } },
      { icon: "ri-gift-2-line", title: { ar: "عبوة وعلبة", en: "Bottle & box" }, desc: { ar: "تصميم ونموذج ملموس", en: "Design and physical prototype" } },
      { icon: "ri-settings-3-line", title: { ar: "الدفعة الأولى", en: "First batch" }, desc: { ar: "تعبئة وفحص جودة وتغليف", en: "Filling, QC and packing" } },
      { icon: "ri-rocket-2-line", title: { ar: "خطة الإطلاق", en: "Launch plan" }, desc: { ar: "قنوات البيع والمحتوى الأول", en: "Sales channels and first content" } },
    ],
    steps: [
      { title: { ar: "البريف والاستراتيجية", en: "Brief & strategy" }, desc: { ar: "جلسة اكتشاف وبريف مكتوب تعتمده", en: "Discovery session and a written brief you approve" }, time: { ar: "أسبوعان", en: "2 weeks" } },
      { title: { ar: "التركيبة والعينات", en: "Formula & samples" }, desc: { ar: "جولات عينات مرقّمة حتى الاعتماد", en: "Numbered sample rounds until sign-off" }, time: { ar: "4 – 8 أسابيع", en: "4 – 8 weeks" } },
      { title: { ar: "الهوية والعبوة", en: "Identity & packaging" }, desc: { ar: "تُصمَّم بالتوازي مع التركيبة", en: "Designed in parallel with the formula" }, time: { ar: "بالتوازي", en: "In parallel" } },
      { title: { ar: "التصنيع والإطلاق", en: "Production & launch" }, desc: { ar: "تعبئة وفحص وتسليم الدفعة الأولى", en: "Filling, QC and first-batch delivery" }, time: { ar: "4 – 8 أسابيع", en: "4 – 8 weeks" } },
    ],
    packages: [
      {
        name: { ar: "الأساس", en: "Essential" },
        note: { ar: "عطر واحد بإصدار واحد", en: "One scent, one edition" },
        price: { ar: "يبدأ من 50,000 ر.س", en: "From SAR 50,000" },
        features: {
          ar: ["تركيبة واحدة", "زجاجة من الكتالوج مع تخصيص", "هوية أساسية", "دفعة أولى صغيرة"],
          en: ["One formula", "Catalogue bottle, customised", "Core identity", "Small first batch"],
        },
      },
      {
        name: { ar: "التوقيع", en: "Signature" },
        note: { ar: "موصى بها", en: "Recommended" },
        price: CUSTOM,
        featured: true,
        features: {
          ar: ["تركيبة حصرية بجولات أكثر", "زجاجة وغطاء مخصّصان", "هوية كاملة ودليل استخدام", "خطة إطلاق ومحتوى"],
          en: ["Exclusive formula, more rounds", "Custom bottle and cap", "Full identity and guidelines", "Launch plan and content"],
        },
      },
      {
        name: { ar: "المجموعة", en: "Collection" },
        note: { ar: "خط من عدة عطور", en: "A multi-scent line" },
        price: CUSTOM,
        features: {
          ar: ["حتى 3 تركيبات بهوية موحّدة", "نظام عبوات متدرّج", "مجموعة اكتشاف (Discovery set)", "تصوير منتج"],
          en: ["Up to 3 formulas, one identity", "A tiered packaging system", "Discovery set", "Product photography"],
        },
      },
    ],
    addons: {
      ar: ["تسجيل المنتج لدى هيئة الغذاء والدواء", "تسجيل العلامة التجارية", "تصوير منتج ومحتوى إطلاق", "متجر إلكتروني"],
      en: ["SFDA product registration", "Trademark registration", "Product photography & launch content", "E-commerce store"],
    },
    faqs: [
      { q: { ar: "هل أملك التركيبة بعد التسليم؟", en: "Do I own the formula after delivery?" }, a: { ar: "تُحدَّد ملكية التركيبة وحصريتها في العقد قبل البدء، وتشمل عادةً حق الاستخدام الحصري لعلامتك.", en: "Formula ownership and exclusivity are set in the contract before we start, usually granting exclusive use for your brand." } },
      { q: { ar: "ما الحد الأدنى للكمية؟", en: "What is the minimum order?" }, a: { ar: "يعتمد على نوع الزجاجة والعلبة. يظهر لك الحد الأدنى في عرض السعر، ويمكنك تجربة الكميات في حاسبة التكلفة.", en: "It depends on the bottle and box you choose. Minimums appear in your quote, and you can try volumes in the cost calculator." } },
    ],
    capabilities: ["strategy", "formula", "identity", "packaging", "manufacturing", "print", "launch"],
    related: ["B", "C", "D"],
  },
  {
    id: "B",
    no: "02",
    icon: "ri-flask-line",
    photo: PHOTOS.samples,
    title: { ar: "تطوير عطر", en: "Fragrance Development" },
    tagline: { ar: "رائحة تُبنى على بريف، لا على الصدفة", en: "A scent built on a brief, not on chance" },
    summary: {
      ar: "تركيبة تُبنى على بريف واضح، وتُراجع عبر جولات عينات مرقّمة حتى تعتمدها.",
      en: "A formula built on a clear brief and refined through numbered sample rounds until you approve it.",
    },
    price: { ar: "يبدأ من 15,000 ر.س", en: "From SAR 15,000" },
    duration: { ar: "6 – 9 أسابيع", en: "6 – 9 weeks" },
    forWho: {
      ar: ["براند قائم يريد عطراً جديداً", "من لديه هوية وعبوة ويحتاج الرائحة", "متاجر تريد عطراً حصرياً"],
      en: ["Existing brands adding a new scent", "Those with identity and packaging who need the juice", "Retailers wanting an exclusive scent"],
    },
    outcome: { ar: "تركيبة معتمدة مع ملف مواصفاتها، جاهزة للتصنيع.", en: "An approved formula with its specification file, ready for production." },
    deliverables: [
      { icon: "ri-file-text-line", title: { ar: "بريف الرائحة", en: "Scent brief" }, desc: { ar: "العائلة العطرية والمزاج والمرجعيات", en: "Olfactive family, mood and references" } },
      { icon: "ri-test-tube-line", title: { ar: "جولات العينات", en: "Sample rounds" }, desc: { ar: "عينات مرقّمة مع استمارة تقييم", en: "Numbered samples with an evaluation form" } },
      { icon: "ri-bar-chart-2-line", title: { ar: "تقرير الثبات والانتشار", en: "Longevity & sillage report" }, desc: { ar: "قياس الأداء قبل الاعتماد", en: "Performance measured before sign-off" } },
      { icon: "ri-file-shield-2-line", title: { ar: "ملف المواصفات", en: "Specification file" }, desc: { ar: "للتصنيع والتسجيل", en: "For production and registration" } },
    ],
    steps: [
      { title: { ar: "البريف", en: "Brief" }, desc: { ar: "جلسة تحديد العائلة العطرية والمرجعيات", en: "Define the family and reference scents" }, time: { ar: "أسبوع", en: "1 week" } },
      { title: { ar: "الجولة الأولى", en: "Round one" }, desc: { ar: "اتجاهان أو ثلاثة للمقارنة", en: "Two or three directions to compare" }, time: { ar: "2 – 3 أسابيع", en: "2 – 3 weeks" } },
      { title: { ar: "التحسين", en: "Refinement" }, desc: { ar: "جولات تعديل على الاتجاه المختار", en: "Refinement rounds on the chosen direction" }, time: { ar: "2 – 4 أسابيع", en: "2 – 4 weeks" } },
      { title: { ar: "الاعتماد", en: "Approval" }, desc: { ar: "اختبار الثبات وتسليم الملف", en: "Stability test and file handover" }, time: { ar: "أسبوع", en: "1 week" } },
    ],
    packages: [
      { name: { ar: "اتجاه واحد", en: "Single direction" }, note: { ar: "تعرف ما تريد", en: "You know what you want" }, price: { ar: "يبدأ من 15,000 ر.س", en: "From SAR 15,000" }, features: { ar: ["اتجاه عطري واحد", "جولتا تعديل", "ملف المواصفات"], en: ["One olfactive direction", "Two refinement rounds", "Specification file"] } },
      { name: { ar: "استكشاف", en: "Exploration" }, note: { ar: "موصى بها", en: "Recommended" }, price: CUSTOM, featured: true, features: { ar: ["3 اتجاهات للمقارنة", "حتى 4 جولات", "تقرير الثبات والانتشار"], en: ["3 directions to compare", "Up to 4 rounds", "Longevity & sillage report"] } },
    ],
    addons: { ar: ["اختبار مستهلكين", "نسخة مركّزة (Extrait)", "عطر للمنزل بنفس الرائحة"], en: ["Consumer panel test", "Extrait version", "Matching home fragrance"] },
    faqs: [
      { q: { ar: "كم جولة عينات تشمل الخدمة؟", en: "How many sample rounds are included?" }, a: { ar: "تختلف حسب الباقة، وتُذكر بوضوح في العرض. الجولات الإضافية تُسعَّر مسبقاً.", en: "It depends on the package and is stated in your quote. Extra rounds are priced upfront." } },
    ],
    capabilities: ["formula"],
    related: ["A", "E"],
  },
  {
    id: "C",
    no: "03",
    icon: "ri-gift-2-line",
    photo: PHOTOS.packaging,
    title: { ar: "عبوة وتغليف", en: "Packaging" },
    tagline: { ar: "أول ما يُلمس قبل أن يُشم", en: "The first thing touched before it's smelled" },
    summary: { ar: "زجاجة وغطاء وعلبة وملصق — من الرسم الأول إلى النموذج الملموس.", en: "Bottle, cap, box and label — from the first sketch to a physical prototype." },
    price: { ar: "يبدأ من 8,000 ر.س", en: "From SAR 8,000" },
    duration: { ar: "3 – 5 أسابيع", en: "3 – 5 weeks" },
    forWho: { ar: ["من لديه عطر جاهز ويحتاج عبوة", "براند يجدد عبوته", "إصدار محدود أو هدايا"], en: ["Those with a finished scent who need packaging", "Brands refreshing their pack", "Limited editions and gift sets"] },
    outcome: { ar: "ملفات تنفيذ معتمدة ونموذج ملموس قبل الطباعة.", en: "Approved production files and a physical prototype before printing." },
    deliverables: [
      { icon: "ri-flask-line", title: { ar: "الزجاجة والغطاء", en: "Bottle & cap" }, desc: { ar: "اختيار من الكتالوج أو تصميم مخصص", en: "From catalogue or custom-designed" } },
      { icon: "ri-archive-line", title: { ar: "العلبة", en: "Box" }, desc: { ar: "هيكل وخامة وتشطيب", en: "Structure, material and finish" } },
      { icon: "ri-price-tag-3-line", title: { ar: "الملصق", en: "Label" }, desc: { ar: "تصميم وبروفة طباعة", en: "Design and print proof" } },
      { icon: "ri-box-3-line", title: { ar: "معاينة ثلاثية الأبعاد", en: "3D preview" }, desc: { ar: "قبل النموذج الملموس", en: "Before the physical sample" } },
    ],
    steps: [
      { title: { ar: "الاتجاه", en: "Direction" }, desc: { ar: "لوحة مرجعية وخامات", en: "Moodboard and materials" }, time: { ar: "أسبوع", en: "1 week" } },
      { title: { ar: "التصميم", en: "Design" }, desc: { ar: "مفهومان ثم تطوير المختار", en: "Two concepts, then develop one" }, time: { ar: "1 – 2 أسابيع", en: "1 – 2 weeks" } },
      { title: { ar: "النموذج", en: "Prototype" }, desc: { ar: "نموذج ملموس للاعتماد", en: "Physical sample for approval" }, time: { ar: "1 – 2 أسابيع", en: "1 – 2 weeks" } },
    ],
    packages: [
      { name: { ar: "كتالوج", en: "Catalogue" }, note: { ar: "أسرع وأوفر", en: "Faster and leaner" }, price: { ar: "يبدأ من 8,000 ر.س", en: "From SAR 8,000" }, features: { ar: ["زجاجة من الكتالوج", "علبة وملصق مخصصان", "معاينة 3D"], en: ["Catalogue bottle", "Custom box and label", "3D preview"] } },
      { name: { ar: "مخصص", en: "Bespoke" }, note: { ar: "هوية لا تتكرر", en: "One of a kind" }, price: CUSTOM, featured: true, features: { ar: ["زجاجة أو غطاء بقالب خاص", "تشطيبات خاصة", "نموذج ملموس"], en: ["Custom-mould bottle or cap", "Special finishes", "Physical prototype"] } },
    ],
    addons: { ar: ["تغليف هدايا ومناسبات", "حقيبة تسوق", "عينات صغيرة 2 مل"], en: ["Gift & seasonal packaging", "Shopping bag", "2 ml sample vials"] },
    faqs: [
      { q: { ar: "هل يمكن رؤية العبوة قبل الطباعة؟", en: "Can I see the pack before printing?" }, a: { ar: "نعم: معاينة ثلاثية الأبعاد أولاً، ثم نموذج ملموس قبل أي طباعة بالكمية.", en: "Yes: a 3D preview first, then a physical prototype before any volume print." } },
    ],
    capabilities: ["packaging", "print"],
    related: ["D", "F"],
  },
  {
    id: "D",
    no: "04",
    icon: "ri-palette-line",
    photo: PHOTOS.identity,
    title: { ar: "هوية بصرية", en: "Visual Identity" },
    tagline: { ar: "اسم يُقرأ، وشكل يُتذكّر", en: "A name that reads, a look that's remembered" },
    summary: { ar: "اسم يُقرأ، شعار يُتذكّر، ونظام بصري يعمل على الرف والشاشة.", en: "A name that reads, a mark that's remembered, and a system that works on shelf and screen." },
    price: { ar: "يبدأ من 12,000 ر.س", en: "From SAR 12,000" },
    duration: { ar: "3 – 4 أسابيع", en: "3 – 4 weeks" },
    forWho: { ar: ["براند جديد قبل تصميم العبوة", "براند يعيد تقديم نفسه"], en: ["New brands before packaging", "Brands repositioning themselves"] },
    outcome: { ar: "نظام هوية كامل ودليل استخدام يسلَّم للمصممين والمطابع.", en: "A complete identity system and guidelines ready for designers and printers." },
    deliverables: [
      { icon: "ri-quill-pen-line", title: { ar: "الاسم والشعار", en: "Name & logo" }, desc: { ar: "بالعربية والإنجليزية", en: "In Arabic and English" } },
      { icon: "ri-font-size", title: { ar: "الخطوط والألوان", en: "Type & colour" }, desc: { ar: "نظام متكامل", en: "A complete system" } },
      { icon: "ri-book-open-line", title: { ar: "دليل الهوية", en: "Brand guidelines" }, desc: { ar: "قواعد الاستخدام", en: "Usage rules" } },
      { icon: "ri-instagram-line", title: { ar: "تطبيقات رقمية", en: "Digital applications" }, desc: { ar: "قوالب منصات التواصل", en: "Social templates" } },
    ],
    steps: [
      { title: { ar: "الاستكشاف", en: "Discovery" }, desc: { ar: "شخصية البراند ومنافسوه", en: "Brand personality and competitors" }, time: { ar: "أسبوع", en: "1 week" } },
      { title: { ar: "المفاهيم", en: "Concepts" }, desc: { ar: "ثلاثة مفاهيم للشعار", en: "Three logo concepts" }, time: { ar: "1 – 2 أسابيع", en: "1 – 2 weeks" } },
      { title: { ar: "النظام", en: "System" }, desc: { ar: "تطوير المختار وبناء الدليل", en: "Develop the chosen one and the guide" }, time: { ar: "أسبوع", en: "1 week" } },
    ],
    packages: [
      { name: { ar: "الأساس", en: "Core" }, note: { ar: "للبداية", en: "To get started" }, price: { ar: "يبدأ من 12,000 ر.س", en: "From SAR 12,000" }, features: { ar: ["شعار ثنائي اللغة", "ألوان وخطوط", "دليل مختصر"], en: ["Bilingual logo", "Colour & type", "Short guide"] } },
      { name: { ar: "النظام الكامل", en: "Full system" }, note: { ar: "موصى بها", en: "Recommended" }, price: CUSTOM, featured: true, features: { ar: ["تسمية البراند", "دليل هوية كامل", "قوالب رقمية ومطبوعة"], en: ["Brand naming", "Full guidelines", "Digital & print templates"] } },
    ],
    addons: { ar: ["تسمية البراند", "تسجيل العلامة", "تصميم الموقع"], en: ["Brand naming", "Trademark filing", "Website design"] },
    faqs: [
      { q: { ar: "كم مفهوماً أحصل عليه؟", en: "How many concepts do I get?" }, a: { ar: "ثلاثة مفاهيم في الجولة الأولى، ثم تطوير المفهوم المختار.", en: "Three concepts in round one, then we develop the one you choose." } },
    ],
    capabilities: ["identity"],
    related: ["C", "A"],
  },
  {
    id: "E",
    no: "05",
    icon: "ri-settings-3-line",
    photo: PHOTOS.production,
    title: { ar: "تصنيع", en: "Manufacturing" },
    tagline: { ar: "تركيبتك وتصميمك، معبّأان بدقة", en: "Your formula and design, filled with precision" },
    summary: { ar: "تعبئة وتجميع وفحص جودة لتركيبتك وتصميمك الجاهزين.", en: "Filling, assembly and quality control for your ready formula and design." },
    price: { ar: "حسب الكمية", en: "Volume-based" },
    duration: { ar: "4 – 8 أسابيع", en: "4 – 8 weeks" },
    forWho: { ar: ["براند لديه تركيبة وعبوة جاهزتان", "إعادة طلب دفعة جديدة"], en: ["Brands with a ready formula and pack", "Reordering a new batch"] },
    outcome: { ar: "دفعة معبّأة ومفحوصة ومغلّفة، جاهزة للشحن.", en: "A filled, checked and boxed batch, ready to ship." },
    deliverables: [
      { icon: "ri-drop-line", title: { ar: "التعبئة", en: "Filling" }, desc: { ar: "تعبئة دقيقة بالحجم المعتمد", en: "Accurate filling at the approved volume" } },
      { icon: "ri-shield-check-line", title: { ar: "فحص الجودة", en: "Quality control" }, desc: { ar: "فحص بصري وتسرّب وحجم", en: "Visual, leak and volume checks" } },
      { icon: "ri-archive-2-line", title: { ar: "التغليف", en: "Packing" }, desc: { ar: "تجميع وتغليف للشحن", en: "Assembly and packing for shipment" } },
    ],
    steps: [
      { title: { ar: "مراجعة الملفات", en: "File review" }, desc: { ar: "التركيبة والعبوة والكميات", en: "Formula, pack and volumes" }, time: { ar: "أسبوع", en: "1 week" } },
      { title: { ar: "التوريد", en: "Sourcing" }, desc: { ar: "الزجاج والعلب والخامات", en: "Glass, boxes and materials" }, time: { ar: "2 – 4 أسابيع", en: "2 – 4 weeks" } },
      { title: { ar: "الإنتاج", en: "Production" }, desc: { ar: "تعبئة وفحص وتغليف", en: "Fill, check and pack" }, time: { ar: "1 – 3 أسابيع", en: "1 – 3 weeks" } },
    ],
    packages: [
      { name: { ar: "دفعة إنتاج", en: "Production run" }, note: { ar: "تُسعَّر بالكمية", en: "Priced by volume" }, price: { ar: "حسب الكمية", en: "Volume-based" }, featured: true, features: { ar: ["تعبئة وتجميع", "فحص جودة", "تغليف للشحن"], en: ["Filling & assembly", "Quality control", "Packed for shipping"] } },
    ],
    addons: { ar: ["تخزين", "شحن للمتاجر", "عينات تجريبية"], en: ["Warehousing", "Shipping to stores", "Tester samples"] },
    faqs: [
      { q: { ar: "كيف أقدّر التكلفة؟", en: "How do I estimate cost?" }, a: { ar: "جرّب الكميات في حاسبة التكلفة لترى تكلفة الوحدة وسعر التجزئة المقترح.", en: "Try volumes in the cost calculator to see unit cost and suggested retail price." } },
    ],
    capabilities: ["manufacturing"],
    related: ["B", "F"],
  },
  {
    id: "F",
    no: "06",
    icon: "ri-printer-line",
    photo: PHOTOS.print,
    title: { ar: "طباعة وتنفيذ", en: "Print & Finishing" },
    tagline: { ar: "ملفاتك، مطبوعة كما صُمّمت", en: "Your files, printed exactly as designed" },
    summary: { ar: "تنفيذ ملفاتك الجاهزة بطباعة دقيقة وتشطيبات خاصة.", en: "Your ready files produced with accurate print and special finishes." },
    price: { ar: "يبدأ من 3,000 ر.س", en: "From SAR 3,000" },
    duration: { ar: "1 – 2 أسابيع", en: "1 – 2 weeks" },
    forWho: { ar: ["من لديه ملفات جاهزة", "إعادة طباعة علب وملصقات"], en: ["Those with print-ready files", "Reprinting boxes and labels"] },
    outcome: { ar: "علب وملصقات مطبوعة مطابقة للبروفة المعتمدة.", en: "Boxes and labels printed to match the approved proof." },
    deliverables: [
      { icon: "ri-contrast-drop-2-line", title: { ar: "مطابقة الألوان", en: "Colour matching" }, desc: { ar: "بروفة قبل الطباعة", en: "Proof before printing" } },
      { icon: "ri-sparkling-line", title: { ar: "تشطيبات خاصة", en: "Special finishes" }, desc: { ar: "فويل، حفر غائر، ورنيش موضعي", en: "Foil, deboss, spot varnish" } },
      { icon: "ri-truck-line", title: { ar: "التسليم", en: "Delivery" }, desc: { ar: "إلى المصنع أو مستودعك", en: "To the factory or your warehouse" } },
    ],
    steps: [
      { title: { ar: "فحص الملفات", en: "File check" }, desc: { ar: "الدقة والألوان والقص", en: "Resolution, colour and cut lines" }, time: { ar: "يومان", en: "2 days" } },
      { title: { ar: "البروفة", en: "Proof" }, desc: { ar: "بروفة للاعتماد", en: "Proof for approval" }, time: { ar: "3 أيام", en: "3 days" } },
      { title: { ar: "الطباعة", en: "Print run" }, desc: { ar: "طباعة وتشطيب وتسليم", en: "Print, finish and deliver" }, time: { ar: "أسبوع", en: "1 week" } },
    ],
    packages: [
      { name: { ar: "طباعة", en: "Print" }, note: { ar: "ملفات جاهزة", en: "Ready files" }, price: { ar: "يبدأ من 3,000 ر.س", en: "From SAR 3,000" }, featured: true, features: { ar: ["فحص ملفات", "بروفة", "طباعة وتشطيب"], en: ["File check", "Proof", "Print & finish"] } },
    ],
    addons: { ar: ["تجهيز الملفات للطباعة", "تصوير المطبوعات"], en: ["Prepress file preparation", "Print photography"] },
    faqs: [
      { q: { ar: "هل تفحصون ملفاتي قبل الطباعة؟", en: "Do you check my files first?" }, a: { ar: "نعم، كل ملف يُفحص وتصلك بروفة قبل الطباعة بالكمية.", en: "Yes, every file is checked and you receive a proof before the volume run." } },
    ],
    capabilities: ["print"],
    related: ["C", "E"],
  },
];

export const serviceById = (id: string | undefined) => SERVICE_TRACKS.find((s) => s.id === id);

// أداة "ساعدني أختار": ماذا لديك الآن؟ → المسار المقترح
export const CHOOSER: { key: string; label: Bi; recommend: ServiceTrack["id"] }[] = [
  { key: "idea", label: { ar: "فكرة فقط، وأريد براند كاملاً", en: "Just an idea — I want a full brand" }, recommend: "A" },
  { key: "brand-no-scent", label: { ar: "لدي هوية وأحتاج الرائحة", en: "I have a brand, I need the scent" }, recommend: "B" },
  { key: "scent-no-pack", label: { ar: "لدي عطر وأحتاج العبوة", en: "I have a scent, I need packaging" }, recommend: "C" },
  { key: "need-identity", label: { ar: "أحتاج اسماً وشعاراً", en: "I need a name and logo" }, recommend: "D" },
  { key: "ready", label: { ar: "كل شيء جاهز وأحتاج الإنتاج", en: "Everything's ready — I need production" }, recommend: "E" },
  { key: "print", label: { ar: "لدي ملفات طباعة جاهزة", en: "I have print-ready files" }, recommend: "F" },
];
