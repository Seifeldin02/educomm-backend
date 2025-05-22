/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
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
