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
          DEFAULT: "#ffffff",
          border: "#e2e5ec",
          hover: "#f1f3f7",
          active: "#eff4ff",
          text: "#5f6577",
          "text-active": "#2563eb",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
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
        "looply": "10px",
        "looply-lg": "14px",
        "looply-xl": "18px",
      },
      boxShadow: {
        "looply-sm": "0 1px 2px rgba(0, 0, 0, 0.04)",
        "looply": "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
        "looply-md": "0 4px 12px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
