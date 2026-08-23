import { formatMessageText } from "../../utils/formatMessageText";
import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  msg: ConversationMessageDto;
  searchQuery?: string;
  isSearchActive?: boolean;
}

export default function OtherBubble({
  msg,
  searchQuery = "",
  isSearchActive = false,
}: Props) {
  return (
    <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap font-normal italic opacity-90">
      {msg.body ? (
        formatMessageText(msg.body, { searchQuery, isSearchActive })
      ) : (
        <span>[Mensagem: {msg.type}]</span>
      )}
    </div>
  );
}
