import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server actions accept 1 MB by default. Our PDF limit is 3 MB, plus a
      // little overhead for the multipart form encoding.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
