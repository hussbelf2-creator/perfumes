import type { RouteObject } from "react-router-dom";
import { lazy } from "react";
import { Navigate, useLocation } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
const AuthPage = lazy(() => import("../pages/auth/page"));
const ServicesPage = lazy(() => import("../pages/services/page"));
const ServiceDetail = lazy(() => import("../pages/services/ServiceDetail"));
const StartPage = lazy(() => import("../pages/start/page"));
const Studio3DPage = lazy(() => import("../pages/studio3d/page"));
const PricingPage = lazy(() => import("../pages/pricing/page"));
const BookPage = lazy(() => import("../pages/book/page"));
const DiscoveryKitPage = lazy(() => import("../pages/discovery-kit/page"));
const KitPaidPage = lazy(() => import("../pages/discovery-kit/Paid"));
const AboutPage = lazy(() => import("../pages/about/page"));
const AccountLayout = lazy(() => import("../pages/account/AccountLayout"));
const accountPage = (name: "AccountOverview" | "AccountProjects" | "AccountProject" | "AccountApprovals" | "AccountDesigns") => lazy(() => import("../pages/account/pages").then((m) => ({ default: m[name] })));
const AccountOverview = accountPage("AccountOverview");
const AccountProjects = accountPage("AccountProjects");
const AccountProject = accountPage("AccountProject");
const AccountApprovals = accountPage("AccountApprovals");
const AccountDesigns = accountPage("AccountDesigns");
const CreativesPage = lazy(() => import("../pages/creatives/page"));
const CreativeProfilePage = lazy(() => import("../pages/creatives/profile"));
const PortfolioPage = lazy(() => import("../pages/portfolio/page"));
const FAQPage = lazy(() => import("../pages/faq/page"));
const LegalPage = lazy(() => import("../pages/legal/page"));
const BespokePage = lazy(() => import("../pages/bespoke/page"));
const ContractPrintPage = lazy(() => import("../pages/contract/page"));
const ContactPage = lazy(() => import("../pages/contact/page"));
import AuthGuard from "../components/feature/AuthGuard";
// لوحة الإدارة الجديدة: تطبيق مستقل بحزمة كود منفصلة
const AdminApp = lazy(() => import("../admin/AdminApp"));
const AdminRequirePerm = lazy(() => import("../admin/AdminApp").then((m) => ({ default: m.RequirePerm })));
const AdminOverview = lazy(() => import("../admin/pages/Overview"));
const AdminInbox = lazy(() => import("../admin/pages/Inbox"));
const AdminPipeline = lazy(() => import("../admin/pages/Pipeline"));
const AdminContacts = lazy(() => import("../admin/pages/Contacts"));
const AdminContactDetail = lazy(() => import("../admin/pages/ContactDetail"));
const AdminTasks = lazy(() => import("../admin/pages/Tasks"));
const AdminPayments = lazy(() => import("../admin/pages/Payments"));
const AdminQuotes = lazy(() => import("../admin/pages/Quotes"));
const AdminReports = lazy(() => import("../admin/pages/Reports"));
const AdminInventory = lazy(() => import("../admin/pages/Inventory"));
const AdminPricing = lazy(() => import("../admin/pages/Pricing"));
const AdminTeam = lazy(() => import("../admin/pages/Team"));
const AdminAudit = lazy(() => import("../admin/pages/Audit"));
const AdminStudio = lazy(() => import("../admin/pages/Studio"));
const AdminStudioEditor = lazy(() => import("../admin/pages/StudioEditor"));
const AdminStudioAi = lazy(() => import("../admin/pages/StudioAi"));
const AdminCreatives = lazy(() => import("../admin/pages/Creatives"));
const AdminCms = lazy(() => import("../admin/pages/Cms"));
const AdminProjects = lazy(() => import("../admin/pages/Projects"));
const AdminProject = lazy(() => import("../admin/pages/Projects").then((m) => ({ default: m.ProjectAdmin })));
const AdminCreativeEditor = lazy(() => import("../admin/pages/CreativeEditor"));
// صفحات اللوحة القديمة (بيانات نموذجية) — تُستبدل في المراحل القادمة

function LegacyDashboardRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(/^\/dashboard/, "/account") + search} replace />;
}

