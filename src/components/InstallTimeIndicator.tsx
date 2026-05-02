"use client";

import { useState, useEffect } from "react";

type Variant = "badge" | "banner" | "inline";
type InstallTime = "same-day" | "next-day" | "monday";

/**
 * Dynamic install time indicator for local mode
 * - Weekday before 11am ET = same-day install
 * - Weekday after 11am ET = next-day install  
 * - Saturday/Sunday = install Monday (can't get inventory over weekend)
 */
export function InstallTimeIndicator({ 
  variant = "badge",
  className = "",
}: { 
  variant?: Variant;
  className?: string;
}) {
  const [installTime, setInstallTime] = useState<InstallTime | null>(null);
  const [cutoffTime, setCutoffTime] = useState<string>("");

  useEffect(() => {
    // Check current Eastern time
    const now = new Date();
    const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = eastern.getHours();
    const minutes = eastern.getMinutes();
    const dayOfWeek = eastern.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Weekend = Monday install (can't get inventory over weekend)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setInstallTime("monday");
      return;
    }
    
    // Weekday: Before 11am = same day, after = next day
    const sameDay = hour < 11;
    setInstallTime(sameDay ? "same-day" : "next-day");
    
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
  if (installTime === null) {
    return null;
  }

  const config = {
    "same-day": {
      icon: "⚡",
      label: "Same-day install",
      title: "Same-Day Install Available",
      subtitle: "Order now and pick up today",
      badgeClass: "bg-green-100 text-green-800",
      bannerClass: "bg-green-50 border border-green-200",
      titleClass: "text-green-800",
      subtitleClass: "text-green-600",
      inlineClass: "text-green-700",
    },
    "next-day": {
      icon: "🔧",
      label: "Next-day install",
      title: "Next-Day Install",
      subtitle: "Order now, install tomorrow",
      badgeClass: "bg-blue-100 text-blue-800",
      bannerClass: "bg-blue-50 border border-blue-200",
      titleClass: "text-blue-800",
      subtitleClass: "text-blue-600",
      inlineClass: "text-blue-700",
    },
    "monday": {
      icon: "📅",
      label: "Install Monday",
      title: "Install Monday",
      subtitle: "Weekend orders ready for Monday install",
      badgeClass: "bg-purple-100 text-purple-800",
      bannerClass: "bg-purple-50 border border-purple-200",
      titleClass: "text-purple-800",
      subtitleClass: "text-purple-600",
      inlineClass: "text-purple-700",
    },
  }[installTime];

  if (variant === "badge") {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${config.badgeClass}`}>
          <span className="text-sm">{config.icon}</span>
          {config.label}
        </span>
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className={`rounded-lg p-3 ${config.bannerClass} ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <div>
            <div className={`text-sm font-bold ${config.titleClass}`}>{config.title}</div>
            <div className={`text-xs ${config.subtitleClass}`}>{config.subtitle}</div>
          </div>
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <span className={`text-xs font-semibold ${config.inlineClass} ${className}`}>
      {config.icon} {config.label}
    </span>
  );
}
