// متطلبات التصنيع لكل مسار، ومتطلبات التصدير من السعودية إلى العالم.
// المصدر الوحيد لما يحتاجه المصنع من العميل (ليبدأ)، وما يسلّمه المصنع (ليكتمل)، وما يلزم كل شحنة خارج المملكة.
import type { Bi } from "../i18n/context";
import type { ServiceTrack } from "./services";

type TrackId = ServiceTrack["id"];

export interface Requirement {
  id: string;
  /** من يوفّره */
  who: "client" | "factory";
  /** متى يلزم */
  phase: "start" | "approval" | "production" | "delivery";
  label: Bi;
  desc: Bi;
  icon: string;
  /** إلزامي للبدء أو الإنتاج */
  required?: boolean;
}

const r = (id: string, who: Requirement["who"], phase: Requirement["phase"], icon: string, ar: string, en: string, dar: string, den: string, required = true): Requirement => ({ id, who, phase, icon, label: { ar, en }, desc: { ar: dar, en: den }, required });

// مشتركة
const BRAND = r("brand", "client", "start", "ri-trademark-line", "اسم البراند وحالته", "Brand name & status", "مسجّل أو قيد التسجيل في الهيئة السعودية للملكية الفكرية — نساعد في الفحص والتسجيل", "Registered or filing with SAIP — we help with search and filing");
const QTY = r("qty", "client", "start", "ri-stack-line", "الكمية والأحجام", "Volume & sizes", "عدد الزجاجات لكل حجم في الدفعة الأولى — يحدد السعر والمواعيد والحد الأدنى", "Bottles per size in the first run — sets price, timing and minimums");
const MARKET = r("market", "client", "start", "ri-earth-line", "السوق المستهدف", "Target market", "الدولة أو الدول التي سيُباع فيها: تحدد الملصق والتسجيل وطريقة الشحن", "Where it sells: drives the label, registration and shipping");
const ARTWORK = r("artwork", "client", "approval", "ri-file-paper-2-line", "ملفات التصميم للطباعة", "Print-ready artwork", "PDF بالألوان CMYK مع هامش قص 3 مم وخطوط محوّلة — أو نجهّزها من هويتك", "CMYK PDF with 3 mm bleed and outlined fonts — or we prepare it from your identity");
const SAMPLE_OK = r("sample_ok", "client", "approval", "ri-checkbox-circle-line", "اعتماد العينة الفعلية", "Physical sample approval", "توقيع على العينة المرجعية (رائحة، لون، عبوة) قبل أي إنتاج بالكمية", "Sign-off on the reference sample (scent, colour, pack) before any volume run");
const COA = r("coa", "factory", "production", "ri-file-shield-2-line", "شهادة تحليل (COA) لكل تشغيلة", "Certificate of analysis per batch", "الكثافة، الانكسار، اللون، ونسبة الكحول — تُرفق بكل دفعة", "Density, refractive index, colour and alcohol content — with every batch");
const MSDS = r("msds", "factory", "production", "ri-flask-line", "نشرة السلامة (SDS) وبيان المسببات", "SDS & allergen declaration", "مطلوبة للشحن الجوي والتسجيل في أغلب الدول", "Needed for air freight and registration in most markets");
const BATCH = r("batch", "factory", "production", "ri-barcode-line", "رقم التشغيلة والباركود", "Batch number & barcode", "رقم تشغيلة على كل وحدة وباركود GS1 على العلبة والكرتون", "A batch code on every unit and a GS1 barcode on box and carton");
const QC = r("qc", "factory", "production", "ri-microscope-line", "تقرير فحص الجودة", "Quality inspection report", "فحص عشوائي للتعبئة والإغلاق والطباعة وفق AQL قبل الشحن", "AQL sampling of fill, closure and print before shipping");
const SFDA = r("sfda", "factory", "delivery", "ri-government-line", "إشعار هيئة الغذاء والدواء (SFDA)", "SFDA cosmetics notification", "تسجيل المنتج في نظام «كوزميتكس» قبل البيع داخل المملكة — نقدّمه عنك", "Product notification in the SFDA cosmetics system before selling in KSA — filed for you");

