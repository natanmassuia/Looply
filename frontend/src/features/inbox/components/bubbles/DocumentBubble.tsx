import { formatMessageText } from "../../utils/formatMessageText";
import type { ConversationMessageDto } from "../../../../lib/types";
import { IconFileText, IconDownload } from "../../../../components/Icons";
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
          <IconFileText className="h-5 w-5" strokeWidth={2} />
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
            <IconDownload className="h-4 w-4" strokeWidth={2} />
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
