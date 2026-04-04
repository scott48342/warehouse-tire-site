"use client";

import { useRouter } from "next/navigation";

interface BackToTiresButtonProps {
  fallbackHref?: string;
  className?: string;
}

/**
 * Back navigation button that uses router.back() to preserve
 * search state, filters, and scroll position.
 * 
 * Falls back to href if no history (direct URL access).
 */
export function BackToTiresButton({ 
  fallbackHref = "/tires",
  className = "text-sm font-semibold text-neutral-600 hover:text-neutral-900"
}: BackToTiresButtonProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if we have history to go back to
    // window.history.length > 1 means there's somewhere to go back
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      // Direct URL access or no history - use fallback
      router.push(fallbackHref);
    }
  };

  return (
    <button onClick={handleClick} className={className}>
      ← Back to tires
    </button>
  );
}
