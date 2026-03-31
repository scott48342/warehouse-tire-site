/**
 * Robots.txt Generator
 * 
 * Controls search engine crawling
 */

import { MetadataRoute } from "next";

const BASE_URL = "https://shop.warehousetiredirect.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/cart",
          "/checkout",
          "/favorites",
          "/_next/",
          // Disallow filter/sort variations (canonicals handle this)
          "/wheels?*",
          "/tires?*",
          "/package?*",
        ],
      },
      {
        // Googlebot-specific rules
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/cart",
          "/checkout",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
