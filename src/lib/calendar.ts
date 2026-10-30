// مواعيد مكالمة الاكتشاف بتوقيت الرياض (UTC+3 ثابت، لا توقيت صيفي)
import { DISCOVERY_CALL } from "@/config/offers";

const RIYADH_OFFSET_MIN = 180;

export interface DaySlot {
  /** YYYY-MM-DD بتوقيت الرياض */
  key: string;
  date: Date; // منتصف نهار ذلك اليوم UTC — للعرض فقط
  slots: { time: string; start: Date; past: boolean }[];
}

/** وقت الرياض الحالي كـ Date "مزاحة" نقرأ منها بـ getUTC* */
function riyadhNow(now = new Date()) {
  return new Date(now.getTime() + RIYADH_OFFSET_MIN * 60_000);
}

/** يحوّل يوماً ووقتاً بتوقيت الرياض إلى لحظة UTC حقيقية */
export function riyadhToUtc(y: number, m: number, d: number, hh: number, mm: number) {
  return new Date(Date.UTC(y, m, d, hh, mm) - RIYADH_OFFSET_MIN * 60_000);
}

export function upcomingDays(now = new Date(), cfg: { daysAhead: number; workDays: number[]; slots: string[] } = DISCOVERY_CALL): DaySlot[] {
  const r = riyadhNow(now);
  const out: DaySlot[] = [];
  for (let i = 0; out.length < 10 && i < cfg.daysAhead; i++) {
    const day = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate() + i, 12));
    if (!cfg.workDays.includes(day.getUTCDay())) continue;
    const y = day.getUTCFullYear(), m = day.getUTCMonth(), d = day.getUTCDate();
    const slots = cfg.slots.map((time) => {
      const [hh, mm] = time.split(":").map(Number);
      const start = riyadhToUtc(y, m, d, hh, mm);
      // لا نعرض موعداً بعد أقل من ساعتين من الآن
      return { time, start, past: start.getTime() < now.getTime() + 2 * 3_600_000 };
    });
    if (slots.every((s) => s.past)) continue;
    out.push({ key: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, date: day, slots });
  }
  return out;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(title: string, start: Date, minutes: number, details: string) {
  const end = new Date(start.getTime() + minutes * 60_000);
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${stamp(start)}/${stamp(end)}`, details });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** ملف .ics لتقويم Apple وOutlook */
export function icsDataUrl(title: string, start: Date, minutes: number, details: string) {
  const end = new Date(start.getTime() + minutes * 60_000);
  const esc = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Perfume Platform//Discovery Call//EN",
    "BEGIN:VEVENT",
    `UID:${stamp(start)}-${Math.random().toString(36).slice(2)}@perfume-platform`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(details)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}
