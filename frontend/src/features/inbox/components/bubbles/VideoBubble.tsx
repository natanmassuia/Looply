import { formatMessageText } from "../../utils/formatMessageText";
import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  msg: ConversationMessageDto;
  searchQuery?: string;
  isSearchActive?: boolean;
}

export default function VideoBubble({
  msg,
  searchQuery = "",
  isSearchActive = false,
}: Props) {
  let videoUrl: string | null = null;
  if (msg.media?.url) {
    videoUrl = msg.media.url;
  } else if (msg.media?.storageKey) {
    videoUrl = `/api/media/file?key=${encodeURIComponent(msg.media.storageKey)}`;
  } else if (
    msg.body &&
    (msg.body.startsWith("http://") ||
      msg.body.startsWith("https://") ||
      msg.body.startsWith("/api/"))
  ) {
    videoUrl = msg.body;
  }

  const isCaption =
    msg.body &&
    !msg.body.startsWith("http://") &&
    !msg.body.startsWith("https://") &&
    !msg.body.startsWith("/api/");

  return (
    <div className="w-full space-y-2">
      {videoUrl && (
        <div className="relative rounded-lg overflow-hidden border border-black/5 dark:border-white/10 max-w-[320px] bg-black">
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="w-full max-h-[360px] rounded-lg"
          >
            Seu navegador não suporta reprodução de vídeo.
          </video>
        </div>
      )}

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
