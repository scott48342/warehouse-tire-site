"use client";

import { useEffect, useMemo, useState } from "react";
import { fitmentLabel, type Fitment } from "@/lib/fitment";

type NormalizedFitment = {
  boltPattern?: string;
  centerBoreMm?: number;
  threadSize?: string;
  wheelDiameterRangeIn?: [number, number];
  wheelWidthRangeIn?: [number, number];
  offsetRangeMm?: [number, number];
};

type AxleFitment = {
  front?: NormalizedFitment;
  rear?: NormalizedFitment;
};

function fmtRange(a?: number, b?: number, unit?: string) {
  if (a == null || b == null) return "";
  if (a === b) return `${a}${unit ?? ""}`;
  return `${a}–${b}${unit ?? ""}`;
}

function minMax(vals: number[]): [number, number] | undefined {
  const xs = vals.filter((n) => Number.isFinite(n));
  if (!xs.length) return undefined;
  return [Math.min(...xs), Math.max(...xs)];
}

function parseTireSizeBasic(s: string): { widthMm?: number; rimIn?: number } {
  const str = String(s || "").trim();
  // Examples:
  // 245/40ZR18 88Y
  // 285/30R19
  const m = str.match(/\b(\d{3})\/(\d{2})\s*[A-Z]*R(\d{2})\b/i);
  if (!m) return {};
  const widthMm = Number(m[1]);
  const rimIn = Number(m[3]);
  return {
    widthMm: Number.isFinite(widthMm) ? widthMm : undefined,
    rimIn: Number.isFinite(rimIn) ? rimIn : undefined,
  };
}

function wheelWidthRangeForTireWidthConservative(widthMm: number): [number, number] | undefined {
  // Conservative mapping (approximate) from tire section width → acceptable wheel width range.
  // This is intentionally wide to avoid false negatives.
  if (!Number.isFinite(widthMm)) return undefined;

  if (widthMm <= 225) return [6.0, 8.5];
  if (widthMm <= 235) return [7.0, 9.0];
  if (widthMm <= 245) return [7.5, 9.5];
  if (widthMm <= 255) return [8.0, 10.0];
  if (widthMm <= 265) return [8.5, 10.5];
  if (widthMm <= 275) return [9.0, 11.0];
  if (widthMm <= 285) return [9.5, 11.5];
  if (widthMm <= 295) return [10.0, 12.0];
  if (widthMm <= 305) return [10.0, 12.0];
  if (widthMm <= 315) return [10.5, 12.5];
  if (widthMm <= 325) return [10.5, 12.5];
  if (widthMm <= 335) return [11.0, 13.0];
  return [11.0, 13.0];
}

function axleFitmentFromOemTireSizesConservative(
  tireSizes: string[],
  fallback: NormalizedFitment | null
): AxleFitment | null {
  const parsed = tireSizes
    .map((s) => ({ raw: s, ...parseTireSizeBasic(s) }))
    .filter((x) => x.widthMm && x.rimIn) as Array<{ raw: string; widthMm: number; rimIn: number }>;

  if (parsed.length < 2) return null;

  const widths = parsed.map((p) => p.widthMm);
  const wMin = Math.min(...widths);
  const wMax = Math.max(...widths);

  // If widths are basically the same, treat as square.
  if (wMax - wMin < 30) return null;

  // Split by midpoint; smaller widths = front, larger = rear.
  const mid = (wMin + wMax) / 2;
  const front = parsed.filter((p) => p.widthMm <= mid);
  const rear = parsed.filter((p) => p.widthMm > mid);
  if (!front.length || !rear.length) return null;

  const frontRims = minMax(front.map((p) => p.rimIn));
  const rearRims = minMax(rear.map((p) => p.rimIn));

  const frontWheelWidths = front
    .map((p) => wheelWidthRangeForTireWidthConservative(p.widthMm))
    .filter(Boolean) as Array<[number, number]>;
  const rearWheelWidths = rear
    .map((p) => wheelWidthRangeForTireWidthConservative(p.widthMm))
    .filter(Boolean) as Array<[number, number]>;

  const frontW = frontWheelWidths.length
    ? ([
        Math.min(...frontWheelWidths.map((r) => r[0])),
        Math.max(...frontWheelWidths.map((r) => r[1])),
      ] as [number, number])
    : undefined;

  const rearW = rearWheelWidths.length
    ? ([
        Math.min(...rearWheelWidths.map((r) => r[0])),
        Math.max(...rearWheelWidths.map((r) => r[1])),
      ] as [number, number])
    : undefined;

  const common = fallback || {};

  return {
    front: {
      boltPattern: common.boltPattern,
      centerBoreMm: common.centerBoreMm,
      offsetRangeMm: common.offsetRangeMm,
      wheelDiameterRangeIn: frontRims,
      wheelWidthRangeIn: frontW,
    },
    rear: {
      boltPattern: common.boltPattern,
      centerBoreMm: common.centerBoreMm,
      offsetRangeMm: common.offsetRangeMm,
      wheelDiameterRangeIn: rearRims,
      wheelWidthRangeIn: rearW,
    },
  };
}

