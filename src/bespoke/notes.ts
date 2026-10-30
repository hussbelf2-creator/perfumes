// «عطرك الخاص»: مكتبة المكونات للأفراد. كل مكوّن في طبقة واحدة من الهرم العطري (مقدمة، قلب، قاعدة)
// مع عائلته وقوته (1 خفيف … 3 طاغٍ)، والنادر منها (العود، الزعفران، الورد الطائفي…) يُسعَّر بإضافة.
// الاستيراد نسبي: دالة الإشعار على الخادم (api/) تعرض الطلب بنصوص هذا الملف.
import type { Bi } from "../i18n/context";

export type Layer = "top" | "heart" | "base";
export type Family = "fresh" | "floral" | "spicy" | "woody" | "amber" | "musk" | "sweet";
export type Concentration = "edp" | "extrait" | "oil";
export type Mode = "video" | "whatsapp" | "studio";
export type Purpose = "self" | "gift" | "occasion";

export interface Note {
  id: string;
  name: Bi;
  layer: Layer;
  family: Family;
  strength: 1 | 2 | 3;
  premium?: boolean;
  /** وصف حسّي قصير */
  feel: Bi;
}

const n = (id: string, ar: string, en: string, layer: Layer, family: Family, strength: 1 | 2 | 3, feelAr: string, feelEn: string, premium = false): Note => ({
  id,
  name: { ar, en },
  layer,
  family,
  strength,
  premium: premium || undefined,
  feel: { ar: feelAr, en: feelEn },
});

export const NOTES: Note[] = [
  // المقدمة: أول ما يُشم، تتبخر خلال نصف ساعة
  n("bergamot", "برغموت", "Bergamot", "top", "fresh", 1, "حمضي مشرق بلمسة مرّة", "Bright citrus with a bitter edge"),
  n("lemon", "ليمون", "Lemon", "top", "fresh", 1, "نظيف وحاد ومنعش", "Clean, sharp and zesty"),
  n("mandarin", "يوسفي", "Mandarin", "top", "fresh", 1, "حمضي حلو ودود", "Sweet, friendly citrus"),
  n("grapefruit", "جريب فروت", "Grapefruit", "top", "fresh", 1, "حمضي عصري فوّار", "Modern, sparkling citrus"),
  n("mint", "نعناع", "Mint", "top", "fresh", 1, "بارد وأخضر", "Cool and green"),
  n("lavender", "خزامى", "Lavender", "top", "fresh", 1, "عشبي هادئ ونظيف", "Calm, clean herb"),
  n("pink_pepper", "فلفل وردي", "Pink pepper", "top", "spicy", 1, "حرارة خفيفة لامعة", "A light, sparkling heat"),
  n("cardamom", "هيل", "Cardamom", "top", "spicy", 2, "دافئ ومألوف كفنجال القهوة", "Warm and familiar, like Arabic coffee"),
  n("saffron", "زعفران", "Saffron", "top", "spicy", 2, "جلدي ذهبي فاخر", "Golden, leathery and luxurious", true),
  // القلب: هوية العطر، يظهر بعد دقائق ويبقى ساعات
  n("rose_taifi", "ورد طائفي", "Taif rose", "heart", "floral", 2, "وردي عميق برائحة الطائف", "Deep rose from Taif", true),
  n("jasmine", "فل (ياسمين سامباك)", "Arabian jasmine (sambac)", "heart", "floral", 2, "زهري أبيض دافئ", "Warm white floral"),
  n("orange_blossom", "زهر البرتقال", "Orange blossom", "heart", "floral", 1, "زهري مضيء ونظيف", "Luminous, clean floral"),
  n("tuberose", "مسك الروم (توبيروز)", "Tuberose", "heart", "floral", 3, "زهري كريمي جريء", "Creamy, bold floral"),
  n("iris", "سوسن", "Iris", "heart", "floral", 1, "بودري ناعم كالمخمل", "Soft, powdery, velvety", true),
  n("geranium", "عطرة", "Geranium", "heart", "floral", 1, "وردي أخضر منعش", "Fresh, green rose"),
  n("cinnamon", "قرفة", "Cinnamon", "heart", "spicy", 2, "دافئ حار وحلو", "Warm, spicy-sweet"),
  n("frankincense", "لبان ظفاري", "Dhofari frankincense", "heart", "amber", 2, "راتنجي ليموني روحاني", "Resinous, lemony, serene"),
  n("coffee", "قهوة", "Coffee", "heart", "sweet", 2, "محمّص ودافئ", "Roasted and warm"),
  // القاعدة: ما يبقى على الجلد والثوب، يحدد الثبات
  n("oud_cambodi", "عود كمبودي", "Cambodian oud", "base", "woody", 3, "عود حلو فاكهي عميق", "Sweet, fruity, deep oud", true),
  n("oud_hindi", "عود هندي", "Indian oud", "base", "woody", 3, "عود حيواني دخاني قوي", "Animalic, smoky, powerful oud", true),
  n("sandalwood", "صندل", "Sandalwood", "base", "woody", 2, "خشبي كريمي ناعم", "Creamy, smooth wood"),
  n("cedar", "أرز", "Cedar", "base", "woody", 1, "خشبي جاف أنيق", "Dry, elegant wood"),
  n("vetiver", "نجيل الهند (فيتيفر)", "Vetiver", "base", "woody", 1, "ترابي أخضر مدخّن", "Earthy, green, smoky"),
  n("patchouli", "باتشولي", "Patchouli", "base", "woody", 2, "ترابي داكن", "Dark and earthy"),
  n("leather", "جلد", "Leather", "base", "woody", 3, "جلدي جريء", "Bold leather"),
  n("amber", "عنبر", "Amber", "base", "amber", 2, "دافئ راتنجي حلو", "Warm, resinous, sweet"),
  n("ambergris", "عنبر رمادي", "Ambergris", "base", "amber", 2, "مالح دافئ يدوم طويلاً", "Salty, warm and long-lasting", true),
  n("bakhoor", "بخور", "Bakhoor", "base", "amber", 3, "دخان البخور في المجلس", "Bakhoor smoke in the majlis"),
  n("white_musk", "مسك أبيض", "White musk", "base", "musk", 1, "نظيف كالقطن", "Clean like fresh cotton"),
  n("musk_tahara", "مسك الطهارة", "Tahara musk", "base", "musk", 1, "ناعم بودري مألوف", "Soft, powdery and familiar"),
  n("vanilla", "فانيليا", "Vanilla", "base", "sweet", 2, "حلو دافئ مريح", "Sweet, warm and comforting"),
  n("tonka", "تونكا", "Tonka bean", "base", "sweet", 2, "لوزي بالكراميل", "Almond and caramel"),
];

