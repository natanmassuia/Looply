/**
 * ImageUpload — reusable identity image upload widget.
 *
 * Handles: file picker → local preview → upload mutation → error display.
 * Shows current image (or initials fallback) with action buttons.
 * Client-side validates MIME and 5 MB before touching the network.
 */
import { useEffect, useRef, useState } from "react";
import { ApiError, validateImageFile } from "../lib/api";

const ACCEPTED = "image/jpeg,image/png,image/webp";

export type ImageUploadStatus = "idle" | "uploading" | "error";

interface ImageUploadProps {
  /** Current image URL (from backend, e.g. /api/media/file?key=...) */
  currentUrl?: string | null;
  /** Initials fallback when no image */
  initials?: string;
  /** Background colour for initials circle */
  bgColor?: string;
  /** Upload mutation (accepts File, returns anything) */
  onUpload: (file: File) => Promise<unknown>;
  /** Delete mutation */
  onDelete?: () => Promise<unknown>;
  /** Label shown on the upload button when no image exists */
  addLabel?: string;
  /** Label shown on the upload button when image exists */
  changeLabel?: string;
  /** Label shown on the delete button */
  removeLabel?: string;
  /** Shape: 'circle' | 'square' */
  shape?: "circle" | "square";
  /** Size class (Tailwind w-* h-*) */
  size?: string;
  /** Whether buttons are disabled externally */
  disabled?: boolean;
}

export default function ImageUpload({
  currentUrl,
  initials = "?",
  bgColor = "var(--looply-color-bg-subtle)",
  onUpload,
  onDelete,
  addLabel = "Adicionar foto",
  changeLabel = "Alterar foto",
  removeLabel = "Remover foto",
  shape = "circle",
  size = "w-20 h-20",
  disabled = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<ImageUploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const effectiveUrl = preview ?? currentUrl ?? null;
  const hasImage = Boolean(effectiveUrl);
  const roundedClass = shape === "circle" ? "rounded-full" : "rounded-xl";
  const isLoading = status === "uploading";

  function pickFile() {
    if (disabled || isLoading) return;
    inputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target) return;
    // reset input so same file can be re-selected
    (e.target as HTMLInputElement).value = "";
    if (!file) return;

    setError(null);

    // Client-side validation first for fast UX
    try {
      validateImageFile(file);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Arquivo inválido");
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setStatus("uploading");

    try {
      await onUpload(file);
      setStatus("idle");
      // Keep preview until parent invalidates query and re-renders with new currentUrl
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof ApiError
          ? err.message
          : "Falha ao enviar imagem. Tente novamente.",
      );
      // Revert preview
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setShowDeleteConfirm(false);
    setError(null);
    setStatus("uploading");
    try {
      await onDelete();
      setPreview(null);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof ApiError
          ? err.message
          : "Falha ao remover imagem. Tente novamente.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Image / initials preview */}
      <div className="flex items-center gap-4">
        <div
          className={`${size} ${roundedClass} flex-shrink-0 overflow-hidden relative`}
          style={{ background: hasImage ? undefined : bgColor, border: "1px solid var(--looply-color-border-default)" }}
        >
          {effectiveUrl ? (
            <img
              src={effectiveUrl}
              alt="Foto"
              className={`w-full h-full object-cover ${isLoading ? "opacity-60" : ""}`}
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-[var(--looply-color-text-brand)] font-bold text-xl select-none">
              {initials.slice(0, 2).toUpperCase()}
            </span>
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={pickFile}
            disabled={disabled || isLoading}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            {hasImage ? changeLabel : addLabel}
          </button>
          {hasImage && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={disabled || isLoading}
              className="text-xs text-[var(--looply-color-text-muted)] hover:text-red-500 transition-colors text-left"
            >
              {removeLabel}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--looply-color-text-muted)]">Remover imagem?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="btn-secondary text-xs py-1 px-2.5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs px-2.5 py-1 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={handleFileChange}
        aria-label="Selecionar imagem"
      />
    </div>
  );
}
