"use client";

import { useState, useEffect } from "react";
import { usePOS } from "./POSContext";

// ============================================================================
// Types
// ============================================================================

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 50 }, (_, i) => String(CURRENT_YEAR + 1 - i));

interface TrimOption {
  value: string;
  label: string;
  modificationId?: string;
}

type Step = "year" | "make" | "model" | "trim";

// ============================================================================
// Crumb Component (shows current selections)
// ============================================================================

function Crumb({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-300">
      <span className="text-neutral-500">{label}: </span>
      <span className="font-extrabold text-white">{value || "—"}</span>
    </div>
  );
}

// ============================================================================
// Make Badge (colored icon with initials)
// ============================================================================

function makeInitials(make: string) {
  const cleaned = String(make || "").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/g).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  return letters.join("") || cleaned.slice(0, 2).toUpperCase();
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
      className="grid h-10 w-10 place-items-center rounded-2xl border border-neutral-700 text-xs font-extrabold text-white"
      style={{ background: `hsla(${hue}, 50%, 30%, 1)` }}
      title={make}
    >
      {initials}
    </div>
  );
}

// ============================================================================
// POS Vehicle Step (Pill-style stepped selector)
// ============================================================================

export function POSVehicleStep() {
  const { setVehicle } = usePOS();
  
  const [step, setStep] = useState<Step>("year");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<TrimOption[]>([]);
  
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTrims, setLoadingTrims] = useState(false);

  // Fetch makes when year is selected
  useEffect(() => {
    if (!year) {
      setMakes([]);
      return;
    }
    
    setLoadingMakes(true);
    fetch(`/api/vehicles/makes?year=${year}`)
      .then((res) => res.json())
      .then((data) => setMakes(data.results || data.makes || []))
      .catch(() => setMakes([]))
      .finally(() => setLoadingMakes(false));
  }, [year]);

  // Fetch models when make is selected
  useEffect(() => {
    if (!year || !make) {
      setModels([]);
      return;
    }
    
    setLoadingModels(true);
    fetch(`/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`)
      .then((res) => res.json())
      .then((data) => setModels(data.results || data.models || []))
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [year, make]);

  // Fetch trims when model is selected
  useEffect(() => {
    if (!year || !make || !model) {
      setTrims([]);
      return;
    }
    
    setLoadingTrims(true);
    fetch(`/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`)
      .then((res) => res.json())
      .then((data) => setTrims(data.results || data.trims || []))
      .catch(() => setTrims([]))
      .finally(() => setLoadingTrims(false));
  }, [year, make, model]);

  const handleComplete = (selectedTrim?: string) => {
    if (!year || !make || !model) return;
    
    setVehicle({
      year,
      make,
      model,
      trim: selectedTrim || trim || undefined,
    });
  };

  const reset = () => {
    setStep("year");
    setYear("");
    setMake("");
    setModel("");
    setTrim("");
    setMakes([]);
    setModels([]);
    setTrims([]);
  };

  const goBack = () => {
    if (step === "trim") {
      setStep("model");
      setTrim("");
    } else if (step === "model") {
      setStep("make");
      setModel("");
      setModels([]);
      setTrims([]);
    } else if (step === "make") {
      setStep("year");
      setMake("");
      setModels([]);
      setTrims([]);
    }
  };

  const crumbs = [
    { label: "Year", value: year || undefined },
    { label: "Make", value: make || undefined },
    { label: "Model", value: model || undefined },
    ...(step === "trim" && trim ? [{ label: "Trim", value: trim }] : []),
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white">What's the vehicle?</h2>
        <p className="text-neutral-400 mt-2">Select the customer's vehicle to see what fits</p>
      </div>
      
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
        {/* Crumbs and navigation */}
        <div className="flex items-center justify-between mb-4">
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
                className="text-xs font-semibold text-neutral-400 hover:text-white hover:underline"
              >
                ← Back
              </button>
            )}
            {step !== "year" && (
              <button
                type="button"
                onClick={reset}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline"
              >
                Start over
              </button>
            )}
          </div>
        </div>

        {/* Year Step */}
        {step === "year" && (
          <div>
            <div className="text-sm font-extrabold text-white mb-3">Select Year</div>
            <div className="flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
              {YEARS.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setYear(y);
                    setMake("");
                    setModel("");
                    setTrim("");
                    setStep("make");
                  }}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm font-extrabold transition-colors " +
                    (year === y
                      ? "border-blue-500 bg-blue-500/20 text-blue-400"
                      : "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700 hover:border-neutral-600")
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
            <div className="text-sm font-extrabold text-white mb-1">Select Make</div>
            <div className="text-xs text-neutral-500 mb-3">
              {loadingMakes ? "Loading makes…" : makes.length ? `${makes.length} makes found` : "No makes found"}
            </div>
            <div className="grid max-h-[360px] grid-cols-2 gap-2 overflow-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-3 sm:grid-cols-3">
              {makes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMake(m);
                    setModel("");
                    setTrim("");
                    setStep("model");
                  }}
                  className={
                    "rounded-2xl border p-3 text-left transition-colors " +
                    (make === m
                      ? "border-blue-500 bg-blue-500/20"
                      : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-700")
                  }
                >
                  <div className="flex items-center gap-3">
                    <MakeBadge make={m} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-white">{m}</div>
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
            <div className="text-sm font-extrabold text-white mb-1">Select Model</div>
            <div className="text-xs text-neutral-500 mb-3">
              {loadingModels ? "Loading models…" : models.length ? `${models.length} models found` : "No models found"}
            </div>
            <div className="flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
              {models.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setModel(m);
                    setTrim("");
                    // Check if we need to show trims or go directly to complete
                    // We'll check after trims load
                    setStep("trim");
                  }}
                  className={
                    "rounded-full border px-4 py-2 text-sm font-extrabold transition-colors " +
                    (model === m
                      ? "border-blue-500 bg-blue-500/20 text-blue-400"
                      : "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700 hover:border-neutral-600")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trim Step */}
        {step === "trim" && (
          <div>
            <div className="text-sm font-extrabold text-white mb-1">Select Trim</div>
            <div className="text-xs text-neutral-500 mb-3">
              {loadingTrims 
                ? "Loading trims…" 
                : trims.length 
                  ? `${trims.length} trims found (or skip for any trim)` 
                  : "No specific trims - continue with any configuration"}
            </div>
            
            {trims.length > 0 ? (
              <div className="flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
                {trims.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setTrim(t.label);
                      handleComplete(t.label);
                    }}
                    className={
                      "rounded-full border px-4 py-2 text-sm font-extrabold transition-colors " +
                      (trim === t.label
                        ? "border-blue-500 bg-blue-500/20 text-blue-400"
                        : "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700 hover:border-neutral-600")
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : !loadingTrims ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center">
                <div className="text-neutral-400 text-sm">
                  No trim differentiation needed for this vehicle.
                </div>
              </div>
            ) : null}
            
            {/* Continue button (skip trim or after trim loaded with no options) */}
            <button
              onClick={() => handleComplete()}
              disabled={loadingTrims}
              className={`
                w-full mt-4 h-14 rounded-xl font-bold text-lg transition-all
                ${!loadingTrims
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                }
              `}
            >
              {trims.length > 0 ? "Skip Trim Selection →" : "Continue to Packages →"}
            </button>
          </div>
        )}
      </div>
      
      {/* Quick vehicle lookup hint */}
      <div className="mt-6 text-center text-sm text-neutral-500">
        Tip: Check the door jamb sticker for exact tire size if needed
      </div>
    </div>
  );
}
