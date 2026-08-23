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
        <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap font-normal">
          {formatMessageText(msg.body || "", {
            searchQuery,
            isSearchActive,
          })}
        </div>
      )}

      {/* AI Audio Transcription */}
      {msg.transcription && (
        <div
          className={`rounded-lg p-2.5 text-[12.5px] border ${
            fromMe
              ? "bg-white/10 border-white/20 text-white"
              : "bg-[var(--looply-color-bg-subtle,#f4f4f5)] border-[var(--looply-color-border-default,#e4e4e7)] text-[var(--looply-color-text-primary,#18181b)]"
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1 font-semibold text-[11px] uppercase tracking-wider opacity-80">
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
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
              className="text-[10px] opacity-75 hover:opacity-100 underline cursor-pointer bg-transparent border-none p-0"
            >
              {showTranscription ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {showTranscription && (
            <p className="leading-relaxed italic break-words">
              "{msg.transcription}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
