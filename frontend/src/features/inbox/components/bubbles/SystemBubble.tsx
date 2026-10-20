import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  msg: ConversationMessageDto;
}

export default function SystemBubble({ msg }: Props) {
  return (
    <div className="my-2 flex justify-center">
      <div className="max-w-[85%] rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-3 py-1 text-center text-[11px] font-medium text-[var(--looply-color-text-muted)]">
        {msg.body}
      </div>
    </div>
  );
}
