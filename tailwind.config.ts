import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        line: "#d9dee7",
        panel: "#f7f8fb",
        brand: "#1f6f78",
        action: "#2f6fed",
        warning: "#b76e00",
        success: "#257a4d"
      },
      boxShadow: {
        soft: "0 8px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
