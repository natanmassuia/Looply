// Pure color math for the theme runtime. No DOM, no state — deterministic.
// Inputs are expected to be validated `#RRGGBB` (see isHexColor). All outputs
// are uppercase `#RRGGBB`.

export type RGB = readonly [number, number, number];

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

export function hexToRgb(hex: string): RGB {
  const match = HEX_RE.exec(hex);
  if (!match) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(rgb: RGB): string {
  const channel = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`.toUpperCase();
}

// Linear interpolation toward `b` by `t` in [0,1] (inclusive, clamped).
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.min(1, Math.max(0, t));
  const out: [number, number, number] = [
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
  ];
  return rgbToHex(out);
}

export function lighten(hex: string, t: number): string {
  return mix(hex, "#FFFFFF", t);
}

export function darken(hex: string, t: number): string {
  return mix(hex, "#000000", t);
}

// WCAG 2.1 relative luminance (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const channel = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// WCAG 2.1 contrast ratio between two colors, [1, 21].
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Nudge `color` until its contrast against `background` reaches `target`.
// Deterministic: 12 bounded steps mixing toward black (light bg) or white
// (dark bg), then a hard fallback so it can never loop. Used to keep derived
// CUSTOM roles readable regardless of how pathological the palette is.
export function ensureContrast(color: string, background: string, target: number): string {
  const towardLight = relativeLuminance(background) < 0.5;
  let current = color;
  for (let i = 0; i < 12; i++) {
    if (contrastRatio(current, background) >= target) return current;
    current = towardLight ? lighten(current, 0.12) : darken(current, 0.12);
  }
  return towardLight ? "#FFFFFF" : "#000000";
}