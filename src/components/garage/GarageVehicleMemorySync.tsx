"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useGarage } from "@/contexts/GarageContext";
import { useVehicleMemory } from "@/contexts/VehicleMemoryContext";

/**
 * Sync component that bridges GarageContext to VehicleMemoryContext
 *
 * When the garage's active vehicle changes, this component updates
 * VehicleMemoryContext so that Jake and other legacy components
 * can access the current vehicle.
 *
 * ── Issue A (Part 1) ────────────────────────────────────────────────────────
 * On shopping / search / product surfaces the URL is the source of truth for the
 * active vehicle (set by VehicleMemorySync from the URL params). Previously this
 * bridge ALSO wrote the garage's active vehicle into VehicleMemory on every page,
 * so when the garage vehicle differed from the URL vehicle the two writers fought
 * each render -> a `vehicle_changed` flood and an active vehicle that could end up
 * != the page you're on.
 *
 * Fix: make this bridge URL-aware. When the current route is a vehicle/search/
 * product surface, OR the URL already carries a vehicle (year/make/model), this
 * bridge does NOT write from the garage -- URL wins. On neutral pages (homepage,
 * etc. with no URL vehicle) it still seeds the active vehicle from the garage.
 *
 * Reversible: set NEXT_PUBLIC_GARAGE_SYNC_URL_AWARE="off" to restore the prior
 * always-write behavior without a code change.
 *
 * Implementation note: the URL query is read from window.location inside the
 * effect (browser-only side effect) rather than useSearchParams(), so this
 * globally-mounted component does not force a CSR/Suspense bailout during static
 * prerender of pages like /_not-found.
 * ────────────────────────────────────────────────────────────────────────────
 */

// Route prefixes where the URL owns the active vehicle (garage must not override).
const VEHICLE_SURFACE_PREFIXES = [
  "/tires",   // covers /tires, /tires/v/*, /tires/for/*, /tires/[sku]
  "/wheels",  // covers /wheels, /wheels/v/*, /wheels/for/*, /wheels/[sku]
  "/packages",
];

function isVehicleSurfacePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return VEHICLE_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export function GarageVehicleMemorySync() {
  const { activeVehicle: garageVehicle, isLoaded: garageLoaded } = useGarage();
  const { setActiveVehicle } = useVehicleMemory();
  const pathname = usePathname();

  useEffect(() => {
    if (!garageLoaded) return;
    if (!garageVehicle) return;

    // Reversible kill-switch: when explicitly disabled, fall back to the prior
    // always-write behavior.
    const urlAware =
      process.env.NEXT_PUBLIC_GARAGE_SYNC_URL_AWARE !== "off";

    if (urlAware) {
      // 1) The URL already carries a vehicle -> URL is the source of truth.
      //    Read from window.location (browser-only) to avoid a CSR/Suspense
      //    bailout from useSearchParams() in this globally-mounted component.
      const sp =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      const urlHasVehicle = Boolean(
        sp && sp.get("year") && sp.get("make") && sp.get("model")
      );
      // 2) The route is a vehicle/search/product surface (e.g. /tires/v/<slug>
      //    where the vehicle lives in the path, not the query string).
      const onVehicleSurface = isVehicleSurfacePath(pathname);

      if (urlHasVehicle || onVehicleSurface) {
        // Do NOT overwrite URL-derived vehicle state on shopping/product pages.
        return;
      }
    }

    // Neutral page (homepage, etc.) with no URL vehicle: seed active vehicle
    // from the garage so Jake / personalization still have context.
    setActiveVehicle({
      year: garageVehicle.year,
      make: garageVehicle.make,
      model: garageVehicle.model,
      trim: garageVehicle.trim,
      modification: garageVehicle.modification,
      wheelDia: garageVehicle.wheelDia,
    });
    // NOTE: We intentionally do NOT call clearActiveVehicle() when garage is empty.
    // This prevents a loop where VehicleMemorySync saves from URL and this clears it.
  }, [garageVehicle, garageLoaded, setActiveVehicle, pathname]);

  // This component renders nothing - it's just for side effects
  return null;
}
