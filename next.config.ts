import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // default 1mb is too small for a photo straight off a phone camera
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: {
    remotePatterns: [
      { hostname: "github.com" },
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
