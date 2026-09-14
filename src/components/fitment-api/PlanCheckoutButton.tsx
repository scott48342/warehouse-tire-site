'use client';

import { useState } from 'react';

export type CheckoutPlan = 'starter' | 'growth' | 'pro';

interface PlanCheckoutButtonProps {
  plan: CheckoutPlan;
  label: string;
  highlighted?: boolean;
  className?: string;
}

/**
 * "Start now" button for a Fitment API pricing tier.
 * POSTs to /api/fitment-api/checkout and redirects to Stripe Checkout.
 */
export function PlanCheckoutButton({ plan, label, highlighted = false, className = '' }: PlanCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fitment-api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.message || data?.error || `Checkout failed (${res.status})`);
      }
      window.location.assign(data.url);
    } catch (err: any) {
      console.error('[PlanCheckoutButton] checkout error:', err);
      setError("Couldn't start checkout. Please try again or use the request form below.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        aria-busy={loading}
        className={`block w-full text-center py-3 px-6 rounded-lg font-semibold transition-all disabled:opacity-70 disabled:cursor-wait ${
          highlighted
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
        } ${className}`}
      >
        {loading ? 'Redirecting to secure checkout…' : label}
      </button>
      {error && (
        <p className={`mt-3 text-sm ${highlighted ? 'text-blue-100' : 'text-red-400'}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
