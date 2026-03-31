import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix Turbopack workspace root detection issue
  // Prevents confusion from parent directory lockfiles
  turbopack: {
    root: path.resolve(__dirname),
  },
  
  // Suppress middleware deprecation warnings during transition
  experimental: {
    // Placeholder for future proxy migration
  },

  // Allow external images from wheel/tire providers
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.wheelpros.com',
      },
      {
        protocol: 'https',
        hostname: 'images.wheelpros.com',
      },
    ],
  },
};

export default nextConfig;
