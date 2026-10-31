import { STATUS_LABEL, STATUS_STYLE } from "../lib/format";
import type { ContentStatus } from "../lib/types";

const statusDot: Record<ContentStatus, string> = {
  DRAFT: "bg-[var(--looply-color-stage-draft)]",
  IN_REVIEW: "bg-[var(--looply-color-stage-review)]",
  AWAITING_CLIENT: "bg-[var(--looply-color-stage-awaiting)]",
  CHANGES_REQUESTED: "bg-[var(--looply-color-stage-changes)]",
  APPROVED: "bg-[var(--looply-color-stage-approved)]",
  SCHEDULED: "bg-[var(--looply-color-stage-scheduled)]",
  PUBLISHED: "bg-[var(--looply-color-stage-published)]",
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
