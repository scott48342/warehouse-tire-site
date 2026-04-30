import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix Turbopack workspace root detection issue
  // Prevents confusion from parent directory lockfiles
  turbopack: {
    root: path.resolve(__dirname),
  },

  // SEO redirects - legacy/long URLs to clean paths
  async redirects() {
    return [
      // ========================================
      // Local site (warehousetire.net) legacy pages
      // ========================================
      {
        source: '/tire-wheel-services-in-pontiac-waterford-mi-warehouse-tire',
        destination: '/services',
        permanent: true,
      },
      {
        source: '/tire-financing-in-pontiac-waterford-mi-snap-koalafi-warehouse-tire',
        destination: '/financing',
        permanent: true,
      },
      {
        source: '/tire-financing-in-pontiac-waterford-mi-snap-koalafi-warehouse-tire/',
        destination: '/financing',
        permanent: true,
      },
      {
        source: '/tire-installation-locations-in-pontiac-waterford-mi-warehouse-tire',
        destination: '/locations',
        permanent: true,
      },
      {
        source: '/tire-installation-locations-in-pontiac-waterford-mi-warehouse-tire/',
        destination: '/locations',
        permanent: true,
      },
      {
        source: '/contact-warehouse-tire-pontiac-waterford-tire-installation',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/contact-warehouse-tire-pontiac-waterford-tire-installation/',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/shop-tires-wheels-online-local-installation-in-pontiac-waterford',
        destination: '/tires',
        permanent: true,
      },
      {
        source: '/shop-tires-wheels-online-local-installation-in-pontiac-waterford/',
        destination: '/tires',
        permanent: true,
      },
      {
        source: '/shop-tires-wheels',
        destination: '/tires',
        permanent: true,
      },
      {
        // Trailing slash version of tires-near-me page
        source: '/tires-near-me-in-pontiac-waterford-same-day-installation/',
        destination: '/tires-near-me-in-pontiac-waterford-same-day-installation',
        permanent: true,
      },
      {
        source: '/terms',
        destination: '/fitment-api/terms',
        permanent: true,
      },

      // ========================================
      // National site legacy URL patterns
      // ========================================
      // /package (singular) -> /packages or /wheels
      {
        source: '/package',
        destination: '/wheels?package=1',
        permanent: true,
      },
      // /packages with vehicle params -> /wheels with package=1
      {
        source: '/packages',
        destination: '/wheels?package=1',
        permanent: true,
      },
      // /tires/for/:path* -> /tires (old URL structure)
      {
        source: '/tires/for/:path*',
        destination: '/tires',
        permanent: false, // 302 - these might have valid vehicles
      },
    ];
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
