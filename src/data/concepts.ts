// نماذج تصوّرية توضّح مخرجات المسارات — ليست مشاريع عملاء
import type { Bi } from "@/i18n/context";
import type { ServiceTrack } from "./services";
import { PHOTOS } from "@/lib/photos";

export interface Concept {
  name: Bi;
  notes: Bi;
  family: Bi;
  track: ServiceTrack["id"];
  photo: string;
}

export const CONCEPTS: Concept[] = [
  { name: { ar: "أطلس", en: "Atlas" }, notes: { ar: "عنبر، خشب الأرز، ملح", en: "Amber, cedarwood, salt" }, family: { ar: "خشبي عنبري", en: "Woody amber" }, track: "A", photo: PHOTOS.atlas },
  { name: { ar: "ثمر", en: "Thamar" }, notes: { ar: "تين، حليب اللوز، مسك", en: "Fig, almond milk, musk" }, family: { ar: "فاكهي ناعم", en: "Soft fruity" }, track: "B", photo: PHOTOS.thamar },
  { name: { ar: "سَهم", en: "Sahm" }, notes: { ar: "بخور، جلد، فلفل أسود", en: "Incense, leather, black pepper" }, family: { ar: "جلدي حار", en: "Spicy leather" }, track: "C", photo: PHOTOS.sahm },
  { name: { ar: "نور", en: "Noor" }, notes: { ar: "زهر البرتقال، ياسمين، مسك أبيض", en: "Orange blossom, jasmine, white musk" }, family: { ar: "زهري", en: "Floral" }, track: "D", photo: PHOTOS.noor },
  { name: { ar: "قهوة", en: "Qahwa" }, notes: { ar: "قهوة، هيل، فانيليا", en: "Coffee, cardamom, vanilla" }, family: { ar: "شرقي دافئ", en: "Warm oriental" }, track: "A", photo: PHOTOS.qahwa },
  { name: { ar: "بحر", en: "Bahr" }, notes: { ar: "ملح البحر، مريمية، خشب الطفو", en: "Sea salt, sage, driftwood" }, family: { ar: "منعش", en: "Fresh aquatic" }, track: "B", photo: PHOTOS.bahr },
];
