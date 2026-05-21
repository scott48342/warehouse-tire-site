"use client";

import { useState } from "react";

type SupplierOption = {
  source: string;
  name: string;
  cost: number;
  sellPrice: number;
  quantity: number;
  autoOrder: boolean;
  partNumber: string;
};

type Props = {
  orderId: string;
  sku: string;
  currentSource: string;
  itemName: string;
  tireSize?: string;
};

export function ResourceSupplier({ orderId, sku, currentSource, itemName, tireSize }: Props) {
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchAlternatives = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resource`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch alternatives");
      }
      
      const itemOptions = data.alternatives?.[sku] || [];
      setOptions(itemOptions);
      setShowOptions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alternatives");
    } finally {
      setLoading(false);
    }
  };

  const switchSupplier = async (option: SupplierOption) => {
    if (option.source === currentSource) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resource`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          newSource: option.source,
          newPartNumber: option.partNumber,
          newCost: option.sellPrice,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to switch supplier");
      }
      
      setSuccess(`Switched to ${option.name}`);
      setShowOptions(false);
      
      // Refresh page after short delay
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch supplier");
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (n: number) => `$${(n || 0).toFixed(2)}`;

  return (
    <div className="mt-2">
      {!showOptions ? (
        <button
          onClick={fetchAlternatives}
          disabled={loading}
          className="text-xs px-2 py-1 rounded bg-neutral-600 hover:bg-neutral-500 text-neutral-200 disabled:opacity-50"
        >
          {loading ? "Loading..." : "🔄 Re-source"}
        </button>
      ) : (
        <div className="bg-neutral-800 rounded-lg p-3 mt-2 border border-neutral-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-400 font-medium">Alternative Suppliers</span>
            <button
              onClick={() => setShowOptions(false)}
              className="text-neutral-500 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
          
          {options.length === 0 ? (
            <div className="text-xs text-neutral-500">No alternatives found</div>
          ) : (
            <div className="space-y-2">
              {options.map((opt) => (
                <div
                  key={opt.source}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    opt.source === currentSource
                      ? "border-green-500 bg-green-900/20"
                      : "border-neutral-600 hover:border-neutral-500 cursor-pointer"
                  }`}
                  onClick={() => opt.source !== currentSource && switchSupplier(opt)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      opt.autoOrder ? "bg-green-600 text-white" : "bg-orange-600 text-white"
                    }`}>
                      {opt.name}
                    </span>
                    {opt.autoOrder && (
                      <span className="text-xs text-green-400">✓ Auto</span>
                    )}
                    {opt.source === currentSource && (
                      <span className="text-xs text-green-400">(current)</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">{formatMoney(opt.sellPrice)}</div>
                    <div className="text-xs text-neutral-400">{opt.quantity} in stock</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="text-xs text-red-400 mt-2">{error}</div>
      )}
      
      {success && (
        <div className="text-xs text-green-400 mt-2">{success}</div>
      )}
    </div>
  );
}
