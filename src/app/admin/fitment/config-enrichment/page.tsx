"use client";

/**
 * Config-Table Enrichment Admin Page
 * 
 * Compare existing config-table tire sizes with USAF enrichment candidates.
 * Safely promote candidates to config table without bypassing priority.
 */

import { useState } from "react";

interface ConfigTireSize {
  tireSize: string;
  wheelDiameter: number;
  axlePosition: "front" | "rear" | "square";
  source: "config" | "legacy" | "usaf";
}

interface EnrichmentCandidate {
  tireSize: string;
  wheelDiameter: number;
  source: "legacy" | "usaf";
  confidence: number;
  reasons: string[];
  autoRejectReason: string | null;
}

interface ConfigEnrichmentAnalysis {
  vehicle: {
    year: number;
    make: string;
    model: string;
    displayTrim: string | null;
  };
  configTableStatus: "has_data" | "no_data";
  existingConfigSizes: ConfigTireSize[];
  legacySizes: string[];
  usafSizes: string[];
  missingInConfig: EnrichmentCandidate[];
  duplicateEquivalents: string[];
  possibleStaggeredGaps: string[];
  conflictingDiameters: string[];
  overallConfidence: number;
  recommendedAction: "auto_approve" | "review_required" | "auto_reject";
  actionReason: string;
  dryRunPreview: {
    currentChooserBehavior: string;
    proposedChooserBehavior: string;
    regressionRisk: "none" | "low" | "medium" | "high";
    regressionDetails: string[];
  };
}

// Sample vehicles with config table data that need enrichment
const SAMPLE_VEHICLES = [
  { year: 2024, make: "Toyota", model: "Tacoma" },
  { year: 2024, make: "Chevrolet", model: "tahoe" },
  { year: 2024, make: "GMC", model: "Sierra 1500" },
  { year: 2025, make: "Ford", model: "bronco" },
  { year: 2026, make: "Toyota", model: "4runner" },
];

