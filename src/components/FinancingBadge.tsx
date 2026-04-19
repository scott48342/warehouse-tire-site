"use client";

interface FinancingBadgeProps {
  price: number;
  className?: string;
  variant?: "inline" | "block" | "compact";
}

/**
 * Shows "As low as $X/mo with Affirm" messaging for products
 * Affirm supports purchases from $50 to $30,000
 * Shows estimated payment based on Affirm's "Pay in 4" (4 bi-weekly payments)
 * 
 * Variants:
 * - inline: Standard text link (default)
 * - block: Full card with benefits
 * - compact: Minimal for product cards (smaller font, single line)
 */
export function FinancingBadge({ price, className = "", variant = "inline" }: FinancingBadgeProps) {
  // Affirm minimum is $50, max is $30,000
  if (price < 50 || price > 30000) {
    return null;
  }

  // Affirm "Pay in 4" = 4 bi-weekly payments at 0% APR
  const monthlyPayment = Math.ceil(price / 4);

  if (variant === "block") {
    return (
      <div className={`rounded-lg border border-blue-200 bg-blue-50 p-3 ${className}`}>
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-blue-900">
              As low as ${monthlyPayment}/mo with Affirm
            </p>
            <p className="text-xs text-blue-700">
              0% APR available · No hidden fees · Pay over time
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant for product cards - visible but not overwhelming
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1.5 mt-1 ${className}`}>
        <img 
          src="https://cdn.affirm.com/brand/buttons/checkout/affirm-logo.svg" 
          alt="Affirm" 
          className="h-4"
        />
        <span className="text-xs text-neutral-600">
          as low as <span className="font-bold text-blue-700">${monthlyPayment}/mo</span>
        </span>
      </div>
    );
  }

  return (
    <p className={`text-sm text-blue-600 ${className}`}>
      <span className="font-medium">As low as ${monthlyPayment}/mo</span>
      <span className="text-blue-500"> with Affirm</span>
    </p>
  );
}

/**
 * Shows payment method badges (Affirm, Afterpay, Apple Pay, etc.)
 */
export function PaymentMethodBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs text-neutral-500">Pay with:</span>
      <div className="flex items-center gap-1.5">
        {/* Apple Pay */}
        <div className="flex h-6 items-center rounded bg-black px-2">
          <span className="text-xs font-medium text-white">Pay</span>
        </div>
        {/* Google Pay */}
        <div className="flex h-6 items-center rounded bg-white border border-neutral-200 px-2">
          <span className="text-xs font-medium text-neutral-700">G Pay</span>
        </div>
        {/* Affirm */}
        <div className="flex h-6 items-center rounded bg-blue-600 px-2">
          <span className="text-xs font-bold text-white">affirm</span>
        </div>
        {/* Afterpay */}
        <div className="flex h-6 items-center rounded bg-[#b2fce4] px-2">
          <span className="text-xs font-bold text-black">afterpay</span>
        </div>
      </div>
    </div>
  );
}
