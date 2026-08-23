import { useState } from "react";
import { formatMessageText } from "../../utils/formatMessageText";
import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  msg: ConversationMessageDto;
  searchQuery?: string;
  isSearchActive?: boolean;
}

export default function ImageBubble({
  msg,
  searchQuery = "",
  isSearchActive = false,
}: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Resolve image URL
  let imageUrl: string | null = null;
  if (msg.media?.url) {
    imageUrl = msg.media.url;
  } else if (msg.media?.storageKey) {
    imageUrl = `/api/media/file?key=${encodeURIComponent(msg.media.storageKey)}`;
  } else if (
    msg.body &&
    (msg.body.startsWith("http://") ||
      msg.body.startsWith("https://") ||
      msg.body.startsWith("/api/"))
  ) {
    imageUrl = msg.body;
  }

  const isCaption =
    msg.body &&
    !msg.body.startsWith("http://") &&
    !msg.body.startsWith("https://") &&
    !msg.body.startsWith("/api/");

  return (
    <div className="w-full space-y-2">
      {imageUrl && (
        <div
          className="relative rounded-lg overflow-hidden border border-black/5 dark:border-white/10 cursor-pointer group bg-black/5 dark:bg-white/5"
          style={{ maxWidth: "320px" }}
          onClick={() => setModalOpen(true)}
        >
          {!isLoaded && !hasError && (
            <div className="w-[280px] h-[180px] flex items-center justify-center animate-pulse bg-zinc-200 dark:bg-zinc-800">
              <svg
                className="w-6 h-6 animate-spin text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            </div>
          )}

          {hasError ? (
            <div className="w-[280px] h-[120px] flex flex-col items-center justify-center p-3 text-center text-xs text-zinc-500">
              <span>Imagem indisponível</span>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={msg.media?.filename || "Imagem da mensagem"}
              className={`max-w-full max-h-[360px] object-cover transition-opacity duration-200 group-hover:opacity-90 ${
                isLoaded ? "opacity-100" : "opacity-0 absolute inset-0"
              }`}
              onLoad={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
            />
          )}
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

      {/* Lightbox / Modal */}
      {modalOpen && imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visualização de imagem"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt="Mídia expandida"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Fechar"
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center font-bold shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