function fmtMaybe(v: unknown, unit?: string) {
  if (v == null) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return `${n}${unit ?? ""}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function RecommendedFitmentCard({ 
  fitment, 
  productType = "tires",
  setupMode = "staggered",
}: { 
  fitment: Fitment;
  productType?: "tires" | "wheels";
  /** For staggered vehicles: "square" shows front specs for all corners, "staggered" shows front+rear */
  setupMode?: "square" | "staggered";
}) {
  const hasVehicle = Boolean(fitment?.year && fitment?.make && fitment?.model);
  const wpSubmodel = useMemo(() => {
    const mod = fitment?.modification || "";
    return mod.startsWith("wp:") ? mod.slice(3) : "";
  }, [fitment?.modification]);

  const [details, setDetails] = useState<NormalizedFitment | null>(null);
  const [axles, setAxles] = useState<AxleFitment | null>(null);
  const [oemTireSizes, setOemTireSizes] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [vehicleIsStaggered, setVehicleIsStaggered] = useState<boolean>(false);
  const [availableDiameters, setAvailableDiameters] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // reset
      setDetails(null);
      setAxles(null);
      setOemTireSizes([]);
      setError("");
      setVehicleIsStaggered(false);
      setAvailableDiameters([]);

      if (!hasVehicle) return;

      // ═══════════════════════════════════════════════════════════════════════════
      // DB-FIRST FITMENT PROFILE (Primary Source of Truth)
      // ═══════════════════════════════════════════════════════════════════════════
      // First, check our fitment-search endpoint for dbProfile + staggered info
      try {
        const fitmentQs = new URLSearchParams({
          year: String(fitment.year || ""),
          make: String(fitment.make || ""),
          model: String(fitment.model || ""),
          pageSize: "1", // Just need fitment info, not wheels
        });
        if (fitment.modification) fitmentQs.set("modification", String(fitment.modification));
        
        const fitmentData = await fetchJson<{
          fitment?: {
            staggered?: {
              isStaggered?: boolean;
              frontSpec?: { diameter: number; width: number; offset: number | null; tireSize: string | null };
              rearSpec?: { diameter: number; width: number; offset: number | null; tireSize: string | null };
            };
            envelope?: {
              boltPattern?: string;
              centerBore?: number;
              oem?: { diameter: [number, number]; width: [number, number]; offset: [number, number] };
            };
            // NEW: DB-first profile (primary source of truth)
            dbProfile?: {
              modificationId: string;
              displayTrim: string;
              boltPattern: string | null;
              centerBoreMm: number | null;
              threadSize: string | null;
              offsetRange: { min: number | null; max: number | null };
              oemWheelSizes: Array<{ diameter: number; width: number; offset: number | null }>;
              oemTireSizes: string[];
              source: string;
            };
          };
          filters?: {
            diameters?: Array<{ value: number; count: number }>;
            widths?: Array<{ value: number; count: number }>;
          };
        }>(`/api/wheels/fitment-search?${fitmentQs.toString()}`);

        if (cancelled) return;

        // Extract available diameters from filters
        const filterDiameters = fitmentData?.filters?.diameters;
        if (filterDiameters && filterDiameters.length > 0) {
          const diams = filterDiameters.map(d => d.value).sort((a, b) => a - b);
          setAvailableDiameters(diams);
        }

        // Extract dbProfile (primary source of truth)
        const dbProfile = fitmentData?.fitment?.dbProfile;
        if (dbProfile) {
          console.log('[RecommendedFitmentCard] ✅ DB PROFILE CONSUMED:', {
            modificationId: dbProfile.modificationId,
            displayTrim: dbProfile.displayTrim,
            boltPattern: dbProfile.boltPattern,
            oemTireSizes: dbProfile.oemTireSizes,
            source: dbProfile.source,
          });
          
          // Use dbProfile values as primary source
          const oemWheelDias = dbProfile.oemWheelSizes?.map(s => s.diameter).filter(d => d != null) || [];
          const oemWheelWidths = dbProfile.oemWheelSizes?.map(s => s.width).filter(w => w != null) || [];
          
          setDetails({
            boltPattern: dbProfile.boltPattern || undefined,
            centerBoreMm: dbProfile.centerBoreMm || undefined,
            threadSize: dbProfile.threadSize || undefined,
            wheelDiameterRangeIn: oemWheelDias.length ? [Math.min(...oemWheelDias), Math.max(...oemWheelDias)] : undefined,
            wheelWidthRangeIn: oemWheelWidths.length ? [Math.min(...oemWheelWidths), Math.max(...oemWheelWidths)] : undefined,
            offsetRangeMm: dbProfile.offsetRange?.min != null && dbProfile.offsetRange?.max != null 
              ? [dbProfile.offsetRange.min, dbProfile.offsetRange.max] 
              : undefined,
          });
          
          setOemTireSizes(dbProfile.oemTireSizes || []);
        } else {
          console.log('[RecommendedFitmentCard] ⚠️ NO DB PROFILE - using legacy envelope');
        }

        // If we got staggered info from fitment-search, use it
        if (fitmentData?.fitment?.staggered) {
          const staggered = fitmentData.fitment.staggered;
          setVehicleIsStaggered(Boolean(staggered.isStaggered));

          // Use envelope for basic details if dbProfile didn't set them
          const envelope = fitmentData.fitment.envelope;
          if (envelope && !dbProfile) {
            setDetails({
              boltPattern: envelope.boltPattern,
              centerBoreMm: envelope.centerBore,
              wheelDiameterRangeIn: envelope.oem?.diameter,
              wheelWidthRangeIn: envelope.oem?.width,
              offsetRangeMm: envelope.oem?.offset,
            });
          }

          // Only set axles if vehicle actually supports staggered
          if (staggered.isStaggered && staggered.frontSpec && staggered.rearSpec) {
            const bp = dbProfile?.boltPattern || envelope?.boltPattern;
            const cb = dbProfile?.centerBoreMm || envelope?.centerBore;
            setAxles({
              front: {
                boltPattern: bp,
                centerBoreMm: cb,
                wheelDiameterRangeIn: [staggered.frontSpec.diameter, staggered.frontSpec.diameter],
                wheelWidthRangeIn: [staggered.frontSpec.width, staggered.frontSpec.width],
                offsetRangeMm: staggered.frontSpec.offset != null ? [staggered.frontSpec.offset, staggered.frontSpec.offset] : undefined,
              },
              rear: {
                boltPattern: bp,
                centerBoreMm: cb,
                wheelDiameterRangeIn: [staggered.rearSpec.diameter, staggered.rearSpec.diameter],
                wheelWidthRangeIn: [staggered.rearSpec.width, staggered.rearSpec.width],
                offsetRangeMm: staggered.rearSpec.offset != null ? [staggered.rearSpec.offset, staggered.rearSpec.offset] : undefined,
              },
            });
          }
          return; // We have good data from fitment-search, no need to continue
        }
        
        // If we got dbProfile but no staggered info, we still have what we need
        if (dbProfile) return;
      } catch {
        // Fitment-search failed, fall through to legacy logic
        console.log('[RecommendedFitmentCard] ⚠️ fitment-search failed, using legacy API');
      }

      // NOTE: WheelPros fitment fallback removed (2026-04-02). All fitment from internal DB only.
      // Legacy wp: submodels are no longer supported - treat as regular modification lookup.

      // Fall back to our package engine vehicle search (OEM tires + wheel ranges).
      try {
        const qs = new URLSearchParams({
          year: String(fitment.year || ""),
          make: String(fitment.make || ""),
          model: String(fitment.model || ""),
        });

        const mod = fitment.modification ? String(fitment.modification) : "";
        if (mod) qs.set("modification", mod);

        const data = await fetchJson<
          Partial<NormalizedFitment> & {
            tireSizes?: string[];
            error?: string;
          }
        >(`/api/vehicles/search?${qs.toString()}`);
        if (cancelled) return;

        // Set wheel fitment ranges (if present) so the UI matches CustomOffsets-style ranges.
        const fallbackDetails: NormalizedFitment = {
          boltPattern: data?.boltPattern,
          centerBoreMm: data?.centerBoreMm,
          wheelDiameterRangeIn: Array.isArray((data as any)?.wheelDiameterRangeIn)
            ? ((data as any).wheelDiameterRangeIn as any)
            : undefined,
          wheelWidthRangeIn: Array.isArray((data as any)?.wheelWidthRangeIn)
            ? ((data as any).wheelWidthRangeIn as any)
            : undefined,
          offsetRangeMm: Array.isArray((data as any)?.offsetRangeMm) ? ((data as any).offsetRangeMm as any) : undefined,
        };
        setDetails(fallbackDetails);

        const sizes = Array.isArray(data?.tireSizes) ? data.tireSizes.map(String) : [];
        setOemTireSizes(sizes);

        // NOTE: We no longer infer staggered from tire size options.
        // Staggered detection is now done by fitment-search using actual front/rear wheel specs.
        // If fitment-search failed above, we just show the basic fitment info without axle split.
      } catch {
        // best-effort only
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasVehicle, wpSubmodel, fitment.year, fitment.make, fitment.model, fitment.modification]);

  if (!hasVehicle) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-red-200 bg-white p-0">
      <div className="border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold text-red-700">Search by Vehicle</div>
            <div className="mt-0.5 text-sm font-extrabold text-neutral-900">{fitmentLabel(fitment)}</div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="text-xs font-extrabold text-neutral-900">{productType === "wheels" ? "Wheel Sizing Guide" : "Sizing guide"}</div>
        <div className="mt-2 grid gap-2 text-[12px] text-neutral-800">
          {details?.boltPattern ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">Bolt pattern</span>
              <span className="font-semibold">{details.boltPattern}</span>
            </div>
          ) : null}

          {axles?.front && axles?.rear && setupMode === "staggered" ? (
            /* STAGGERED MODE: Show front and rear separately */
            <div className="grid gap-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-2">
                <div className="text-[11px] font-extrabold text-neutral-900">Front sizes</div>
                <div className="mt-1 grid gap-1">
                  {axles.front.wheelDiameterRangeIn ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">Diameter</span>
                      <span className="font-semibold">{fmtRange(axles.front.wheelDiameterRangeIn[0], axles.front.wheelDiameterRangeIn[1], "\"")}</span>
                    </div>
                  ) : null}
                  {axles.front.wheelWidthRangeIn ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">Width</span>
                      <span className="font-semibold">{fmtRange(axles.front.wheelWidthRangeIn[0], axles.front.wheelWidthRangeIn[1], "\"")}</span>
                    </div>
                  ) : null}
                  {axles.front.offsetRangeMm ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">Offset</span>
                      <span className="font-semibold">{fmtRange(axles.front.offsetRangeMm[0], axles.front.offsetRangeMm[1], "mm")}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-2">
                <div className="text-[11px] font-extrabold text-neutral-900">Rear sizes</div>
                <div className="mt-1 grid gap-1">
                  {axles.rear.wheelDiameterRangeIn ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">Diameter</span>
                      <span className="font-semibold">{fmtRange(axles.rear.wheelDiameterRangeIn[0], axles.rear.wheelDiameterRangeIn[1], "\"")}</span>
                    </div>
                  ) : null}
                  {axles.rear.wheelWidthRangeIn ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">Width</span>
                      <span className="font-semibold">{fmtRange(axles.rear.wheelWidthRangeIn[0], axles.rear.wheelWidthRangeIn[1], "\"")}</span>
                    </div>
                  ) : null}
                  {axles.rear.offsetRangeMm ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">Offset</span>
                      <span className="font-semibold">{fmtRange(axles.rear.offsetRangeMm[0], axles.rear.offsetRangeMm[1], "mm")}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : axles?.front && setupMode === "square" ? (
            /* SQUARE MODE on staggered vehicle: Show front specs as "All corners" */
            <div className="rounded-xl border border-neutral-200 bg-white p-2">
              <div className="text-[11px] font-extrabold text-neutral-900">All corners (square)</div>
              <div className="mt-1 grid gap-1">
                {axles.front.wheelDiameterRangeIn ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-600">Diameter</span>
                    <span className="font-semibold">{fmtRange(axles.front.wheelDiameterRangeIn[0], axles.front.wheelDiameterRangeIn[1], "\"")}</span>
                  </div>
                ) : null}
                {axles.front.wheelWidthRangeIn ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-600">Width</span>
                    <span className="font-semibold">{fmtRange(axles.front.wheelWidthRangeIn[0], axles.front.wheelWidthRangeIn[1], "\"")}</span>
                  </div>
                ) : null}
                {axles.front.offsetRangeMm ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-600">Offset</span>
                    <span className="font-semibold">{fmtRange(axles.front.offsetRangeMm[0], axles.front.offsetRangeMm[1], "mm")}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {(availableDiameters.length > 0 || details?.wheelDiameterRangeIn) ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">Diameter</span>
                  <span className="font-semibold">
                    {availableDiameters.length > 0 
                      ? fmtRange(availableDiameters[0], availableDiameters[availableDiameters.length - 1], "\"")
                      : fmtRange(details?.wheelDiameterRangeIn?.[0], details?.wheelDiameterRangeIn?.[1], "\"")}
                  </span>
                </div>
              ) : null}

              {details?.wheelWidthRangeIn ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">Width</span>
                  <span className="font-semibold">{fmtRange(details.wheelWidthRangeIn[0], details.wheelWidthRangeIn[1], "\"")}</span>
                </div>
              ) : null}

              {details?.offsetRangeMm ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">Offset</span>
                  <span className="font-semibold">{fmtRange(details.offsetRangeMm[0], details.offsetRangeMm[1], "mm")}</span>
                </div>
              ) : null}
            </>
          )}

          {details?.centerBoreMm ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">Center bore</span>
              <span className="font-semibold">{fmtMaybe(details.centerBoreMm, "mm")}</span>
            </div>
          ) : null}

          {details?.threadSize ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">Lug thread</span>
              <span className="font-semibold">{details.threadSize}</span>
            </div>
          ) : null}

          {!details && oemTireSizes.length ? (
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-neutral-600">OEM tire sizes</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {oemTireSizes.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-800"
                  >
                    {s}
                  </span>
                ))}
                {oemTireSizes.length > 4 ? (
                  <span className="text-[11px] font-semibold text-neutral-600">+{oemTireSizes.length - 4} more</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {!details && !oemTireSizes.length && !error ? (
            <div className="text-[11px] text-neutral-600">Select a trim/submodel to see fitment details.</div>
          ) : null}

          {error ? <div className="text-[11px] text-neutral-600">Fitment details unavailable.</div> : null}
        </div>

        <div className="mt-3 text-[11px] text-neutral-500">
          Sizing ranges are informational — final fitment is confirmed before purchase/installation.
        </div>
        </div>
      </div>
    </section>
  );
}
