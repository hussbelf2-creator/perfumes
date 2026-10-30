import type { Activity, Contact, CrmSnapshot, Lead, Payment, Task, TeamMember } from "./types";

// بيانات نموذجية للوضع التجريبي — التواريخ نسبية لليوم فتبقى "حيّة"

export const DEMO_TEAM: TeamMember[] = [
  { id: "USR-OWNER", firstName: "أحمد", lastName: "الكاف", email: "owner@demo.local", role: "owner", active: true, createdAt: "2025-01-05T08:00:00Z" },
  { id: "USR-ADMIN", firstName: "ريم", lastName: "الشهري", email: "admin@demo.local", role: "admin", active: true, createdAt: "2025-02-11T08:00:00Z" },
  { id: "USR-SALES", firstName: "فيصل", lastName: "القحطاني", email: "sales@demo.local", role: "sales", active: true, createdAt: "2025-03-02T08:00:00Z" },
  { id: "USR-SALES2", firstName: "لمى", lastName: "العتيبي", email: "lama@demo.local", role: "sales", active: true, createdAt: "2025-06-18T08:00:00Z" },
  { id: "USR-DESIGN", firstName: "نورة", lastName: "الدوسري", email: "designer@demo.local", role: "designer", active: true, createdAt: "2025-04-09T08:00:00Z" },
  { id: "USR-PROD", firstName: "سلطان", lastName: "الحربي", email: "production@demo.local", role: "production", active: true, createdAt: "2025-04-20T08:00:00Z" },
  { id: "USR-EDITOR", firstName: "هيا", lastName: "المطيري", email: "editor@demo.local", role: "editor", active: true, createdAt: "2025-07-01T08:00:00Z" },
];

const H = 3_600_000;
const D = 24 * H;

/** موعد قادم بتوقيت الرياض (UTC+3) بعد `days` يوم عمل تقريباً */
function riyadhSlot(now: number, days: number, hour: number) {
  const d = new Date(now + days * D);
  d.setUTCHours(hour - 3, 0, 0, 0);
  return d;
}

