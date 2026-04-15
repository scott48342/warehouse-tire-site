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

// ============================================================================
// POS Vehicle Step
// ============================================================================

export function POSVehicleStep() {
  const { setVehicle } = usePOS();
  
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

  // Fetch makes when year changes
  useEffect(() => {
    if (!year) {
      setMakes([]);
      setMake("");
      return;
    }
    
    setLoadingMakes(true);
    fetch(`/api/vehicles/makes?year=${year}`)
      .then((res) => res.json())
      .then((data) => setMakes(data.results || data.makes || []))
      .catch(() => setMakes([]))
      .finally(() => setLoadingMakes(false));
    
    // Reset downstream
    setMake("");
    setModel("");
    setTrim("");
    setModels([]);
    setTrims([]);
  }, [year]);

  // Fetch models when make changes
  useEffect(() => {
    if (!year || !make) {
      setModels([]);
      setModel("");
      return;
    }
    
    setLoadingModels(true);
    fetch(`/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`)
      .then((res) => res.json())
      .then((data) => setModels(data.results || data.models || []))
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
    
    // Reset downstream
    setModel("");
    setTrim("");
    setTrims([]);
  }, [year, make]);

  // Fetch trims when model changes
  useEffect(() => {
    if (!year || !make || !model) {
      setTrims([]);
      setTrim("");
      return;
    }
    
    setLoadingTrims(true);
    fetch(`/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`)
      .then((res) => res.json())
      .then((data) => setTrims(data.results || data.trims || []))
      .catch(() => setTrims([]))
      .finally(() => setLoadingTrims(false));
    
    setTrim("");
  }, [year, make, model]);

  const handleContinue = () => {
    if (!year || !make || !model) return;
    
    setVehicle({
      year,
      make,
      model,
      trim: trim || undefined,
    });
  };

  const canContinue = year && make && model;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white">What's the vehicle?</h2>
        <p className="text-neutral-400 mt-2">Select the customer's vehicle to see what fits</p>
      </div>
      
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 space-y-4">
        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full h-12 rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        
        {/* Make */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Make</label>
          <select
            value={make}
            onChange={(e) => setMake(e.target.value)}
            disabled={!year || loadingMakes}
            className="w-full h-12 rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">{loadingMakes ? "Loading..." : "Select Make"}</option>
            {makes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        
        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!make || loadingModels}
            className="w-full h-12 rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">{loadingModels ? "Loading..." : "Select Model"}</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        
        {/* Trim (Optional) */}
        {trims.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Trim <span className="text-neutral-500">(Optional)</span>
            </label>
            <select
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              disabled={loadingTrims}
              className="w-full h-12 rounded-xl bg-neutral-800 border border-neutral-700 text-white px-4 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">{loadingTrims ? "Loading..." : "Any Trim"}</option>
              {trims.map((t) => (
                <option key={t.value} value={t.label}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
        
        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={`
            w-full mt-4 h-14 rounded-xl font-bold text-lg transition-all
            ${canContinue
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
            }
          `}
        >
          Continue to Packages →
        </button>
      </div>
      
      {/* Quick vehicle lookup hint */}
      <div className="mt-6 text-center text-sm text-neutral-500">
        Tip: Check the door jamb sticker for exact tire size if needed
      </div>
    </div>
  );
}
