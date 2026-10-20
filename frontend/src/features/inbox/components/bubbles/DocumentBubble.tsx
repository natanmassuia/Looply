import { formatMessageText } from "../../utils/formatMessageText";
import type { ConversationMessageDto } from "../../../../lib/types";
import { safeHref } from "../../../../lib/url";

interface Props {
  msg: ConversationMessageDto;
  searchQuery?: string;
  isSearchActive?: boolean;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentBubble({
  msg,
  searchQuery = "",
  isSearchActive = false,
}: Props) {
  let docUrl: string | null = null;
  if (msg.media?.url) {
    docUrl = msg.media.url;
  } else if (msg.media?.storageKey) {
    docUrl = `/api/media/file?key=${encodeURIComponent(msg.media.storageKey)}`;
  } else if (
    msg.body &&
    (msg.body.startsWith("http://") ||
      msg.body.startsWith("https://") ||
      msg.body.startsWith("/api/"))
  ) {
    docUrl = msg.body;
  }

  const filename = msg.media?.filename || "Documento";
  const sizeFormatted = formatBytes(msg.media?.sizeBytes);
  const isCaption =
    msg.body &&
    !msg.body.startsWith("http://") &&
    !msg.body.startsWith("https://") &&
    !msg.body.startsWith("/api/");

  return (
    <div className="w-full space-y-2">
      <a
        href={safeHref(docUrl) ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        download={filename}
        className={`flex items-center gap-3 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-3 text-[var(--looply-color-text-primary)] transition-all ${
          docUrl ? "cursor-pointer hover:opacity-90" : "cursor-default opacity-75"
        }`}
        onClick={(e) => {
          if (!docUrl) e.preventDefault();
        }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--looply-color-coral-100)] text-[var(--looply-color-action-primary)]">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-[var(--looply-color-text-primary)]">
            {filename}
          </p>
          {sizeFormatted && (
            <p className="mt-0.5 text-[11px] text-[var(--looply-color-text-muted)]">
              {sizeFormatted}
            </p>
          )}
        </div>

        {docUrl && (
          <div className="shrink-0 text-[var(--looply-color-text-muted)]">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
        )}
      </a>

      {isCaption && (
        <div className="whitespace-pre-wrap break-words text-[13px] font-normal leading-relaxed">
          {formatMessageText(msg.body || "", {
            searchQuery,
            isSearchActive,
          })}
        </div>
      )}
    </div>
  );
}
