"use client";

import { useState, useEffect } from "react";

type FitmentData = {
  boltPattern: string | null;
  centerBoreMm: number | null;
  threadSize: string | null;
  seatType: string | null;
  wheelSizes: string[];
  tireSizes: string[];
  offsetMin: number | null;
  offsetMax: number | null;
};

type Modification = {
  modificationId: string;
  trim: string;
  hasDbData: boolean;
  current: FitmentData;
  override: (FitmentData & { id: string; notes: string; updatedAt: string; createdBy: string }) | null;
};

type SearchResult = {
  year: string;
  make: string;
  model: string;
  trimCount: number;
  dbMatchCount: number;
  overrideCount: number;
  modifications: Modification[];
};

export default function FitmentPage() {
  const [years, setYears] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");

  const [editingMod, setEditingMod] = useState<string | null>(null);

  // Load years on mount
  useEffect(() => {
    fetch("/api/admin/fitment/ymm?type=years")
      .then((r) => r.json())
      .then((d) => setYears(d.years || []))
      .catch(() => {});
  }, []);

  // Load makes when year changes
  useEffect(() => {
    if (!year) {
      setMakes([]);
      setMake("");
      return;
    }
    fetch(`/api/admin/fitment/ymm?type=makes&year=${year}`)
      .then((r) => r.json())
      .then((d) => setMakes(d.makes || []))
      .catch(() => {});
  }, [year]);

  // Load models when make changes
  useEffect(() => {
    if (!year || !make) {
      setModels([]);
      setModel("");
      return;
    }
    fetch(`/api/admin/fitment/ymm?type=models&year=${year}&make=${encodeURIComponent(make)}`)
      .then((r) => r.json())
      .then((d) => setModels(d.models || []))
      .catch(() => {});
  }, [year, make]);

  const handleSearch = async () => {
    if (!year || !make || !model) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/admin/fitment/search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Search failed");

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Fitment Overrides</h1>
        <p className="text-neutral-400 mt-1">
          Search for a vehicle to view and edit its fitment data
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
            >
              <option value="">Select year</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              Make
            </label>
            <select
              value={make}
              onChange={(e) => setMake(e.target.value)}
              disabled={!year}
              className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
            >
              <option value="">Select make</option>
              {makes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!make}
              className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
            >
              <option value="">Select model</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={!year || !make || !model || loading}
              className="w-full h-10 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Vehicle Header */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-bold text-white">
                  {result.year} {result.make} {result.model}
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-neutral-400">
                    {result.trimCount} trim{result.trimCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-green-400">
                    {result.dbMatchCount} with base data
                  </span>
                  {result.overrideCount > 0 && (
                    <>
                      <span className="text-neutral-500">•</span>
                      <span className="text-amber-400">
                        {result.overrideCount} override{result.overrideCount !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Fitment Summary - aggregate from all trims */}
            <FitmentSummary modifications={result.modifications} />
          </div>

          {result.modifications.length === 0 ? (
            <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-8 text-center text-neutral-500">
              No modifications found for this vehicle
            </div>
          ) : (
            <div className="space-y-4">
              {result.modifications.map((mod) => (
                <ModificationCard
                  key={mod.modificationId}
                  mod={mod}
                  year={result.year}
                  make={result.make}
                  model={result.model}
                  isEditing={editingMod === mod.modificationId}
                  onEdit={() => setEditingMod(mod.modificationId)}
                  onCancel={() => setEditingMod(null)}
                  onSaved={() => {
                    setEditingMod(null);
                    handleSearch(); // Refresh
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModificationCard({
  mod,
  year,
  make,
  model,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  mod: Modification;
  year: string;
  make: string;
  model: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    boltPattern: mod.override?.boltPattern || mod.current.boltPattern || "",
    centerBoreMm: mod.override?.centerBoreMm || mod.current.centerBoreMm || "",
    threadSize: mod.override?.threadSize || mod.current.threadSize || "",
    seatType: mod.override?.seatType || mod.current.seatType || "",
    wheelSizes: (mod.override?.wheelSizes || mod.current.wheelSizes || []).join(", "),
    tireSizes: (mod.override?.tireSizes || mod.current.tireSizes || []).join(", "),
    offsetMin: mod.override?.offsetMin || mod.current.offsetMin || "",
    offsetMax: mod.override?.offsetMax || mod.current.offsetMax || "",
    notes: mod.override?.notes || "",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fitment/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modificationId: mod.modificationId,
          year,
          make,
          model,
          trim: mod.trim,
          boltPattern: form.boltPattern || null,
          centerBoreMm: form.centerBoreMm ? Number(form.centerBoreMm) : null,
          threadSize: form.threadSize || null,
          seatType: form.seatType || null,
          wheelSizes: form.wheelSizes ? form.wheelSizes.split(",").map((s) => s.trim()).filter(Boolean) : null,
          tireSizes: form.tireSizes ? form.tireSizes.split(",").map((s) => s.trim()).filter(Boolean) : null,
          offsetMin: form.offsetMin ? Number(form.offsetMin) : null,
          offsetMax: form.offsetMax ? Number(form.offsetMax) : null,
          notes: form.notes || null,
        }),
      });

      if (!res.ok) throw new Error("Save failed");
      onSaved();
    } catch (err) {
      alert("Failed to save override");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this override? Vehicle will use default fitment data.")) return;

    try {
      const res = await fetch(`/api/admin/fitment/override?modificationId=${mod.modificationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      onSaved();
    } catch (err) {
      alert("Failed to delete override");
    }
  };

  const data = mod.override || mod.current;

  return (
    <div className={`bg-neutral-800 rounded-xl border p-5 ${mod.override ? "border-amber-600" : "border-neutral-700"}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-bold text-white">{mod.trim}</div>
          <code className="text-xs text-neutral-500">{mod.modificationId}</code>
          {mod.override && (
            <span className="ml-2 text-xs bg-amber-600 text-white px-2 py-0.5 rounded">
              Override Active
            </span>
          )}
          {!mod.hasDbData && !mod.override && (
            <span className="ml-2 text-xs bg-neutral-600 text-neutral-300 px-2 py-0.5 rounded">
              No Base Data
            </span>
          )}
        </div>
        {!isEditing && (
          <button
            onClick={onEdit}
            className="text-sm text-red-400 hover:text-red-300 font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field
              label="Bolt Pattern"
              value={form.boltPattern}
              onChange={(v) => setForm({ ...form, boltPattern: v })}
              placeholder="6x139.7"
            />
            <Field
              label="Center Bore (mm)"
              value={form.centerBoreMm}
              onChange={(v) => setForm({ ...form, centerBoreMm: v })}
              placeholder="78.1"
              type="number"
            />
            <Field
              label="Thread Size"
              value={form.threadSize}
              onChange={(v) => setForm({ ...form, threadSize: v })}
              placeholder="M14x1.5"
            />
            <Field
              label="Seat Type"
              value={form.seatType}
              onChange={(v) => setForm({ ...form, seatType: v })}
              placeholder="conical"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Wheel Sizes (comma-sep)"
              value={form.wheelSizes}
              onChange={(v) => setForm({ ...form, wheelSizes: v })}
              placeholder="18x8, 20x9, 22x9"
            />
            <Field
              label="Tire Sizes (comma-sep)"
              value={form.tireSizes}
              onChange={(v) => setForm({ ...form, tireSizes: v })}
              placeholder="265/65R18, 275/55R20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Offset Min"
              value={form.offsetMin}
              onChange={(v) => setForm({ ...form, offsetMin: v })}
              placeholder="-12"
              type="number"
            />
            <Field
              label="Offset Max"
              value={form.offsetMax}
              onChange={(v) => setForm({ ...form, offsetMax: v })}
              placeholder="30"
              type="number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full h-20 rounded-lg bg-neutral-700 border border-neutral-600 px-3 py-2 text-white text-sm"
              placeholder="Reason for override..."
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Override"}
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg bg-neutral-700 text-white font-medium hover:bg-neutral-600"
              >
                Cancel
              </button>
            </div>
            {mod.override && (
              <button
                onClick={handleDelete}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Delete Override
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <DataItem label="Bolt Pattern" value={data.boltPattern} />
          <DataItem label="Center Bore" value={data.centerBoreMm ? `${data.centerBoreMm}mm` : null} />
          <DataItem label="Thread Size" value={data.threadSize} />
          <DataItem label="Seat Type" value={data.seatType} />
          <DataItem label="Wheel Sizes" value={data.wheelSizes?.join(", ")} />
          <DataItem label="Tire Sizes" value={data.tireSizes?.join(", ")} />
          <DataItem label="Offset Range" value={data.offsetMin != null && data.offsetMax != null ? `${data.offsetMin} to ${data.offsetMax}mm` : null} />
          {mod.override?.notes && (
            <div className="col-span-2 md:col-span-4">
              <div className="text-neutral-500 text-xs">Notes</div>
              <div className="text-neutral-300">{mod.override.notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
      />
    </div>
  );
}

function DataItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-neutral-500 text-xs">{label}</div>
      <div className="text-white font-medium">{value || "—"}</div>
    </div>
  );
}

function FitmentSummary({ modifications }: { modifications: Modification[] }) {
  // Aggregate fitment data from all modifications
  const allBoltPatterns = new Set<string>();
  const allWheelSizes = new Set<string>();
  const allTireSizes = new Set<string>();
  let minOffset: number | null = null;
  let maxOffset: number | null = null;
  let centerBore: number | null = null;
  let threadSize: string | null = null;
  let seatType: string | null = null;

  for (const mod of modifications) {
    const data = mod.override || mod.current;
    
    if (data.boltPattern) allBoltPatterns.add(data.boltPattern);
    if (data.wheelSizes) data.wheelSizes.forEach(s => allWheelSizes.add(s));
    if (data.tireSizes) data.tireSizes.forEach(s => allTireSizes.add(s));
    
    if (data.offsetMin != null) {
      minOffset = minOffset === null ? data.offsetMin : Math.min(minOffset, data.offsetMin);
    }
    if (data.offsetMax != null) {
      maxOffset = maxOffset === null ? data.offsetMax : Math.max(maxOffset, data.offsetMax);
    }
    if (data.centerBoreMm && !centerBore) centerBore = data.centerBoreMm;
    if (data.threadSize && !threadSize) threadSize = data.threadSize;
    if (data.seatType && !seatType) seatType = data.seatType;
  }

  const hasData = allBoltPatterns.size > 0 || allWheelSizes.size > 0 || allTireSizes.size > 0;

  if (!hasData) {
    return (
      <div className="mt-4 pt-4 border-t border-neutral-700">
        <div className="text-sm text-neutral-500">
          No fitment data available. Add an override to specify fitment specs.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-neutral-700">
      <div className="text-sm font-medium text-neutral-400 mb-3">Fitment Summary</div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
        {/* Bolt Pattern */}
        <div className="bg-neutral-700/50 rounded-lg p-3">
          <div className="text-neutral-500 text-xs mb-1">Bolt Pattern</div>
          <div className="text-white font-bold">
            {allBoltPatterns.size > 0 ? Array.from(allBoltPatterns).join(", ") : "—"}
          </div>
        </div>

        {/* Center Bore */}
        <div className="bg-neutral-700/50 rounded-lg p-3">
          <div className="text-neutral-500 text-xs mb-1">Center Bore</div>
          <div className="text-white font-bold">
            {centerBore ? `${centerBore}mm` : "—"}
          </div>
        </div>

        {/* Offset Range */}
        <div className="bg-neutral-700/50 rounded-lg p-3">
          <div className="text-neutral-500 text-xs mb-1">Offset Range</div>
          <div className="text-white font-bold">
            {minOffset != null && maxOffset != null 
              ? `${minOffset} to ${maxOffset}mm` 
              : "—"}
          </div>
        </div>

        {/* Thread Size */}
        <div className="bg-neutral-700/50 rounded-lg p-3">
          <div className="text-neutral-500 text-xs mb-1">Thread Size</div>
          <div className="text-white font-bold">
            {threadSize || "—"}
          </div>
        </div>

        {/* OEM Wheel Sizes */}
        <div className="bg-neutral-700/50 rounded-lg p-3 col-span-2 md:col-span-1">
          <div className="text-neutral-500 text-xs mb-1">OEM Wheel Sizes</div>
          <div className="text-white font-bold">
            {allWheelSizes.size > 0 ? (
              <span className="text-green-400">{allWheelSizes.size} size{allWheelSizes.size !== 1 ? "s" : ""}</span>
            ) : "—"}
          </div>
          {allWheelSizes.size > 0 && (
            <div className="text-xs text-neutral-400 mt-1 truncate" title={Array.from(allWheelSizes).join(", ")}>
              {Array.from(allWheelSizes).slice(0, 3).join(", ")}
              {allWheelSizes.size > 3 && "..."}
            </div>
          )}
        </div>

        {/* OEM Tire Sizes */}
        <div className="bg-neutral-700/50 rounded-lg p-3 col-span-2 md:col-span-1">
          <div className="text-neutral-500 text-xs mb-1">OEM Tire Sizes</div>
          <div className="text-white font-bold">
            {allTireSizes.size > 0 ? (
              <span className="text-green-400">{allTireSizes.size} size{allTireSizes.size !== 1 ? "s" : ""}</span>
            ) : "—"}
          </div>
          {allTireSizes.size > 0 && (
            <div className="text-xs text-neutral-400 mt-1 truncate" title={Array.from(allTireSizes).join(", ")}>
              {Array.from(allTireSizes).slice(0, 3).join(", ")}
              {allTireSizes.size > 3 && "..."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
