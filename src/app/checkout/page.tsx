"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartWheelItem, type CartTireItem, type CartAccessoryItem } from "@/lib/cart/CartContext";
import { validatePackage, verifyTotalMatch } from "@/lib/package/validation";
import { getFitmentMessaging, getFitmentColors, type FitmentClass } from "@/lib/package/fitment";
import { BRAND } from "@/lib/brand";

/**
 * Checkout Page
 * 
 * Cart is the single source of truth.
 * Validates package, shows pricing, collects shipping/payment info.
 * 
 * Edge cases handled:
 * - Empty cart
 * - Incomplete package (wheels only)
 * - Mismatched quantities
 * - Missing accessories
 */

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    getWheels,
    getTires,
    getAccessories,
    getTotal,
    hasWheels,
    hasTires,
    clearCart,
  } = useCart();

  // Validate package
  const validation = validatePackage(items);
  const cartTotal = getTotal();

  // Verify totals match (important for integrity)
  const totalCheck = verifyTotalMatch(cartTotal, validation.totals.total);
  
  useEffect(() => {
    if (!totalCheck.matches) {
      console.warn("[Checkout] Total mismatch!", {
        cart: cartTotal,
        calculated: validation.totals.total,
        diff: totalCheck.difference,
      });
    }
  }, [cartTotal, validation.totals.total, totalCheck]);

  // Get items
  const wheels = getWheels();
  const tires = getTires();
  const accessories = getAccessories();

  // Get vehicle and fitment from cart
  const vehicle = wheels[0]?.vehicle || tires[0]?.vehicle;
  const fitmentClass = wheels[0]?.fitmentClass as FitmentClass | undefined;
  const fitmentMessaging = getFitmentMessaging(fitmentClass);
  const fitmentColors = getFitmentColors(fitmentClass);

  // Form state
  const [step, setStep] = useState<"review" | "shipping" | "payment">("review");
  const [shipping, setShipping] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
  });
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<"stripe" | "paypal">("stripe");

  async function startPayPalCheckout() {
    try {
      setPaypalError(null);
      setProcessing(true);

      const customer = {
        firstName: shipping.firstName,
        lastName: shipping.lastName,
        email: shipping.email,
        phone: shipping.phone,
      };

      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items,
          customer,
          vehicle,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.approvalUrl) {
        setPaypalError(String(data?.error || data?.detail || "PayPal checkout failed"));
        setProcessing(false);
        return;
      }

      // Redirect to PayPal
      window.location.href = String(data.approvalUrl);
    } catch (e: any) {
      setPaypalError(e?.message || String(e));
      setProcessing(false);
    }
  }

  async function startStripeCheckout() {
    try {
      setStripeError(null);
      setProcessing(true);

      const customer = {
        firstName: shipping.firstName,
        lastName: shipping.lastName,
        email: shipping.email,
        phone: shipping.phone,
      };

      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items,
          customer,
          vehicle,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        setStripeError(String(data?.error || data?.detail || "Stripe checkout failed"));
        setProcessing(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = String(data.url);
    } catch (e: any) {
      setStripeError(e?.message || String(e));
      setProcessing(false);
    }
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <main className="bg-neutral-50 min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <h1 className="text-3xl font-extrabold text-neutral-900">Checkout</h1>
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-xl font-bold text-neutral-900">Your cart is empty</h2>
            <p className="mt-2 text-neutral-600">Add wheels and tires to start your package.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/wheels"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-6 text-sm font-extrabold text-white hover:bg-green-700"
              >
                Shop Wheels
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Incomplete package warning
  const isIncomplete = hasWheels() && !hasTires();

  return (
    <main className="bg-neutral-50 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-neutral-900">Checkout</h1>
          <Link href="/cart" className="text-sm text-neutral-600 hover:text-neutral-900 underline">
            Edit cart
          </Link>
        </div>

        {/* Incomplete package banner */}
        {isIncomplete && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-bold text-amber-900">Package incomplete</h3>
                <p className="text-sm text-amber-800 mt-1">
                  You have wheels but no tires. Add matching tires to complete your package.
                </p>
                <Link
                  href="/tires"
                  className="mt-2 inline-flex text-sm font-bold text-amber-700 hover:underline"
                >
                  Add tires →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Validation errors */}
        {validation.errors.length > 0 && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
            <h3 className="font-bold text-red-900">Please fix these issues:</h3>
            <ul className="mt-2 text-sm text-red-700 space-y-1">
              {validation.errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setStep("review")}
                className={`px-3 py-1 rounded-full ${
                  step === "review" ? "bg-green-100 text-green-800 font-bold" : "text-neutral-500"
                }`}
              >
                1. Review
              </button>
              <span className="text-neutral-300">→</span>
              <button
                onClick={() => setStep("shipping")}
                className={`px-3 py-1 rounded-full ${
                  step === "shipping" ? "bg-green-100 text-green-800 font-bold" : "text-neutral-500"
                }`}
              >
                2. Shipping
              </button>
              <span className="text-neutral-300">→</span>
              <span
                className={`px-3 py-1 rounded-full ${
                  step === "payment" ? "bg-green-100 text-green-800 font-bold" : "text-neutral-400"
                }`}
              >
                3. Payment
              </span>
            </div>

            {/* Step: Review */}
            {step === "review" && (
              <div className="space-y-4">
                {/* Vehicle confirmation */}
                {vehicle && (
                  <div className={`rounded-xl p-4 ${fitmentColors.bg} border ${fitmentColors.border}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-neutral-600">Fitment for</div>
                        <div className="font-bold text-neutral-900">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                          {vehicle.trim && ` ${vehicle.trim}`}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${fitmentColors.badge}`}>
                        {fitmentMessaging.icon} {fitmentMessaging.shortLabel}
                      </div>
                    </div>
                    {fitmentMessaging.checkoutNote && (
                      <p className={`mt-2 text-sm ${fitmentColors.text}`}>
                        {fitmentMessaging.checkoutNote}
                      </p>
                    )}
                  </div>
                )}

                {/* Package items */}
                <div className="rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-100">
                  {/* Wheels */}
                  {wheels.map((wheel) => (
                    <CheckoutItem key={wheel.sku} item={wheel} type="wheel" />
                  ))}

                  {/* Tires */}
                  {tires.map((tire) => (
                    <CheckoutItem key={tire.sku} item={tire} type="tire" />
                  ))}

                  {/* Accessories */}
                  {accessories.map((acc) => (
                    <CheckoutItem key={acc.sku} item={acc} type="accessory" />
                  ))}
                </div>

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
                    <ul className="text-amber-800 space-y-1">
                      {validation.warnings.map((w, i) => (
                        <li key={i}>⚠️ {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => setStep("shipping")}
                  disabled={validation.errors.length > 0}
                  className={`w-full h-12 rounded-xl font-extrabold text-white ${
                    validation.errors.length > 0
                      ? "bg-neutral-300 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  Continue to Shipping
                </button>
              </div>
            )}

            {/* Step: Shipping */}
            {step === "shipping" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <h2 className="text-lg font-bold text-neutral-900 mb-4">Shipping Information</h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="First name *"
                      value={shipping.firstName}
                      onChange={(e) => setShipping((p) => ({ ...p, firstName: e.target.value }))}
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    />
                    <input
                      type="text"
                      placeholder="Last name *"
                      value={shipping.lastName}
                      onChange={(e) => setShipping((p) => ({ ...p, lastName: e.target.value }))}
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    />
                    <input
                      type="email"
                      placeholder="Email *"
                      value={shipping.email}
                      onChange={(e) => setShipping((p) => ({ ...p, email: e.target.value }))}
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    />
                    <input
                      type="tel"
                      placeholder="Phone *"
                      value={shipping.phone}
                      onChange={(e) => setShipping((p) => ({ ...p, phone: e.target.value }))}
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    />
                    <input
                      type="text"
                      placeholder="Address *"
                      value={shipping.address}
                      onChange={(e) => setShipping((p) => ({ ...p, address: e.target.value }))}
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm sm:col-span-2 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    />
                    <input
                      type="text"
                      placeholder="Apt, suite, etc. (optional)"
                      value={shipping.address2}
                      onChange={(e) => setShipping((p) => ({ ...p, address2: e.target.value }))}
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm sm:col-span-2 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    />
                    <input
                      type="text"
                      placeholder="City *"
                      value={shipping.city}
                      onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
                      className="h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={shipping.state}
                        onChange={(e) => setShipping((p) => ({ ...p, state: e.target.value }))}
                        className="h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:border-green-500"
                      >
                        <option value="">State *</option>
                        <option value="MI">Michigan</option>
                        <option value="OH">Ohio</option>
                        <option value="IN">Indiana</option>
                        <option value="IL">Illinois</option>
                        {/* Add more states */}
                      </select>
                      <input
                        type="text"
                        placeholder="ZIP *"
                        value={shipping.zip}
                        onChange={(e) => setShipping((p) => ({ ...p, zip: e.target.value }))}
                        className="h-11 rounded-xl border border-neutral-200 px-3 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                      />
                    </div>
                  </div>

                  <label className="mt-4 flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                      className="rounded border-neutral-300"
                    />
                    Billing address same as shipping
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("review")}
                    className="h-12 px-6 rounded-xl border border-neutral-200 bg-white font-bold text-neutral-900 hover:bg-neutral-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep("payment")}
                    className="flex-1 h-12 rounded-xl bg-green-600 font-extrabold text-white hover:bg-green-700"
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {/* Step: Payment */}
            {step === "payment" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <h2 className="text-lg font-bold text-neutral-900 mb-4">Payment Method</h2>

                  {/* Payment method selection */}
                  <div className="space-y-3">
                    {/* Credit Card (Stripe) */}
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        selectedPayment === "stripe"
                          ? "border-green-600 bg-green-50"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={selectedPayment === "stripe"}
                        onChange={() => setSelectedPayment("stripe")}
                        className="w-5 h-5 text-green-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💳</span>
                          <span className="font-bold text-neutral-900">Credit / Debit Card</span>
                        </div>
                        <p className="text-sm text-neutral-500 mt-0.5">
                          Pay securely with Visa, Mastercard, Amex, or Discover
                        </p>
                      </div>
                    </label>

                    {/* PayPal */}
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        selectedPayment === "paypal"
                          ? "border-blue-600 bg-blue-50"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={selectedPayment === "paypal"}
                        onChange={() => setSelectedPayment("paypal")}
                        className="w-5 h-5 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🅿️</span>
                          <span className="font-bold text-neutral-900">PayPal</span>
                        </div>
                        <p className="text-sm text-neutral-500 mt-0.5">
                          Pay with your PayPal account or PayPal Credit
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Error messages */}
                  {stripeError && selectedPayment === "stripe" && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {stripeError}
                    </div>
                  )}
                  {paypalError && selectedPayment === "paypal" && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {paypalError}
                    </div>
                  )}

                  <p className="text-xs text-neutral-500 mt-4 text-center">
                    You will be redirected to {selectedPayment === "stripe" ? "Stripe" : "PayPal"} to complete your purchase securely.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("shipping")}
                    className="h-12 px-6 rounded-xl border border-neutral-200 bg-white font-bold text-neutral-900 hover:bg-neutral-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={selectedPayment === "stripe" ? startStripeCheckout : startPayPalCheckout}
                    disabled={processing}
                    className={`flex-1 h-12 rounded-xl font-extrabold text-white flex items-center justify-center ${
                      processing
                        ? "bg-neutral-300 cursor-not-allowed"
                        : selectedPayment === "stripe"
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {processing
                      ? "Redirecting…"
                      : selectedPayment === "stripe"
                      ? "Pay with Card"
                      : "Pay with PayPal"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Order Summary</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Wheels ({wheels.reduce((s, w) => s + w.quantity, 0)})</span>
                  <span className="font-semibold">${validation.totals.wheelSubtotal.toFixed(2)}</span>
                </div>
                {tires.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Tires ({tires.reduce((s, t) => s + t.quantity, 0)})</span>
                    <span className="font-semibold">${validation.totals.tireSubtotal.toFixed(2)}</span>
                  </div>
                )}
                {accessories.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Accessories</span>
                    <span className="font-semibold">${validation.totals.accessorySubtotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-neutral-100">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="font-semibold">${validation.totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Shipping</span>
                  <span className={`font-semibold ${validation.totals.shipping === 0 ? "text-green-700" : ""}`}>
                    {validation.totals.shipping === 0 ? "FREE" : `$${validation.totals.shipping.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Tax</span>
                  <span className="text-neutral-500 text-xs">Calculated at payment</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-neutral-900">Total</span>
                  <span className="text-2xl font-extrabold text-neutral-900">
                    ${validation.totals.total.toFixed(2)}
                  </span>
                </div>
                {!totalCheck.matches && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Total verification pending (diff: ${totalCheck.difference.toFixed(2)})
                  </p>
                )}
              </div>
            </div>

            {/* Trust badges */}
            <div className="rounded-xl bg-neutral-50 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-neutral-700">
                <span className="text-green-600">✓</span>
                <span>Secure checkout</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-700">
                <span className="text-green-600">✓</span>
                <span>Free shipping over $500</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-700">
                <span className="text-green-600">✓</span>
                <span>30-day returns</span>
              </div>
            </div>

            {/* Need help */}
            <div className="text-center text-sm text-neutral-600">
              Need help?{" "}
              <a href={BRAND.links.tel} className="font-bold text-green-700 hover:underline">
                {BRAND.phone.callDisplay}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ===== Checkout Item Component =====

function CheckoutItem({
  item,
  type,
}: {
  item: CartWheelItem | CartTireItem | CartAccessoryItem;
  type: "wheel" | "tire" | "accessory";
}) {
  const lineTotal = item.unitPrice * item.quantity;

  if (type === "wheel") {
    const wheel = item as CartWheelItem;
    return (
      <div className="flex gap-4 p-4">
        <div className="w-16 h-16 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
          {wheel.imageUrl ? (
            <img src={wheel.imageUrl} alt={wheel.model} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-2xl">⚙️</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-neutral-500">{wheel.brand}</div>
          <div className="font-bold text-neutral-900">{wheel.model}</div>
          <div className="text-sm text-neutral-600">
            {wheel.diameter}" × {wheel.width}" • {wheel.boltPattern}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-neutral-500">×{wheel.quantity}</div>
          <div className="font-bold text-neutral-900">${lineTotal.toFixed(2)}</div>
        </div>
      </div>
    );
  }

  if (type === "tire") {
    const tire = item as CartTireItem;
    return (
      <div className="flex gap-4 p-4">
        <div className="w-16 h-16 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
          {tire.imageUrl ? (
            <img src={tire.imageUrl} alt={tire.model} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-2xl">🛞</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-neutral-500">{tire.brand}</div>
          <div className="font-bold text-neutral-900">{tire.model}</div>
          <div className="text-sm text-neutral-600">{tire.size}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-neutral-500">×{tire.quantity}</div>
          <div className="font-bold text-neutral-900">${lineTotal.toFixed(2)}</div>
        </div>
      </div>
    );
  }

  // Accessory
  const acc = item as CartAccessoryItem;
  return (
    <div className="flex gap-4 p-4 bg-neutral-50">
      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-neutral-200 flex items-center justify-center text-lg">
        {acc.category === "lug_nut" ? "🔩" : acc.category === "hub_ring" ? "⭕" : "🔧"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-neutral-900 flex items-center gap-2">
          {acc.name}
          {acc.required && (
            <span className="text-[10px] uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Required</span>
          )}
        </div>
        {acc.spec?.threadSize && (
          <div className="text-xs text-neutral-500">{acc.spec.threadSize}</div>
        )}
      </div>
      <div className="text-right">
        <div className="text-xs text-neutral-500">×{acc.quantity}</div>
        <div className="font-semibold text-neutral-900">${lineTotal.toFixed(2)}</div>
      </div>
    </div>
  );
}