export const LAYERS: { id: Layer; label: Bi; hint: Bi }[] = [
  { id: "top", label: { ar: "المقدمة", en: "Top" }, hint: { ar: "أول انطباع — يتبخر خلال نصف ساعة", en: "First impression — fades within half an hour" } },
  { id: "heart", label: { ar: "القلب", en: "Heart" }, hint: { ar: "شخصية العطر — يظهر بعد دقائق ويبقى ساعات", en: "The character — arrives after minutes, stays for hours" } },
  { id: "base", label: { ar: "القاعدة", en: "Base" }, hint: { ar: "ما يبقى على الجلد والثوب — يحدد الثبات", en: "What stays on skin and fabric — sets the longevity" } },
];

export const FAMILIES: Record<Family, Bi> = {
  fresh: { ar: "منعش", en: "Fresh" },
  floral: { ar: "زهري", en: "Floral" },
  spicy: { ar: "توابل", en: "Spicy" },
  woody: { ar: "خشبي وعود", en: "Woody & oud" },
  amber: { ar: "عنبري وشرقي", en: "Amber & oriental" },
  musk: { ar: "مسكي نظيف", en: "Clean musk" },
  sweet: { ar: "دافئ وحلو", en: "Warm & sweet" },
};

export const CONCENTRATIONS: { id: Concentration; label: Bi; note: Bi; sizes: number[] }[] = [
  { id: "edp", label: { ar: "أو دو بارفان", en: "Eau de parfum" }, note: { ar: "بخاخ يومي متوازن", en: "A balanced daily spray" }, sizes: [30, 50, 100] },
  { id: "extrait", label: { ar: "إكستريه (مركّز)", en: "Extrait (concentrated)" }, note: { ar: "بخاخ أقوى وأثبت", en: "A stronger, longer-lasting spray" }, sizes: [30, 50, 100] },
  { id: "oil", label: { ar: "دهن عطري", en: "Perfume oil" }, note: { ar: "بلا كحول، يوضع باللمس", en: "Alcohol-free, applied by touch" }, sizes: [6, 12, 24] },
];

export const MODES: { id: Mode; icon: string; label: Bi; note: Bi }[] = [
  { id: "video", icon: "ri-vidicon-line", label: { ar: "مكالمة فيديو", en: "Video call" }, note: { ar: "30 دقيقة مع المستشار", en: "30 minutes with the consultant" } },
  { id: "whatsapp", icon: "ri-whatsapp-line", label: { ar: "محادثة واتساب", en: "WhatsApp chat" }, note: { ar: "بالرسائل والصوت، على راحتك", en: "Text and voice notes, at your pace" } },
  { id: "studio", icon: "ri-store-2-line", label: { ar: "زيارة الاستوديو", en: "Studio visit" }, note: { ar: "تشم المكونات بنفسك قبل التكوين", en: "Smell the materials yourself before blending" } },
];

export const PURPOSES: { id: Purpose; label: Bi }[] = [
  { id: "self", label: { ar: "لي", en: "For me" } },
  { id: "gift", label: { ar: "هدية", en: "A gift" } },
  { id: "occasion", label: { ar: "مناسبة (زواج، تخرج…)", en: "An occasion (wedding, graduation…)" } },
];

/** نقاط بداية جاهزة — يعدّلها العميل كما يشاء */
export const PRESETS: { id: string; name: Bi; story: Bi; notes: string[] }[] = [
  { id: "taif_nights", name: { ar: "ليالي الطائف", en: "Taif nights" }, story: { ar: "ورد وزعفران فوق عود كمبودي", en: "Rose and saffron over Cambodian oud" }, notes: ["saffron", "rose_taifi", "oud_cambodi", "amber"] },
  { id: "najdi_morning", name: { ar: "صباح نجدي", en: "Najdi morning" }, story: { ar: "حمضيات وهيل ومسك نظيف", en: "Citrus, cardamom and clean musk" }, notes: ["bergamot", "cardamom", "orange_blossom", "white_musk", "cedar"] },
  { id: "majlis", name: { ar: "المجلس", en: "The majlis" }, story: { ar: "قهوة وبخور ولبان", en: "Coffee, bakhoor and frankincense" }, notes: ["cardamom", "coffee", "frankincense", "bakhoor", "sandalwood"] },
  { id: "velvet", name: { ar: "مخمل", en: "Velvet" }, story: { ar: "سوسن وفانيليا ومسك ناعم", en: "Iris, vanilla and soft musk" }, notes: ["pink_pepper", "iris", "jasmine", "vanilla", "musk_tahara"] },
];

export const noteById = (id: string) => NOTES.find((x) => x.id === id);
export const MAX_PER_LAYER = 3;
export const NAME_MAX = 20;
