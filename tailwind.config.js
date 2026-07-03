/** @type {import('tailwindcss').Config} */
// As cores referenciam CSS variables definidas em src/styles/skins.css.
// Trocar de skin (8-10 / 11-14 / 15-18) = trocar tokens no [data-skin], não reescrever.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bm-bg)",
        surface: "var(--bm-surface)",
        "surface-2": "var(--bm-surface-2)",
        ink: "var(--bm-ink)",
        muted: "var(--bm-muted)",
        primary: "var(--bm-primary)",
        "primary-ink": "var(--bm-primary-ink)",
        accent: "var(--bm-accent)",
        success: "var(--bm-success)",
        warn: "var(--bm-warn)",
        danger: "var(--bm-danger)",
        border: "var(--bm-border)",
      },
      borderRadius: {
        bm: "var(--bm-radius)",
      },
      fontFamily: {
        sans: ["var(--bm-font)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
