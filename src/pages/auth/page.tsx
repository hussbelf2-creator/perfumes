import { useState } from "react";
import { useNavigate, Navigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth, DEMO_ADMIN_ENABLED } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { SITE } from "@/config/site";
import { PHOTOS } from "@/lib/photos";
import Photo from "@/components/base/Photo";
import LangToggle from "@/components/base/LangToggle";
import { ROLE_LABELS, STAFF_ROLES, isStaff, type Role } from "@/lib/rbac";
import { EN_MESSAGES } from "@/lib/authMessages";
import LegalConsent from "@/components/feature/LegalConsent";
import PhoneField from "@/components/feature/PhoneField";
import { COUNTRIES, flag, guessCountry } from "@/lib/phone";

type AuthMode = "login" | "register" | "forgot";

const input =
  "w-full bg-paper-50 border border-paper-200 focus:border-ink-900 focus:bg-white rounded-xl px-4 py-3 text-ink-900 placeholder:text-paper-400 transition-colors outline-none";

const AuthPage = () => {
  const { user, login, register, loginAsDemo, requestPasswordReset, isDemoMode } = useAuth();
  const { t, pick, isAr } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const track = searchParams.get("track");
  const fromState = (location.state as { from?: string } | null)?.from;
  const redirectTo = fromState || (track ? `/services/${track}` : "/services");
  const msg = (m: string) => (isAr ? m : EN_MESSAGES[m] ?? m);

  const [mode, setMode] = useState<AuthMode>(searchParams.get("mode") === "register" ? "register" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState("");
  const [demoRole, setDemoRole] = useState<Role>("admin");
  const [country, setCountry] = useState(guessCountry);

  // فريق المنصة يذهب للوحة الإدارة، والعميل لوجهته — لا يدخل أحدهما لوحة الآخر
  if (user) {
    const dest = isStaff(user.role) ? (fromState?.startsWith("/admin") ? fromState : "/admin") : fromState?.startsWith("/admin") ? "/account" : redirectTo;
    return <Navigate to={dest} replace />;
  }

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError("");
    setNotice("");
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (mode === "login") {
        const r = await login(get("email"), get("password"));
        if (!r.success) setError(msg(r.message));
      } else if (mode === "register") {
        const r = await register(get("firstName"), get("lastName"), get("email"), get("phone"), clientType, get("password"), country);
        if (!r.success) setError(msg(r.message));
        else if (r.message.includes("تأكيد")) setNotice(msg(r.message));
        // النجاح: يُعاد التوجيه تلقائياً عند تحديث المستخدم
      } else {
        const r = await requestPasswordReset(get("email"));
        if (r.success) setNotice(msg(r.message));
        else setError(msg(r.message));
      }
    } catch {
      setError(t("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى", "Unexpected error. Please try again"));
    } finally {
      setLoading(false);
    }
  };

  const demo = (role: Role) => {
    loginAsDemo(role);
    navigate(isStaff(role) ? "/admin" : redirectTo, { replace: true });
  };

  const passwordField = (id: string, autoComplete: string) => (
    <div className="relative">
      <input id={id} name="password" type={showPassword ? "text" : "password"} required minLength={mode === "register" ? 8 : undefined} autoComplete={autoComplete} placeholder={mode === "register" ? t("8 أحرف على الأقل", "At least 8 characters") : "••••••••"} className={`${input} pe-12`} />
      <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t("إخفاء كلمة المرور", "Hide password") : t("إظهار كلمة المرور", "Show password")} className="absolute top-1/2 -translate-y-1/2 end-3 w-8 h-8 flex items-center justify-center text-paper-500">
        <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true"></i>
      </button>
    </div>
  );

  const titles = {
    login: { h: t("مرحباً بعودتك", "Welcome back"), p: t("سجّل دخولك لمتابعة مشاريعك", "Sign in to follow your projects") },
    register: { h: t("ابدأ مشروعك", "Start your project"), p: t("أنشئ حسابك في دقيقة، ثم اختر مسارك", "Create your account in a minute, then pick your track") },
    forgot: { h: t("استعادة كلمة المرور", "Reset your password"), p: t("أدخل بريدك وسنرسل لك رابط الاستعادة", "Enter your email and we'll send a reset link") },
  }[mode];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper-50">
      {/* اللوحة الجانبية */}
      <div className="hidden lg:block relative overflow-hidden bg-ink-900">
        <Photo src={PHOTOS.hero} alt="" zoom className="!absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-ink-900/10" aria-hidden="true" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <Link to="/" className="font-display text-2xl flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-accent2 inline-flex items-center justify-center text-sm" aria-hidden="true"><i className="ri-drop-fill"></i></span>
            {pick(SITE.shortName)}
          </Link>
          <div>
            <h2 className="font-display text-5xl leading-[1.15] max-w-md">{t("براندك العطري، من الفكرة إلى الرف.", "Your fragrance brand, from idea to shelf.")}</h2>
            <ul className="mt-10 space-y-3">
              {[t("تتبّع كل مرحلة من لوحة تحكم واحدة", "Track every stage from one dashboard"), t("اعتمادات موثّقة لكل قرار", "Documented sign-off for every decision"), t("عرض تكلفة واضح قبل البدء", "A clear cost estimate before you start")].map((s) => (
                <li key={s} className="flex items-center gap-3 text-white/80">
                  <i className="ri-checkbox-circle-fill text-accent2" aria-hidden="true"></i>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* النموذج */}
      <div className="flex flex-col px-5 md:px-12 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:invisible font-display text-xl text-ink-900">{pick(SITE.shortName)}</Link>
          <LangToggle />
        </div>
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-md">
            {mode === "forgot" && (
              <button type="button" onClick={() => switchMode("login")} className="mb-6 inline-flex items-center gap-2 text-sm text-paper-500 hover:text-ink-900">
                <i className="ri-arrow-right-line flip-ltr" aria-hidden="true"></i>
                {t("العودة لتسجيل الدخول", "Back to sign in")}
              </button>
            )}

            {mode !== "forgot" && (
              <div className="mb-8 grid grid-cols-2 rounded-full bg-white border border-paper-200 p-1" role="tablist">
                {(["login", "register"] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)} className={`rounded-full py-2.5 text-sm transition-colors ${mode === m ? "bg-ink-900 text-white" : "text-paper-600"}`}>
                    {m === "login" ? t("تسجيل الدخول", "Sign in") : t("حساب جديد", "New account")}
                  </button>
                ))}
              </div>
            )}

            <h1 className="font-display text-4xl text-ink-900">{titles.h}</h1>
            <p className="mt-2 text-paper-600">{titles.p}</p>

            {error && (
              <div role="alert" className="mt-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex items-center gap-2">
                <i className="ri-error-warning-line" aria-hidden="true"></i>
                {error}
              </div>
            )}
            {notice && (
              <div role="status" className="mt-6 rounded-xl bg-[#EDF3EC] border border-[#cfe0cc] text-[#346538] text-sm px-4 py-3 flex items-center gap-2">
                <i className="ri-mail-check-line" aria-hidden="true"></i>
                {notice}
              </div>
            )}

            <form key={mode} onSubmit={onSubmit} className="mt-8 space-y-4" noValidate={mode === "forgot"}>
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="a-first" className="block text-sm text-paper-600 mb-2">{t("الاسم الأول", "First name")}</label>
                    <input id="a-first" name="firstName" required autoComplete="given-name" className={input} />
                  </div>
                  <div>
                    <label htmlFor="a-last" className="block text-sm text-paper-600 mb-2">{t("اسم العائلة", "Last name")}</label>
                    <input id="a-last" name="lastName" required autoComplete="family-name" className={input} />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="a-email" className="block text-sm text-paper-600 mb-2">{t("البريد الإلكتروني", "Email")}</label>
                <input id="a-email" name="email" type="email" required autoComplete="email" placeholder="name@email.com" className={input} />
              </div>
              {mode === "register" && (
                <>
                  <div>
                    <label htmlFor="a-country" className="block text-sm text-paper-600 mb-2">{t("الدولة", "Country")}</label>
                    <select id="a-country" required value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country" className={input}>
                      {COUNTRIES.map((c) => (
                        <option key={c.iso} value={c.iso}>{`${flag(c.iso)} ${pick(c.name)} (+${c.dial})`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="a-phone" className="block text-sm text-paper-600 mb-2">{t("الجوال (اختياري)", "Mobile (optional)")}</label>
                    <PhoneField id="a-phone" name="phone" countryName="phone_country" defaultCountry={country} className={input} />
                  </div>
                  <div>
                    <span id="a-type" className="block text-sm text-paper-600 mb-2">{t("نوع العميل", "You are")}</span>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="a-type">
                      {[
                        { v: "فرد", l: t("فرد", "Individual") },
                        { v: "شركة", l: t("شركة", "Company") },
                        { v: "موزع", l: t("موزع", "Distributor") },
                        { v: "براند قائم", l: t("براند قائم", "Existing brand") },
                      ].map((o) => (
                        <button key={o.v} type="button" role="radio" aria-checked={clientType === o.v} onClick={() => setClientType(o.v)} className={`rounded-xl border py-2.5 text-sm transition-colors ${clientType === o.v ? "border-ink-900 bg-white text-ink-900" : "border-paper-200 text-paper-600 hover:border-paper-400"}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {mode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="a-pass" className="block text-sm text-paper-600">{t("كلمة المرور", "Password")}</label>
                    {mode === "login" && (
                      <button type="button" onClick={() => switchMode("forgot")} className="text-sm text-ink-900 hover:underline underline-offset-4">
                        {t("نسيت كلمة المرور؟", "Forgot password?")}
                      </button>
                    )}
                  </div>
                  {passwordField("a-pass", mode === "login" ? "current-password" : "new-password")}
                </div>
              )}
              <button type="submit" disabled={loading} className="w-full rounded-full bg-ink-900 hover:bg-ink-700 text-white py-3.5 transition-colors disabled:opacity-60">
                {loading
                  ? t("لحظة…", "One moment…")
                  : mode === "login"
                    ? t("تسجيل الدخول", "Sign in")
                    : mode === "register"
                      ? t("إنشاء الحساب", "Create account")
                      : t("إرسال رابط الاستعادة", "Send reset link")}
              </button>
              {mode === "register" && <LegalConsent action={{ ar: "بإنشاء الحساب", en: "creating an account" }} className="text-center" />}
            </form>

            {isDemoMode && mode !== "forgot" && (
              <div className="mt-8 pt-6 border-t border-paper-200">
                <p className="text-sm text-paper-500 mb-3">{t("أو جرّب المنصة", "Or try the platform")}</p>
                <div className="grid gap-2">
                  <button type="button" onClick={() => demo("client")} className="rounded-full border border-dashed border-paper-400 hover:border-ink-900 py-3 text-sm text-ink-900 inline-flex items-center justify-center gap-2">
                    <i className="ri-user-star-line" aria-hidden="true"></i>
                    {t("دخول كعميل تجريبي", "Continue as demo client")}
                  </button>
                  {DEMO_ADMIN_ENABLED && (
                    <>
                      <button type="button" onClick={() => demo("owner")} className="rounded-full bg-ink-900 text-white hover:bg-ink-700 py-3 text-sm inline-flex items-center justify-center gap-2">
                        <i className="ri-vip-crown-line" aria-hidden="true"></i>
                        {t("دخول كمالك المنصة (تجريبي)", "Continue as platform owner (demo)")}
                      </button>
                      <div className="flex items-stretch gap-2">
                        <button type="button" onClick={() => demo(demoRole)} className="flex-1 rounded-full border border-paper-200 hover:border-ink-900 py-3 text-sm text-paper-700 inline-flex items-center justify-center gap-2">
                          <i className="ri-shield-user-line" aria-hidden="true"></i>
                          {t("دخول كفريق المنصة", "Continue as platform staff")}
                        </button>
                        <select value={demoRole} onChange={(e) => setDemoRole(e.target.value as Role)} aria-label={t("الدور التجريبي", "Demo role")} className="rounded-full border border-paper-200 bg-white px-3 text-sm text-ink-900">
                          {STAFF_ROLES.map((r) => <option key={r} value={r}>{pick(ROLE_LABELS[r])}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <p className="mt-3 text-xs text-paper-500 text-center">{t("وضع تجريبي: البيانات نموذجية والحسابات محفوظة في هذا المتصفح فقط.", "Demo mode: sample data, accounts are stored in this browser only.")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
