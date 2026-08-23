import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  msg: ConversationMessageDto;
}

export default function SystemBubble({ msg }: Props) {
  return (
    <div className="flex justify-center my-2">
      <div className="bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-muted,#71717a)] text-[11px] font-medium px-3 py-1 rounded-full shadow-sm max-w-[85%] text-center border border-[var(--looply-color-border-default,#e4e4e7)]">
        {msg.body}
      </div>
    </div>
  );
}
