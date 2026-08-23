import type { ConversationMessageDto } from "../../../lib/types";
import { formatMessageTime } from "../utils/time";
import MessageStatusIcon from "./MessageStatusIcon";
import TextBubble from "./bubbles/TextBubble";
import AudioBubble from "./bubbles/AudioBubble";
import ImageBubble from "./bubbles/ImageBubble";
import VideoBubble from "./bubbles/VideoBubble";
import DocumentBubble from "./bubbles/DocumentBubble";
import SystemBubble from "./bubbles/SystemBubble";
import ActionCard from "./bubbles/ActionCard";
import OtherBubble from "./bubbles/OtherBubble";

interface Props {
  msg: ConversationMessageDto;
  searchQuery?: string;
  isSearchActive?: boolean;
  isHighlighted?: boolean;
}

export default function MessageBubble({
  msg,
  searchQuery = "",
  isSearchActive = false,
  isHighlighted = false,
}: Props) {
  if (msg.type === "SYSTEM") {
    return <SystemBubble msg={msg} />;
  }

  const isOutbound = msg.direction === "OUTBOUND";
  const isAi = msg.senderType === "AI";
  const isUser = msg.senderType === "USER";

  const renderBubbleContent = () => {
    switch (msg.type) {
      case "TEXT":
        return (
          <TextBubble
            msg={msg}
            searchQuery={searchQuery}
            isSearchActive={isSearchActive}
          />
        );
      case "AUDIO":
        return (
          <AudioBubble
            msg={msg}
            searchQuery={searchQuery}
            isSearchActive={isSearchActive}
          />
        );
      case "IMAGE":
        return (
          <ImageBubble
            msg={msg}
            searchQuery={searchQuery}
            isSearchActive={isSearchActive}
          />
        );
      case "VIDEO":
        return (
          <VideoBubble
            msg={msg}
            searchQuery={searchQuery}
            isSearchActive={isSearchActive}
          />
        );
      case "DOCUMENT":
        return (
          <DocumentBubble
            msg={msg}
            searchQuery={searchQuery}
            isSearchActive={isSearchActive}
          />
        );
      default:
        return (
          <OtherBubble
            msg={msg}
            searchQuery={searchQuery}
            isSearchActive={isSearchActive}
          />
        );
    }
  };

  return (
    <div
      data-message-id={msg.id}
      className={`flex w-full my-1.5 ${
        isOutbound ? "justify-end" : "justify-start"
      } ${isHighlighted ? "animate-pulse" : ""}`}
    >
      <div
        className={`relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl px-3.5 py-2.5 shadow-sm transition-all ${
          isOutbound
            ? "bg-[var(--looply-color-text-brand,#2563eb)] text-white rounded-br-xs"
            : "bg-[var(--looply-color-bg-surface,#ffffff)] text-[var(--looply-color-text-primary,#18181b)] border border-[var(--looply-color-border-default,#e4e4e7)] rounded-bl-xs"
        } ${
          isHighlighted
            ? "ring-2 ring-yellow-400 dark:ring-yellow-500 shadow-md"
            : ""
        }`}
      >
        {/* SENDER LABEL (for AI or User) */}
        {isOutbound && (
          <div className="flex items-center gap-1 mb-1 text-[11px] font-semibold tracking-wide text-white/90">
            {isAi ? (
              <span className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                <svg
                  className="w-3 h-3 text-yellow-300 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                </svg>
                Looply AI
              </span>
            ) : isUser ? (
              <span className="opacity-90">
                {msg.senderUser?.name || "Operador"}
              </span>
            ) : null}
          </div>
        )}

        {/* BUBBLE CONTENT */}
        {renderBubbleContent()}

        {/* STRUCTURED ACTION CARD */}
        {msg.action && (
          <ActionCard action={msg.action} fromMe={isOutbound} />
        )}

        {/* TIME & DELIVERY STATUS */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10.5px] tabular-nums select-none ${
            isOutbound
              ? "text-white/70"
              : "text-[var(--looply-color-text-muted,#71717a)]"
          }`}
        >
          <span>{formatMessageTime(msg.createdAt)}</span>
          {isOutbound && (
            <MessageStatusIcon status={msg.deliveryStatus} />
          )}
        </div>
      </div>
    </div>
  );
}
