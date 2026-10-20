import { useState, useRef, useEffect, useCallback } from "react";

export interface AudioPlayerProps {
  url: string | null;
  /** When true, uses colors suited for outbound message bubbles */
  fromMe?: boolean;
  downloadUrl?: string | null;
  downloadFilename?: string;
}

// Heights (in px) simulating waveform bars — 40 bars organic pattern from Kore
const WAVE = [
  3, 5, 8, 6, 10, 14, 10, 7, 12, 16, 11, 8, 14, 18, 13, 9, 15, 19, 14, 10,
  16, 20, 15, 11, 13, 17, 12, 8, 14, 18, 10, 7, 11, 15, 9, 6, 10, 13, 7, 4,
];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  url,
  fromMe = false,
  downloadUrl = null,
  downloadFilename = "audio-message.ogg",
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const hackSeekPending = useRef(false);

  // Fix OGG/Opus without Content-Length: browser reports Infinity until seek to end.
  const fixInfiniteDuration = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hackSeekPending.current) return;
    if (!isFinite(audio.duration)) {
      hackSeekPending.current = true;
      audio.currentTime = 1e101;
    }
  }, []);

  const onSeeked = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !hackSeekPending.current) return;
    hackSeekPending.current = false;
    if (isFinite(audio.duration)) {
      setDuration(audio.duration);
      audio.currentTime = 0;
    }
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isFinite(audio.duration)) {
      setDuration(audio.duration);
    } else {
      fixInfiniteDuration();
    }
    audio.playbackRate = playbackRate;
  }, [playbackRate, fixInfiniteDuration]);

  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hackSeekPending.current) return;

    if (isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
      setProgress(audio.currentTime / audio.duration);
    }
  }, []);

  const onEnded = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.playbackRate = 1;
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setCurrentTime(0);
    setPlaybackRate(1);
    setHasError(false);
  }, [url]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setIsPlaying(false);
    }
  };

  const cycleSpeed = () => {
    const rates = [1, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const handleDownload = async () => {
    if (!downloadUrl || isDownloading) return;

    setIsDownloading(true);
    try {
      const isLocal = downloadUrl.startsWith("/") || downloadUrl.startsWith(window.location.origin);
      const response = await fetch(downloadUrl, {
        credentials: isLocal ? "include" : "omit",
      });
      if (!response.ok) throw new Error("audio-download-failed");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Best-effort
    } finally {
      setIsDownloading(false);
    }
  };

  // Seek clicking waveform
  const handleWaveClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(duration) || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setProgress(pct);
    setCurrentTime(pct * duration);
  };

  // Colors adapted for Looply theme (outbound vs inbound bubble)
  const barActive = "bg-[var(--looply-color-action-primary)]";
  const barInactive = "bg-[var(--looply-color-border-strong)]";
  const timeColor = "text-[var(--looply-color-text-muted)]";
  const btnBg =
    "bg-[var(--looply-color-action-primary)] hover:bg-[var(--looply-color-action-primary-hover)] text-[var(--looply-color-text-on-brand)]";
  const speedBg = fromMe
    ? "bg-[var(--looply-color-bg-surface)] hover:bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-primary)]"
    : "bg-[var(--looply-color-bg-subtle)] hover:bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-primary)]";
  const iconBg = fromMe
    ? "bg-[var(--looply-color-bg-surface)] hover:bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-primary)]"
    : "bg-[var(--looply-color-bg-subtle)] hover:bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-primary)]";

  const activeBars = Math.round(progress * WAVE.length);

  const onAudioError = useCallback(() => {
    setHasError(true);
    setIsPlaying(false);
  }, []);

  if (!url || hasError) {
    return (
      <div className="flex min-w-[220px] max-w-[320px] items-center rounded-xl bg-[var(--looply-color-bg-subtle,#f4f4f5)] px-4 py-3 text-xs font-semibold text-[var(--looply-color-text-muted,#71717a)]">
        Não foi possível carregar o áudio.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[220px] max-w-[320px]">
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={onLoadedMetadata}
        onSeeked={onSeeked}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={onAudioError}
        preload="metadata"
        className="hidden"
      />

      {/* Play / Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
        className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full transition-all active:scale-90 border-none cursor-pointer ${btnBg}`}
      >
        {isPlaying ? (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M5 3l14 9-14 9V3z" />
          </svg>
        )}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Clickable waveform */}
        <div
          ref={waveRef}
          role="slider"
          aria-label="Progresso do áudio"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          className="flex items-end gap-[2px] h-[20px] cursor-pointer"
          onClick={handleWaveClick}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              const audio = audioRef.current;
              if (audio && duration) {
                audio.currentTime = Math.min(duration, audio.currentTime + 5);
              }
            } else if (e.key === "ArrowLeft") {
              const audio = audioRef.current;
              if (audio && duration) {
                audio.currentTime = Math.max(0, audio.currentTime - 5);
              }
            }
          }}
        >
          {WAVE.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors duration-100 ${
                i < activeBars ? barActive : barInactive
              }`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        {/* Time and Speed */}
        <div className="flex justify-between items-center">
          <span className={`text-[10px] font-semibold tabular-nums ${timeColor}`}>
            {isPlaying || currentTime > 0
              ? formatTime(currentTime)
              : formatTime(duration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label="Alterar velocidade do áudio"
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all border-none cursor-pointer ${speedBg}`}
          >
            {playbackRate}×
          </button>
        </div>
      </div>

      {downloadUrl && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          aria-label="Baixar áudio"
          className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md transition-all border-none cursor-pointer disabled:cursor-wait disabled:opacity-60 ${iconBg}`}
        >
          {isDownloading ? (
            <svg
              className="h-3.5 w-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
          ) : (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
