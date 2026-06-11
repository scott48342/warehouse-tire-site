"use client";

import { useEffect } from "react";
import { trackPackageBuilderEnter } from "@/lib/analytics/tracker";

/**
 * Client component to track page visits for conversion dashboard.
 * Drop into server components that need visit tracking.
 */

interface PackageBuilderTrackerProps {
  vehicle?: {
    year: string;
    make: string;
    model: string;
  };
}

export function PackageBuilderTracker({ vehicle }: PackageBuilderTrackerProps) {
  useEffect(() => {
    trackPackageBuilderEnter(vehicle);
  }, [vehicle]);
  
  return null;
}
