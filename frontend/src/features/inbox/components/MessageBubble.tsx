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
      className={`my-1.5 flex w-full ${
        isOutbound ? "justify-end" : "justify-start"
      } ${isHighlighted ? "animate-pulse" : ""}`}
    >
      <div
        className={`relative max-w-[85%] rounded-[10px] border px-3.5 py-2.5 transition-all sm:max-w-[75%] md:max-w-[68%] ${
          isOutbound
            ? "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)]"
            : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-primary)]"
        } ${
          isHighlighted
            ? "ring-2 ring-[var(--looply-color-action-primary)] shadow-md"
            : ""
        }`}
      >
        {/* SENDER LABEL (for AI or User — Figma 16 490:7) */}
        {isOutbound && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[var(--looply-color-text-secondary)]">
            {isAi ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--looply-color-coral-100)] px-2 py-0.5 text-[10px] font-bold text-[var(--looply-color-text-primary)]">
                <svg
                  className="h-3 w-3 fill-current text-[var(--looply-color-action-primary)]"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                </svg>
                Looply AI
              </span>
            ) : isUser ? (
              <span className="text-[10.5px] font-bold text-[var(--looply-color-text-primary)]">
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
        <div className="mt-1 flex select-none items-center justify-end gap-1 text-[10px] tabular-nums text-[var(--looply-color-text-muted)]">
          <span>{formatMessageTime(msg.createdAt)}</span>
          {isOutbound && (
            <MessageStatusIcon status={msg.deliveryStatus} />
          )}
        </div>
      </div>
    </div>
  );
}
