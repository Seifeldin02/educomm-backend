/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during builds
  },
  typescript: {
    ignoreBuildErrors: true, // Skip TypeScript errors during builds
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://educomm-84fd5.web.app",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
  reactStrictMode: true,

  // UPDATED: Use transpilePackages instead of experimental.serverExternalPackages
  transpilePackages: ["firebase-admin", "ws"],

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("ws");
    }
    return config;
  },
};

module.exports = nextConfig;
