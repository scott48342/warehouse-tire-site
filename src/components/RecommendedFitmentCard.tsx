"use client";

import { useEffect, useMemo, useState } from "react";
import { fitmentLabel, type Fitment } from "@/lib/fitment";

type NormalizedFitment = {
  boltPattern?: string;
  centerBoreMm?: number;
  wheelDiameterRangeIn?: [number, number];
  wheelWidthRangeIn?: [number, number];
  offsetRangeMm?: [number, number];
};

function fmtRange(a?: number, b?: number, unit?: string) {
  if (a == null || b == null) return "";
  if (a === b) return `${a}${unit ?? ""}`;
  return `${a}–${b}${unit ?? ""}`;
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

export function RecommendedFitmentCard({ fitment }: { fitment: Fitment }) {
  const hasVehicle = Boolean(fitment?.year && fitment?.make && fitment?.model);
  const wpSubmodel = useMemo(() => {
    const mod = fitment?.modification || "";
    return mod.startsWith("wp:") ? mod.slice(3) : "";
  }, [fitment?.modification]);

  const [details, setDetails] = useState<NormalizedFitment | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasVehicle || !wpSubmodel) {
        setDetails(null);
        setError("");
        return;
      }

      try {
        const qs = new URLSearchParams({
          year: String(fitment.year || ""),
          make: String(fitment.make || ""),
          model: String(fitment.model || ""),
          submodel: String(wpSubmodel),
        });

        const data = await fetchJson<{ fitment?: NormalizedFitment; error?: string }>(`/api/wp/vehicles/fitment?${qs.toString()}`);
        if (cancelled) return;

        if (data?.error) {
          setError(String(data.error));
          setDetails(null);
          return;
        }

        setError("");
        setDetails(data?.fitment || null);
      } catch (e: any) {
        if (cancelled) return;
        setDetails(null);
        setError(e?.message ? String(e.message) : "Failed to load fitment");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasVehicle, wpSubmodel, fitment.year, fitment.make, fitment.model]);

  if (!hasVehicle) return null;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-neutral-600">Search by Vehicle</div>
          <div className="text-sm font-extrabold text-neutral-900">{fitmentLabel(fitment)}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="text-xs font-extrabold text-neutral-900">Recommended Fitment</div>
        <div className="mt-2 grid gap-1 text-[12px] text-neutral-800">
          {details?.boltPattern ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">Bolt pattern</span>
              <span className="font-semibold">{details.boltPattern}</span>
            </div>
          ) : null}

          {details?.wheelDiameterRangeIn ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">Diameter</span>
              <span className="font-semibold">{fmtRange(details.wheelDiameterRangeIn[0], details.wheelDiameterRangeIn[1], "\"")}</span>
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

          {details?.centerBoreMm ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">Center bore</span>
              <span className="font-semibold">{fmtMaybe(details.centerBoreMm, "mm")}</span>
            </div>
          ) : null}

          {!details && !error ? (
            <div className="text-[11px] text-neutral-600">Select a trim/submodel to see fitment details.</div>
          ) : null}

          {error ? (
            <div className="text-[11px] text-neutral-600">Fitment details unavailable.</div>
          ) : null}
        </div>

        <div className="mt-3 text-[11px] text-neutral-500">
          Informational only — verify fitment before purchase.
        </div>
      </div>
    </section>
  );
}
