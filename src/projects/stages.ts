// مراحل المشروع حسب مسار الخدمة: عميل الطباعة لا يرى «تطوير التركيبة» مرحلة معلّقة.
// الأسماء والمدد من خطوات الخدمة نفسها (src/data/services.ts)، والمفاتيح مطابقة لـ track_stages في supabase/schema.sql.
// الاستيراد نسبي لأن دالة الإشعار على الخادم (api/) تستخدم هذا الملف أيضاً.
import type { Bi } from "../i18n/context";
import { trackInfo } from "../data/tracks";
import { PROJECT_STAGES, STAGE_LABELS } from "./types";

/** مفاتيح خطوات كل مسار بترتيبها (الأولى دائماً brief)، ثم «التسليم» للجميع */
export const TRACK_STAGE_KEYS: Record<string, string[]> = {
  A: ["brief", "formula", "identity", "production"],
  B: ["brief", "first_round", "refinement", "approval"],
  C: ["brief", "design", "prototype"],
  D: ["brief", "concepts", "system"],
  E: ["brief", "sourcing", "production"],
  F: ["brief", "proof", "printing"],
  P: ["brief", "sampling", "bottling"],
};

export interface StageDef {
  id: string;
  label: Bi;
  time?: Bi;
}

export function stagesFor(track?: string | null): StageDef[] {
  const t = trackInfo(track);
  if (!t || !TRACK_STAGE_KEYS[t.id]) return PROJECT_STAGES.map((id) => ({ id, label: STAGE_LABELS[id] }));
  return [...TRACK_STAGE_KEYS[t.id].map((id, i) => ({ id, label: t.steps[i].title, time: t.steps[i].time })), { id: "delivered", label: STAGE_LABELS.delivered }];
}

export const stageOk = (track: string | null | undefined, stage: string) => stagesFor(track).some((s) => s.id === stage);

export function stageLabel(track: string | null | undefined, stage: string): Bi {
  return stagesFor(track).find((s) => s.id === stage)?.label ?? { ar: stage, en: stage };
}

/** عند تغيير مسار المشروع: المرحلة نفسها إن وُجدت فيه، وإلا ما يقابل موضعها */
export function mapStage(from: string | null | undefined, to: string | null | undefined, stage: string): string {
  const target = stagesFor(to);
  if (target.some((s) => s.id === stage)) return stage;
  const src = stagesFor(from);
  const at = Math.max(0, src.findIndex((s) => s.id === stage));
  if (at === src.length - 1) return "delivered";
  return target[Math.min(at, target.length - 2)].id;
}
