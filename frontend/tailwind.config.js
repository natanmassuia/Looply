/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff3ee",
          100: "#ffe4d9",
          200: "#ffc8b3",
          300: "#ffa382",
          400: "#f7846c",
          500: "#f06d55",
          600: "#f06d55",
          700: "#d9563f",
          800: "#b44330",
          900: "#913728",
        },
        /* Sidebar light palette */
        sidebar: {
          DEFAULT: "#fafbfc",
          border: "#e8eaef",
          hover: "#f0f1f4",
          active: "#fff3ee",
          "active-bar": "#f06d55",
          text: "#6b7280",
          "text-active": "#f06d55",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f0f1f4",
          subtle: "#f7f8fa",
          elevated: "#ffffff",
        },
        /* Semantic roles → theme runtime vars (AURA/LIGHT static, overridden
           at runtime by applyTheme; F2+ migrates screens onto these) */
        canvas: "var(--looply-color-bg-canvas)",
        foreground: "var(--looply-color-text-primary)",
        muted: "var(--looply-color-text-muted)",
        primary: "var(--looply-color-action-primary)",
      },
      fontFamily: {
        sans: [
          "Manrope",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        looply: "8px",
        "looply-md": "10px",
        "looply-lg": "12px",
        "looply-xl": "16px",
      },
      boxShadow: {
        "looply-sm": "0 1px 2px rgba(0, 0, 0, 0.03)",
        "looply": "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
        "looply-md": "0 4px 8px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.03)",
        "looply-lg": "0 10px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
