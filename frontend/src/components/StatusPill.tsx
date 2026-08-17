import { STATUS_LABEL, STATUS_STYLE } from "../lib/format";
import type { ContentStatus } from "../lib/types";

const statusDot: Record<ContentStatus, string> = {
  DRAFT: "bg-slate-400",
  IN_REVIEW: "bg-amber-500",
  AWAITING_CLIENT: "bg-violet-500",
  CHANGES_REQUESTED: "bg-rose-500",
  APPROVED: "bg-emerald-500",
  SCHEDULED: "bg-blue-500",
  PUBLISHED: "bg-teal-500",
};

export default function StatusPill({ status }: { status: ContentStatus }) {
  return (
    <span
      className={`status-pill min-w-0 max-w-full ${STATUS_STYLE[status]}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[status]}`} />
      {/* Wrapping label: allows long statuses (e.g. "Aguardando cliente") to
          stay inside the pill on narrow cards instead of escaping the group. */}
      <span className="min-w-0 whitespace-normal">{STATUS_LABEL[status]}</span>
    </span>
  );
}