const routes: RouteObject[] = [
  // Public routes
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    path: "/services",
    element: <ServicesPage />,
  },
  {
    path: "/services/:id",
    element: <ServiceDetail />,
  },
  {
    path: "/start/:track",
    element: <StartPage />,
  },
  {
    path: "/packaging",
    element: <Navigate to="/studio-3d?tab=box" replace />,
  },
  {
    path: "/approval",
    element: <Navigate to="/account/approvals" replace />,
  },
  {
    path: "/about",
    element: <AboutPage />,
  },
  {
    path: "/portfolio",
    element: <PortfolioPage />,
  },
  {
    // استوديو المبدعين — عام
    path: "/creatives",
    element: <CreativesPage />,
  },
  {
    path: "/creatives/:slug",
    element: <CreativeProfilePage />,
  },
  {
    path: "/faq",
    element: <FAQPage />,
  },
  { path: "/bespoke", element: <BespokePage /> },
  { path: "/contract/:id", element: <AuthGuard shared><ContractPrintPage /></AuthGuard> },
  { path: "/privacy", element: <LegalPage kind="privacy" /> },
  { path: "/terms", element: <LegalPage kind="terms" /> },
  { path: "/refund", element: <LegalPage kind="refund" /> },
  {
    path: "/contact",
    element: <ContactPage />,
  },
  {
    path: "/pricing",
    element: <PricingPage />,
  },
  {
    path: "/book",
    element: <BookPage />,
  },
  {
    path: "/discovery-kit",
    element: <DiscoveryKitPage />,
  },
  {
    path: "/discovery-kit/paid",
    element: <KitPaidPage />,
  },
  // Admin routes - require admin role
  {
    path: "/admin",
    element: <AdminApp />,
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "inbox", element: <AdminRequirePerm perm="crm.view"><AdminInbox /></AdminRequirePerm> },
      { path: "pipeline", element: <AdminRequirePerm perm="crm.view"><AdminPipeline /></AdminRequirePerm> },
      { path: "contacts", element: <AdminRequirePerm perm="crm.view"><AdminContacts /></AdminRequirePerm> },
      { path: "contacts/:id", element: <AdminRequirePerm perm="crm.view"><AdminContactDetail /></AdminRequirePerm> },
      { path: "tasks", element: <AdminTasks /> },
      { path: "payments", element: <AdminRequirePerm perm="payments.view"><AdminPayments /></AdminRequirePerm> },
      { path: "quotes", element: <AdminRequirePerm perm="payments.view"><AdminQuotes /></AdminRequirePerm> },
      { path: "reports", element: <AdminRequirePerm perm="payments.view"><AdminReports /></AdminRequirePerm> },
      { path: "inventory", element: <AdminRequirePerm perm="inventory.view"><AdminInventory /></AdminRequirePerm> },
      { path: "pricing", element: <AdminRequirePerm perm="pricing.manage"><AdminPricing /></AdminRequirePerm> },
      { path: "team", element: <AdminRequirePerm perm="team.view"><AdminTeam /></AdminRequirePerm> },
      { path: "audit", element: <AdminRequirePerm perm="audit.view"><AdminAudit /></AdminRequirePerm> },
      { path: "studio", element: <AdminRequirePerm perm="studio.manage"><AdminStudio /></AdminRequirePerm> },
      { path: "studio/ai", element: <AdminRequirePerm perm="studio.manage"><AdminStudioAi /></AdminRequirePerm> },
      // الصلاحية تُفحص داخل الصفحة: المصمم يدخل لمشاريعه المسندة فقط
      { path: "projects", element: <AdminProjects /> },
      { path: "projects/:id", element: <AdminProject /> },
      { path: "cms", element: <AdminRequirePerm perm="content.edit"><AdminCms /></AdminRequirePerm> },
      { path: "creatives", element: <AdminRequirePerm perm="studio.manage"><AdminCreatives /></AdminRequirePerm> },
      { path: "creatives/:id", element: <AdminRequirePerm perm="studio.manage"><AdminCreativeEditor /></AdminRequirePerm> },
      { path: "studio/:id", element: <AdminRequirePerm perm="studio.manage"><AdminStudioEditor /></AdminRequirePerm> },
    ],
  },
  // صفحات اللوحة القديمة (بيانات نموذجية) استُبدلت بصفحات فعلية
  { path: "/admin/orders", element: <Navigate to="/admin/quotes" replace /> },
  { path: "/admin/content", element: <Navigate to="/admin/cms" replace /> },
  { path: "/admin/settings", element: <Navigate to="/admin/cms" replace /> },
  // لوحة العميل (كانت /dashboard) — الروابط القديمة تُحوَّل
  { path: "/dashboard", element: <Navigate to="/account" replace /> },
  { path: "/dashboard/*", element: <LegacyDashboardRedirect /> },
  {
    // لوحة العميل الحقيقية: مشاريعه واعتماداته وتصاميمه
    path: "/account",
    element: <AuthGuard><AccountLayout /></AuthGuard>,
    children: [
      { index: true, element: <AccountOverview /> },
      { path: "projects", element: <AccountProjects /> },
      { path: "projects/:projectId", element: <AccountProject /> },
      { path: "approvals", element: <AccountApprovals /> },
      { path: "designs", element: <AccountDesigns /> },
      // صفحات البيانات النموذجية القديمة (رسائل، فواتير، مهام، إعدادات) لا تُعرض على عميل حقيقي
      { path: "projects/manage", element: <Navigate to="/account/projects" replace /> },
      { path: "messages", element: <Navigate to="/account/projects" replace /> },
      { path: "invoices", element: <Navigate to="/account" replace /> },
      { path: "settings", element: <Navigate to="/account" replace /> },
    ],
  },
  {
    // استوديو العبوة ثلاثي الأبعاد — عام (أداة بيع، لا تحتاج حساباً)
    path: "/studio-3d",
    element: <Studio3DPage />,
  },
  // صفحات النسخة الأولى (بيانات نموذجية) حُذفت: روابطها القديمة تذهب لما يقابلها في المنصة الفعلية
  ...(
    [
      ["/workspace", "/account/projects"],
      ["/workspace/:projectId", "/account/projects"],
      ["/production", "/account/projects"],
      ["/after-sales", "/account"],
      ["/workflow", "/services"],
      ["/packaging-customizer", "/studio-3d?tab=box"],
      ["/brand-creation", "/services/A"],
      ["/visual-identity", "/services/D"],
      ["/manufacturing", "/services/E"],
    ] as const
  ).map(([path, to]) => ({ path, element: <Navigate to={to} replace /> })),
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;