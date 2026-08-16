// Looply Human Relay type ramp (figma node 19:2). Exposed as a JS contract for
// consumers that style programmatically; the same values ship as CSS utility
// classes (.typo-*) in index.css. Numbers are px.

export interface TypographySpec {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing?: string;
  textTransform?: "uppercase";
}

const MANROPE = `"Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export const TYPOGRAPHY = {
  eyebrow: {
    fontFamily: MANROPE,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 700,
    letterSpacing: "0.88px",
    textTransform: "uppercase",
  },
  displayLarge: {
    fontFamily: MANROPE,
    fontSize: 56,
    lineHeight: 64,
    fontWeight: 800,
    letterSpacing: "-1.12px",
  },
  headingH2: {
    fontFamily: MANROPE,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
    letterSpacing: "-0.36px",
  },
  titleLarge: {
    fontFamily: MANROPE,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
  bodyLarge: {
    fontFamily: MANROPE,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: 400,
  },
  bodyMedium: {
    fontFamily: MANROPE,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 400,
  },
  bodySmall: {
    fontFamily: MANROPE,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
  },
  labelLarge: {
    fontFamily: MANROPE,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  labelSmall: {
    fontFamily: MANROPE,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 600,
    letterSpacing: "0.5px",
  },
  caption: {
    fontFamily: MANROPE,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 400,
  },
} as const satisfies Record<string, TypographySpec>;

export type TypographyToken = keyof typeof TYPOGRAPHY;