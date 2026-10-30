import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, sanitize, rejectedFields, announcementLive } from "@/cms/schema";
const ok = (name: string, cond: boolean, info = "") => test(name, () => assert.ok(cond, info));
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// القيم الافتراضية تمر كما هي
for (const k of ["site", "announcement", "hero", "faq", "offers", "pricing", "legal"] as const) ok(`defaults stable: ${k}`, eq(sanitize(k, DEFAULTS[k]), DEFAULTS[k]));
// مدخلات تالفة كلياً → الافتراضي
for (const bad of [null, 42, "x", [1, 2], { hacked: true }]) for (const k of ["site", "announcement", "hero", "offers"] as const) ok(`garbage ${JSON.stringify(bad)} → default ${k}`, eq(sanitize(k, bad), DEFAULTS[k]));
// الروابط والأرقام
const s = sanitize("site", { ...DEFAULTS.site, email: "not-an-email", phone: "0500", whatsapp: "966500000000", social: { ...DEFAULTS.site.social, instagram: "javascript:alert(1)", x: "https://x.com/brand" } });
ok("bad email falls back", s.email === DEFAULTS.site.email);
ok("local phone rejected", s.phone === DEFAULTS.site.phone);
ok("whatsapp digits kept", s.whatsapp === "966500000000");
ok("javascript: social rejected", s.social.instagram === "");
ok("https social kept", s.social.x === "https://x.com/brand");
ok("rejectedFields names bad ones", eq(rejectedFields("site", { ...DEFAULTS.site, email: "x@", phone: "123" }).sort(), ["email", "phone"]));
const a = sanitize("announcement", { ...DEFAULTS.announcement, link: "//evil.com", until: "tomorrow" });
ok("protocol-relative link rejected", a.link === DEFAULTS.announcement.link);
ok("bad date rejected", a.until === "");
ok("internal link ok", sanitize("announcement", { ...DEFAULTS.announcement, link: "/book?x=1" }).link === "/book?x=1");
ok("long text truncated", sanitize("announcement", { ...DEFAULTS.announcement, text: { ar: "ع".repeat(500), en: "" } }).text.ar.length === 160);
ok("announcement live window", announcementLive({ ...DEFAULTS.announcement, enabled: true, until: "2026-10-18" }, "2026-10-18") && !announcementLive({ ...DEFAULTS.announcement, enabled: true, until: "2026-10-17" }, "2026-10-18"));
ok("disabled not live", !announcementLive({ ...DEFAULTS.announcement, enabled: false }, "2026-01-01"));
ok("empty text not live", !announcementLive({ ...DEFAULTS.announcement, enabled: true, text: { ar: " ", en: "x" } }, "2026-01-01"));
// الواجهة
const h = sanitize("hero", { ...DEFAULTS.hero, image: "javascript:x", facts: [{ value: -5, prefix: "123456789", label: { ar: "أ", en: "a" } }, ...Array(6).fill(DEFAULTS.hero.facts[0])] });
ok("hero image must be https/idb", h.image === DEFAULTS.hero.image);
ok("idb image allowed", sanitize("hero", { ...DEFAULTS.hero, image: "idb:img-1" }).image === "idb:img-1");
ok("facts clamped & capped to 4", h.facts.length === 4 && h.facts[0].value === 0 && h.facts[0].prefix.length === 8);
// الأسئلة
const f = sanitize("faq", { items: [{ id: "a", topic: "cost", q: { ar: "س", en: "" }, a: { ar: "ج", en: "" }, published: false }, { id: "a", topic: "weird", q: { ar: "س2", en: "" }, a: { ar: "ج2", en: "" } }, { id: "b", q: { ar: "", en: "Q" }, a: { ar: "", en: "A" } }, { id: "<script>", q: { ar: "س3", en: "" }, a: { ar: "ج3", en: "" } }] });
ok("faq drops items without Arabic", f.items.length === 3);
ok("faq duplicate ids made unique", new Set(f.items.map((x) => x.id)).size === 3);
ok("faq unknown topic → start", f.items[1].topic === "start");
ok("faq keeps hidden flag", f.items[0].published === false);
ok("faq id stripped of markup", f.items[2].id === "script");
ok("faq empty list allowed", sanitize("faq", { items: [] }).items.length === 0);
// العروض
const o = sanitize("offers", { call: { minutes: 5, slots: ["09:00", "25:00", "09:00", "8:00", "14:30"], workDays: [0, 7, 3, 3, 1.5], daysAhead: 999 }, kit: { vials: 0, ml: 3, creditDays: 30, shipping: { ar: "يومان", en: "2 days" } } });
ok("minutes clamped", o.call.minutes === 10);
ok("slots valid, unique, sorted", eq(o.call.slots, ["09:00", "14:30"]));
ok("workdays valid, unique", eq(o.call.workDays, [0, 3]));
ok("daysAhead clamped", o.call.daysAhead === 60);
ok("vials min 1", o.kit.vials === 1 && o.kit.creditDays === 30);
ok("no slots → default slots", eq(sanitize("offers", { call: { slots: [] } }).call.slots, DEFAULTS.offers.call.slots));
ok("price is not part of the document", !("price" in sanitize("offers", { kit: { price: 1 } }).kit));
