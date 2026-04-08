"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// Common tire sizes for dropdowns
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
  const [width, setWidth] = useState(initialWidth);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  const [diameter, setDiameter] = useState(initialDiameter);

  const isValid = width && aspectRatio && diameter;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

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
  }, [width, aspectRatio, diameter, isValid, router]);

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

      {/* Size diagram hint */}
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

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-3">
          {/* Width */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Width
            </label>
            <select
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select</option>
              {TIRE_WIDTHS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Aspect
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            >
              <option value="">Select</option>
              {ASPECT_RATIOS.map((ar) => (
                <option key={ar} value={ar}>{ar}</option>
              ))}
            </select>
          </div>

          {/* Diameter */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Diameter
            </label>
            <select
              value={diameter}
              onChange={(e) => setDiameter(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="">Select</option>
              {RIM_DIAMETERS.map((d) => (
                <option key={d} value={d}>{d}"</option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!isValid}
          className={`
            mt-6 w-full h-14 rounded-xl font-extrabold text-base transition-all duration-200
            ${isValid 
              ? "bg-[var(--brand-red)] text-white hover:bg-red-700 shadow-lg hover:shadow-xl" 
              : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }
          `}
        >
          {isValid ? `Find ${width}/${aspectRatio}R${diameter} Tires` : "Select Size to Continue"}
        </button>
      </form>

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
