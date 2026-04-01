"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Analytics tracking component
 * Add to root layout to track all page views
 */
export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    // Build full path with search params
    const search = searchParams.toString();
    const fullPath = search ? `${pathname}?${search}` : pathname;

    // Don't double-track the same page
    if (fullPath === lastTracked.current) return;
    lastTracked.current = fullPath;

    // Skip admin and API routes client-side too
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    // Track the page view
    const track = async () => {
      try {
        await fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pathname,
            referrer: document.referrer || null,
          }),
          // Don't block navigation
          keepalive: true,
        });
      } catch (e) {
        // Silently fail - analytics shouldn't break the site
        console.debug("[Analytics] Track failed:", e);
      }
    };

    track();
  }, [pathname, searchParams]);

  // This component renders nothing
  return null;
}

export default Analytics;
