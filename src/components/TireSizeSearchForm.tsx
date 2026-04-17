"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import tireSizes from "@/data/tire-sizes.json";

function normalizeTireSize(width: number | null, aspect: number | null, rim: number | null) {
  if (!width || !aspect || !rim) return "";
  return `${width}/${aspect}R${rim}`;
}

function normalizeFlotationSize(dia: number | null, width: number | null, rim: number | null) {
  if (!dia || !width || !rim) return "";
  return `${dia}x${Number(width).toFixed(2)}R${rim}`;
}

interface TireSizeSearchFormProps {
  className?: string;
  initialWidth?: string;
  initialAspectRatio?: string;
  initialDiameter?: string;
}

export function TireSizeSearchForm({
  className = "",
  initialWidth = "",
  initialAspectRatio = "",
  initialDiameter = "",
}: TireSizeSearchFormProps) {
  const router = useRouter();

  // Metric tire state
  const [tireStep, setTireStep] = useState<"w" | "a" | "r">(
    initialWidth ? (initialAspectRatio ? "r" : "a") : "w"
  );
  const [tireWidth, setTireWidth] = useState<number | null>(
    initialWidth ? Number(initialWidth) : null
  );
  const [tireAspect, setTireAspect] = useState<number | null>(
    initialAspectRatio ? Number(initialAspectRatio) : null
  );
  const [tireRim, setTireRim] = useState<number | null>(
    initialDiameter ? Number(initialDiameter) : null
  );

  // Flotation tire state
  const [floatStep, setFloatStep] = useState<"d" | "w" | "r">("d");
  const [floatDia, setFloatDia] = useState<number | null>(null);
  const [floatWidth, setFloatWidth] = useState<number | null>(null);
  const [floatRim, setFloatRim] = useState<number | null>(null);

  // Parse metric sizes from JSON
  const metric = Array.isArray((tireSizes as any)?.metric)
    ? ((tireSizes as any).metric as string[])
    : [];
  const parsedMetric = metric
    .map((s) => {
      const m = String(s).match(/^(\d{3})\/(\d{2})R(\d{2})$/);
      if (!m) return null;
      return { width: Number(m[1]), aspect: Number(m[2]), rim: Number(m[3]), label: s };
    })
    .filter(Boolean) as Array<{ width: number; aspect: number; rim: number; label: string }>;

  // Parse flotation sizes from JSON
  const flotationRows = Array.isArray((tireSizes as any)?.flotation)
    ? ((tireSizes as any).flotation as any[])
    : [];
  const parsedFlotation = flotationRows
    .map((x) => ({
      dia: Number(x?.dia),
      width: Number(x?.width),
      rim: Number(x?.rim),
    }))
    .filter((x) => [x.dia, x.width, x.rim].every((n) => Number.isFinite(n) && n > 0));

  // Compute available options based on selections
  const metricWidths = Array.from(new Set(parsedMetric.map((x) => x.width))).sort((a, b) => a - b);
  const metricAspects = Array.from(
    new Set(parsedMetric.filter((x) => (tireWidth ? x.width === tireWidth : true)).map((x) => x.aspect))
  ).sort((a, b) => a - b);
  const metricRims = Array.from(
    new Set(
      parsedMetric
        .filter((x) => (tireWidth ? x.width === tireWidth : true))
        .filter((x) => (tireAspect ? x.aspect === tireAspect : true))
        .map((x) => x.rim)
    )
  ).sort((a, b) => a - b);

  const flotationDias = Array.from(new Set(parsedFlotation.map((x) => x.dia))).sort((a, b) => a - b);
  const flotationWidths = Array.from(
    new Set(parsedFlotation.filter((x) => (floatDia ? x.dia === floatDia : true)).map((x) => x.width))
  ).sort((a, b) => a - b);
  const flotationRims = Array.from(
    new Set(
      parsedFlotation
        .filter((x) => (floatDia ? x.dia === floatDia : true))
        .filter((x) => (floatWidth ? x.width === floatWidth : true))
        .map((x) => x.rim)
    )
  ).sort((a, b) => a - b);

  const metricSelected = normalizeTireSize(tireWidth, tireAspect, tireRim);
  const flotationSelected = normalizeFlotationSize(floatDia, floatWidth, floatRim);

  function Btn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={
          "rounded-full border px-3 py-1 text-xs font-extrabold transition-colors " +
          (active
            ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]"
            : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50")
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className={`bg-white rounded-3xl shadow-xl border border-neutral-200 p-6 sm:p-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-extrabold text-neutral-900">Enter Your Tire Size</div>
          <div className="text-xs text-neutral-500">Find it on your tire sidewall (e.g., 275/60R20)</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* METRIC SIZES */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="text-xs font-extrabold text-neutral-900">Metric sizes</div>
        <div className="mt-3">
          <div className="text-xs font-extrabold text-neutral-900">
            {tireStep === "w" ? "Select Width" : tireStep === "a" ? "Select Aspect" : "Select Rim"}
          </div>

          {tireStep === "w" && (
            <div className="mt-2 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
              {metricWidths.map((w) => (
                <Btn
                  key={w}
                  label={String(w)}
                  active={tireWidth === w}
                  onClick={() => {
                    setTireWidth(w);
                    setTireAspect(null);
                    setTireRim(null);
                    setTireStep("a");
                  }}
                />
              ))}
            </div>
          )}

          {tireStep === "a" && (
            <div className="mt-2 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
              {metricAspects.map((a) => (
                <Btn
                  key={a}
                  label={String(a)}
                  active={tireAspect === a}
                  onClick={() => {
                    setTireAspect(a);
                    setTireRim(null);
                    setTireStep("r");
                  }}
                />
              ))}
            </div>
          )}

          {tireStep === "r" && (
            <div className="mt-2 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
              {metricRims.map((r) => (
                <Btn
                  key={r}
                  label={String(r)}
                  active={tireRim === r}
                  onClick={() => {
                    const nextSize = normalizeTireSize(tireWidth, tireAspect, r);
                    if (!nextSize) {
                      setTireRim(r);
                      return;
                    }
                    const next = new URLSearchParams();
                    next.set("size", nextSize);
                    router.push(`/tires?${next.toString()}`);
                  }}
                />
              ))}
            </div>
          )}

          <div className="mt-3 text-sm font-extrabold text-neutral-900">
            {metricSelected || "Select size"}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {tireStep !== "w" && (
              <button
                type="button"
                onClick={() => {
                  if (tireStep === "r") {
                    setTireStep("a");
                    setTireRim(null);
                    return;
                  }
                  if (tireStep === "a") {
                    setTireStep("w");
                    setTireAspect(null);
                  }
                }}
                className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setTireStep("w");
                setTireWidth(null);
                setTireAspect(null);
                setTireRim(null);
              }}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              Reset
            </button>

            <button
              type="button"
              disabled={!metricSelected}
              onClick={() => {
                const next = new URLSearchParams();
                next.set("size", metricSelected);
                router.push(`/tires?${next.toString()}`);
              }}
              className="h-11 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)] disabled:opacity-60"
            >
              Search tires
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 h-px bg-neutral-200" />

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* FLOTATION SIZES */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="mt-4">
        <div className="text-xs font-extrabold text-neutral-900">Flotation sizes</div>
        <div className="mt-3">
          <div className="text-xs font-extrabold text-neutral-900">
            {floatStep === "d" ? "Select Diameter" : floatStep === "w" ? "Select Width" : "Select Rim"}
          </div>

          {floatStep === "d" && (
            <div className="mt-2 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
              {flotationDias.map((d) => (
                <Btn
                  key={d}
                  label={String(d)}
                  active={floatDia === d}
                  onClick={() => {
                    setFloatDia(d);
                    setFloatWidth(null);
                    setFloatRim(null);
                    setFloatStep("w");
                  }}
                />
              ))}
            </div>
          )}

          {floatStep === "w" && (
            <div className="mt-2 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
              {flotationWidths.map((w) => (
                <Btn
                  key={w}
                  label={w.toFixed(2)}
                  active={floatWidth === w}
                  onClick={() => {
                    setFloatWidth(w);
                    setFloatRim(null);
                    setFloatStep("r");
                  }}
                />
              ))}
            </div>
          )}

          {floatStep === "r" && (
            <div className="mt-2 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
              {flotationRims.map((r) => (
                <Btn
                  key={r}
                  label={String(r)}
                  active={floatRim === r}
                  onClick={() => {
                    const final = normalizeFlotationSize(floatDia, floatWidth, r);
                    if (!final) {
                      setFloatRim(r);
                      return;
                    }

                    // Build rawSize digits (TireConnect style): 37x13.50R22 -> 37135022
                    const rawSize = (() => {
                      const m = final.match(/^(\d{2})x(\d{1,2}\.\d{2})R(\d{2}(?:\.5)?)$/i);
                      if (!m) return "";
                      const dia = m[1];
                      const w = m[2].replace(".", "");
                      const rim = m[3].replace(".", "");
                      return `${dia}${w}${rim}`;
                    })();

                    const next = new URLSearchParams();
                    next.set("flotation", final);
                    if (rawSize) next.set("size", rawSize);
                    router.push(`/tires?${next.toString()}`);
                  }}
                />
              ))}
            </div>
          )}

          <div className="mt-3 text-sm font-extrabold text-neutral-900">
            {flotationSelected || "Select size"}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {floatStep !== "d" && (
              <button
                type="button"
                onClick={() => {
                  if (floatStep === "r") {
                    setFloatStep("w");
                    setFloatRim(null);
                    return;
                  }
                  if (floatStep === "w") {
                    setFloatStep("d");
                    setFloatWidth(null);
                    setFloatDia(null);
                  }
                }}
                className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setFloatStep("d");
                setFloatDia(null);
                setFloatWidth(null);
                setFloatRim(null);
              }}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              Reset
            </button>

            <button
              type="button"
              disabled={!flotationSelected}
              onClick={() => {
                const next = new URLSearchParams();
                next.set("flotation", flotationSelected);
                router.push(`/tires?${next.toString()}`);
              }}
              className="h-11 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)] disabled:opacity-60"
            >
              Search tires
            </button>
          </div>
        </div>
      </div>

      {/* Help text */}
      <p className="mt-6 text-center text-xs text-neutral-500">
        Not sure of your size?{" "}
        <button 
          onClick={() => router.push("/tires")}
          className="text-blue-600 hover:underline font-semibold"
        >
          Search by vehicle instead
        </button>
      </p>
    </div>
  );
}
