import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0F1B2B", soft: "#3D4C61", faint: "#6B7A8F" },
        paper: "#F7F8FA",
        line: "#E2E7EE",
        seal: { DEFAULT: "#17456E", hover: "#0F3556", tint: "#EAF1F8" },
        s9001: { DEFAULT: "#2456A6", tint: "#EBF1FA" },
        s14001: { DEFAULT: "#1E7A46", tint: "#EAF5EE" },
        s45001: { DEFAULT: "#C2410C", tint: "#FBEFE8" },
        s27001: { DEFAULT: "#5B34A6", tint: "#F1ECFA" },
        s50001: { DEFAULT: "#A16207", tint: "#FAF3E4" },
        ok: "#1E7A46",
        warn: "#B45309",
        danger: "#B42318",
      },
      fontFamily: {
        sans: ['"Sofia Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,27,43,0.05), 0 1px 1px rgba(15,27,43,0.03)",
        pop: "0 8px 24px rgba(15,27,43,0.14)",
      },
    },
  },
  plugins: [],
};
export default config;