export function buildSeed(nowMs = Date.now()): CrmSnapshot {
  const ago = (ms: number) => new Date(nowMs - ms).toISOString();
  const ahead = (ms: number) => new Date(nowMs + ms).toISOString();

  type Row = {
    id: string;
    name: string;
    email: string;
    phone: string;
    city: string;
    company?: string;
    source: Contact["source"];
    stage: Contact["stage"];
    value: number;
    ownerId?: string;
    tags?: string[];
    age: number;
  };

  const rows: Row[] = [
    { id: "C-1001", name: "سارة العنزي", email: "sara@oudlane.sa", phone: "+966551230011", city: "Riyadh", company: "عود لين", source: "booking", stage: "new", value: 0, age: 3 * H },
    { id: "C-1002", name: "خالد الزهراني", email: "khalid@majlis.co", phone: "+966501112233", city: "Jeddah", source: "kit", stage: "new", value: 750, age: 7 * H },
    { id: "C-1003", name: "منيرة السبيعي", email: "muneera@gmail.com", phone: "+966533004455", city: "Dammam", source: "contact", stage: "new", value: 0, age: 26 * H },
    { id: "C-1004", name: "عبدالله الشمري", email: "a.shammari@hailscents.com", phone: "+966544778899", city: "Hail", company: "عطور حائل", source: "booking", stage: "contacted", value: 45000, ownerId: "USR-SALES", age: 2 * D },
    { id: "C-1005", name: "دانة الغامدي", email: "dana@noor-atelier.sa", phone: "+966555667788", city: "Riyadh", company: "أتيليه نور", source: "kit", stage: "qualified", value: 85000, ownerId: "USR-SALES2", tags: ["براند كامل"], age: 6 * D },
    { id: "C-1006", name: "تركي العسيري", email: "turki@abhaoud.com", phone: "+966566112244", city: "Abha", source: "consultation", stage: "proposal", value: 120000, ownerId: "USR-SALES", tags: ["أولوية"], age: 12 * D },
    { id: "C-1007", name: "لولوة الرشيد", email: "lulwa@bayt-alward.sa", phone: "+966577223344", city: "Riyadh", company: "بيت الورد", source: "booking", stage: "proposal", value: 32000, ownerId: "USR-SALES2", age: 9 * D },
    { id: "C-1008", name: "ماجد الحربي", email: "majed@qahwa-scents.com", phone: "+966588334455", city: "Madinah", company: "قهوة سنتس", source: "kit", stage: "won", value: 64000, ownerId: "USR-SALES", age: 31 * D },
    { id: "C-1009", name: "أسماء القرني", email: "asma@bahr.studio", phone: "+966599445566", city: "Khobar", company: "بحر ستوديو", source: "contact", stage: "won", value: 28000, ownerId: "USR-SALES2", age: 44 * D },
    { id: "C-1010", name: "ياسر المالكي", email: "yasser@gmail.com", phone: "+966500556677", city: "Taif", source: "booking", stage: "lost", value: 18000, ownerId: "USR-SALES", tags: ["السعر"], age: 22 * D },
    { id: "C-1011", name: "شهد الجهني", email: "shahad@yanbu-musk.com", phone: "+966511667788", city: "Yanbu", source: "kit", stage: "contacted", value: 750, ownerId: "USR-SALES2", age: 4 * D },
    { id: "C-1012", name: "فهد العمري", email: "fahad@sahm.sa", phone: "+966522778899", city: "Riyadh", company: "سهم", source: "consultation", stage: "qualified", value: 55000, ownerId: "USR-SALES", age: 15 * D },
    { id: "C-1013", name: "ريما الحمدان", email: "reema@thamar.co", phone: "+966533889900", city: "Qassim", company: "ثمر", source: "booking", stage: "contacted", value: 0, age: 30 * H },
    { id: "C-1014", name: "عمر باوزير", email: "omar@hadramout-oud.com", phone: "+966544990011", city: "Jeddah", source: "contact", stage: "lost", value: 9000, ownerId: "USR-SALES2", age: 38 * D },
  ];

  const contacts: Contact[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    city: r.city,
    company: r.company ?? null,
    source: r.source,
    stage: r.stage,
    value: r.value,
    ownerId: r.ownerId ?? null,
    tags: r.tags ?? [],
    createdAt: ago(r.age),
    lastActivityAt: ago(Math.max(r.age / 3, H)),
  }));

  const leads: Lead[] = [];
  const payments: Payment[] = [];
  const activities: Activity[] = [];
  let n = 1;
  const directions = ["عود دخاني / عود وردي / عنبر ناعم", "ورد طائفي / زهر أبيض / زهري مسكي", "قهوة عربية / تمر وفانيلا / كراميل مملح"];

  rows.forEach((r, i) => {
    const [first, ...rest] = r.name.split(" ");
    const base = { firstName: first, lastName: rest.join(" "), email: r.email, phone: r.phone };
    let payload: Record<string, string>;
    if (r.source === "booking") {
      const slot = riyadhSlot(nowMs, (i % 4) + 1, [10, 11, 14, 15][i % 4]);
      payload = {
        ...base,
        slot_utc: slot.toISOString(),
        slot_riyadh: `${slot.toISOString().slice(0, 10)} ${String(slot.getUTCHours() + 3).padStart(2, "0")}:00 (Asia/Riyadh)`,
        channel: ["video", "whatsapp", "phone"][i % 3],
        subject: ["A", "B", "C", ""][i % 4],
        message: "أفكر في عطر عودي بسعر 300 ريال للسوق المحلي",
        language: "ar",
        request_type: "discovery_call",
      };
    } else if (r.source === "kit") {
      const ref = `KIT-${["7F3K9Q", "M2XH8P", "Q9WT4N", "B6RZ2K"][i % 4]}`;
      payload = {
        ...base,
        city: r.city,
        address: "حي النرجس",
        order_ref: ref,
        quiz: "family=oud; intensity=balanced; audience=unisex; price=mid",
        directions: directions[i % 3],
        payment: "online_pending",
        request_type: "discovery_kit",
      };
      const paid = r.stage !== "new" || i % 2 === 1;
      payments.push({
        id: `pay-${String(n).padStart(4, "0")}-demo`,
        orderRef: ref,
        kind: "kit",
        amount: 75000,
        currency: "SAR",
        status: paid ? "paid" : "failed",
        method: paid ? (i % 2 ? "mada" : "applepay") : "visa",
        email: r.email,
        createdAt: ago(r.age - 20 * 60_000),
      });
    } else {
      payload = { ...base, subject: "استفسار عن براند كامل", message: "نرغب بإطلاق خط من ثلاثة عطور قبل رمضان. ما المدة والتكلفة؟" };
    }
    leads.push({
      id: `L-${2000 + n}`,
      kind: r.source === "manual" ? "contact" : r.source,
      payload,
      page: r.source === "booking" ? "/book" : r.source === "kit" ? "/discovery-kit" : "/contact",
      createdAt: ago(r.age),
      contactId: r.id,
      status: r.stage === "new" ? "new" : r.stage === "won" || r.stage === "lost" ? "done" : "in_progress",
      assigneeId: r.ownerId ?? null,
    });
    activities.push({ id: `A-${3000 + n}`, contactId: r.id, type: "request", body: "طلب وارد من الموقع", actorId: null, createdAt: ago(r.age) });
    if (r.ownerId) activities.push({ id: `A-${3100 + n}`, contactId: r.id, type: "assign", body: "أُسند العميل", actorId: "USR-ADMIN", createdAt: ago(r.age - 2 * H) });
    if (r.stage !== "new") activities.push({ id: `A-${3200 + n}`, contactId: r.id, type: "call", body: "مكالمة تعريفية: الفكرة واضحة، يحتاج تقدير تكلفة.", actorId: r.ownerId ?? "USR-SALES", createdAt: ago(r.age - 6 * H) });
    if (r.stage === "proposal" || r.stage === "won") activities.push({ id: `A-${3300 + n}`, contactId: r.id, type: "email", body: "أُرسل عرض السعر والجدول الزمني.", actorId: r.ownerId ?? null, createdAt: ago(r.age / 2) });
    if (r.stage === "lost") activities.push({ id: `A-${3400 + n}`, contactId: r.id, type: "note", body: "اعتذر العميل: الميزانية أقل من المطلوب هذا الربع.", actorId: r.ownerId ?? null, createdAt: ago(r.age / 3) });
    n++;
  });

  const tasks: Task[] = [
    { id: "T-1", contactId: "C-1004", title: "إرسال تقدير التكلفة بعد المكالمة", dueAt: ago(20 * H), done: false, assigneeId: "USR-SALES", createdBy: "USR-SALES", createdAt: ago(2 * D) },
    { id: "T-2", contactId: "C-1006", title: "متابعة عرض السعر", dueAt: ahead(3 * H), done: false, assigneeId: "USR-SALES", createdBy: "USR-ADMIN", createdAt: ago(3 * D) },
    { id: "T-3", contactId: "C-1005", title: "تحديد موعد تجربة العينات مع جمهورها", dueAt: ahead(5 * H), done: false, assigneeId: "USR-SALES2", createdBy: "USR-SALES2", createdAt: ago(D) },
    { id: "T-4", contactId: "C-1011", title: "التأكد من وصول العينة", dueAt: ahead(2 * D), done: false, assigneeId: "USR-PROD", createdBy: "USR-SALES2", createdAt: ago(D) },
    { id: "T-5", contactId: "C-1007", title: "مراجعة ملاحظات العميلة على العرض", dueAt: ago(3 * H), done: false, assigneeId: "USR-SALES2", createdBy: "USR-SALES2", createdAt: ago(4 * D) },
    { id: "T-6", contactId: "C-1008", title: "تسليم ملف المشروع لفريق التصميم", dueAt: ago(6 * D), done: true, assigneeId: "USR-DESIGN", createdBy: "USR-ADMIN", createdAt: ago(10 * D) },
    { id: "T-7", contactId: null, title: "مراجعة الطلبات غير المسندة صباحاً", dueAt: ahead(18 * H), done: false, assigneeId: "USR-ADMIN", createdBy: "USR-ADMIN", createdAt: ago(D) },
  ];

  return {
    team: DEMO_TEAM,
    contacts,
    leads,
    activities: activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tasks,
    payments,
    audit: [
      { id: "AU-1", actorId: "USR-OWNER", action: "team.role", entity: "profile", entityId: "USR-SALES2", detail: "client → sales", createdAt: ago(120 * D) },
      { id: "AU-2", actorId: "USR-ADMIN", action: "crm.assign", entity: "contact", entityId: "C-1006", detail: "→ USR-SALES", createdAt: ago(12 * D) },
      { id: "AU-3", actorId: "USR-SALES", action: "crm.stage", entity: "contact", entityId: "C-1008", detail: "proposal → won", createdAt: ago(8 * D) },
    ],
  };
}
