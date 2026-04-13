"use client";

import { useEffect } from "react";

interface Props {
  wasAutoSelected: boolean;
  diameter: number;
  vehicle: string;
  confidence: string;
}

/**
 * Client component to track wheel configuration auto-select events.
 * Fires a single analytics event when mounted if auto-selection occurred.
 */
export function WheelConfigAutoSelectTracker({ 
  wasAutoSelected, 
  diameter, 
  vehicle,
  confidence,
}: Props) {
  useEffect(() => {
    if (wasAutoSelected && typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "wheel_config_auto_selected", {
        diameter,
        vehicle,
        confidence,
      });
      console.log("[analytics] wheel_config_auto_selected", { diameter, vehicle, confidence });
    }
  }, [wasAutoSelected, diameter, vehicle, confidence]);

  // This component renders nothing
  return null;
}
