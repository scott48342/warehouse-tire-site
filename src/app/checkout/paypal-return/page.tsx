"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

/**
 * PayPal Return Page
 * 
 * PayPal redirects here after user approves payment.
 * We capture the order and then show success or redirect.
 */
export default function PayPalReturnPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token"); // PayPal order ID
    const payerId = searchParams.get("PayerID");

    if (!token) {
      setStatus("error");
      setErrorMessage("No PayPal order token found. Please try again.");
      return;
    }

    // Capture the order
    async function captureOrder() {
      try {
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: token }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setStatus("error");
          setErrorMessage(data.error || "Failed to complete payment");
          return;
        }

        setOrderId(data.orderId);
        setStatus("success");
        
        // Clear cart (will be done by CartContext on success page)
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err.message || "Something went wrong");
      }
    }

    captureOrder();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <main className="bg-neutral-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-neutral-700 font-medium">Completing your PayPal payment...</p>
          <p className="mt-1 text-sm text-neutral-500">Please don&apos;t close this page</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="bg-neutral-50 min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white text-2xl">
                ✗
              </div>
              <div>
                <div className="text-sm font-semibold text-red-700">{BRAND.name}</div>
                <h1 className="text-2xl font-extrabold text-neutral-900">Payment Failed</h1>
              </div>
            </div>
            <p className="mt-3 text-neutral-700">
              {errorMessage || "We couldn't complete your PayPal payment. Please try again."}
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/checkout"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
              >
                Try Again
              </Link>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-900"
              >
                Back to Shop
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Success!
  return (
    <main className="bg-neutral-50 min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white text-2xl">
              ✓
            </div>
            <div>
              <div className="text-sm font-semibold text-green-700">{BRAND.name}</div>
              <h1 className="text-2xl font-extrabold text-neutral-900">Payment Successful!</h1>
            </div>
          </div>
          <p className="mt-3 text-neutral-700">
            Your PayPal payment has been completed. Thank you for your order!
          </p>
          {orderId && (
            <p className="mt-1 text-sm text-neutral-600">
              PayPal Order ID: <span className="font-mono font-bold">{orderId}</span>
            </p>
          )}
          <p className="mt-2 text-sm text-neutral-600">
            Check your email for order confirmation details.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