export const REQUIREMENTS: Record<TrackId, Requirement[]> = {
  A: [
    BRAND,
    MARKET,
    r("positioning", "client", "start", "ri-compass-3-line", "الجمهور والسعر المستهدف", "Audience & target price", "لمن العطر وبكم سيُباع — تُبنى عليه التركيبة والعبوة", "Who it's for and at what price — the formula and pack follow from it"),
    QTY,
    r("refs", "client", "start", "ri-sparkling-2-line", "عطور مرجعية", "Reference scents", "ثلاثة عطور تحبها (أو عينة) لتحديد الاتجاه", "Three scents you love (or a sample) to set the direction", false),
    SAMPLE_OK,
    r("identity_ok", "client", "approval", "ri-palette-line", "اعتماد الهوية والعبوة", "Identity & pack approval", "الشعار والنظام البصري ونموذج العبوة الملموس", "Logo, visual system and the physical pack prototype"),
    COA, MSDS, BATCH, QC, SFDA,
    r("launch", "factory", "delivery", "ri-rocket-2-line", "حزمة الإطلاق", "Launch kit", "صور المنتج، نصوص المتجر، وخطة أول 90 يوماً", "Product photos, store copy and a first-90-days plan"),
  ],
  B: [
    r("brief_scent", "client", "start", "ri-file-text-line", "بريف الرائحة", "Scent brief", "العائلة والمزاج والجمهور — أو تركيبتك من المكوّن", "Family, mood and audience — or your composition from the composer"),
    r("ref_sample", "client", "start", "ri-test-tube-line", "عينة مرجعية (إن وُجدت)", "Reference sample (if any)", "عطر قائم تريد تطويره أو الاقتراب منه", "An existing scent to develop or approach", false),
    r("conc", "client", "start", "ri-drop-line", "التركيز والحجم", "Concentration & size", "EDP أو EDT أو زيت — ونسبة التركيز المستهدفة", "EDP, EDT or oil — and the target concentration"),
    MARKET,
    r("rounds", "factory", "approval", "ri-loop-left-line", "جولات العينات", "Sample rounds", "عينات مرقّمة مع استمارة تقييم حتى الاعتماد", "Numbered samples with an evaluation form until approval"),
    SAMPLE_OK,
    r("formula_file", "factory", "delivery", "ri-lock-2-line", "ملف التركيبة والمواصفات", "Formula & specification file", "التركيبة بأمانة المصنع، ومواصفات الإنتاج والتسجيل باسم العميل", "The formula held in escrow by the factory; production and registration specs in the client's name"),
    r("stability", "factory", "delivery", "ri-time-line", "تقرير الثبات", "Stability report", "ثبات اللون والرائحة تحت الحرارة والضوء 4 أسابيع", "Colour and scent stability under heat and light for 4 weeks"),
    MSDS,
  ],
  C: [
    r("bottle_spec", "client", "start", "ri-shapes-line", "مواصفة العبوة من الاستوديو", "Bottle spec from the studio", "الشكل والحجم والغطاء والمضخة والزخرفة — تُرفق تلقائياً من لوحة العمل", "Shape, size, cap, pump and decoration — attached automatically from the workspace"),
    r("box_spec", "client", "start", "ri-archive-line", "العلبة وملحقاتها", "Box & extras", "النوع والمقاس والخامة والملحقات (حشوة، بطاقات…)", "Style, size, board and extras (insert, cards…)"),
    QTY,
    r("logo_files", "client", "approval", "ri-image-line", "الشعار بصيغة متجهة", "Vector logo", "AI أو SVG أو PDF — للفويل والطباعة الحريرية", "AI, SVG or PDF — needed for foil and screen printing"),
    ARTWORK,
    r("proto_ok", "client", "approval", "ri-box-3-line", "اعتماد النموذج الملموس", "Prototype approval", "علبة وملصق مطبوعان على الخامة الفعلية قبل الكمية", "A box and label printed on the real material before the run"),
    r("dielines", "factory", "delivery", "ri-scissors-cut-line", "مخططات القص وملفات الإنتاج", "Dielines & production files", "SVG/PDF للعلبة والملصق بمقاسات الإنتاج — ملك العميل", "SVG/PDF for box and label at production size — owned by the client"),
    BATCH, QC,
  ],
  D: [
    r("brand_brief", "client", "start", "ri-chat-3-line", "بريف الهوية", "Identity brief", "الطابع والجمهور والمنافسون — من أسئلة البدء", "Style, audience and competitors — from the start questions"),
    r("naming", "client", "start", "ri-font-size", "الاسم أو خيارات التسمية", "Name or naming options", "اسم محسوم، أو نقترح ونفحص توافره", "A final name, or we propose and check availability"),
    BRAND,
    r("concepts_ok", "client", "approval", "ri-checkbox-multiple-line", "اختيار المفهوم", "Concept selection", "من ثلاثة مفاهيم في الجولة الأولى", "From three concepts in round one"),
    r("guidelines", "factory", "delivery", "ri-book-open-line", "دليل الهوية والملفات الأصلية", "Guidelines & source files", "AI/SVG/PNG بالعربية والإنجليزية، وقواعد الاستخدام", "AI/SVG/PNG in Arabic and English, with usage rules"),
    r("tm_file", "factory", "delivery", "ri-shield-star-line", "ملف تسجيل العلامة", "Trademark filing pack", "الشعار بالفئة 3 جاهز للإيداع في السعودية أو دولياً (مدريد)", "The mark in class 3, ready to file in KSA or internationally (Madrid)", false),
  ],
  E: [
    r("formula_src", "client", "start", "ri-flask-line", "التركيبة أو الزيت العطري", "Formula or fragrance oil", "تركيبتك، أو مورّد الزيت مع نشرة السلامة — أو نطوّرها (المسار B)", "Your formula, or the oil supplier with its SDS — or we develop it (track B)"),
    r("pack_src", "client", "start", "ri-archive-line", "العبوات والعلب", "Bottles & boxes", "جاهزة لديك (نستلمها) أو من كتالوجنا أو مصنّعة لك (المسار C)", "Yours (we receive them), from our catalogue, or made for you (track C)"),
    QTY,
    MARKET,
    r("calc", "client", "start", "ri-calculator-line", "أرقام الحاسبة", "Calculator figures", "الكمية والسرعة والتقدير — تُرفق من لوحة العمل", "Volume, turnaround and estimate — attached from the workspace", false),
    SAMPLE_OK,
    r("pilot", "factory", "production", "ri-settings-3-line", "تشغيلة تجريبية", "Pilot run", "50 – 100 وحدة لضبط التعبئة والإغلاق والملصق قبل الكمية", "50 – 100 units to tune fill, closure and labelling before the run"),
    COA, MSDS, BATCH, QC, SFDA,
    r("packing_list", "factory", "delivery", "ri-truck-line", "قائمة التعبئة وشهادة المنشأ", "Packing list & certificate of origin", "للشحن داخل المملكة وخارجها — مع رمز HS 3303", "For domestic and export shipping — with HS code 3303"),
  ],
  F: [
    r("items", "client", "start", "ri-printer-line", "قائمة المطبوعات والكميات", "Print items & quantities", "ملصقات، علب، بطاقات، أكياس — لكل صنف كميته", "Labels, boxes, cards, bags — with a quantity per item"),
    ARTWORK,
    r("logo_files", "client", "approval", "ri-image-line", "الشعار بصيغة متجهة", "Vector logo", "AI أو SVG أو PDF — للفويل والنقش", "AI, SVG or PDF — for foil and embossing"),
    r("proof_ok", "client", "approval", "ri-eye-line", "اعتماد البروفة المطبوعة", "Printed proof approval", "بروفة على الخامة الفعلية بالألوان النهائية", "A proof on the real stock in final colours"),
    r("dielines", "factory", "delivery", "ri-scissors-cut-line", "مخططات القص", "Dielines", "تُسلَّم مع كل علبة وملصق", "Delivered with every box and label"),
    QC,
    r("delivery", "factory", "delivery", "ri-truck-line", "التسليم في كراتين مرقّمة", "Delivery in numbered cartons", "كل صنف في كرتونه بالكمية والباركود", "Each item in its own carton with quantity and barcode"),
  ],
};

