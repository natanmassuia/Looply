import { useEffect, useRef } from "react";
import { IconSearch, IconChevronUp, IconChevronDown, IconX } from "../../../components/Icons";

interface Props {
  query: string;
  setQuery: (query: string) => void;
  matchesCount: number;
  activeIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export default function ConversationSearchBar({
  query,
  setQuery,
  matchesCount,
  activeIndex,
  onNext,
  onPrevious,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      if (e.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    }
  };

  return (
    <div
      role="search"
      aria-label="Buscar na conversa"
      className="
        absolute left-0 right-0 top-0 z-20 flex items-center gap-2
        border-b border-[var(--looply-color-border-default)]
        bg-[var(--looply-color-bg-surface)] p-2.5 shadow-sm transition-all
      "
    >
      <div className="relative flex-1">
        <IconSearch
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--looply-color-text-muted)]"
          strokeWidth={2}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar na conversa..."
          aria-label="Termo de busca na conversa"
          className="
            w-full rounded-[10px] border
            border-[var(--looply-color-border-default)]
            bg-[var(--looply-color-bg-subtle)] py-1.5 pl-9 pr-4 text-xs
            text-[var(--looply-color-text-primary)]
            placeholder:text-[var(--looply-color-text-muted)]
            focus:border-[var(--looply-color-action-primary)]
            focus:outline-none transition-all
          "
        />
      </div>

      <div className="flex items-center gap-1 border-l border-[var(--looply-color-border-default)] pl-2">
        <span className="min-w-[50px] text-center text-[11px] font-semibold tabular-nums text-[var(--looply-color-text-muted)]">
          {matchesCount > 0
            ? `${activeIndex + 1} / ${matchesCount}`
            : query
            ? "0 / 0"
            : "0"}
        </span>

        {/* Previous match */}
        <button
          type="button"
          onClick={onPrevious}
          disabled={matchesCount === 0}
          aria-label="Resultado anterior"
          title="Resultado anterior (Shift + Enter)"
          className="
            cursor-pointer rounded-[8px] border-none bg-transparent p-1.5
            text-[var(--looply-color-text-muted)] transition-colors
            hover:bg-[var(--looply-color-bg-subtle)]
            hover:text-[var(--looply-color-text-primary)]
            disabled:opacity-30
          "
        >
          <IconChevronUp className="h-4 w-4" strokeWidth={2} />
        </button>

        {/* Next match */}
        <button
          type="button"
          onClick={onNext}
          disabled={matchesCount === 0}
          aria-label="Próximo resultado"
          title="Próximo resultado (Enter)"
          className="
            cursor-pointer rounded-[8px] border-none bg-transparent p-1.5
            text-[var(--looply-color-text-muted)] transition-colors
            hover:bg-[var(--looply-color-bg-subtle)]
            hover:text-[var(--looply-color-text-primary)]
            disabled:opacity-30
          "
        >
          <IconChevronDown className="h-4 w-4" strokeWidth={2} />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar busca"
          title="Fechar busca (Esc)"
          className="
            cursor-pointer rounded-[8px] border-none bg-transparent p-1.5
            text-[var(--looply-color-text-muted)] transition-colors
            hover:bg-[var(--looply-color-coral-100)]
            hover:text-[var(--looply-color-status-danger)]
          "
        >
          <IconX className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
