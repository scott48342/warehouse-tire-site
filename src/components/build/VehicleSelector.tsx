"use client";

import { useState, useEffect, useMemo } from "react";
import { useBuild, type BuildVehicle } from "./BuildContext";

// ============================================================================
// Constants
// ============================================================================

const THIS_YEAR = new Date().getFullYear();
// Generate years from current year back 70 years
const YEARS = Array.from({ length: 70 }, (_, i) => String(THIS_YEAR + 1 - i));

// ============================================================================
// Types
// ============================================================================

type MakeOption = { make: string; makeDisplay?: string };
type ModelOption = { model: string; modelDisplay?: string };
type TrimOption = { trim: string; trimDisplay?: string };

// ============================================================================
// VehicleSelector Component
// ============================================================================

export function VehicleSelector() {
  const { setVehicle } = useBuild();
  
  const [makes, setMakes] = useState<MakeOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [trims, setTrims] = useState<TrimOption[]>([]);
  
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedTrim, setSelectedTrim] = useState<string>("");
  
  const [loading, setLoading] = useState<"makes" | "models" | "trims" | null>(null);
  
  // Fetch makes when year changes
  useEffect(() => {
    if (!selectedYear) {
      setMakes([]);
      setSelectedMake("");
      return;
    }
    
    const fetchMakes = async () => {
      setLoading("makes");
      try {
        const res = await fetch(`/api/vehicles/makes?year=${encodeURIComponent(selectedYear)}`);
        const data = await res.json();
        // API returns { results: string[] }
        const makesList = data.results || data.makes || [];
        setMakes(makesList.map((m: string) => ({ make: m })));
      } catch (err) {
        console.error("[VehicleSelector] Failed to fetch makes:", err);
        setMakes([]);
      } finally {
        setLoading(null);
      }
    };
    fetchMakes();
  }, [selectedYear]);
  
  // Fetch models when make changes
  useEffect(() => {
    if (!selectedYear || !selectedMake) {
      setModels([]);
      setSelectedModel("");
      return;
    }
    
    const fetchModels = async () => {
      setLoading("models");
      try {
        const params = new URLSearchParams({ year: selectedYear, make: selectedMake });
        const res = await fetch(`/api/vehicles/models?${params.toString()}`);
        const data = await res.json();
        // API returns { results: string[] }
        const modelsList = data.results || data.models || [];
        setModels(modelsList.map((m: string) => ({ model: m })));
      } catch (err) {
        console.error("[VehicleSelector] Failed to fetch models:", err);
        setModels([]);
      } finally {
        setLoading(null);
      }
    };
    fetchModels();
  }, [selectedYear, selectedMake]);
  
  // Fetch trims when model changes
  useEffect(() => {
    if (!selectedYear || !selectedMake || !selectedModel) {
      setTrims([]);
      setSelectedTrim("");
      return;
    }
    
    const fetchTrims = async () => {
      setLoading("trims");
      try {
        const params = new URLSearchParams({ year: selectedYear, make: selectedMake, model: selectedModel });
        const res = await fetch(`/api/vehicles/trims?${params.toString()}`);
        const data = await res.json();
        // API returns { results: Array<{value, label}> } or { trims: [] }
        const trimsList = data.results || data.trims || [];
        // Handle both string[] and {value, label}[] formats
        setTrims(trimsList.map((t: string | { value: string; label?: string }) => 
          typeof t === "string" ? { trim: t } : { trim: t.value, trimDisplay: t.label }
        ));
      } catch (err) {
        console.error("[VehicleSelector] Failed to fetch trims:", err);
        setTrims([]);
      } finally {
        setLoading(null);
      }
    };
    fetchTrims();
  }, [selectedYear, selectedMake, selectedModel]);
  
  // Handle continue
  const handleContinue = () => {
    if (!selectedYear || !selectedMake || !selectedModel) return;
    
    const vehicle: BuildVehicle = {
      year: selectedYear,
      make: selectedMake,
      model: selectedModel,
      trim: selectedTrim || undefined,
    };
    
    setVehicle(vehicle);
  };
  
  const canContinue = selectedYear && selectedMake && selectedModel;
  
  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl shadow-lg mb-4">
          🚗
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">What vehicle do you drive?</h2>
        <p className="text-neutral-600 mt-2">
          We'll find the perfect wheels and tires for your exact fitment.
        </p>
      </div>
      
      {/* Selectors */}
      <div className="space-y-4">
        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedMake("");
              setSelectedModel("");
              setSelectedTrim("");
            }}
            className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        
        {/* Make */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Make</label>
          <select
            value={selectedMake}
            onChange={(e) => {
              setSelectedMake(e.target.value);
              setSelectedModel("");
              setSelectedTrim("");
            }}
            disabled={!selectedYear || loading === "makes"}
            className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-neutral-100"
          >
            <option value="">Select make</option>
            {makes.map((m) => (
              <option key={m.make} value={m.make}>{m.makeDisplay || m.make}</option>
            ))}
          </select>
        </div>
        
        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              setSelectedTrim("");
            }}
            disabled={!selectedMake || loading === "models"}
            className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-neutral-100"
          >
            <option value="">Select model</option>
            {models.map((m) => (
              <option key={m.model} value={m.model}>{m.modelDisplay || m.model}</option>
            ))}
          </select>
        </div>
        
        {/* Trim (optional) */}
        {trims.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Trim <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <select
              value={selectedTrim}
              onChange={(e) => setSelectedTrim(e.target.value)}
              disabled={loading === "trims"}
              className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white text-neutral-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-neutral-100"
            >
              <option value="">Any trim</option>
              {trims.map((t) => (
                <option key={t.trim} value={t.trim}>{t.trimDisplay || t.trim}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className={`w-full mt-8 py-4 rounded-xl font-bold text-base transition-all ${
          canContinue
            ? "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 shadow-lg shadow-red-500/20 active:scale-[0.99]"
            : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
        }`}
      >
        Find Wheels & Tires
      </button>
      
      {/* Trust signals */}
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> Guaranteed Fit
        </span>
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> Free Shipping
        </span>
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> Easy Returns
        </span>
      </div>
    </div>
  );
}
