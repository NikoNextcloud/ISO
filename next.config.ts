import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/api/iso27001/export": ["./templates/iso27001/**/*"]
  }
};

export default nextConfig;
