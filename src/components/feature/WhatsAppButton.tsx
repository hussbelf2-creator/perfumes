import { useI18n } from "@/i18n/context";
import { useLocation } from "react-router-dom";
import { whatsappLink } from "@/config/site";
import { useContent } from "@/cms/ContentProvider";

// زر واتساب عائم في الصفحات العامة فقط — يُخفى تلقائياً إن لم يُضبط الرقم
export default function WhatsAppButton() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const site = useContent("site");
  const href = whatsappLink(site.whatsapp);
  const isAppArea = /^\/(admin|account|auth|contract)/.test(pathname);
  if (!href || isAppArea) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("تواصل معنا عبر واتساب", "Chat with us on WhatsApp")}
      className="fixed bottom-5 end-5 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg shadow-black/20 hover:scale-105 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
    >
      <i className="ri-whatsapp-line text-3xl" aria-hidden="true"></i>
    </a>
  );
}
