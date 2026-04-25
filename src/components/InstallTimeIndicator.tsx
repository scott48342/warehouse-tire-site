"use client";

import { useState, useEffect } from "react";

type Variant = "badge" | "banner" | "inline";

/**
 * Dynamic install time indicator for local mode
 * Shows "same-day install" before 11am ET, "next-day install" after
 */
export function InstallTimeIndicator({ 
  variant = "badge",
  className = "",
}: { 
  variant?: Variant;
  className?: string;
}) {
  const [isSameDay, setIsSameDay] = useState<boolean | null>(null);
  const [cutoffTime, setCutoffTime] = useState<string>("");

  useEffect(() => {
    // Check current Eastern time
    const now = new Date();
    const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = eastern.getHours();
    const minutes = eastern.getMinutes();
    
    // Before 11am = same day, after = next day
    const sameDay = hour < 11;
    setIsSameDay(sameDay);
    
    // Calculate time until cutoff for display
    if (sameDay) {
      const hoursLeft = 10 - hour;
      const minsLeft = 60 - minutes;
      if (hoursLeft > 0) {
        setCutoffTime(`${hoursLeft}h ${minsLeft}m left`);
      } else {
        setCutoffTime(`${minsLeft}m left`);
      }
    }
  }, []);

  // Don't render until we know the time (avoid hydration mismatch)
  if (isSameDay === null) {
    return null;
  }

  if (variant === "badge") {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {isSameDay ? (
          <>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
              <span className="text-sm">⚡</span>
              Same-day install
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
            <span className="text-sm">🔧</span>
            Next-day install
          </span>
        )}
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className={`rounded-lg p-3 ${isSameDay ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"} ${className}`}>
        {isSameDay ? (
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <div>
              <div className="text-sm font-bold text-green-800">Same-Day Install Available</div>
              <div className="text-xs text-green-600">Order now and pick up today</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg">🔧</span>
            <div>
              <div className="text-sm font-bold text-blue-800">Next-Day Install</div>
              <div className="text-xs text-blue-600">Order now, install tomorrow</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // inline variant
  return (
    <span className={`text-xs font-semibold ${isSameDay ? "text-green-700" : "text-blue-700"} ${className}`}>
      {isSameDay ? "⚡ Same-day install" : "🔧 Next-day install"}
    </span>
  );
}
