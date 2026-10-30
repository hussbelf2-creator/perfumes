import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@/components/ui/Button";
import LegalConsent from "@/components/feature/LegalConsent";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/hooks/useAuth";
import { EN_MESSAGES } from "@/lib/authMessages";

const field =
  "w-full bg-paper-50 border border-paper-200 focus:border-ink-900 focus:bg-white rounded-xl px-4 py-3 text-ink-900 placeholder:text-paper-400 transition-colors outline-none";

// بعد إرسال الطلب: الحساب بكلمة مرور فقط (البيانات الباقية لدينا)، فيتحول الطلب مشروعاً في حساب العميل
export default function AccountAfterRequest({ contact, pitch }: { contact: { firstName: string; lastName: string; email: string; phone: string; country?: string }; pitch?: string }) {
  const { t, isAr } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<"idle" | "confirm" | "exists">("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await register(contact.firstName, contact.lastName, contact.email, contact.phone.replace(/[\s-]/g, ""), "فرد", password, contact.country);
    setBusy(false);
    if (r.success && r.needsConfirm) return setAccount("confirm");
    if (r.success) return navigate("/account?started=1", { replace: true });
    if (r.message.includes("مسجّل مسبقاً")) return setAccount("exists");
    setError(isAr ? r.message : (EN_MESSAGES[r.message] ?? "Something went wrong. Please try again"));
  };

  return (
    <section className="mt-10 rounded-2xl bg-white border border-paper-200 p-6" aria-labelledby="st-acc">
      {account === "confirm" ? (
        <>
          <h2 id="st-acc" className="font-display text-2xl text-ink-900">{t("بقيت خطوة: أكّد بريدك", "One step left: confirm your email")}</h2>
          <p className="mt-2 text-paper-600 leading-[1.8]">{t(`أرسلنا رابط تأكيد إلى ${contact.email}. بعد التأكيد ستجد طلبك مشروعاً في حسابك.`, `We sent a confirmation link to ${contact.email}. Once confirmed, you'll find your request as a project in your account.`)}</p>
        </>
      ) : account === "exists" ? (
        <>
          <h2 id="st-acc" className="font-display text-2xl text-ink-900">{t("لديك حساب بهذا البريد", "You already have an account")}</h2>
          <p className="mt-2 text-paper-600 leading-[1.8]">{t("سجّل دخولك وستجد طلبك مشروعاً في حسابك.", "Sign in and you'll find your request as a project in your account.")}</p>
          <Button to="/auth" className="mt-5" arrow>{t("تسجيل الدخول", "Sign in")}</Button>
        </>
      ) : (
        <form onSubmit={createAccount}>
          <h2 id="st-acc" className="font-display text-2xl text-ink-900">{t("تابع طلبك من حسابك", "Track your request in your account")}</h2>
          <p className="mt-2 text-paper-600 leading-[1.8]">{pitch ?? t("مراحل المشروع، التصاميم للاعتماد، والنقاش مع الفريق في مكان واحد. اختر كلمة مرور فقط — بياناتك الباقية لدينا.", "Project stages, designs to approve and the team chat in one place. Just pick a password — we have the rest.")}</p>
          <label htmlFor="st-pass" className="block text-sm text-paper-600 mt-5 mb-2">{t("كلمة المرور (8 أحرف على الأقل)", "Password (at least 8 characters)")}</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input id="st-pass" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            <Button type="submit" disabled={busy} className="shrink-0">{busy ? t("جارٍ الإنشاء…", "Creating…") : t("أنشئ حسابي", "Create my account")}</Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <LegalConsent action={{ ar: "بإنشاء الحساب", en: "creating an account" }} className="mt-3" />
        </form>
      )}
    </section>
  );
}
