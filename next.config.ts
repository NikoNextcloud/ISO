import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/api/iso9001/export": ["./templates/iso9001/**/*"],
    "/api/iso14001/export": ["./templates/iso14001/**/*"],
    "/api/iso27001/export": ["./templates/iso27001/**/*"],
    "/api/iso45001/export": ["./templates/iso45001/**/*"],
    "/api/iso50001/export": ["./templates/iso50001/**/*"],
    "/api/iso902027/export": ["./templates/iso902027/**/*"]
  }
};

export default nextConfig;
