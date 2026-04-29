"use client";

import { useState } from "react";
import { usePOS } from "./POSContext";
import { formatWheelSize, formatTireSize } from "@/lib/fitment/staggeredFitment";

// ============================================================================
// POS Pricing Step - Toggle-based add-ons with admin-configurable prices
// ============================================================================

export function POSPricingStep() {
  const {
    state,
    setDiscount,
    setSelectedAddOns,
    goToStep,
    isStaggered,
    subtotal,
    laborTotal,
    addOnsTotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    creditCardFee,
    outTheDoorPrice,
  } = usePOS();

  const { adminSettings, selectedAddOns } = state;

  const [showDiscount, setShowDiscount] = useState(!!state.discount);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(state.discount?.type || "percent");
  const [discountValue, setDiscountValue] = useState(state.discount?.value || 0);
  const [discountReason, setDiscountReason] = useState(state.discount?.reason || "");

  const handleApplyDiscount = () => {
    if (discountValue > 0) {
      setDiscount({
        type: discountType,
        value: discountValue,
        reason: discountReason || undefined,
      });
    } else {
      setDiscount(null);
    }
  };

  const handleClearDiscount = () => {
    setDiscount(null);
    setDiscountValue(0);
    setDiscountReason("");
    setShowDiscount(false);
  };

  const toggleAddon = (key: keyof typeof selectedAddOns) => {
    if (key === "customIds") return;
    setSelectedAddOns({ [key]: !selectedAddOns[key] });
  };

  const toggleCustomAddon = (id: string) => {
    const current = selectedAddOns.customIds;
    const updated = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id];
    setSelectedAddOns({ customIds: updated });
  };

  // Check if package is complete
  if (!state.vehicle || !state.wheel || !state.tire) {
    return (
      <div className="py-12 text-center text-neutral-400">
        Please select a package first.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-white">Build the Quote</h2>
        <p className="mt-2 text-neutral-400">Toggle add-ons and apply discounts</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Selections */}
        <div className="space-y-6">
          {/* Parts Summary */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">
              🛞 Parts
              {isStaggered && (
                <span className="ml-2 text-sm font-normal text-purple-400">🏁 Staggered</span>
              )}
            </h3>

            {/* Wheels */}
            <div className="flex items-center justify-between border-b border-neutral-800 py-3">
              <div className="flex items-center gap-3">
                {state.wheel.imageUrl && (
                  <img
                    src={state.wheel.imageUrl}
                    alt={state.wheel.model}
                    className="h-12 w-12 rounded-lg bg-neutral-800 object-contain"
                  />
                )}
                <div>
                  <div className="font-medium text-white">
                    {state.wheel.brand} {state.wheel.model}
                  </div>
                  <div className="text-sm text-neutral-400">
                    {formatWheelSize(state.wheel)} • Qty: {state.wheel.quantity}
                  </div>
                </div>
              </div>
              <div className="text-lg font-bold text-white">
                ${state.wheel.setPrice.toLocaleString()}
              </div>
            </div>

            {/* Tires */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {state.tire.imageUrl && (
                  <img
                    src={state.tire.imageUrl}
                    alt={state.tire.model}
                    className="h-12 w-12 rounded-lg bg-neutral-800 object-contain"
                  />
                )}
                <div>
                  <div className="font-medium text-white">
                    {state.tire.brand} {state.tire.model}
                  </div>
                  <div className="text-sm text-neutral-400">
                    {formatTireSize(state.tire)} • Qty: {state.tire.quantity}
                  </div>
                </div>
              </div>
              <div className="text-lg font-bold text-white">
                ${state.tire.setPrice.toLocaleString()}
              </div>
            </div>

            <div className="flex justify-between border-t border-neutral-800 pt-3">
              <span className="text-neutral-400">Parts Subtotal</span>
              <span className="text-xl font-bold text-white">${subtotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Labor */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">💪 Labor</h3>

            <label className="flex cursor-pointer items-center justify-between rounded-xl bg-neutral-800 p-4 transition-colors hover:bg-neutral-750">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedAddOns.labor}
                  onChange={() => toggleAddon("labor")}
                  className="h-5 w-5 rounded border-neutral-600 bg-neutral-700 text-blue-600"
                />
                <div>
                  <div className="font-medium text-white">Mount & Balance</div>
                  <div className="text-sm text-neutral-400">
                    ${adminSettings.laborPerWheel}/wheel × 4
                  </div>
                </div>
              </div>
              <div className="text-lg font-bold text-white">
                ${(adminSettings.laborPerWheel * 4).toFixed(2)}
              </div>
            </label>
          </div>

          {/* Add-ons */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">🔧 Add-ons</h3>

            <div className="space-y-3">
              {/* TPMS */}
              <label className="flex cursor-pointer items-center justify-between rounded-xl bg-neutral-800 p-4 transition-colors hover:bg-neutral-750">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAddOns.tpms}
                    onChange={() => toggleAddon("tpms")}
                    className="h-5 w-5 rounded border-neutral-600 bg-neutral-700 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-white">TPMS Sensors</div>
                    <div className="text-sm text-neutral-400">
                      ${adminSettings.tpmsPerSensor}/sensor × 4
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-white">
                  ${(adminSettings.tpmsPerSensor * 4).toFixed(2)}
                </div>
              </label>

              {/* Disposal */}
              <label className="flex cursor-pointer items-center justify-between rounded-xl bg-neutral-800 p-4 transition-colors hover:bg-neutral-750">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAddOns.disposal}
                    onChange={() => toggleAddon("disposal")}
                    className="h-5 w-5 rounded border-neutral-600 bg-neutral-700 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-white">Tire Disposal</div>
                    <div className="text-sm text-neutral-400">
                      ${adminSettings.disposalPerTire}/tire × 4
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-white">
                  ${(adminSettings.disposalPerTire * 4).toFixed(2)}
                </div>
              </label>

              {/* Custom Add-ons - filter out Valve Stems (included in installation) */}
              {adminSettings.customAddOns
                .filter((addon) => addon.name.toLowerCase() !== "valve stems")
                .map((addon) => (
                <label
                  key={addon.id}
                  className="flex cursor-pointer items-center justify-between rounded-xl bg-neutral-800 p-4 transition-colors hover:bg-neutral-750"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedAddOns.customIds.includes(addon.id)}
                      onChange={() => toggleCustomAddon(addon.id)}
                      className="h-5 w-5 rounded border-neutral-600 bg-neutral-700 text-blue-600"
                    />
                    <div>
                      <div className="font-medium text-white">{addon.name}</div>
                      {addon.perUnit && (
                        <div className="text-sm text-neutral-400">${addon.price}/ea × 4</div>
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white">
                    ${(addon.perUnit ? addon.price * 4 : addon.price).toFixed(2)}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Discount */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">💰 Discount</h3>

            {!showDiscount ? (
              <button
                onClick={() => setShowDiscount(true)}
                className="w-full rounded-xl border border-dashed border-neutral-600 bg-neutral-800 py-3 text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
              >
                + Add Discount
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
                    className="rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-white"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">$</option>
                  </select>
                  <input
                    type="number"
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    placeholder="Amount"
                    className="flex-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-white"
                  />
                </div>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyDiscount}
                    className="flex-1 rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-500"
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleClearDiscount}
                    className="rounded-lg border border-neutral-600 px-4 py-2 text-neutral-400 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Price Summary */}
        <div className="lg:sticky lg:top-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">Price Summary</h3>

            <div className="space-y-3">
              <div className="flex justify-between text-neutral-400">
                <span>Parts</span>
                <span className="text-white">${subtotal.toLocaleString()}</span>
              </div>

              {laborTotal > 0 && (
                <div className="flex justify-between text-neutral-400">
                  <span>Labor</span>
                  <span className="text-white">${laborTotal.toFixed(2)}</span>
                </div>
              )}

              {addOnsTotal > 0 && (
                <div className="flex justify-between text-neutral-400">
                  <span>Add-ons</span>
                  <span className="text-white">${addOnsTotal.toFixed(2)}</span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-neutral-400">
                <span>Tax (6%)</span>
                <span className="text-white">${taxAmount.toFixed(2)}</span>
              </div>

              {/* Non Cash Fee - toggleable credit card processing fee */}
              <label className="flex cursor-pointer items-center justify-between rounded-lg bg-neutral-800/50 px-3 py-2 transition-colors hover:bg-neutral-800">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedAddOns.creditCard}
                    onChange={() => toggleAddon("creditCard")}
                    className="h-4 w-4 rounded border-neutral-600 bg-neutral-700 text-blue-600"
                  />
                  <span className="text-sm text-neutral-400">
                    Non Cash Fee ({adminSettings.creditCardFeePercent}%)
                  </span>
                </div>
                <span className={`text-sm ${selectedAddOns.creditCard ? "text-white" : "text-neutral-500"}`}>
                  {selectedAddOns.creditCard ? `$${creditCardFee.toFixed(2)}` : "$0.00"}
                </span>
              </label>

              <div className="border-t border-neutral-700 pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-white">Out the Door</span>
                  <span className="text-2xl font-bold text-green-400">
                    ${outTheDoorPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
              <button
                onClick={() => goToStep("quote")}
                className="w-full rounded-xl bg-green-600 py-4 text-lg font-bold text-white transition-colors hover:bg-green-500"
              >
                Generate Quote
              </button>
              <button
                onClick={() => goToStep("package")}
                className="w-full text-center text-sm text-neutral-400 hover:text-white"
              >
                ← Back to Package
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
