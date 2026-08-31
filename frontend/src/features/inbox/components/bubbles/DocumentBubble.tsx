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
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
          docUrl ? "hover:opacity-90 cursor-pointer" : "opacity-75 cursor-default"
        } ${
          msg.direction === "OUTBOUND"
            ? "bg-white/10 border-white/20 text-white"
            : "bg-[var(--looply-color-bg-subtle,#f4f4f5)] border-[var(--looply-color-border-default,#e4e4e7)] text-[var(--looply-color-text-primary,#18181b)]"
        }`}
        onClick={(e) => {
          if (!docUrl) e.preventDefault();
        }}
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            msg.direction === "OUTBOUND"
              ? "bg-white/20 text-white"
              : "bg-[var(--looply-color-text-brand,#2563eb)]/10 text-[var(--looply-color-text-brand,#2563eb)]"
          }`}
        >
          <svg
            className="w-5 h-5"
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
          <p className="text-[13px] font-semibold truncate leading-tight">
            {filename}
          </p>
          {sizeFormatted && (
            <p
              className={`text-[11px] mt-0.5 ${
                msg.direction === "OUTBOUND"
                  ? "text-white/70"
                  : "text-[var(--looply-color-text-muted,#71717a)]"
              }`}
            >
              {sizeFormatted}
            </p>
          )}
        </div>

        {docUrl && (
          <div className="shrink-0 opacity-75">
            <svg
              className="w-4 h-4"
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
        <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap font-normal">
          {formatMessageText(msg.body || "", {
            searchQuery,
            isSearchActive,
          })}
        </div>
      )}
    </div>
  );
}
