/**
 * Fitment Audit Admin Page
 * 
 * Simple page with buttons to download fitment exports and audit reports.
 */

"use client";

import { useState } from "react";

export default function FitmentAuditPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ type: string; rows?: number; time?: number; error?: string } | null>(null);

  const handleDownload = async (endpoint: string, filename: string) => {
    setDownloading(endpoint);
    setLastResult(null);
    
    try {
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const error = await response.json();
        setLastResult({ type: "error", error: error.message || "Download failed" });
        return;
      }
      
      // Get stats from headers
      const totalRows = response.headers.get("X-Total-Rows") || response.headers.get("X-Total-YMM");
      const queryTime = response.headers.get("X-Query-Time-Ms");
      const suspiciousCount = response.headers.get("X-Suspicious-Count");
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setLastResult({
        type: "success",
        rows: totalRows ? parseInt(totalRows) : undefined,
        time: queryTime ? parseInt(queryTime) : undefined,
      });
      
    } catch (err: any) {
      setLastResult({ type: "error", error: err?.message || "Download failed" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Fitment Audit</h1>
        <p className="text-neutral-600 mb-8">
          Export fitment data and audit reports for debugging and validation.
        </p>

        <div className="space-y-4">
          {/* Full Export */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Full Fitment Export</h2>
            <p className="text-sm text-neutral-600 mb-4">
              Download complete fitment data as CSV. Includes all fields: year, make, model, trim, 
              bolt pattern, center bore, wheel sizes, tire sizes, etc.
            </p>
            <button
              onClick={() => handleDownload("/api/admin/export-fitments", `fitment-export-${new Date().toISOString().slice(0, 10)}.csv`)}
              disabled={downloading !== null}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading === "/api/admin/export-fitments" ? "Downloading..." : "Download Full Export"}
            </button>
          </div>

          {/* Audit Report */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Trim Coverage Audit</h2>
            <p className="text-sm text-neutral-600 mb-4">
              Download audit report showing trim counts per Year/Make/Model. Sorted by trim count 
              (lowest first) to surface problems. Flags suspicious vehicles with zero or low trims.
            </p>
            <button
              onClick={() => handleDownload("/api/admin/export-fitment-audit", `fitment-audit-${new Date().toISOString().slice(0, 10)}.csv`)}
              disabled={downloading !== null}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading === "/api/admin/export-fitment-audit" ? "Downloading..." : "Download Audit Report"}
            </button>
          </div>
        </div>

        {/* Result Display */}
        {lastResult && (
          <div className={`mt-6 rounded-lg p-4 ${lastResult.type === "error" ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
            {lastResult.type === "error" ? (
              <p className="text-sm text-red-700">❌ Error: {lastResult.error}</p>
            ) : (
              <div className="text-sm text-green-700">
                <p>✅ Download complete!</p>
                {lastResult.rows !== undefined && (
                  <p className="mt-1">Rows exported: <strong>{lastResult.rows.toLocaleString()}</strong></p>
                )}
                {lastResult.time !== undefined && (
                  <p>Query time: <strong>{lastResult.time}ms</strong></p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-neutral-900 mb-2">Understanding the Audit Report</h3>
          <div className="text-sm text-neutral-600 space-y-2">
            <p><strong>is_suspicious = TRUE</strong> when:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>trim_count = 0 (no trims at all)</li>
              <li>trim_count = 1 for trucks/SUVs (should have 2WD/4WD variants)</li>
              <li>has_empty_trim = TRUE (null or empty trim names)</li>
            </ul>
            <p className="mt-3"><strong>suspicion_reason</strong> values:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><code>ZERO_TRIMS</code> - Critical: no trims exist</li>
              <li><code>LOW_TRIM_COUNT</code> - Warning: truck/SUV with only 1 trim</li>
              <li><code>EMPTY_TRIM_NAME</code> - Data quality issue</li>
            </ul>
          </div>
        </div>

        {/* API Endpoints Reference */}
        <div className="mt-4 text-xs text-neutral-500">
          <p>API Endpoints:</p>
          <ul className="list-disc list-inside ml-2">
            <li><code>/api/admin/export-fitments</code> - Full export</li>
            <li><code>/api/admin/export-fitment-audit</code> - Audit report</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
