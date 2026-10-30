import { useI18n } from "@/i18n/context";

const NOTES = [
  { ar: "عود كمبودي", en: "Cambodian oud" },
  { ar: "ورد طائفي", en: "Taif rose" },
  { ar: "عنبر رمادي", en: "Ambergris" },
  { ar: "زعفران", en: "Saffron" },
  { ar: "مسك أبيض", en: "White musk" },
  { ar: "خشب الأرز", en: "Cedarwood" },
  { ar: "برغموت", en: "Bergamot" },
  { ar: "لبان عُماني", en: "Omani frankincense" },
  { ar: "فانيليا مدغشقر", en: "Madagascar vanilla" },
  { ar: "جلد", en: "Leather" },
  { ar: "تين", en: "Fig" },
  { ar: "فلفل وردي", en: "Pink pepper" },
];

// شريط نوتات عطرية يتحرك ببطء — يتوقف عند المرور عليه
const NotesMarquee = () => {
  const { t, pick } = useI18n();
  const names = NOTES.map(pick);
  return (
    <div className="marquee-wrap relative bg-accent2 text-white overflow-hidden py-5" aria-label={t("أمثلة على نوتات عطرية نعمل بها", "Examples of notes we work with")}>
      <div className="marquee" aria-hidden="true">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex items-center shrink-0">
            {names.map((n) => (
              <li key={`${copy}-${n}`} className="flex items-center gap-8 px-8 font-display text-2xl md:text-3xl whitespace-nowrap">
                {n}
                <i className="ri-sparkling-2-fill text-white/60 text-lg" />
              </li>
            ))}
          </ul>
        ))}
      </div>
      <p className="sr-only">{names.join(", ")}</p>
    </div>
  );
};

export default NotesMarquee;
