import { aiPhoto } from "@/lib/photos";
import type { Creative, Work } from "./types";

// ملفات توضيحية فقط: تظهر للزائر بشارة «ملف توضيحي» وأعمالها «مشروع تصوّري».
// احذفها أو استبدلها بمصمميكم الحقيقيين من /admin/creatives.

const T = "2026-01-01T00:00:00.000Z";
const p = (subject: string, seq: string, w = 1200, h = 1500) => aiPhoto(subject, `crea-${seq}`, w, h);

export const SEED_CREATIVES: Creative[] = [
  {
    id: "CR-REEM",
    slug: "reem-studio",
    name: { ar: "ريم · استوديو الهوية", en: "Reem · Identity studio" },
    title: { ar: "مصممة هوية بصرية وملصقات", en: "Brand identity & label designer" },
    bio: {
      ar: "تبني هويات عطرية تبدأ من الحكاية: الاسم، والحرف العربي، ونظام الألوان، ثم الملصق الذي يحملها على العبوة. تميل إلى البساطة الفاخرة والخط العربي المعاصر.",
      en: "Builds fragrance identities that start from the story: the name, Arabic letterforms and colour system, then the label that carries it. Leans towards quiet luxury and contemporary Arabic type.",
    },
    city: { ar: "الرياض", en: "Riyadh" },
    specialties: ["identity", "label"],
    yearsExp: 8,
    rateFrom: 6000,
    turnaroundDays: 14,
    avatar: null,
    available: true,
    featured: true,
    published: true,
    sample: true,
    profileId: null,
    sort: 1,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "CR-FAISAL",
    slug: "faisal-pack",
    name: { ar: "فيصل · تغليف وثلاثي الأبعاد", en: "Faisal · Packaging & 3D" },
    title: { ar: "مصمم تغليف ومجسمات ثلاثية الأبعاد", en: "Packaging & 3D designer" },
    bio: {
      ar: "يصمم العلب الصلبة والمغناطيسية ومخططات القص الجاهزة للمطبعة، ويقدّم تصييراً واقعياً قبل الإنتاج حتى تُعتمد العلبة دون عينات مكلفة.",
      en: "Designs rigid and magnetic boxes with print-ready dielines, and delivers photoreal renders before production so the box is approved without costly samples.",
    },
    city: { ar: "جدة", en: "Jeddah" },
    specialties: ["packaging", "3d"],
    yearsExp: 11,
    rateFrom: 9000,
    turnaroundDays: 21,
    avatar: null,
    available: true,
    featured: true,
    published: true,
    sample: true,
    profileId: null,
    sort: 2,
    createdAt: T,
    updatedAt: T,
  },
  {
    id: "CR-LINA",
    slug: "lina-objects",
    name: { ar: "لينا · عبوات وتصوير", en: "Lina · Bottles & photography" },
    title: { ar: "مصممة عبوات ومصورة منتجات", en: "Bottle designer & product photographer" },
    bio: {
      ar: "تصمم أشكال العبوات والأغطية بالتعاون مع المصانع، ثم تصوّرها بإضاءة تحريرية لإطلاق البراند على المتاجر ووسائل التواصل.",
      en: "Designs bottle and cap forms with manufacturers, then shoots them in editorial light for store and social launches.",
    },
    city: { ar: "الخبر", en: "Khobar" },
    specialties: ["bottle", "photo"],
    yearsExp: 6,
    rateFrom: 4500,
    turnaroundDays: 10,
    avatar: null,
    available: false,
    featured: false,
    published: true,
    sample: true,
    profileId: null,
    sort: 3,
    createdAt: T,
    updatedAt: T,
  },
];

const w = (id: string, creativeId: string, category: Work["category"], ar: string, en: string, sumAr: string, sumEn: string, images: string[], year: number, sort: number): Work => ({
  id,
  creativeId,
  title: { ar, en },
  summary: { ar: sumAr, en: sumEn },
  category,
  images,
  client: null,
  concept: true,
  year,
  published: true,
  sort,
  createdAt: T,
  updatedAt: T,
});

export const SEED_WORKS: Work[] = [
  w("W-R1", "CR-REEM", "identity", "هوية «سَهم»", "“Sahm” identity", "شعار بالخط الكوفي المعاصر ونظام ألوان من الجلد والبخور.", "A contemporary Kufic logotype with a leather-and-incense palette.",
    [p("perfume brand identity guidelines book with arabic kufic logo, black and tan palette, on linen desk", "r1a"), p("perfume brand stationery set with arabic logo, business cards and wax seal, flat lay", "r1b", 1500, 1200)], 2025, 1),
  w("W-R2", "CR-REEM", "label", "ملصقات «ثمر»", "“Thamar” labels", "ملصق ورق قطني بطباعة بارزة وفويل نحاسي.", "Cotton-paper label with letterpress and copper foil.",
    [p("close up of minimal perfume label on frosted glass bottle, letterpress cotton paper with copper foil", "r2a"), p("label proofs and pantone swatches for perfume on designer desk", "r2b", 1500, 1200)], 2025, 2),
  w("W-R3", "CR-REEM", "identity", "هوية «نور»", "“Noor” identity", "هوية زهرية خفيفة بحرف عربي رفيع.", "A light floral identity with fine Arabic letterforms.",
    [p("white perfume box and label with fine arabic calligraphy logo, floral petals, soft morning light", "r3a")], 2024, 3),
  w("W-F1", "CR-FAISAL", "packaging", "علبة مغناطيسية «أطلس»", "“Atlas” magnetic box", "علبة صلبة بغطاء مغناطيسي وبطانة مخملية.", "Rigid magnetic box with a velvet-lined insert.",
    [p("luxury black magnetic perfume box open with velvet insert holding amber bottle, studio light", "f1a"), p("closed matte black rigid perfume box with gold foil logo on stone", "f1b", 1500, 1200)], 2025, 1),
  w("W-F2", "CR-FAISAL", "3d", "تصيير «بحر»", "“Bahr” renders", "تصيير واقعي للعبوة والعلبة قبل الإنتاج.", "Photoreal render of bottle and box before production.",
    [p("photoreal 3d render of pale blue perfume bottle and white box on sand, soft shadows", "f2a", 1500, 1200)], 2025, 2),
  w("W-F3", "CR-FAISAL", "packaging", "علبة درج «قهوة»", "“Qahwa” drawer box", "علبة درج من الكرافت بفتحة إبهام وطباعة بنية.", "Kraft drawer box with thumb notch and brown print.",
    [p("kraft paper drawer perfume box half open with dark glass bottle inside, coffee beans around", "f3a")], 2024, 3),
  w("W-L1", "CR-LINA", "bottle", "عبوة «قهوة»", "“Qahwa” bottle", "عبوة كروية قصيرة بزجاج بني وغطاء خشبي.", "Squat round bottle in brown glass with a wooden cap.",
    [p("squat round dark brown glass perfume bottle with walnut wood cap, seamless beige background", "l1a")], 2025, 1),
  w("W-L2", "CR-LINA", "photo", "جلسة تصوير «أطلس»", "“Atlas” shoot", "تصوير تحريري بضوء النافذة على الترافرتين.", "Editorial window-light shoot on travertine.",
    [p("amber perfume bottle on raw travertine stone with long window shadow, editorial photography", "l2a", 1500, 1200), p("perfume bottle with cedar chips and dried flowers, editorial still life", "l2b")], 2024, 2),
];
