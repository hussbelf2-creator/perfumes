// التحقق البشري (Cloudflare Turnstile) عند الإرسال، دون تعديل كل نموذج:
// تُحمَّل الأداة عند الحاجة، ولا تظهر للزائر إلا إن احتاجت تفاعلاً منه.

export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;
function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** رمز تحقق صالح لمرة واحدة */
export async function turnstileToken(lang: "ar" | "en" = "ar"): Promise<string> {
  const api = await load();
  const box = document.createElement("div");
  box.setAttribute("role", "dialog");
  box.style.cssText = "position:fixed;inset-inline:0;bottom:24px;display:flex;justify-content:center;z-index:9999;pointer-events:auto";
  document.body.appendChild(box);
  let id = "";
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("turnstile_timeout")), 120_000);
      id = api.render(box, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        language: lang,
        callback: (token: string) => {
          window.clearTimeout(timer);
          resolve(token);
        },
        "error-callback": () => {
          window.clearTimeout(timer);
          reject(new Error("turnstile"));
        },
      });
    });
  } finally {
    if (id) api.remove(id);
    box.remove();
  }
}
