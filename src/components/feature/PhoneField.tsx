import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { COUNTRIES, countryByIso, flag, guessCountry, parsePhone, placeholderFor, toE164, validNational } from "@/lib/phone";

// حقل جوال دولي: قائمة الدولة (العلم + الرمز) ثم الرقم الوطني.
// - داخل نموذج يُقرأ بـ FormData: مرّر name فتُرسل قيمة E.164 في حقل مخفي، والدولة في «country».
// - في نموذج متحكَّم به: onChange يعيد E.164 والدولة وصلاحية الرقم.
// التحقق عبر setCustomValidity فيعمل مع تحقق المتصفح الأصلي ورسائله.

interface Props {
  id: string;
  /** اسم حقل الرقم في FormData (حقل مخفي بصيغة E.164) */
  name?: string;
  /** اسم حقل الدولة في FormData */
  countryName?: string;
  required?: boolean;
  /** رقم مخزّن بأي صيغة (+9665… أو 05…) */
  defaultValue?: string;
  defaultCountry?: string;
  onChange?: (e164: string, country: string, valid: boolean) => void;
  /** صنف الحقل النصي (ليطابق حقول النموذج) */
  className?: string;
  describedBy?: string;
  invalid?: boolean;
}

export default function PhoneField({ id, name, countryName = "country", required, defaultValue, defaultCountry, onChange, className = "", describedBy, invalid }: Props) {
  const { t, pick, lang } = useI18n();
  const init = useMemo(() => parsePhone(defaultValue, defaultCountry ?? guessCountry()), [defaultValue, defaultCountry]);
  const [country, setCountry] = useState(init.country);
  const [national, setNational] = useState(init.national);
  const input = useRef<HTMLInputElement>(null);
  const ct = countryByIso(country) ?? COUNTRIES[0];

  // قيمة مخزّنة تصل متأخرة (جلسة المستخدم) ولم يُكتب شيء بعد
  useEffect(() => {
    if (!national && init.national) {
      setCountry(init.country);
      setNational(init.national);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init]);

  // دولة الإقامة تتغير في النموذج ولم يُكتب رقم بعد: رمز الاتصال يتبعها
  useEffect(() => {
    if (defaultCountry && countryByIso(defaultCountry) && !national) setCountry(defaultCountry.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCountry]);

  const e164 = toE164(country, national);
  const ok = validNational(country, national);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.setCustomValidity(
      national && !ok
        ? country === "SA"
          ? t("رقم جوال سعودي غير صحيح: تسعة أرقام تبدأ بـ5، مثل 5x xxx xxxx.", "Invalid Saudi mobile: nine digits starting with 5, e.g. 5x xxx xxxx.")
          : t(`الرقم غير صحيح لـ${pick(ct.name)}. اكتبه دون رمز الدولة.`, `That number doesn't look right for ${pick(ct.name)}. Type it without the country code.`)
        : "",
    );
  }, [national, ok, country, ct, t, pick]);

  const emit = (iso: string, raw: string) => onChange?.(toE164(iso, raw), iso, validNational(iso, raw));

  const sorted = useMemo(() => (lang === "ar" ? COUNTRIES : [...COUNTRIES.slice(0, 6), ...COUNTRIES.slice(6).sort((a, b) => a.name.en.localeCompare(b.name.en))]), [lang]);

  return (
    <div className="flex items-stretch gap-2" dir="ltr">
      <div className="relative shrink-0">
        <span aria-hidden="true" className={`${className} !w-auto h-full inline-flex items-center gap-1.5 !pe-8 whitespace-nowrap pointer-events-none`}>
          <span className="text-lg leading-none">{flag(ct.iso)}</span>
          <span className="tabular-nums">+{ct.dial}</span>
          <i className="ri-arrow-down-s-line absolute end-2.5 text-paper-500"></i>
        </span>
        <select
          aria-label={t("الدولة ورمز الاتصال", "Country and dialing code")}
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            emit(e.target.value, national);
            input.current?.focus();
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {sorted.map((x) => (
            <option key={x.iso} value={x.iso}>{`${flag(x.iso)} ${pick(x.name)} (+${x.dial})`}</option>
          ))}
        </select>
      </div>
      <input
        ref={input}
        id={id}
        type="tel"
        required={required}
        inputMode="tel"
        autoComplete="tel-national"
        dir="ltr"
        maxLength={20}
        placeholder={placeholderFor(country)}
        value={national}
        aria-invalid={invalid || (national !== "" && !ok) || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const raw = e.target.value;
          // لصق رقم كامل برمز دولة أخرى: نحوّل الدولة تلقائياً
          if (/^\s*(\+|00)/.test(raw)) {
            const p = parsePhone(raw, country);
            setCountry(p.country);
            setNational(p.national);
            emit(p.country, p.national);
            return;
          }
          setNational(raw);
          emit(country, raw);
        }}
        className={`${className} flex-1 min-w-0`}
      />
      {name && <input type="hidden" name={name} value={e164} />}
      {name && <input type="hidden" name={countryName} value={country} />}
    </div>
  );
}
