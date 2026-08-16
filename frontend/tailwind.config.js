/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff4ff",
          100: "#dbe4ff",
          200: "#bcd0ff",
          300: "#8fb3ff",
          400: "#5f8dff",
          500: "#3b6df7",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        /* Sidebar light palette */
        sidebar: {
          DEFAULT: "#fafbfc",
          border: "#e8eaef",
          hover: "#f0f1f4",
          active: "#f0f4ff",
          "active-bar": "#2563eb",
          text: "#6b7280",
          "text-active": "#2563eb",
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