export default function ConfigEnrichmentPage() {
  const [year, setYear] = useState("2024");
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("Tacoma");
  const [trim, setTrim] = useState("");
  const [analysis, setAnalysis] = useState<ConfigEnrichmentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const analyzeVehicle = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setDryRunResult(null);
    setSelectedCandidates(new Set());

    try {
      const params = new URLSearchParams({ year, make, model });
      if (trim) params.set("trim", trim);

      const res = await fetch(`/api/admin/fitment/config-enrichment?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }

      const data: ConfigEnrichmentAnalysis = await res.json();
      setAnalysis(data);

      // Auto-select high-confidence candidates
      const autoSelected = new Set(
        data.missingInConfig
          .filter((c) => c.confidence >= 70 && !c.autoRejectReason)
          .map((c) => c.tireSize)
      );
      setSelectedCandidates(autoSelected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runDryRun = async () => {
    if (!analysis || selectedCandidates.size === 0) return;

    setLoading(true);
    setError(null);
    setDryRunResult(null);

    try {
      const res = await fetch("/api/admin/fitment/config-enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: parseInt(year, 10),
          make,
          model,
          trim: trim || undefined,
          candidates: Array.from(selectedCandidates),
          dryRun: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Dry run failed");
      }

      setDryRunResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const toggleCandidate = (tireSize: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(tireSize)) {
        next.delete(tireSize);
      } else {
        next.add(tireSize);
      }
      return next;
    });
    setDryRunResult(null); // Clear dry run when selection changes
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600";
    if (confidence >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "none":
        return "text-green-600 bg-green-50";
      case "low":
        return "text-blue-600 bg-blue-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "high":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Config-Table Enrichment
        </h1>
        <p className="text-gray-600 mb-8">
          Compare config-table tire sizes with USAF data. Safely promote
          candidates to strengthen the config architecture.
        </p>

        {/* Vehicle Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Select Vehicle</h2>

          {/* Quick Select */}
          <div className="mb-4">
            <label className="block text-sm text-gray-500 mb-2">
              Quick Select:
            </label>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_VEHICLES.map((v) => (
                <button
                  key={`${v.year}-${v.make}-${v.model}`}
                  onClick={() => {
                    setYear(String(v.year));
                    setMake(v.make);
                    setModel(v.model);
                    setTrim("");
                  }}
                  className={`px-3 py-1 rounded text-sm ${
                    year === String(v.year) &&
                    make === v.make &&
                    model === v.model
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {v.year} {v.make} {v.model}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Entry */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trim (optional)
              </label>
              <input
                type="text"
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., SR5"
              />
            </div>
          </div>

          <button
            onClick={analyzeVehicle}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze Vehicle"}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <>
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {analysis.vehicle.year} {analysis.vehicle.make}{" "}
                    {analysis.vehicle.model}
                    {analysis.vehicle.displayTrim &&
                      ` - ${analysis.vehicle.displayTrim}`}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Config Table:{" "}
                    <span
                      className={
                        analysis.configTableStatus === "has_data"
                          ? "text-green-600"
                          : "text-yellow-600"
                      }
                    >
                      {analysis.configTableStatus === "has_data"
                        ? "Has Data"
                        : "No Data"}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className={`text-2xl font-bold ${getConfidenceColor(
                      analysis.overallConfidence
                    )}`}
                  >
                    {analysis.overallConfidence}%
                  </div>
                  <div className="text-sm text-gray-500">Overall Confidence</div>
                </div>
              </div>

              <div
                className={`p-3 rounded ${
                  analysis.recommendedAction === "auto_approve"
                    ? "bg-green-50 text-green-800"
                    : analysis.recommendedAction === "auto_reject"
                    ? "bg-red-50 text-red-800"
                    : "bg-yellow-50 text-yellow-800"
                }`}
              >
                <span className="font-medium">
                  {analysis.recommendedAction === "auto_approve"
                    ? "✅ Auto-Approve"
                    : analysis.recommendedAction === "auto_reject"
                    ? "❌ Auto-Reject"
                    : "⚠️ Review Required"}
                </span>
                : {analysis.actionReason}
              </div>
            </div>

            {/* Current vs Proposed */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Existing Config Sizes */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Existing Config Sizes
                </h3>
                {analysis.existingConfigSizes.length === 0 ? (
                  <p className="text-gray-500 italic">No config table data</p>
                ) : (
                  <div className="space-y-2">
                    {analysis.existingConfigSizes.map((size, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded"
                      >
                        <span className="font-mono">{size.tireSize}</span>
                        <span className="text-sm text-gray-500">
                          {size.wheelDiameter}" • {size.axlePosition}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Legacy/USAF Sizes */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Legacy/USAF Sizes</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Legacy DB ({analysis.legacySizes.length})
                    </h4>
                    <div className="space-y-1">
                      {analysis.legacySizes.map((size, i) => (
                        <div
                          key={i}
                          className="text-sm font-mono text-gray-700"
                        >
                          {size}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      USAF Data ({analysis.usafSizes.length})
                    </h4>
                    <div className="space-y-1">
                      {analysis.usafSizes.map((size, i) => (
                        <div
                          key={i}
                          className="text-sm font-mono text-gray-700"
                        >
                          {size}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enrichment Candidates */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">
                Enrichment Candidates ({analysis.missingInConfig.length})
              </h3>

              {analysis.missingInConfig.length === 0 ? (
                <p className="text-green-600">
                  ✅ Config table is complete - no missing sizes
                </p>
              ) : (
                <div className="space-y-3">
                  {analysis.missingInConfig.map((candidate) => (
                    <div
                      key={candidate.tireSize}
                      className={`p-4 rounded border ${
                        candidate.autoRejectReason
                          ? "bg-red-50 border-red-200"
                          : selectedCandidates.has(candidate.tireSize)
                          ? "bg-blue-50 border-blue-300"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {!candidate.autoRejectReason && (
                            <input
                              type="checkbox"
                              checked={selectedCandidates.has(
                                candidate.tireSize
                              )}
                              onChange={() =>
                                toggleCandidate(candidate.tireSize)
                              }
                              className="h-5 w-5"
                            />
                          )}
                          <div>
                            <span className="font-mono text-lg">
                              {candidate.tireSize}
                            </span>
                            <span className="ml-2 text-sm text-gray-500">
                              {candidate.wheelDiameter}" •{" "}
                              {candidate.source.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`font-bold ${getConfidenceColor(
                            candidate.confidence
                          )}`}
                        >
                          {candidate.confidence}%
                        </div>
                      </div>

                      {candidate.autoRejectReason ? (
                        <div className="mt-2 text-sm text-red-700">
                          ❌ Auto-rejected: {candidate.autoRejectReason}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-gray-600">
                          {candidate.reasons.join(" • ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Issues Detected */}
            {(analysis.duplicateEquivalents.length > 0 ||
              analysis.possibleStaggeredGaps.length > 0 ||
              analysis.conflictingDiameters.length > 0) && (
              <div className="bg-yellow-50 rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-4">
                  ⚠️ Issues Detected
                </h3>
                {analysis.duplicateEquivalents.length > 0 && (
                  <div className="mb-3">
                    <h4 className="font-medium text-yellow-700">
                      Duplicate Equivalents:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-yellow-700">
                      {analysis.duplicateEquivalents.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.possibleStaggeredGaps.length > 0 && (
                  <div className="mb-3">
                    <h4 className="font-medium text-yellow-700">
                      Possible Staggered Gaps:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-yellow-700">
                      {analysis.possibleStaggeredGaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.conflictingDiameters.length > 0 && (
                  <div>
                    <h4 className="font-medium text-yellow-700">
                      Conflicting Diameters:
                    </h4>
                    <ul className="list-disc list-inside text-sm text-yellow-700">
                      {analysis.conflictingDiameters.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Dry Run Preview */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">
                Chooser Behavior Preview
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">
                    Current Behavior
                  </h4>
                  <div className="p-3 bg-gray-50 rounded font-mono text-sm">
                    {analysis.dryRunPreview.currentChooserBehavior}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">
                    After Enrichment
                  </h4>
                  <div className="p-3 bg-blue-50 rounded font-mono text-sm">
                    {analysis.dryRunPreview.proposedChooserBehavior}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <span
                  className={`inline-block px-3 py-1 rounded text-sm font-medium ${getRiskColor(
                    analysis.dryRunPreview.regressionRisk
                  )}`}
                >
                  Regression Risk: {analysis.dryRunPreview.regressionRisk.toUpperCase()}
                </span>
                <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                  {analysis.dryRunPreview.regressionDetails.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actions */}
            {selectedCandidates.size > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Promote to Config ({selectedCandidates.size} selected)
                </h3>

                <div className="flex gap-4">
                  <button
                    onClick={runDryRun}
                    disabled={loading}
                    className="bg-yellow-500 text-white px-6 py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
                  >
                    {loading ? "Running..." : "Dry Run Preview"}
                  </button>
                  <button
                    disabled
                    className="bg-gray-300 text-gray-500 px-6 py-2 rounded cursor-not-allowed"
                    title="Apply requires admin approval workflow"
                  >
                    Apply (Coming Soon)
                  </button>
                </div>

                {dryRunResult && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      Dry Run Result
                    </h4>
                    <p className="text-yellow-700 mb-2">
                      {dryRunResult.message}
                    </p>
                    {dryRunResult.configsToCreate && (
                      <div className="text-sm">
                        <p className="font-medium">Would create:</p>
                        <ul className="list-disc list-inside">
                          {dryRunResult.configsToCreate.map((c: any, i: number) => (
                            <li key={i}>
                              {c.tireSize} ({c.wheelDiameter}") -{" "}
                              {c.sourceConfidence} confidence
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
