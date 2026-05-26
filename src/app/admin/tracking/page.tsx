"use client";

import { useState } from "react";

export default function TrackingAdminPage() {
  const [orderId, setOrderId] = useState("");
  const [orderData, setOrderData] = useState<any>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const lookupOrder = async () => {
    if (!orderId.trim()) return;
    
    setLoading(true);
    setError("");
    setSuccess("");
    setOrderData(null);

    try {
      const res = await fetch(`/api/admin/tracking?orderId=${encodeURIComponent(orderId.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to lookup order");
        return;
      }

      setOrderData(data);
      
      // Pre-fill tracking if exists
      if (data.supplierOrder?.trackingNumbers?.length > 0) {
        setTrackingInput(data.supplierOrder.trackingNumbers.join("\n"));
      }
    } catch (err) {
      setError("Failed to lookup order");
    } finally {
      setLoading(false);
    }
  };

  const updateTracking = async () => {
    if (!orderId.trim() || !trackingInput.trim()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    // Parse tracking numbers (one per line or comma-separated)
    const trackingNumbers = trackingInput
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (trackingNumbers.length === 0) {
      setError("Please enter at least one tracking number");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId.trim(),
          trackingNumbers,
          sendEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update tracking");
        return;
      }

      setSuccess(
        `✅ Updated ${data.trackingNumbers.length} tracking number(s)` +
          (data.emailSent ? " — Email sent to customer!" : data.emailError ? ` — Email failed: ${data.emailError}` : "")
      );

      // Refresh order data
      lookupOrder();
    } catch (err) {
      setError("Failed to update tracking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">📦 Tracking Management</h1>

      {/* Order Lookup */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Order ID
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="WTD-XXXXX"
            className="flex-1 border rounded-lg px-3 py-2"
            onKeyDown={(e) => e.key === "Enter" && lookupOrder()}
          />
          <button
            onClick={lookupOrder}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "..." : "Lookup"}
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* Order Info */}
      {orderData && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold mb-3">Order Details</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500">Order ID:</div>
            <div className="font-mono">{orderData.order.id}</div>
            
            <div className="text-gray-500">Customer:</div>
            <div>{orderData.order.customerName}</div>
            
            <div className="text-gray-500">Email:</div>
            <div>{orderData.order.customerEmail}</div>
            
            <div className="text-gray-500">Order Status:</div>
            <div>
              <span className={`px-2 py-1 rounded text-xs ${
                orderData.order.status === "delivered" ? "bg-green-100 text-green-800" :
                orderData.order.status === "shipped" ? "bg-blue-100 text-blue-800" :
                "bg-yellow-100 text-yellow-800"
              }`}>
                {orderData.order.status}
              </span>
            </div>
          </div>

          {orderData.supplierOrder && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold mb-2">Supplier Order</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">Supplier:</div>
                <div>{orderData.supplierOrder.supplier}</div>
                
                <div className="text-gray-500">Order #:</div>
                <div className="font-mono">{orderData.supplierOrder.supplierOrderNumber}</div>
                
                <div className="text-gray-500">Status:</div>
                <div>{orderData.supplierOrder.status}</div>
                
                <div className="text-gray-500">Current Tracking:</div>
                <div>
                  {orderData.supplierOrder.trackingNumbers?.length > 0 ? (
                    <ul className="font-mono text-xs">
                      {orderData.supplierOrder.trackingNumbers.map((t: string) => (
                        <li key={t}>
                          <a
                            href={`https://www.fedex.com/fedextrack/?trknbr=${t}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {t}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tracking Update Form */}
      {orderData && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Update Tracking</h2>
          
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tracking Numbers (one per line)
          </label>
          <textarea
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="381479221397&#10;381479221401&#10;381479221412"
            rows={5}
            className="w-full border rounded-lg px-3 py-2 font-mono text-sm mb-4"
          />

          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="sendEmail"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="sendEmail" className="text-sm text-gray-700">
              Send tracking email to customer
            </label>
          </div>

          <button
            onClick={updateTracking}
            disabled={loading || !trackingInput.trim()}
            className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {loading ? "Updating..." : "💾 Save Tracking Numbers"}
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 text-sm text-gray-500">
        <p className="font-medium mb-2">How to use:</p>
        <ol className="list-decimal ml-5 space-y-1">
          <li>Enter the order ID (e.g., WTD-T5JT8F)</li>
          <li>Copy tracking numbers from USAF email</li>
          <li>Paste them into the tracking field (one per line)</li>
          <li>Click Save to update the order and notify the customer</li>
        </ol>
      </div>
    </div>
  );
}
