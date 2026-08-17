import React, { useEffect } from "react";
import { IconX } from "./Icons";

export interface ModalOrSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function ModalOrSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-lg",
}: ModalOrSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-sheet-title"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-150"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-default"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Surface: Bottom Sheet on mobile (<md), Centered Modal on desktop (md+) */}
      <div
        className={`relative z-10 flex flex-col w-full bg-[var(--looply-color-bg-surface)] shadow-looply-lg border border-[var(--looply-color-border-default)] ${maxWidth}
          rounded-t-2xl md:rounded-2xl max-h-[92vh] md:max-h-[88vh] overflow-hidden`}
      >
        {/* Mobile Pull Handle */}
        <div className="flex items-center justify-center pt-2.5 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--looply-color-border-default)]" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-[var(--looply-color-border-default)] px-5 py-4">
          <div className="min-w-0 pr-4">
            <h2 id="modal-sheet-title" className="text-[15px] font-bold tracking-tight text-[var(--looply-color-text-primary)]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] text-[var(--looply-color-text-muted)]">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] transition-colors"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-[var(--looply-color-text-primary)]">
          {children}
        </div>
      </div>
    </div>
  );
}
