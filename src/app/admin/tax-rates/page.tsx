"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type StateTaxRate = {
  stateCode: string;
  stateName: string;
  taxRate: number;
};

export default function TaxRatesAdminPage() {
  const [rates, setRates] = useState<StateTaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editedRates, setEditedRates] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRates();
  }, []);

  async function fetchRates() {
    try {
      setLoading(true);
      const res = await fetch("/api/tax");
      const data = await res.json();
      if (data.ok && Array.isArray(data.rates)) {
        setRates(data.rates);
        // Initialize edit state
        const initial: Record<string, string> = {};
        for (const r of data.rates) {
          initial[r.stateCode] = (r.taxRate * 100).toFixed(3);
        }
        setEditedRates(initial);
      } else {
        setError(data.error || "Failed to load rates");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load rates");
    } finally {
      setLoading(false);
    }
  }

  function handleRateChange(stateCode: string, value: string) {
    setEditedRates((prev) => ({ ...prev, [stateCode]: value }));
    setSuccess(null);
  }

  async function saveAll() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updates: Array<{ stateCode: string; taxRate: number }> = [];
      for (const [stateCode, pctStr] of Object.entries(editedRates)) {
        const pct = parseFloat(pctStr);
        if (!Number.isFinite(pct)) continue;
        const original = rates.find((r) => r.stateCode === stateCode);
        const originalPct = original ? original.taxRate * 100 : 0;
        // Only update if changed
        if (Math.abs(pct - originalPct) > 0.0001) {
          updates.push({ stateCode, taxRate: pct / 100 });
        }
      }

      if (updates.length === 0) {
        setSuccess("No changes to save");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates: updates }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccess(`Updated ${updates.length} state(s)`);
        await fetchRates();
      } else {
        setError(data.error || "Failed to save");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="bg-neutral-50 min-h-screen p-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-neutral-600">Loading tax rates...</div>
        </div>
      </main>
    );
  }

  // Group states by region for easier scanning
  const noTaxStates = rates.filter((r) => r.taxRate === 0);
  const taxStates = rates.filter((r) => r.taxRate > 0).sort((a, b) => b.taxRate - a.taxRate);

  return (
    <main className="bg-neutral-50 min-h-screen p-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <Link href="/admin" className="text-sm text-neutral-600 hover:underline">
              ← Back to Admin
            </Link>
            <h1 className="text-2xl font-extrabold text-neutral-900 mt-1">State Tax Rates</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Set sales tax rates for each state. Rates are applied at checkout based on shipping address.
            </p>
          </div>
          <button
            onClick={saveAll}
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save All Changes"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-900 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-xl border border-green-200 bg-green-50 text-green-900 text-sm">
            {success}
          </div>
        )}

        {/* No-tax states */}
        {noTaxStates.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl border border-neutral-200 bg-white">
            <h2 className="text-sm font-bold text-neutral-700 mb-3">
              States with No Sales Tax ({noTaxStates.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {noTaxStates.map((r) => (
                <span
                  key={r.stateCode}
                  className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold"
                >
                  {r.stateCode}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tax rate grid */}
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-neutral-200">
            {taxStates.map((r) => (
              <div key={r.stateCode} className="bg-white p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-neutral-900">{r.stateCode}</span>
                  <span className="text-[10px] text-neutral-500 truncate">{r.stateName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="25"
                    value={editedRates[r.stateCode] || "0"}
                    onChange={(e) => handleRateChange(r.stateCode, e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-neutral-200 text-sm font-mono text-right focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <span className="text-xs text-neutral-500">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* No-tax states editor (collapsed by default) */}
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-bold text-neutral-700 hover:text-neutral-900">
            Edit No-Tax States ({noTaxStates.length})
          </summary>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {noTaxStates.map((r) => (
              <div key={r.stateCode} className="bg-white rounded-xl border border-neutral-200 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-neutral-900">{r.stateCode}</span>
                  <span className="text-[10px] text-neutral-500">{r.stateName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="25"
                    value={editedRates[r.stateCode] || "0"}
                    onChange={(e) => handleRateChange(r.stateCode, e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-neutral-200 text-sm font-mono text-right focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <span className="text-xs text-neutral-500">%</span>
                </div>
              </div>
            ))}
          </div>
        </details>

        <div className="mt-6 text-xs text-neutral-500">
          <p>
            <strong>Note:</strong> These are base state rates. Some states have additional local taxes
            that vary by city/county. Consider setting rates slightly higher to account for this,
            or use a tax service like Stripe Tax for automatic calculation.
          </p>
        </div>
      </div>
    </main>
  );
}
