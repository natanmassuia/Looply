import { formatMessageText } from "../../utils/formatMessageText";
import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  msg: ConversationMessageDto;
  searchQuery?: string;
  isSearchActive?: boolean;
}

export default function TextBubble({
  msg,
  searchQuery = "",
  isSearchActive = false,
}: Props) {
  const content = msg.body || "";

  return (
    <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap font-normal">
      {formatMessageText(content, {
        searchQuery,
        isSearchActive,
      })}
    </div>
  );
}
