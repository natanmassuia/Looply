// ── Canonical Looply brand: Human Relay ────────────────────────────────────
// Exact Figma geometry (file 8JDixNLJNe1f3KVPRwEFBi · page 02 — Logo & Symbol
// · component Logo/Symbol/Human Relay · node 72:2 · natural 168×168).
// Coral path node 27:4 (#F06D55), amber path node 27:5 (#F3B84B), relay
// nodes 27:6/27:7 (#2A171F). Fixed brand identity colors — deliberately NOT
// theme tokens; the logo does not recolor across Aura/Flux/Pulse.
// This component is the single runtime authority for the symbol: no screen
// redraws the geometry (repo convention: inline SVG components, no asset dir).
export function Logo({
  size = 48,
  inverse = false,
  wordmark = true,
}: {
  size?: number;
  /** wordmark color only — the symbol itself never recolors */
  inverse?: boolean;
  /** false = symbol-only (decorative; pair with a visible text wordmark) */
  wordmark?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-2.5"
      {...(wordmark ? { role: "img", "aria-label": "Looply" } : { "aria-hidden": "true" })}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 168 168"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M 0 48 C 0 18 24 0 54 0 L 87 0 C 111 0 129 18 129 42 C 129 66 111 84 87 84 L 60 84"
          transform="translate(27 24)"
          stroke="#F06D55"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="miter"
        />
        <path
          d="M 129 36 C 129 66 105 84 75 84 L 42 84 C 18 84 0 66 0 42 C 0 18 18 0 42 0 L 69 0"
          transform="translate(12 60)"
          stroke="#F3B84B"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="miter"
        />
        <circle cx="87" cy="108" r="9" fill="#2A171F" />
        <circle cx="81" cy="60" r="9" fill="#2A171F" />
      </svg>
      {wordmark && (
        <span
          aria-hidden="true"
          className={`font-bold tracking-tight ${
            inverse ? "text-[var(--looply-color-text-inverse)]" : "text-[var(--looply-color-text-primary)]"
          }`}
          style={{ fontSize: Math.round(size * 0.375) }}
        >
          Looply
        </span>
      )}
    </span>
  );
}
