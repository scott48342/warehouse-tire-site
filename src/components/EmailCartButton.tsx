"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import { getCartId } from "@/lib/cart/useCartTracking";

interface EmailCartButtonProps {
  /** Button variant */
  variant?: "inline" | "full";
  /** Custom class name */
  className?: string;
}

export function EmailCartButton({ variant = "inline", className = "" }: EmailCartButtonProps) {
  const { items } = useCart();
  const [isExpanded, setIsExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract vehicle from cart
  const vehicle = items.find(i => i.type === "wheel" || i.type === "tire")?.vehicle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "cart_save",
          vehicle: vehicle ? {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim,
          } : undefined,
          cartId: getCartId(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSubmitted(true);
      // Reset after delay
      setTimeout(() => {
        setSubmitted(false);
        setIsExpanded(false);
        setEmail("");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) return null;

  // Submitted state
  if (submitted) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-600 ${className}`}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-medium">Cart saved to {email}</span>
      </div>
    );
  }

  // Expanded form
  if (isExpanded) {
    return (
      <form onSubmit={handleSubmit} className={`flex flex-col gap-2 ${className}`}>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            autoFocus
            className="flex-1 min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {isSubmitting ? "..." : "Send"}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="rounded-lg border border-neutral-300 px-2 py-2 text-neutral-500 hover:bg-neutral-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    );
  }

  // Collapsed button
  if (variant === "full") {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 ${className}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Email me this cart
      </button>
    );
  }

  return (
    <button
      onClick={() => setIsExpanded(true)}
      className={`flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 ${className}`}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <span className="underline">Email me this cart</span>
    </button>
  );
}

export default EmailCartButton;
