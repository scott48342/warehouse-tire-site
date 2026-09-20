/**
 * Server-side derivation of the install-hardware dimensions a placeholder line
 * claims (release review 2026-09-19, Codex browser acceptance follow-up).
 *
 * The cart's `LUGKIT-<thread>` / `HR-<outer>-<inner>` placeholders are built in
 * the browser from the wheel card + vehicle profile. Checkout must not trust
 * those digits: the thread size comes from the VEHICLE's fitment record, the
 * hub-ring dimensions from the vehicle hub bore and the SELECTED WHEEL's
 * catalog center bore. `buildCheckoutLines` compares the placeholder against
 * these server values and blocks the order when they differ or cannot be
 * derived, so fulfilment never ships hardware the server could not validate.
 *
 * Read-only: fitment DB + wheel catalogs (same chain as `resolveWheelPrice`).
 */
import { resolveUniversalFitment } from "@/lib/fitment/universalFitmentResolver";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import { getWheel1WheelBySku } from "@/lib/wheel1/catalog";
import { getWSIWheelBySku } from "@/lib/wsi/catalog";

export type HardwareSpecVehicle = {
  year: string | number;
  make: string;
  model: string;
  trim?: string | null;
  modification?: string | null;
};

export type HardwareSpecInput = {
  /** Front SKU of the wheel set the hardware line belongs to. */
  wheelSku: string;
  vehicle: HardwareSpecVehicle | null | undefined;
};

export type ResolvedHardwareSpec = {
  /** Vehicle lug thread (e.g. "M14x1.5") from the fitment record; null when unknown. */
  vehicleThreadSize: string | null;
  vehicleSeatType: string | null;
  /** Vehicle hub bore in mm from the fitment record; null when unknown. */
  vehicleHubMm: number | null;
  /** Selected wheel's center bore in mm from the catalog; null when unknown. */
  wheelBoreMm: number | null;
  sources: { vehicle: string | null; wheel: string | null };
};

export type HardwareSpecResolver = (input: HardwareSpecInput) => Promise<ResolvedHardwareSpec>;

const positiveMm = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : v != null ? parseFloat(String(v)) : NaN;
  // 999 is the WheelPros "unknown" placeholder; anything outside a sane bore range is unknown.
  return Number.isFinite(n) && n >= 40 && n < 200 ? n : null;
};

// Same base-URL rule as `repriceCatalog.ts` so bore and price read the same WheelPros row.
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

/** Center bore of a wheel SKU: WheelPros -> TechFeed -> Wheel-1 -> WSI. Null when no catalog knows it. */
export async function resolveWheelBoreMm(sku: string): Promise<{ mm: number | null; source: string | null }> {
  const clean = String(sku || "").trim();
  if (!clean) return { mm: null, source: null };
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/wheelpros/wheels/search?fields=properties&page=1&pageSize=1&sku=${encodeURIComponent(clean)}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as { items?: any[]; results?: any[] };
      const raw = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];
      const mm = positiveMm(raw[0]?.properties?.centerbore);
      if (mm != null) return { mm, source: "wheelpros" };
    }
  } catch (e) {
    console.warn(`[checkout/hardware] wheelpros bore lookup failed for ${clean}:`, e instanceof Error ? e.message : e);
  }
  try {
    const tf: any = await getTechfeedWheelBySku(clean);
    const mm = positiveMm(tf?.centerbore);
    if (mm != null) return { mm, source: "techfeed" };
  } catch {}
  try {
    const w1: any = await getWheel1WheelBySku(clean);
    const mm = positiveMm(w1?.centerbore);
    if (mm != null) return { mm, source: "wheel1" };
  } catch {}
  try {
    const wsi: any = await getWSIWheelBySku(clean);
    const mm = positiveMm(wsi?.centerbore);
    if (mm != null) return { mm, source: "wsi" };
  } catch {}
  return { mm: null, source: null };
}

/** Vehicle thread / seat / hub bore from the fitment DB. Nulls when the vehicle cannot be resolved. */
export async function resolveVehicleHardwareSpec(vehicle: HardwareSpecVehicle | null | undefined): Promise<{
  threadSize: string | null;
  seatType: string | null;
  hubMm: number | null;
  source: string | null;
}> {
  const year = Number(vehicle?.year);
  if (!vehicle || !Number.isFinite(year) || !vehicle.make || !vehicle.model) {
    return { threadSize: null, seatType: null, hubMm: null, source: null };
  }
  try {
    const r = await resolveUniversalFitment({
      year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.modification || vehicle.trim || null,
    });
    // Only a real fitment row counts. A resolver fallback/none source carries no
    // vehicle-specific thread or hub data the server could validate against.
    if (!r?.found || r.source === "fallback" || r.source === "none") {
      return { threadSize: null, seatType: null, hubMm: null, source: null };
    }
    return {
      threadSize: r.threadSize || null,
      seatType: r.lugSeatType || null,
      hubMm: positiveMm(r.centerBore),
      source: `${r.source}:${r.qualityTier}`,
    };
  } catch (e) {
    console.warn("[checkout/hardware] vehicle fitment lookup failed:", e instanceof Error ? e.message : e);
    return { threadSize: null, seatType: null, hubMm: null, source: null };
  }
}

export const defaultHardwareSpecResolver: HardwareSpecResolver = async ({ wheelSku, vehicle }) => {
  const [v, w] = await Promise.all([resolveVehicleHardwareSpec(vehicle), resolveWheelBoreMm(wheelSku)]);
  return {
    vehicleThreadSize: v.threadSize,
    vehicleSeatType: v.seatType,
    vehicleHubMm: v.hubMm,
    wheelBoreMm: w.mm,
    sources: { vehicle: v.source, wheel: w.source },
  };
};
