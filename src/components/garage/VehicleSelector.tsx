"use client";

import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE SELECTOR MODAL
// Step-through selector for adding vehicles to garage
// ═══════════════════════════════════════════════════════════════════════════════

type Step = "year" | "make" | "model" | "trim";

interface VehicleSelectorProps {
  onSelect: (vehicle: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  }) => void;
  onClose: () => void;
}

const CloseIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronLeftIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

export function VehicleSelector({ onSelect, onClose }: VehicleSelectorProps) {
  const [step, setStep] = useState<Step>("year");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  
  const [years, setYears] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<{ trim: string; modification?: string }[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch years on mount
  useEffect(() => {
    fetchYears();
  }, []);

  async function fetchYears() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vehicles/all-years");
      if (!res.ok) throw new Error("Failed to fetch years");
      const data = await res.json();
      // API returns array of year numbers, convert to strings
      const yearList = Array.isArray(data) ? data.map(String) : (data.years || []);
      setYears(yearList);
    } catch (err) {
      setError("Failed to load years");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMakes(selectedYear: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehicles/makes?year=${selectedYear}`);
      if (!res.ok) throw new Error("Failed to fetch makes");
      const data = await res.json();
      setMakes(data.results || data.makes || []);
    } catch (err) {
      setError("Failed to load makes");
    } finally {
      setLoading(false);
    }
  }

  async function fetchModels(selectedYear: string, selectedMake: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehicles/models?year=${selectedYear}&make=${encodeURIComponent(selectedMake)}`);
      if (!res.ok) throw new Error("Failed to fetch models");
      const data = await res.json();
      setModels(data.results || data.models || []);
    } catch (err) {
      setError("Failed to load models");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrims(selectedYear: string, selectedMake: string, selectedModel: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/vehicles/trims?year=${selectedYear}&make=${encodeURIComponent(selectedMake)}&model=${encodeURIComponent(selectedModel)}`
      );
      if (!res.ok) throw new Error("Failed to fetch trims");
      const data = await res.json();
      // Trims API returns array of { value, label, modificationId } or legacy { trim, modification }
      const trimData = data.results || data.trims || [];
      setTrims(trimData.map((t: any) => {
        if (typeof t === 'string') return { trim: t };
        // Normalize API response - it uses 'label' but we need 'trim'
        return {
          trim: t.label || t.trim || t.value,
          modification: t.modificationId || t.modification || t.value,
        };
      }));
    } catch (err) {
      setError("Failed to load trims");
    } finally {
      setLoading(false);
    }
  }

  function handleYearSelect(selectedYear: string) {
    setYear(selectedYear);
    setMake("");
    setModel("");
    setTrims([]);
    fetchMakes(selectedYear);
    setStep("make");
  }

  function handleMakeSelect(selectedMake: string) {
    setMake(selectedMake);
    setModel("");
    setTrims([]);
    fetchModels(year, selectedMake);
    setStep("model");
  }

  function handleModelSelect(selectedModel: string) {
    setModel(selectedModel);
    fetchTrims(year, make, selectedModel);
    setStep("trim");
  }

  function handleTrimSelect(trim: string, modification?: string) {
    onSelect({
      year,
      make,
      model,
      trim: trim === "All Trims" ? undefined : trim,
      modification,
    });
  }

  function handleSkipTrim() {
    onSelect({
      year,
      make,
      model,
    });
  }

  function handleBack() {
    if (step === "make") {
      setStep("year");
      setMake("");
    } else if (step === "model") {
      setStep("make");
      setModel("");
    } else if (step === "trim") {
      setStep("model");
      setTrims([]);
    }
  }

  const stepLabels: Record<Step, string> = {
    year: "Select Year",
    make: "Select Make",
    model: "Select Model",
    trim: "Select Trim",
  };

  const currentSelection = [
    year && `${year}`,
    make,
    model,
  ].filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:w-[480px] max-h-[85vh] bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {step !== "year" && (
              <button
                onClick={handleBack}
                className="p-1 -ml-1 text-white/60 hover:text-white transition-colors"
              >
                <ChevronLeftIcon />
              </button>
            )}
            <div>
              <h2 className="text-white font-bold text-lg">{stepLabels[step]}</h2>
              {currentSelection && (
                <p className="text-white/50 text-sm">{currentSelection}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-white/60 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => {
                  if (step === "year") fetchYears();
                  else if (step === "make") fetchMakes(year);
                  else if (step === "model") fetchModels(year, make);
                  else fetchTrims(year, make, model);
                }}
                className="text-red-500 hover:text-red-400 font-medium"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {step === "year" &&
                years.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleYearSelect(y)}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 rounded-lg text-white font-medium text-center transition-all"
                  >
                    {y}
                  </button>
                ))}

              {step === "make" &&
                makes.map((m) => (
                  <button
                    key={m}
                    onClick={() => handleMakeSelect(m)}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 rounded-lg text-white font-medium text-center transition-all"
                  >
                    {m}
                  </button>
                ))}

              {step === "model" &&
                models.map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModelSelect(m)}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 rounded-lg text-white font-medium text-center transition-all"
                  >
                    {m}
                  </button>
                ))}

              {step === "trim" && (
                <>
                  {/* If only one trim (Standard/Base), show clearer messaging */}
                  {trims.length === 1 && trims[0].trim?.toLowerCase().includes("standard") ? (
                    <button
                      onClick={() => handleTrimSelect(trims[0].trim, trims[0].modification)}
                      className="col-span-2 sm:col-span-3 px-4 py-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500 rounded-lg text-white font-semibold text-center transition-all"
                    >
                      Continue with {year} {make} {model}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSkipTrim}
                        className="col-span-2 sm:col-span-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-lg text-white/70 font-medium text-center transition-all text-sm"
                      >
                        Skip Trim Selection
                      </button>
                      {trims.map((t) => (
                        <button
                          key={t.modification || t.trim}
                          onClick={() => handleTrimSelect(t.trim, t.modification)}
                          className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 rounded-lg text-white font-medium text-center transition-all text-sm"
                        >
                          {t.trim}
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="px-4 sm:px-5 py-3 border-t border-white/10">
          <div className="flex items-center justify-center gap-2">
            {(["year", "make", "model", "trim"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  i <= ["year", "make", "model", "trim"].indexOf(step)
                    ? "bg-red-500 w-8"
                    : "bg-white/20 w-4"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VehicleSelector;
