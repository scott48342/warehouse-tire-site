"use client";

import { useState } from "react";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => String(THIS_YEAR - i));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export type VehicleSelection = {
  year: string;
  make: string;
  model: string;
  trim: string;
  modification: string;
};

/**
 * New stepped vehicle selector with year grid and chip-based UI.
 * Replaces the old YYMM dropdown selector.
 */
export function VehicleSelector({
  onSelect,
}: {
  onSelect: (v: VehicleSelection) => void;
}) {
  const [step, setStep] = useState<"year" | "make" | "model" | "trim">("year");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<{ trim: string; modification: string }[]>([]);
  
  const [loading, setLoading] = useState(false);

  async function selectYear(y: string) {
    setYear(y);
    setMake("");
    setModel("");
    setLoading(true);
    try {
      const data = await fetchJson<{ results?: string[] }>(`/api/vehicles/makes?year=${y}`);
      setMakes(data.results || []);
      setStep("make");
    } catch {
      setMakes([]);
    }
    setLoading(false);
  }

  async function selectMake(m: string) {
    setMake(m);
    setModel("");
    setLoading(true);
    try {
      const data = await fetchJson<{ results?: string[] }>(`/api/vehicles/models?year=${year}&make=${m}`);
      setModels(data.results || []);
      setStep("model");
    } catch {
      setModels([]);
    }
    setLoading(false);
  }

  async function selectModel(mod: string) {
    setModel(mod);
    setLoading(true);
    try {
      const data = await fetchJson<{ results?: { label: string; modificationId: string }[] }>(
        `/api/vehicles/trims?year=${year}&make=${make}&model=${mod}`
      );
      // Map API response to our expected format
      const mapped = (data.results || []).map((t) => ({
        trim: t.label,
        modification: t.modificationId,
      }));
      setTrims(mapped);
      setStep("trim");
    } catch {
      setTrims([]);
    }
    setLoading(false);
  }

  function selectTrim(t: { trim: string; modification: string }) {
    onSelect({ year, make, model, trim: t.trim, modification: t.modification });
  }

  function reset() {
    setStep("year");
    setYear("");
    setMake("");
    setModel("");
    setMakes([]);
    setModels([]);
    setTrims([]);
  }

  function goBack() {
    if (step === "trim") {
      setStep("model");
      setTrims([]);
    } else if (step === "model") {
      setStep("make");
      setModels([]);
      setModel("");
    } else if (step === "make") {
      setStep("year");
      setMakes([]);
      setMake("");
      setYear("");
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-neutral-900">Select Your Vehicle</h3>
        <div className="flex items-center gap-3">
          {step !== "year" && (
            <button type="button" onClick={goBack} className="text-xs font-semibold text-neutral-600 hover:underline">
              ← Back
            </button>
          )}
          {step !== "year" && (
            <button type="button" onClick={reset} className="text-xs font-semibold text-[var(--brand-red)] hover:underline">
              Start over
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb chips showing current selection */}
      {(year || make || model) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {year && (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              {year}
            </span>
          )}
          {make && (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              {make}
            </span>
          )}
          {model && (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              {model}
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Loading...
        </div>
      )}

      {/* Year Grid */}
      {!loading && step === "year" && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">Year</div>
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => selectYear(y)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-[var(--brand-red)] hover:bg-red-50"
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Make Grid */}
      {!loading && step === "make" && makes.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">Make</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {makes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectMake(m)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-[var(--brand-red)] hover:bg-red-50 text-left"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model Grid */}
      {!loading && step === "model" && models.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">Model</div>
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectModel(m)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-[var(--brand-red)] hover:bg-red-50 text-left"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trim List */}
      {!loading && step === "trim" && trims.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">Trim / Submodel</div>
          <div className="grid gap-2 max-h-72 overflow-y-auto">
            {trims.map((t) => (
              <button
                key={t.modification}
                type="button"
                onClick={() => selectTrim(t)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900 hover:border-[var(--brand-red)] hover:bg-red-50 text-left"
              >
                {t.trim}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty states */}
      {!loading && step === "make" && makes.length === 0 && year && (
        <div className="mt-4 text-sm text-neutral-600">No makes found for {year}.</div>
      )}
      {!loading && step === "model" && models.length === 0 && make && (
        <div className="mt-4 text-sm text-neutral-600">No models found for {year} {make}.</div>
      )}
      {!loading && step === "trim" && trims.length === 0 && model && (
        <div className="mt-4 text-sm text-neutral-600">No trims found for {year} {make} {model}.</div>
      )}
    </div>
  );
}
