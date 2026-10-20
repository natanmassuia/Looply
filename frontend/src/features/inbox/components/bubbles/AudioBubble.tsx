import { useState } from "react";
import AudioPlayer from "../../../../components/AudioPlayer";
import { formatMessageText } from "../../utils/formatMessageText";
import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  msg: ConversationMessageDto;
  searchQuery?: string;
  isSearchActive?: boolean;
}

export default function AudioBubble({
  msg,
  searchQuery = "",
  isSearchActive = false,
}: Props) {
  const fromMe = msg.direction === "OUTBOUND";
  const [showTranscription, setShowTranscription] = useState(true);

  // Resolve audio URL
  let audioUrl: string | null = null;
  if (msg.media?.url) {
    audioUrl = msg.media.url;
  } else if (msg.media?.storageKey) {
    audioUrl = `/api/media/file?key=${encodeURIComponent(msg.media.storageKey)}`;
  } else if (
    msg.body &&
    (msg.body.startsWith("http://") ||
      msg.body.startsWith("https://") ||
      msg.body.startsWith("/api/"))
  ) {
    audioUrl = msg.body;
  }

  const filename = msg.media?.filename || `audio-${msg.id}.ogg`;
  const isCaption =
    msg.body &&
    !msg.body.startsWith("http://") &&
    !msg.body.startsWith("https://") &&
    !msg.body.startsWith("/api/");

  return (
    <div className="w-full space-y-2">
      {/* Audio Player */}
      <AudioPlayer
        url={audioUrl}
        fromMe={fromMe}
        downloadUrl={audioUrl}
        downloadFilename={filename}
      />

      {/* Caption if provided */}
      {isCaption && (
        <div className="whitespace-pre-wrap break-words text-[13px] font-normal leading-relaxed">
          {formatMessageText(msg.body || "", {
            searchQuery,
            isSearchActive,
          })}
        </div>
      )}

      {/* AI Audio Transcription */}
      {msg.transcription && (
        <div className="rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-2.5 text-[12px] text-[var(--looply-color-text-primary)]">
          <div className="mb-1 flex items-center justify-between gap-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--looply-color-text-muted)]">
            <span className="flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5 text-[var(--looply-color-action-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Transcrição por IA
            </span>
            <button
              type="button"
              onClick={() => setShowTranscription((v) => !v)}
              className="cursor-pointer border-none bg-transparent p-0 text-[10px] text-[var(--looply-color-text-brand)] underline hover:opacity-80"
            >
              {showTranscription ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {showTranscription && (
            <p className="break-words italic leading-relaxed text-[var(--looply-color-text-secondary)]">
              "{msg.transcription}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
