import { useEffect, useRef } from "react";

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
      className="absolute top-0 left-0 right-0 z-20 p-2.5 bg-[var(--looply-color-bg-surface,#ffffff)]/95 backdrop-blur-md border-b border-[var(--looply-color-border-default,#e4e4e7)] flex items-center gap-2 shadow-sm transition-all"
    >
      <div className="flex-1 relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--looply-color-text-muted,#71717a)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar na conversa..."
          aria-label="Termo de busca na conversa"
          className="w-full pl-9 pr-4 py-1.5 bg-[var(--looply-color-bg-subtle,#f4f4f5)] border border-[var(--looply-color-border-default,#e4e4e7)] focus:border-[var(--looply-color-text-brand,#2563eb)] rounded-lg text-sm transition-all outline-none text-[var(--looply-color-text-primary,#18181b)] placeholder:text-[var(--looply-color-text-muted,#71717a)]"
        />
      </div>

      <div className="flex items-center gap-1 border-l border-[var(--looply-color-border-default,#e4e4e7)] pl-2">
        <span className="text-[11px] font-semibold text-[var(--looply-color-text-muted,#71717a)] min-w-[50px] text-center tabular-nums">
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
          className="p-1.5 text-[var(--looply-color-text-muted,#71717a)] hover:text-[var(--looply-color-text-brand,#2563eb)] hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] disabled:opacity-30 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Next match */}
        <button
          type="button"
          onClick={onNext}
          disabled={matchesCount === 0}
          aria-label="Próximo resultado"
          title="Próximo resultado (Enter)"
          className="p-1.5 text-[var(--looply-color-text-muted,#71717a)] hover:text-[var(--looply-color-text-brand,#2563eb)] hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] disabled:opacity-30 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar busca"
          title="Fechar busca (Esc)"
          className="p-1.5 text-[var(--looply-color-text-muted,#71717a)] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
