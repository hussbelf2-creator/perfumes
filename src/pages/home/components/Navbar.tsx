import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/context";
import { SITE } from "@/config/site";
import { SERVICE_TRACKS } from "@/data/services";
import { PHOTOS } from "@/lib/photos";
import LangToggle from "@/components/base/LangToggle";
import Photo from "@/components/base/Photo";
import Arrow from "@/components/ui/Arrow";

const Navbar = () => {
  const { user, logout, isStaff } = useAuth();
  const { t, pick } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  // لوحة الخدمات خارج زرّها في الشجرة: النقر داخلها ليس «خارج القائمة» وإلا أُغلقت قبل أن يُنفَّذ الرابط
  const servicesPanelRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // سبعة روابط على سطر واحد: الأدوات (الاستوديو، الأسعار) أمام العين، والمواد المساندة في القائمة الكبيرة
  const NAV_LINKS = [
    { to: "/studio-3d", label: t("الاستوديو", "Studio") },
    { to: "/pricing", label: t("الأسعار", "Pricing") },
    { to: "/bespoke", label: t("عطرك الخاص", "Your scent") },
    { to: "/creatives", label: t("المبدعون", "Creatives") },
    { to: "/about", label: t("عن المنصة", "About") },
    { to: "/contact", label: t("تواصل", "Contact") },
  ];
  const MORE_LINKS = [
    { to: "/portfolio", label: t("نماذج تصوّرية", "Concepts") },
    { to: "/faq", label: t("الأسئلة الشائعة", "FAQ") },
    { to: "/discovery-kit", label: t("عينة الاكتشاف", "Discovery kit") },
    { to: "/book", label: t("مكالمة اكتشاف مجانية", "Free discovery call") },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (servicesRef.current && !servicesRef.current.contains(target) && !servicesPanelRef.current?.contains(target)) setServicesOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setServicesOpen(false);
        setUserMenuOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setServicesOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // فوق هيرو الصفحة الرئيسية الداكن تكون القائمة فاتحة النص
  const onDark = pathname === "/" && !scrolled && !menuOpen && !servicesOpen;

  const linkClass = (path: string) =>
    `text-[0.92rem] transition-colors whitespace-nowrap ${
      onDark
        ? pathname.startsWith(path) ? "text-white" : "text-white/70 hover:text-white"
        : pathname.startsWith(path) ? "text-ink-900" : "text-paper-500 hover:text-ink-900"
    }`;

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate("/");
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        onDark ? "bg-transparent border-b border-white/10" : "bg-paper-50/90 backdrop-blur-md border-b border-paper-200"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-5 md:px-8 h-[4.25rem] flex items-center justify-between gap-6" aria-label={t("القائمة الرئيسية", "Main navigation")}>
        <Link to="/" className={`font-display text-xl whitespace-nowrap flex items-center gap-2 ${onDark ? "text-white" : "text-ink-900"}`}>
          <span className="w-7 h-7 rounded-full bg-accent2 inline-flex items-center justify-center text-white text-sm" aria-hidden="true">
            <i className="ri-drop-fill"></i>
          </span>
          {pick(SITE.shortName)}
        </Link>

        <div className="hidden lg:flex items-center gap-5 xl:gap-8">
          <div className="relative" ref={servicesRef}>
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              aria-expanded={servicesOpen}
              aria-haspopup="true"
              className={`${linkClass("/services")} inline-flex items-center gap-1`}
            >
              {t("الخدمات", "Services")}
              <i className={`ri-arrow-down-s-line transition-transform ${servicesOpen ? "rotate-180" : ""}`} aria-hidden="true"></i>
            </button>
          </div>
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={linkClass(l.to)}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-4 xl:gap-5">
          <LangToggle className={onDark ? "!text-white/80 hover:!text-white" : ""} />
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className={`inline-flex items-center gap-2 text-sm ${onDark ? "text-white" : "text-ink-900"}`}
              >
                <span className="w-8 h-8 rounded-full bg-sand text-ink-900 flex items-center justify-center text-xs">{user.firstName.charAt(0)}</span>
                {user.firstName}
                <i className="ri-arrow-down-s-line" aria-hidden="true"></i>
              </button>
              {userMenuOpen && (
                <div className="absolute top-full end-0 mt-3 w-56 bg-white border border-paper-200 rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-4 py-3 border-b border-paper-200">
                    <div className="text-sm text-ink-900">{user.firstName} {user.lastName}</div>
                    <div className="text-xs text-paper-500 truncate" dir="ltr">{user.email}</div>
                  </div>
                  {[
                    ...(isStaff
                      ? [{ to: "/admin", label: t("لوحة الإدارة", "Admin panel") }]
                      : [
                          { to: "/account", label: t("حسابي", "My account") },
                          { to: "/account/projects", label: t("مشاريعي", "My projects") },
                        ]),
                  ].map((item) => (
                    <Link key={item.to} to={item.to} className="block px-4 py-2.5 text-sm text-paper-700 hover:bg-paper-50">
                      {item.label}
                    </Link>
                  ))}
                  <button type="button" onClick={handleLogout} className="w-full text-start px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 border-t border-paper-200">
                    {t("تسجيل الخروج", "Sign out")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/auth" className={`text-[0.92rem] whitespace-nowrap transition-colors ${onDark ? "text-white/80 hover:text-white" : "text-paper-500 hover:text-ink-900"}`}>
                {t("دخول", "Sign in")}
              </Link>
              <Link
                to="/book"
                className={`rounded-full px-5 py-2.5 text-sm transition-colors whitespace-nowrap ${onDark ? "bg-white text-ink-900 hover:bg-sand-soft" : "bg-ink-900 text-white hover:bg-ink-700"}`}
              >
                {t("مكالمة مجانية", "Free call")}
              </Link>
            </>
          )}
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <LangToggle className={onDark ? "!text-white/80" : ""} />
          <button
            type="button"
            className={`w-11 h-11 flex items-center justify-center ${onDark ? "text-white" : "text-ink-900"}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? t("إغلاق القائمة", "Close menu") : t("فتح القائمة", "Open menu")}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <i className={`text-2xl ${menuOpen ? "ri-close-line" : "ri-menu-line"}`} aria-hidden="true"></i>
          </button>
        </div>
      </nav>

      {/* قائمة الخدمات الكبيرة */}
      {servicesOpen && (
        <div ref={servicesPanelRef} className="hidden lg:block border-t border-paper-200 bg-paper-50">
          <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-12 gap-8">
            <div className="col-span-8 grid grid-cols-2 gap-2">
              {SERVICE_TRACKS.map((s) => (
                <Link key={s.id} to={`/services/${s.id}`} onClick={() => setServicesOpen(false)} className="group flex items-start gap-4 rounded-2xl p-4 hover:bg-white transition-colors">
                  <span className="w-11 h-11 rounded-xl bg-white border border-paper-200 group-hover:border-ink-900 flex items-center justify-center text-ink-900 shrink-0 transition-colors">
                    <i className={`${s.icon} text-lg`} aria-hidden="true"></i>
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-ink-900">
                      {pick(s.title)}
                      <span className="label-mono">N°{s.no}</span>
                    </span>
                    <span className="block text-sm text-paper-500 mt-1 leading-[1.6]">{pick(s.summary)}</span>
                  </span>
                </Link>
              ))}
            </div>
            <div className="col-span-4 flex flex-col gap-3">
            <ul className="grid grid-cols-2 gap-1 text-sm">
              {MORE_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} onClick={() => setServicesOpen(false)} className="block rounded-xl px-3 py-2 text-paper-600 hover:bg-white hover:text-ink-900">{l.label}</Link>
                </li>
              ))}
            </ul>
            <Link to="/services" onClick={() => setServicesOpen(false)} className="group relative overflow-hidden rounded-2xl min-h-[12rem] flex items-end p-6 flex-1">
              <Photo src={PHOTOS.consult} alt="" className="!absolute inset-0" imgClassName="group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-ink-900/80 to-transparent" aria-hidden="true" />
              <span className="relative text-white">
                <span className="block font-display text-2xl">{t("لا تعرف من أين تبدأ؟", "Not sure where to start?")}</span>
                <span className="mt-2 inline-flex items-center gap-2 text-sm text-white/80">
                  {t("ساعدني أختار المسار", "Help me choose a track")}
                  <Arrow />
                </span>
              </span>
            </Link>
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div id="mobile-menu" className="lg:hidden h-[calc(100dvh-4.25rem)] overflow-y-auto bg-paper-50 border-t border-paper-200 px-5 pb-10">
          <p className="label-mono pt-6 pb-3">{t("المسارات", "Tracks")}</p>
          <ul className="border-t border-paper-200">
            {SERVICE_TRACKS.map((s) => (
              <li key={s.id} className="border-b border-paper-200">
                <Link to={`/services/${s.id}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-4 py-3.5">
                  <i className={`${s.icon} text-lg text-paper-500`} aria-hidden="true"></i>
                  <span className="text-ink-900 flex-1">{pick(s.title)}</span>
                  <span className="label-mono">N°{s.no}</span>
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-1">
            {[{ to: "/services", label: t("كل الخدمات", "All services") }, ...NAV_LINKS, ...MORE_LINKS].map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="block py-2.5 font-display text-2xl text-ink-900">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 pt-6 border-t border-paper-200 flex flex-col gap-3">
            {user ? (
              <>
                <Link to={isStaff ? "/admin" : "/account"} className="bg-ink-900 text-white text-center py-3.5 rounded-full">{isStaff ? t("لوحة الإدارة", "Admin panel") : t("حسابي", "My account")}</Link>
                <button type="button" onClick={handleLogout} className="py-3 text-sm text-red-700">{t("تسجيل الخروج", "Sign out")}</button>
              </>
            ) : (
              <>
                <Link to="/book" className="bg-ink-900 text-white text-center py-3.5 rounded-full">{t("احجز مكالمة مجانية", "Book a free call")}</Link>
                <Link to="/auth?mode=register" className="border border-paper-300 text-ink-900 text-center py-3.5 rounded-full">{t("ابدأ مشروعك", "Start a project")}</Link>
                <Link to="/auth" className="py-3 text-center text-sm text-paper-600">{t("تسجيل الدخول", "Sign in")}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
