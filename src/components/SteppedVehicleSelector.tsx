"use client";

import { useEffect, useState } from "react";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

type Step = "year" | "make" | "model" | "trim" | "wheelSize";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 70 }, (_, i) => String(THIS_YEAR - i));

function Crumb({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
      <span className="text-neutral-500">{label}: </span>
      <span className="font-extrabold text-neutral-900">{value || "—"}</span>
    </div>
  );
}

function makeInitials(make: string) {
  const cleaned = String(make || "").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/g).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  const out = letters.join("");
  return out.length ? out : cleaned.slice(0, 2).toUpperCase();
}

function makeHue(make: string) {
  let h = 0;
  for (let i = 0; i < make.length; i++) h = (h * 31 + make.charCodeAt(i)) >>> 0;
  return h % 360;
}

function MakeBadge({ make }: { make: string }) {
  const initials = makeInitials(make);
  const hue = makeHue(make);
  return (
    <div
      aria-hidden
      className="grid h-10 w-10 place-items-center rounded-2xl border border-neutral-200 text-xs font-extrabold text-neutral-900"
      style={{ background: `hsla(${hue}, 70%, 92%, 1)` }}
      title={make}
    >
      {initials}
    </div>
  );
}

export type VehicleSelection = {
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;
  wheelDia?: number; // OEM wheel diameter when multiple options exist
};

/**
 * Stepped vehicle selector with year grid + make/model/trim buttons.
 * Matches the VisualFitmentLauncher UI pattern.
 */
