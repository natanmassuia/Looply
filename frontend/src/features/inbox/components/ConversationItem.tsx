import type { ConversationSummaryDto } from "../../../lib/types";
import { formatTimeAgo } from "../utils/time";

interface Props {
  conversation: ConversationSummaryDto;
  isSelected: boolean;
  onClick: () => void;
  now?: number;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "C"
  );
}

function formatPhone(phone: string): string {
  if (phone.startsWith("+55") && phone.length === 14) {
    return phone.replace(/(\+55)(\d{2})(\d{5})(\d{4})/, "$1 ($2) $3-$4");
  }
  if (phone.startsWith("+55") && phone.length === 13) {
    return phone.replace(/(\+55)(\d{2})(\d{4})(\d{4})/, "$1 ($2) $3-$4");
  }
  return phone;
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
  const timeLabel = formatTimeAgo(conversation.lastMessageAt || conversation.updatedAt, now);

  return (
    <button
      type="button"
      onClick={onClick}
      role="button"
      aria-selected={isSelected}
      aria-label={`Conversa com ${displayName}`}
      className={`w-full text-left p-3 rounded-xl transition-all border flex items-start gap-3 cursor-pointer select-none ${
        isSelected
          ? "bg-[var(--looply-color-bg-subtle,#f4f4f5)] border-[var(--looply-color-text-brand,#2563eb)]/30 shadow-xs"
          : "bg-[var(--looply-color-bg-surface,#ffffff)] border-transparent hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)]/60 hover:border-[var(--looply-color-border-default,#e4e4e7)]"
      }`}
    >
      {/* Contact Avatar + AI Status Dot */}
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-brand,#2563eb)] font-bold text-sm border border-[var(--looply-color-border-default,#e4e4e7)] overflow-hidden">
          {conversation.contactAvatarUrl ? (
            <img
              src={conversation.contactAvatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials(displayName)}</span>
          )}
        </div>

        {/* AI Status Dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--looply-color-bg-surface,#ffffff)] ${
            aiStatus === "ACTIVE"
              ? "bg-emerald-500"
              : aiStatus === "PAUSED"
              ? "bg-amber-500"
              : "bg-rose-500"
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

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <h3 className="text-sm font-semibold text-[var(--looply-color-text-primary,#18181b)] truncate">
            {displayName}
          </h3>
          <span className="text-[11px] text-[var(--looply-color-text-muted,#71717a)] tabular-nums shrink-0">
            {timeLabel}
          </span>
        </div>

        {/* Client badge if linked */}
        {conversation.client && (
          <div className="mb-1">
            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 truncate max-w-[160px]">
              {conversation.client.name}
            </span>
          </div>
        )}

        {/* Preview and Unread badge */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--looply-color-text-muted,#71717a)] truncate leading-relaxed">
            {conversation.lastMessagePreview || "Nenhuma mensagem"}
          </p>

          {conversation.unreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 bg-[var(--looply-color-text-brand,#2563eb)] text-white text-[10.5px] font-bold rounded-full flex items-center justify-center shadow-xs">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
