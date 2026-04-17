"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// Common tire sizes for pill buttons
const TIRE_WIDTHS = [
  "155", "165", "175", "185", "195", "205", "215", "225", "235", "245", 
  "255", "265", "275", "285", "295", "305", "315", "325", "335", "345"
];

const ASPECT_RATIOS = [
  "25", "30", "35", "40", "45", "50", "55", "60", "65", "70", "75", "80", "85"
];

const RIM_DIAMETERS = [
  "14", "15", "16", "17", "18", "19", "20", "21", "22", "24", "26"
];

type Step = "width" | "aspect" | "diameter";

function Crumb({ label, value, color }: { label: string; value?: string; color?: string }) {
  return (
    <div className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
      <span className="text-neutral-500">{label}: </span>
      <span className={`font-extrabold ${color || "text-neutral-900"}`}>{value || "—"}</span>
    </div>
  );
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
  const [step, setStep] = useState<Step>(initialWidth ? (initialAspectRatio ? "diameter" : "aspect") : "width");
  const [width, setWidth] = useState(initialWidth);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  const [diameter, setDiameter] = useState(initialDiameter);

  const handleSubmit = useCallback(() => {
    if (!width || !aspectRatio || !diameter) return;

    // Build the tire size string: 275/60R20
    const sizeString = `${width}/${aspectRatio}R${diameter}`;
    
    // Navigate to results with size params
    const params = new URLSearchParams({
      searchMode: "size",
      size: sizeString,
      width,
      aspectRatio,
      diameter,
    });
    
    router.push(`/tires?${params.toString()}`);
  }, [width, aspectRatio, diameter, router]);

  function reset() {
    setStep("width");
    setWidth("");
    setAspectRatio("");
    setDiameter("");
  }

  function goBack() {
    if (step === "diameter") {
      setStep("aspect");
      setDiameter("");
    } else if (step === "aspect") {
      setStep("width");
      setAspectRatio("");
    }
  }

  const crumbs = [
    { label: "Width", value: width || undefined, color: width ? "text-blue-600" : undefined },
    { label: "Aspect", value: aspectRatio || undefined, color: aspectRatio ? "text-green-600" : undefined },
    { label: "Diameter", value: diameter ? `${diameter}"` : undefined, color: diameter ? "text-amber-600" : undefined },
  ];

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

      {/* Size diagram preview */}
      <div className="mb-6 rounded-xl bg-neutral-50 border border-neutral-200 p-4">
        <div className="flex items-center justify-center gap-1 text-lg font-mono font-bold text-neutral-800">
          <span className={width ? "text-blue-600" : "text-neutral-400"}>
            {width || "275"}
          </span>
          <span className="text-neutral-400">/</span>
          <span className={aspectRatio ? "text-green-600" : "text-neutral-400"}>
            {aspectRatio || "60"}
          </span>
          <span className="text-neutral-400">R</span>
          <span className={diameter ? "text-amber-600" : "text-neutral-400"}>
            {diameter || "20"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
            Width (mm)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-600"></span>
            Aspect Ratio
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-600"></span>
            Rim Diameter
          </span>
        </div>
      </div>

      {/* Crumbs and navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {crumbs.map((c) => (
            <Crumb key={c.label} label={c.label} value={c.value} color={c.color} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {step !== "width" && (
            <button
              type="button"
              onClick={goBack}
              className="text-xs font-semibold text-neutral-600 hover:underline"
            >
              ← Back
            </button>
          )}
          {step !== "width" && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Start over
            </button>
          )}
        </div>
      </div>

      {/* Width Step */}
      {step === "width" && (
        <div>
          <div className="text-xs font-extrabold text-neutral-900">Select Width (mm)</div>
          <div className="mt-3 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
            {TIRE_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => {
                  setWidth(w);
                  setStep("aspect");
                }}
                className={
                  "rounded-full border px-4 py-2 text-sm font-extrabold transition-colors " +
                  (width === w
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:border-neutral-300")
                }
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Aspect Ratio Step */}
      {step === "aspect" && (
        <div>
          <div className="text-xs font-extrabold text-neutral-900">Select Aspect Ratio</div>
          <div className="mt-3 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar}
                type="button"
                onClick={() => {
                  setAspectRatio(ar);
                  setStep("diameter");
                }}
                className={
                  "rounded-full border px-4 py-2 text-sm font-extrabold transition-colors " +
                  (aspectRatio === ar
                    ? "border-green-600 bg-green-50 text-green-600"
                    : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:border-neutral-300")
                }
              >
                {ar}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Diameter Step */}
      {step === "diameter" && (
        <div>
          <div className="text-xs font-extrabold text-neutral-900">Select Rim Diameter</div>
          <div className="mt-3 flex max-h-[280px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
            {RIM_DIAMETERS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDiameter(d);
                  // Auto-submit after selecting diameter
                  setTimeout(() => {
                    const sizeString = `${width}/${aspectRatio}R${d}`;
                    const params = new URLSearchParams({
                      searchMode: "size",
                      size: sizeString,
                      width,
                      aspectRatio,
                      diameter: d,
                    });
                    router.push(`/tires?${params.toString()}`);
                  }, 150);
                }}
                className={
                  "rounded-full border px-4 py-2 text-sm font-extrabold transition-colors " +
                  (diameter === d
                    ? "border-amber-600 bg-amber-50 text-amber-600"
                    : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:border-neutral-300")
                }
              >
                {d}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <p className="mt-4 text-center text-xs text-neutral-500">
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
