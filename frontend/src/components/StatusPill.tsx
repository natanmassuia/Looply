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
      className={`status-pill ${STATUS_STYLE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
