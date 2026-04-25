"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "received" | "processing" | "parts_ordered" | "ready_for_install" | "shipped" | "delivered" | "completed" | "cancelled";

const STATUS_OPTIONS: { value: Status; label: string; color: string; icon: string }[] = [
  { value: "received", label: "Received", color: "bg-green-600", icon: "📥" },
  { value: "processing", label: "Processing", color: "bg-blue-600", icon: "⚙️" },
  { value: "parts_ordered", label: "Parts Ordered", color: "bg-yellow-600", icon: "📦" },
  { value: "ready_for_install", label: "Ready for Install", color: "bg-purple-600", icon: "🔧" },
  { value: "shipped", label: "Shipped", color: "bg-indigo-600", icon: "🚚" },
  { value: "delivered", label: "Delivered", color: "bg-neutral-600", icon: "✅" },
  { value: "completed", label: "Completed", color: "bg-emerald-600", icon: "🎉" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-600", icon: "❌" },
];

export function OrderStatusUpdater({ 
  orderId, 
  currentStatus 
}: { 
  orderId: string; 
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(currentStatus as Status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleStatusChange = async (newStatus: Status) => {
    if (newStatus === status) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }
      
      setStatus(newStatus);
      setSuccess(true);
      router.refresh();
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const currentConfig = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">Current Status:</span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${currentConfig.color} text-white`}>
          {currentConfig.icon} {currentConfig.label}
        </span>
      </div>

      <div className="border-t border-neutral-700 pt-4">
        <div className="text-xs text-neutral-500 uppercase tracking-wide mb-3">Update Status</div>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              disabled={loading || option.value === status}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-all
                flex items-center justify-center gap-1.5
                ${option.value === status 
                  ? `${option.color} text-white ring-2 ring-white/30` 
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600 hover:text-white"
                }
                ${loading ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-sm text-blue-400 flex items-center gap-2">
          <span className="animate-spin">⏳</span> Updating...
        </div>
      )}

      {success && (
        <div className="text-sm text-green-400 flex items-center gap-2">
          ✅ Status updated successfully!
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 flex items-center gap-2">
          ❌ {error}
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-t border-neutral-700 pt-4">
        <div className="text-xs text-neutral-500 uppercase tracking-wide mb-3">Quick Actions</div>
        <div className="space-y-2">
          <button
            onClick={() => handleStatusChange("completed")}
            disabled={loading || status === "completed"}
            className="w-full px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            🎉 Mark as Complete
          </button>
          <button
            onClick={() => handleStatusChange("cancelled")}
            disabled={loading || status === "cancelled"}
            className="w-full px-4 py-2 rounded-lg bg-neutral-700 hover:bg-red-600 text-neutral-300 hover:text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            ❌ Cancel Order
          </button>
        </div>
      </div>
    </div>
  );
}
