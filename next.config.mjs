/** @type {import('next').NextConfig} */
const config = {
  output: process.env.ALIYAS_STANDALONE === "true" ? "standalone" : undefined,
  serverExternalPackages: ["mysql2", "date-fns"],
  poweredByHeader: false,
  devIndicators: false,
  agentRules: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    proxyClientMaxBodySize: "22mb",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
