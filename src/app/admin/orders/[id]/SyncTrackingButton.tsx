"use client";

import { useState } from "react";

export function SyncTrackingButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/sync-tracking`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: data.tracking?.length
            ? `Found tracking: ${data.tracking.join(", ")}`
            : data.delivered
            ? "Order marked as delivered!"
            : "Synced - no new tracking yet",
        });
        // Refresh the page after a short delay to show updated data
        if (data.tracking?.length || data.delivered) {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        setResult({
          success: false,
          message: data.error || "Sync failed",
        });
      }
    } catch (err) {
      setResult({
        success: false,
        message: "Network error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          loading
            ? "bg-neutral-600 text-neutral-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Syncing...
          </span>
        ) : (
          "🔄 Sync Tracking Now"
        )}
      </button>
      {result && (
        <div
          className={`mt-2 p-2 rounded text-xs ${
            result.success
              ? "bg-green-900/30 border border-green-700 text-green-300"
              : "bg-red-900/30 border border-red-700 text-red-300"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
