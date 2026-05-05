"use client";

/**
 * OEM Packages Admin - Client Component
 * 
 * Handles approve/reject actions and filtering.
 */

import { useState, useCallback } from "react";
import type { OemPackageChoice } from "@/lib/fitment/oemPackageChoices";

interface OemPackagesClientProps {
  initialChoices: OemPackageChoice[];
  grouped: Record<string, OemPackageChoice[]>;
}

export function OemPackagesClient({ initialChoices, grouped }: OemPackagesClientProps) {
  const [choices, setChoices] = useState(initialChoices);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredChoices = filter === "all" 
    ? choices 
    : choices.filter(c => c.status === filter);

  // Group filtered choices
  const filteredGrouped: Record<string, OemPackageChoice[]> = {};
  for (const choice of filteredChoices) {
    const key = `${choice.year} ${choice.make} ${choice.model} ${choice.trim}`;
    if (!filteredGrouped[key]) filteredGrouped[key] = [];
    filteredGrouped[key].push(choice);
  }

  const handleAction = useCallback(async (id: string, action: "approve" | "reject") => {
    setLoading(id);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/oem-package-choices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reviewedBy: "admin" }),
      });

      const data = await res.json();

      if (data.success) {
        // Update local state
        setChoices(prev => prev.map(c => 
          c.id === id 
            ? { ...c, status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date() }
            : c
        ));
        setMessage({ type: "success", text: `Package choice ${action}d` });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error" });
    }

    setLoading(null);
  }, []);

  const handleApproveAll = useCallback(async (vehicleKey: string) => {
    const vehicleChoices = filteredGrouped[vehicleKey]?.filter(c => c.status === "pending") || [];
    if (vehicleChoices.length === 0) return;

    setLoading(vehicleKey);
    setMessage(null);

    try {
      for (const choice of vehicleChoices) {
        await fetch("/api/admin/oem-package-choices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: choice.id, action: "approve", reviewedBy: "admin" }),
        });
      }

      // Update local state
      setChoices(prev => prev.map(c => 
        vehicleChoices.some(vc => vc.id === c.id)
          ? { ...c, status: "approved" as const, reviewedAt: new Date() }
          : c
      ));
      setMessage({ type: "success", text: `Approved all ${vehicleChoices.length} choices for ${vehicleKey}` });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to approve all" });
    }

    setLoading(null);
  }, [filteredGrouped]);

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-white border text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <span className="ml-1 text-xs opacity-70">
                ({choices.filter(c => c.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* Grouped choices */}
      <div className="space-y-6">
        {Object.entries(filteredGrouped).map(([vehicleKey, vehicleChoices]) => {
          const hasPending = vehicleChoices.some(c => c.status === "pending");
          
          return (
            <div key={vehicleKey} className="bg-white rounded-xl border overflow-hidden">
              {/* Vehicle header */}
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b">
                <div>
                  <h3 className="font-semibold text-neutral-900">{vehicleKey}</h3>
                  <p className="text-xs text-neutral-500">{vehicleChoices.length} package option(s)</p>
                </div>
                {hasPending && (
                  <button
                    onClick={() => handleApproveAll(vehicleKey)}
                    disabled={loading === vehicleKey}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading === vehicleKey ? "..." : "Approve All"}
                  </button>
                )}
              </div>

              {/* Package choices */}
              <div className="divide-y">
                {vehicleChoices.map(choice => (
                  <div key={choice.id} className="flex items-center gap-4 px-4 py-3">
                    {/* Wheel size badge */}
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 font-bold text-lg">
                      {choice.wheelDiameter}&quot;
                    </div>
                    
                    {/* Label and details */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-neutral-900">{choice.packageLabel}</div>
                      <div className="text-sm text-neutral-500">
                        {choice.tireSize}
                        {choice.tireSizeRear && choice.tireSizeRear !== choice.tireSize && (
                          <span> / {choice.tireSizeRear}</span>
                        )}
                      </div>
                      {choice.notes && (
                        <div className="text-xs text-neutral-400 mt-1">{choice.notes}</div>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      choice.status === "pending" 
                        ? "bg-amber-100 text-amber-700"
                        : choice.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                    }`}>
                      {choice.status}
                    </div>

                    {/* Actions */}
                    {choice.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(choice.id, "approve")}
                          disabled={loading === choice.id}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {loading === choice.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleAction(choice.id, "reject")}
                          disabled={loading === choice.id}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredChoices.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          No package choices found for this filter.
        </div>
      )}
    </div>
  );
}
