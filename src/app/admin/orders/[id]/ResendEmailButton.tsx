"use client";

import { useState } from "react";

export function ResendEmailButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleResend = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend_email" }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult({ success: true, message: data.message || "Email sent!" });
      } else {
        setResult({ success: false, message: data.error || "Failed to send" });
      }
    } catch (err) {
      setResult({ success: false, message: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleResend}
        disabled={loading}
        className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span> Sending...
          </>
        ) : (
          <>📧 Resend Confirmation Email</>
        )}
      </button>
      
      {result && (
        <div className={`text-sm p-2 rounded ${result.success ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"}`}>
          {result.success ? "✅" : "❌"} {result.message}
        </div>
      )}
    </div>
  );
}
