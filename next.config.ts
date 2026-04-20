import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix Turbopack workspace root detection issue
  // Prevents confusion from parent directory lockfiles
  turbopack: {
    root: path.resolve(__dirname),
  },
  
  // ssh2 has native bindings that can't be bundled by Turbopack
  // Must be external for serverless functions
  serverExternalPackages: ["ssh2", "ssh2-sftp-client"],
  
  // Suppress middleware deprecation warnings during transition
  experimental: {
    // Placeholder for future proxy migration
  },

  // Allow external images from wheel/tire providers and stock photos
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
      {
        protocol: 'https',
        hostname: 'wpassets.wheelpros.com',
      },
      {
        // WheelPros Canto DAM - real vehicle gallery images
        protocol: 'https',
        hostname: 'wheelpros.canto.com',
      },
      {
        protocol: 'https',
        hostname: '5129608.app.netsuite.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'www.morimotohid.com',
      },
      {
        protocol: 'https',
        hostname: '31inc.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.schradertpms.com',
      },
      {
        // WheelPros gallery images via CloudFront (legacy, being migrated)
        protocol: 'https',
        hostname: 'd3opzdukpbxlns.cloudfront.net',
      },
      {
        // Vercel Blob storage for gallery images
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
