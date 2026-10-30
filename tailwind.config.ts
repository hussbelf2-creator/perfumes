import colors from "tailwindcss/colors";

// لوحة "الحبر والورق": تحل محل البرتقالي في كامل التطبيق.
// الدرجات الفاتحة رملية دافئة، والداكنة حبر شبه أسود — للأزرار والعناوين والإبراز.
// حبر «بنفسجي منتصف الليل»: داكن بعمق لوني بدل الأسود الصرف — للأزرار والعناوين والأقسام الداكنة
const ink = {
  50: "#F7F5FA",
  100: "#EFEBF4",
  200: "#E2DCEA",
  300: "#CBC1D9",
  400: "#9F8FB4",
  500: "#73628C",
  600: "#4E4062",
  700: "#30273F",
  800: "#1F182A",
  900: "#15101D",
  950: "#0C0812",
};

// رمادي دافئ بخلفية ورقية
const paper = {
  ...colors.stone,
  50: "#F7F6F3",
  100: "#F1EFEA",
  200: "#EAEAEA",
  300: "#D9D6CF",
  400: "#9A968E",
  500: "#787774",
  600: "#5A5955",
  700: "#3F3E3B",
  800: "#2F3437",
  900: "#1E1F20",
  950: "#141414",
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        amber: ink,
        stone: paper,
        ink,
        paper,
        sand: { DEFAULT: "#E9E3D8", soft: "#F2EEE6" },
        // لون إبراز حار (مرجاني/زعفراني) — للتفاصيل الحية والأزرار الثانوية
        accent2: { DEFAULT: "#E4612E", soft: "#FBE9DF", ink: "#A4421A" },
        // لون إبراز بارد (نعناعي) — للتدرجات والنجاح والانتعاش
        accent3: { DEFAULT: "#2FA287", soft: "#DDF3EB", ink: "#1C6A58" },
        gold: { DEFAULT: "#D4A853", soft: "#F7EBCF" },
        // رموز دلالية تستخدمها صفحات الإدارة والعميل
        background: paper,
        foreground: paper,
        primary: ink,
        secondary: colors.emerald,
        accent: colors.orange,
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        // عصري هندسي بحرفين عربي ولاتيني متناسقين
        display: ['"Readex Pro"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', '"IBM Plex Sans Arabic"', "ui-monospace", "monospace"],
      },
      // ظلال شبه معدومة — العمق يأتي من الحدود والمساحات
      // ظلال خفيفة مصبوغة بلون الحبر لا بالأسود
      boxShadow: {
        sm: "0 1px 2px rgba(21,16,29,0.04)",
        DEFAULT: "0 1px 3px rgba(21,16,29,0.05)",
        md: "0 2px 8px rgba(21,16,29,0.05)",
        lg: "0 4px 16px rgba(21,16,29,0.07)",
        xl: "0 8px 24px rgba(21,16,29,0.08)",
        "2xl": "0 12px 32px rgba(21,16,29,0.1)",
        glow: "0 0 0 1px rgba(228,97,46,0.25), 0 12px 40px rgba(228,97,46,0.18)",
      },
      letterSpacing: {
        label: "0.08em",
      },
      transitionTimingFunction: {
        quiet: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