export function SteppedVehicleSelector({
  onComplete,
}: {
  onComplete: (selection: VehicleSelection) => void;
}) {
  const [step, setStep] = useState<Step>("year");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [selectedTrim, setSelectedTrim] = useState<{ value: string; label: string } | null>(null);

  const [makes, setMakes] = useState<string[]>([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [trims, setTrims] = useState<Array<{ value: string; label: string }>>([]);
  const [trimsLoading, setTrimsLoading] = useState(false);
  
  // Wheel diameter selection (for trims with multiple OEM wheel sizes)
  const [wheelDiameters, setWheelDiameters] = useState<number[]>([]);
  const [wheelDiametersLoading, setWheelDiametersLoading] = useState(false);
  const [wheelDiametersChecked, setWheelDiametersChecked] = useState(false);

  // Load makes when year changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!year) {
        setMakes([]);
        return;
      }
      setMakesLoading(true);
      try {
        const data = await fetchJson<{ results: string[] }>(`/api/vehicles/makes?year=${encodeURIComponent(year)}`);
        if (!cancelled) setMakes(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!cancelled) setMakes([]);
      } finally {
        if (!cancelled) setMakesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [year]);

  // Load models when make changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!year || !make) {
        setModels([]);
        return;
      }
      setModelsLoading(true);
      try {
        const qs = new URLSearchParams({ year, make });
        const data = await fetchJson<{ results: string[] }>(`/api/vehicles/models?${qs.toString()}`);
        if (!cancelled) setModels(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!cancelled) setModels([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [year, make]);

  // Track if trims have been loaded at least once for current model
  const [trimsLoadedOnce, setTrimsLoadedOnce] = useState(false);

  // Reset trimsLoadedOnce when model changes
  useEffect(() => {
    setTrimsLoadedOnce(false);
  }, [model]);

  // Load trims when model changes
  // Priority: Fitment DB first (has Tier A differentiated trims), then WheelPros fallback
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!year || !make || !model) {
        setTrims([]);
        return;
      }
      setTrimsLoading(true);
      const qs = new URLSearchParams({ year, make, model });

      // Try fitment DB first (has curated Tier A trims for performance vehicles)
      try {
        const data = await fetchJson<{ results: Array<{ value: string; label: string }> }>(
          `/api/vehicles/trims?${qs.toString()}`
        );
        const dbResults = Array.isArray(data?.results) ? data.results : [];
        // Use fitment DB if it has real trims (more than just "Base")
        const hasRealTrims = dbResults.length > 1 || 
          (dbResults.length === 1 && dbResults[0].label !== "Base");
        if (hasRealTrims) {
          if (!cancelled) setTrims(dbResults);
          if (!cancelled) setTrimsLoading(false);
          if (!cancelled) setTrimsLoadedOnce(true);
          return;
        }
      } catch {
        // DB lookup failed - proceed with no trims
      }

      // NOTE: WheelPros fallback removed (2026-04-02). All trim data from internal DB only.
      // Vehicles not in DB will have no trims and auto-continue to fitment lookup.

      // No trims found in internal DB
      if (!cancelled) setTrims([]);
      if (!cancelled) setTrimsLoading(false);
      if (!cancelled) setTrimsLoadedOnce(true);
    })();
    return () => { cancelled = true; };
  }, [year, make, model]);

  // Auto-continue when no trims available (skip the trim step entirely)
  // IMPORTANT: Only auto-continue after trims have actually loaded (trimsLoadedOnce)
  // This prevents race condition where we skip before trims finish loading
  useEffect(() => {
    if (step === "trim" && !trimsLoading && trimsLoadedOnce && trims.length === 0 && year && make && model) {
      // No trims available - need to check wheel diameters before completing
      checkWheelDiametersAndComplete({ year, make, model });
    }
  }, [step, trimsLoading, trimsLoadedOnce, trims.length, year, make, model]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WHEEL DIAMETER CHECK - For trims with multiple OEM wheel sizes
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Check wheel diameters after trim selection to determine if we need the wheelSize step
  async function checkWheelDiametersAndComplete(selection: { 
    year: string; 
    make: string; 
    model: string; 
    trim?: string; 
    modification?: string; 
  }) {
    setWheelDiametersLoading(true);
    setWheelDiametersChecked(false);
    
    try {
      const qs = new URLSearchParams({
        year: selection.year,
        make: selection.make,
        model: selection.model,
      });
      if (selection.modification) qs.set("modification", selection.modification);
      
      const data = await fetchJson<{
        wheelDiameters?: {
          needsSelection: boolean;
          available: number[];
          default?: number;
        };
      }>(`/api/vehicles/tire-sizes?${qs.toString()}`);
      
      const needsSelection = data?.wheelDiameters?.needsSelection ?? false;
      const available = data?.wheelDiameters?.available ?? [];
      
      if (needsSelection && available.length > 1) {
        // Multiple wheel sizes - show wheelSize step
        setWheelDiameters(available.sort((a, b) => a - b));
        setSelectedTrim(selection.trim && selection.modification 
          ? { value: selection.modification, label: selection.trim }
          : null
        );
        setWheelDiametersChecked(true);
        setWheelDiametersLoading(false);
        setStep("wheelSize");
      } else {
        // Single wheel size or none - complete immediately
        setWheelDiametersChecked(true);
        setWheelDiametersLoading(false);
        onComplete(selection);
      }
    } catch (err) {
      console.error("[SteppedVehicleSelector] Failed to fetch wheel diameters:", err);
      // On error, just complete without wheel size step
      setWheelDiametersChecked(true);
      setWheelDiametersLoading(false);
      onComplete(selection);
    }
  }
  
  // Handle trim selection - check wheel diameters before proceeding
  function handleTrimSelect(trim: { value: string; label: string }) {
    const selection = {
      year,
      make,
      model,
      trim: trim.label,
      modification: trim.value,
    };
    setSelectedTrim(trim);
    checkWheelDiametersAndComplete(selection);
  }
  
  // Handle wheel size selection - complete with selected diameter
  function handleWheelSizeSelect(diameter: number) {
    onComplete({
      year,
      make,
      model,
      trim: selectedTrim?.label,
      modification: selectedTrim?.value,
      wheelDia: diameter,
    });
  }

  function reset() {
    setStep("year");
    setYear("");
    setMake("");
    setModel("");
    setMakes([]);
    setModels([]);
    setTrims([]);
    setTrimsLoadedOnce(false);
    setSelectedTrim(null);
    setWheelDiameters([]);
    setWheelDiametersChecked(false);
  }

  function goBack() {
    if (step === "wheelSize") {
      // Go back to trim selection (or model if no trims)
      setWheelDiameters([]);
      setWheelDiametersChecked(false);
      if (trims.length > 0) {
        setStep("trim");
      } else {
        setStep("model");
      }
    } else if (step === "trim") {
      setStep("model");
      setSelectedTrim(null);
    } else if (step === "model") {
      setStep("make");
      setModel("");
    } else if (step === "make") {
      setStep("year");
      setMake("");
    }
  }

  const crumbs = [
    { label: "Year", value: year || undefined },
    { label: "Make", value: make || undefined },
    { label: "Model", value: model || undefined },
    // Show trim in crumbs when on wheelSize step
    ...(step === "wheelSize" && selectedTrim ? [{ label: "Trim", value: selectedTrim.label }] : []),
  ];

  return (
    <div>
      {/* Header with back/reset */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {crumbs.map((c) => (
            <Crumb key={c.label} label={c.label} value={c.value} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {step !== "year" && (
            <button
              type="button"
              onClick={goBack}
              className="text-xs font-semibold text-neutral-600 hover:underline"
            >
              ← Back
            </button>
          )}
          {step !== "year" && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-[var(--brand-red)] hover:underline"
            >
              Start over
            </button>
          )}
        </div>
      </div>

      {/* Year Step */}
      {step === "year" && (
        <div>
          <div className="text-xs font-extrabold text-neutral-900">Select Year</div>
          <div className="mt-3 flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => {
                  setYear(y);
                  setMake("");
                  setModel("");
                  setStep("make");
                }}
                className={
                  "rounded-full border px-3 py-1 text-xs font-extrabold " +
                  (year === y
                    ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]"
                    : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50")
                }
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Make Step */}
      {step === "make" && (
        <div>
          <div className="text-xs font-extrabold text-neutral-900">Select Make</div>
          <div className="mt-1 text-[11px] text-neutral-500">
            {makesLoading ? "Loading makes…" : makes.length ? "" : "No makes found."}
          </div>
          <div className="mt-3 grid max-h-[360px] grid-cols-2 gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3 sm:grid-cols-3">
            {makes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMake(m);
                  setModel("");
                  setStep("model");
                }}
                className={
                  "rounded-2xl border p-3 text-left " +
                  (make === m
                    ? "border-[var(--brand-red)] bg-red-50"
                    : "border-neutral-200 bg-white hover:bg-neutral-50")
                }
              >
                <div className="flex items-center gap-3">
                  <MakeBadge make={m} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-neutral-900">{m}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model Step */}
      {step === "model" && (
        <div>
          <div className="text-xs font-extrabold text-neutral-900">Select Model</div>
          <div className="mt-1 text-[11px] text-neutral-500">
            {modelsLoading ? "Loading models…" : models.length ? "" : "No models found."}
          </div>
          <div className="mt-3 grid max-h-[360px] grid-cols-2 gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3 sm:grid-cols-3">
            {models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModel(m);
                  setStep("trim");
                }}
                className={
                  "rounded-2xl border p-3 text-left " +
                  (model === m
                    ? "border-[var(--brand-red)] bg-red-50"
                    : "border-neutral-200 bg-white hover:bg-neutral-50")
                }
              >
                <div className="text-sm font-extrabold text-neutral-900">{m}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trim Step */}
      {step === "trim" && (
        <div>
          <div className="text-xs font-extrabold text-neutral-900">Select Trim</div>
          <div className="mt-1 text-[11px] text-neutral-500">
            {trimsLoading ? "Loading trims…" : trims.length ? "" : "No trims found."}
          </div>
          <div className="mt-3 grid max-h-[360px] grid-cols-1 gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3 sm:grid-cols-2">
            {trims.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTrimSelect(t)}
                className="rounded-2xl border border-neutral-200 bg-white p-3 text-left hover:bg-neutral-50"
              >
                <div className="text-sm font-extrabold text-neutral-900">{t.label}</div>
              </button>
            ))}
            {wheelDiametersLoading && (
              <div className="col-span-full flex items-center justify-center py-4">
                <div className="text-sm text-neutral-500">Checking wheel options...</div>
              </div>
            )}
            {!trimsLoading && !trims.length && !wheelDiametersLoading && (
              <div className="col-span-full rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                <div className="font-extrabold text-neutral-900">No trim list available.</div>
                <div className="mt-1">You can continue without a specific trim.</div>
                <button
                  type="button"
                  onClick={() => {
                    checkWheelDiametersAndComplete({ year, make, model });
                  }}
                  className="mt-3 h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wheel Size Step - shown when trim has multiple OEM wheel diameters */}
      {step === "wheelSize" && (
        <div>
          <div className="text-xs font-extrabold text-neutral-900">Select Wheel Size</div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Your selected trim came with multiple wheel size options. Choose your current wheel size to see the correct tire fitment.
          </div>
          <div className="mt-3 flex flex-wrap gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
            {wheelDiameters.map((dia) => (
              <button
                key={dia}
                type="button"
                onClick={() => handleWheelSizeSelect(dia)}
                className="rounded-2xl border-2 border-neutral-200 bg-white px-6 py-4 text-center hover:border-[var(--brand-red)] hover:bg-red-50 transition-colors"
              >
                <div className="text-2xl font-extrabold text-neutral-900">{dia}&quot;</div>
                <div className="text-xs text-neutral-500">wheels</div>
              </button>
            ))}
          </div>
          <div className="mt-3 text-xs text-neutral-500">
            💡 Not sure? Check your current tires — the last number (e.g., R{wheelDiameters[0] || 20}) is your wheel diameter.
          </div>
        </div>
      )}
    </div>
  );
}
