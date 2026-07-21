import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        line: "#e1e6ef",
        panel: "#f7f9fc",
        brand: "#0f766e",
        action: "#2563eb",
        warning: "#b76e00",
        success: "#257a4d"
      },
      boxShadow: {
        soft: "0 12px 32px rgba(15, 23, 42, 0.07)"
      }
    }
  },
  plugins: []
};

export default config;
