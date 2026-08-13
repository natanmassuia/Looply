import { STATUS_LABEL, STATUS_STYLE } from "../lib/format";
import type { ContentStatus } from "../lib/types";

export default function StatusPill({ status }: { status: ContentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