// ─── التصدير من السعودية إلى العالم ──────────────────────────────
export interface ExportItem {
  id: string;
  icon: string;
  title: Bi;
  desc: Bi;
}

/** ما تحمله كل شحنة خارج المملكة، وما يختاره العميل */
export const EXPORT: { docs: ExportItem[]; shipping: ExportItem[]; incoterms: ExportItem[]; markets: ExportItem[] } = {
  docs: [
    { id: "ci", icon: "ri-bill-line", title: { ar: "فاتورة تجارية وقائمة تعبئة", en: "Commercial invoice & packing list" }, desc: { ar: "بالرمز الجمركي 3303.00 وبلد المنشأ السعودية", en: "With HS code 3303.00 and origin Saudi Arabia" } },
    { id: "coo", icon: "ri-award-line", title: { ar: "شهادة منشأ", en: "Certificate of origin" }, desc: { ar: "من الغرفة التجارية — تخفّض الرسوم في دول الاتفاقيات", en: "From the chamber of commerce — lowers duties under trade agreements" } },
    { id: "sds", icon: "ri-flask-line", title: { ar: "نشرة سلامة (SDS) وبيان IFRA", en: "SDS & IFRA statement" }, desc: { ar: "العطور بضائع خطرة في الجو (UN1266) — تُشحن بتغليف معتمد", en: "Perfume is air-cargo dangerous goods (UN1266) — shipped in certified packing" } },
    { id: "reg", icon: "ri-government-line", title: { ar: "تسجيل المنتج في السوق المستهدف", en: "Product registration in the target market" }, desc: { ar: "CPNP في أوروبا، SCPN في بريطانيا، إشعار FDA اختياري في أمريكا، وتسجيلات الخليج — نجهّز الملف", en: "CPNP in the EU, SCPN in the UK, optional FDA listing in the US, and GCC registrations — we prepare the file" } },
  ],
  shipping: [
    { id: "air", icon: "ri-flight-takeoff-line", title: { ar: "جوي سريع (DHL / Aramex)", en: "Express air (DHL / Aramex)" }, desc: { ar: "3 – 7 أيام — للعينات والدفعات حتى 200 كغ", en: "3 – 7 days — samples and runs up to 200 kg" } },
    { id: "cargo", icon: "ri-plane-line", title: { ar: "شحن جوي عام", en: "Air cargo" }, desc: { ar: "7 – 12 يوماً — للدفعات المتوسطة", en: "7 – 12 days — mid-size runs" } },
    { id: "sea", icon: "ri-ship-line", title: { ar: "بحري (LCL / FCL)", en: "Sea (LCL / FCL)" }, desc: { ar: "25 – 45 يوماً من جدة أو الدمام — الأوفر للكميات الكبيرة", en: "25 – 45 days from Jeddah or Dammam — the most economical at volume" } },
    { id: "land", icon: "ri-truck-line", title: { ar: "بري للخليج", en: "Road to the GCC" }, desc: { ar: "3 – 6 أيام للإمارات والكويت والبحرين وقطر وعُمان", en: "3 – 6 days to the UAE, Kuwait, Bahrain, Qatar and Oman" } },
  ],
  incoterms: [
    { id: "exw", icon: "ri-building-2-line", title: { ar: "EXW — من باب المصنع", en: "EXW — ex works" }, desc: { ar: "تستلم شركة الشحن التي تختارها من مستودعنا", en: "Your forwarder collects from our warehouse" } },
    { id: "fob", icon: "ri-anchor-line", title: { ar: "FOB — على ظهر السفينة/الطائرة", en: "FOB — on board" }, desc: { ar: "نتولى التخليص والتسليم إلى الميناء أو المطار السعودي", en: "We clear and deliver to the Saudi port or airport" } },
    { id: "dap", icon: "ri-map-pin-line", title: { ar: "DAP — حتى عنوانك", en: "DAP — delivered at place" }, desc: { ar: "نشحن حتى بابك، والرسوم الجمركية في بلدك عليك", en: "We ship to your door; import duties in your country are yours" } },
    { id: "ddp", icon: "ri-hand-coin-line", title: { ar: "DDP — شامل الرسوم", en: "DDP — duties paid" }, desc: { ar: "سعر واحد شامل الشحن والجمارك — متاح للخليج وأوروبا وبريطانيا", en: "One price including freight and duties — GCC, EU and UK" } },
  ],
  markets: [
    { id: "gcc", icon: "ri-sun-line", title: { ar: "الخليج", en: "GCC" }, desc: { ar: "ملصق عربي/إنجليزي، تسجيل في كل دولة، شحن بري", en: "Arabic/English label, per-country registration, road freight" } },
    { id: "eu", icon: "ri-euro-circle-line", title: { ar: "أوروبا وبريطانيا", en: "EU & UK" }, desc: { ar: "CPNP/SCPN، شخص مسؤول محلي، INCI ومسببات الحساسية الـ26", en: "CPNP/SCPN, a local responsible person, INCI and the 26 allergens" } },
    { id: "us", icon: "ri-flag-line", title: { ar: "أمريكا الشمالية", en: "North America" }, desc: { ar: "ملصق FDA بالأونصة والمل، وتسجيل اختياري", en: "FDA labelling in fl oz and ml, optional listing" } },
    { id: "asia", icon: "ri-global-line", title: { ar: "آسيا وأفريقيا", en: "Asia & Africa" }, desc: { ar: "متطلبات تسجيل تختلف لكل دولة — نراجعها قبل العرض", en: "Registration varies by country — reviewed before the quote" } },
  ],
};

export const PHASES: { id: Requirement["phase"]; label: Bi }[] = [
  { id: "start", label: { ar: "للبدء", en: "To start" } },
  { id: "approval", label: { ar: "للاعتماد", en: "To approve" } },
  { id: "production", label: { ar: "في الإنتاج", en: "In production" } },
  { id: "delivery", label: { ar: "عند التسليم", en: "On delivery" } },
];
