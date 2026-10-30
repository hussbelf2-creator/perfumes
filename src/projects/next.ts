// «خطوتك التالية»: ما ينتظر العميل الآن، الأهم أولاً — العربون يبدأ العمل، ثم العرض، ثم التصاميم
import type { ProjectsData } from "./repo";
import type { ProjectItem, Quote } from "./types";
import type { Contract } from "@/contracts/types";

export type ClientAction =
  | { kind: "deposit"; projectId: string; to: string; quote: Quote; since: string }
  | { kind: "contract"; projectId: string; to: string; contract: Contract; since: string }
  | { kind: "quote"; projectId: string; to: string; quote: Quote; since: string }
  | { kind: "design"; projectId: string; to: string; item: ProjectItem; since: string };

const RANK: Record<ClientAction["kind"], number> = { deposit: 0, contract: 1, quote: 2, design: 3 };

export function clientActions(d: Pick<ProjectsData, "items" | "quotes"> & Partial<Pick<ProjectsData, "contracts">>): ClientAction[] {
  const out: ClientAction[] = [
    ...d.quotes
      .filter((q) => q.status === "accepted" && q.deposit > 0)
      .map((q): ClientAction => ({ kind: "deposit", projectId: q.projectId, to: `/account/projects/${q.projectId}#pj-quote`, quote: q, since: q.decidedAt ?? q.createdAt })),
    ...d.quotes
      // العرض المنتهي لا يُعتمد: لا نطلب من العميل مراجعته
      .filter((q) => q.status === "sent" && !(q.validUntil && q.validUntil < new Date().toISOString().slice(0, 10)))
      .map((q): ClientAction => ({ kind: "quote", projectId: q.projectId, to: `/account/projects/${q.projectId}#pj-quote`, quote: q, since: q.sentAt ?? q.createdAt })),
    // عقد بانتظار توقيع العميل
    ...(d.contracts ?? [])
      .filter((c) => c.status === "sent" && !c.clientSignature)
      .map((c): ClientAction => ({ kind: "contract", projectId: c.projectId, to: `/account/projects/${c.projectId}#pj-contract`, contract: c, since: c.sentAt ?? c.createdAt })),
    ...d.items
      .filter((i) => i.status === "pending")
      .map((i): ClientAction => ({ kind: "design", projectId: i.projectId, to: `/account/projects/${i.projectId}#it-${i.id}`, item: i, since: i.createdAt })),
  ];
  // الأهم نوعاً، ثم الأقدم انتظاراً
  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.since.localeCompare(b.since));
}
