"use client";

import { useEffect, useRef, useState } from "react";

export const WHEELS_LOADALL_RESTORE_KEY = "wtd:wheels:loadall-restore";

/**
 * Auto-triggering "Load All" for the wheels SRP infinite scroll.
 *
 * The server only fetches the first ~100 SKUs for speed. When the user
 * scrolls past everything we've fetched, this component automatically
 * navigates to the `loadAll=true` URL (full upstream fetch) instead of
 * making them click a button — so the page feels like one continuous
 * scroll. Scroll position + reveal count are stashed in sessionStorage
 * and restored by WheelsGridWithSelection after the reload.
 *
 * A manual button is still rendered as a fallback (no-JS, or if the
 * user wants to load everything before scrolling).
 */
export default function WheelsAutoLoadAll({
  href,
  totalCount,
  shownCount,
}: {
  href: string;
  totalCount: number;
  shownCount: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const triggeredRef = useRef(false);
  const hasScrolledRef = useRef(false);

  const trigger = () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    try {
      sessionStorage.setItem(
        WHEELS_LOADALL_RESTORE_KEY,
        JSON.stringify({ y: window.scrollY, count: shownCount, ts: Date.now() })
      );
    } catch {
      /* sessionStorage unavailable — still navigate */
    }
    setLoading(true);
    window.location.assign(href);
  };

  useEffect(() => {
    // Require at least one real scroll before auto-loading, so short result
    // sets don't kick off the heavy full fetch the instant the page renders.
    const onScroll = () => {
      hasScrolledRef.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const el = containerRef.current;
    if (!el) return () => window.removeEventListener("scroll", onScroll);

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasScrolledRef.current) {
          trigger();
        }
      },
      { rootMargin: "800px 0px" }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, shownCount]);

  return (
    <div
      ref={containerRef}
      className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 py-6"
    >
      {loading ? (
        <>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="text-sm font-semibold text-neutral-700">
            Loading all {totalCount.toLocaleString()} wheels…
          </p>
          <p className="text-xs text-neutral-400">This may take a moment</p>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-600">
            Showing {shownCount.toLocaleString()} styles — loading the rest as you scroll
          </p>
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              trigger();
            }}
            className="rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-neutral-800"
          >
            Load All {totalCount.toLocaleString()} Wheels
          </a>
          <p className="text-xs text-neutral-400">May take a moment to load</p>
        </>
      )}
    </div>
  );
}
