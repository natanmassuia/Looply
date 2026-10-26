import type { ConversationSummaryDto } from "../../../lib/types";
import { formatTimeAgo } from "../utils/time";
import { formatPhone, initials } from "../../../lib/format";

interface Props {
  conversation: ConversationSummaryDto;
  isSelected: boolean;
  onClick: () => void;
  now?: number;
}

export default function ConversationItem({
  conversation,
  isSelected,
  onClick,
  now,
}: Props) {
  const displayName =
    conversation.contactName || formatPhone(conversation.remotePhone);
  const aiStatus = conversation.aiStatus;
  const timeLabel = formatTimeAgo(
    conversation.lastMessageAt || conversation.updatedAt,
    now,
  );

  const statusTagLabel =
    aiStatus === "ACTIVE"
      ? "IA"
      : aiStatus === "PAUSED"
      ? "Pausa"
      : "!";

  return (
    <button
      type="button"
      onClick={onClick}
      role="button"
      aria-selected={isSelected}
      aria-label={`Conversa com ${displayName}`}
      className={`flex w-full cursor-pointer select-none items-start gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? "border-[var(--looply-color-action-primary)] bg-[var(--looply-color-bg-subtle)]"
          : "border-transparent bg-[var(--looply-color-bg-surface)] hover:bg-[var(--looply-color-bg-subtle)]"
      }`}
    >
      {/* Contact Avatar (Figma 16 — 40×40 coral-100 circle + text-primary initials) */}
      <div className="relative shrink-0">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--looply-color-coral-100)] text-xs font-bold text-[var(--looply-color-text-primary)]">
          {conversation.contactAvatarUrl ? (
            <img
              src={conversation.contactAvatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initials(displayName)}</span>
          )}
        </div>

        {/* AI Status Dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--looply-color-bg-surface)] ${
            aiStatus === "ACTIVE"
              ? "bg-[var(--looply-color-status-success)]"
              : aiStatus === "PAUSED"
              ? "bg-[var(--looply-color-status-warning)]"
              : "bg-[var(--looply-color-status-danger)]"
          }`}
          title={
            aiStatus === "ACTIVE"
              ? "IA Ativa"
              : aiStatus === "PAUSED"
              ? "IA Pausada"
              : "Requer Atenção"
          }
        />
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <h3 className="truncate text-[13px] font-bold text-[var(--looply-color-text-primary)]">
            {displayName}
          </h3>
          <span className="shrink-0 text-[10px] tabular-nums text-[var(--looply-color-text-muted)]">
            {timeLabel}
          </span>
        </div>

        {/* Preview and Status / Unread badges — client chip folded inline to
            keep rows dense (no dedicated badge line) */}
        <div className="mt-0.5 flex items-center gap-2">
          {conversation.client && (
            <span className="max-w-[90px] shrink-0 truncate rounded-[6px] bg-[color-mix(in_srgb,var(--looply-color-action-primary)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--looply-color-text-primary)]">
              {conversation.client.name}
            </span>
          )}
          <p className="min-w-0 flex-1 truncate text-[11px] leading-snug text-[var(--looply-color-text-secondary)]">
            {conversation.lastMessagePreview || "Nenhuma mensagem"}
          </p>

          <div className="flex shrink-0 items-center gap-1">
            <span
              className={`rounded-[8px] px-1.5 py-0.5 text-[10px] font-semibold ${
                isSelected
                  ? "bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-secondary)]"
                  : "bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-secondary)]"
              }`}
            >
              {statusTagLabel}
            </span>

            {conversation.unreadCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--looply-color-action-primary)] px-1 text-[10px] font-bold text-[var(--looply-color-text-on-brand)]">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
