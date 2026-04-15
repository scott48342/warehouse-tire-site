"use client";

import { useState } from "react";
import { usePOS } from "./POSContext";

// ============================================================================
// POS Pricing Step - Toggle-based add-ons with admin-configurable prices
// ============================================================================

export function POSPricingStep() {
  const {
    state,
    setDiscount,
    setSelectedAddOns,
    goToStep,
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
  
  if (!state.vehicle || !state.wheel || !state.tire) {
    return (
      <div className="text-center py-12 text-neutral-400">
        Please select a package first.
      </div>
    );
  }
  
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">Build the Quote</h2>
        <p className="text-neutral-400 mt-2">Toggle add-ons and apply discounts</p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Selections */}
        <div className="space-y-6">
          {/* Parts Summary */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">🛞 Parts</h3>
            
            {/* Wheels */}
            <div className="flex items-center justify-between py-3 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                {state.wheel.imageUrl && (
                  <img src={state.wheel.imageUrl} alt={state.wheel.model} className="h-12 w-12 rounded-lg object-contain bg-neutral-800" />
                )}
                <div>
                  <div className="font-medium text-white">{state.wheel.brand} {state.wheel.model}</div>
                  <div className="text-sm text-neutral-400">{state.wheel.diameter}" × {state.wheel.width}" • Qty: {state.wheel.quantity}</div>
                </div>
              </div>
              <div className="text-lg font-bold text-white">${state.wheel.setPrice.toLocaleString()}</div>
            </div>
            
            {/* Tires */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {state.tire.imageUrl && (
                  <img src={state.tire.imageUrl} alt={state.tire.model} className="h-12 w-12 rounded-lg object-contain bg-neutral-800" />
                )}
                <div>
                  <div className="font-medium text-white">{state.tire.brand} {state.tire.model}</div>
                  <div className="text-sm text-neutral-400">{state.tire.size} • Qty: {state.tire.quantity}</div>
                </div>
              </div>
              <div className="text-lg font-bold text-white">${state.tire.setPrice.toLocaleString()}</div>
            </div>
            
            <div className="pt-3 border-t border-neutral-800 flex justify-between">
              <span className="text-neutral-400">Parts Subtotal</span>
              <span className="text-xl font-bold text-white">${subtotal.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Labor */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">💪 Labor</h3>
            
            <label className="flex items-center justify-between p-4 rounded-xl bg-neutral-800 cursor-pointer hover:bg-neutral-750 transition-colors">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedAddOns.labor}
                  onChange={() => toggleAddon("labor")}
                  className="w-5 h-5 rounded text-blue-600 bg-neutral-700 border-neutral-600"
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
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">🔧 Add-ons</h3>
            
            <div className="space-y-3">
              {/* TPMS */}
              <label className="flex items-center justify-between p-4 rounded-xl bg-neutral-800 cursor-pointer hover:bg-neutral-750 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAddOns.tpms}
                    onChange={() => toggleAddon("tpms")}
                    className="w-5 h-5 rounded text-blue-600 bg-neutral-700 border-neutral-600"
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
              <label className="flex items-center justify-between p-4 rounded-xl bg-neutral-800 cursor-pointer hover:bg-neutral-750 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAddOns.disposal}
                    onChange={() => toggleAddon("disposal")}
                    className="w-5 h-5 rounded text-blue-600 bg-neutral-700 border-neutral-600"
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
              
              {/* Custom Add-ons */}
              {adminSettings.customAddOns.map((addon) => (
                <label 
                  key={addon.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-neutral-800 cursor-pointer hover:bg-neutral-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedAddOns.customIds.includes(addon.id)}
                      onChange={() => toggleCustomAddon(addon.id)}
                      className="w-5 h-5 rounded text-blue-600 bg-neutral-700 border-neutral-600"
                    />
                    <div>
                      <div className="font-medium text-white">{addon.name}</div>
                      {addon.perUnit && (
                        <div className="text-sm text-neutral-400">
                          ${addon.price} × 4
                        </div>
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
          
          {/* Payment Method */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">💳 Payment Method</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedAddOns({ creditCard: false })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  !selectedAddOns.creditCard
                    ? "border-green-500 bg-green-500/10"
                    : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
                }`}
              >
                <div className="text-2xl mb-1">💵</div>
                <div className="font-medium text-white">Cash / Check</div>
                <div className="text-sm text-neutral-400">No fee</div>
              </button>
              
              <button
                onClick={() => setSelectedAddOns({ creditCard: true })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedAddOns.creditCard
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
                }`}
              >
                <div className="text-2xl mb-1">💳</div>
                <div className="font-medium text-white">Credit Card</div>
                <div className="text-sm text-neutral-400">+{adminSettings.creditCardFeePercent}% fee</div>
              </button>
            </div>
            
            {selectedAddOns.creditCard && (
              <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-300">Credit card processing fee</span>
                  <span className="text-blue-300 font-bold">+${creditCardFee.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Discount */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">💸 Discount</h3>
              {!showDiscount && !state.discount && (
                <button
                  onClick={() => setShowDiscount(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  + Add Discount
                </button>
              )}
            </div>
            
            {(showDiscount || state.discount) && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={discountType === "percent"}
                      onChange={() => setDiscountType("percent")}
                      className="text-blue-500"
                    />
                    <span className="text-neutral-300">Percentage</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={discountType === "fixed"}
                      onChange={() => setDiscountType("fixed")}
                      className="text-blue-500"
                    />
                    <span className="text-neutral-300">Fixed Amount</span>
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">{discountType === "percent" ? "%" : "$"}</span>
                  <input
                    type="number"
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-32 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-right px-3 font-semibold"
                    placeholder="0"
                  />
                  {discountType === "percent" && discountValue > 0 && (
                    <span className="text-neutral-400 text-sm">
                      = ${((subtotal * discountValue) / 100).toFixed(2)} off
                    </span>
                  )}
                </div>
                
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3"
                />
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleApplyDiscount}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium"
                  >
                    Apply Discount
                  </button>
                  <button
                    onClick={handleClearDiscount}
                    className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            
            {state.discount && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-green-400 font-medium">
                      {state.discount.type === "percent"
                        ? `${state.discount.value}% discount`
                        : `$${state.discount.value} discount`}
                    </span>
                    {state.discount.reason && (
                      <span className="text-neutral-500 text-sm ml-2">({state.discount.reason})</span>
                    )}
                  </div>
                  <span className="text-green-400 font-bold">-${discountAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right: Quote Summary */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="bg-neutral-800 rounded-2xl border border-neutral-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h3 className="text-lg font-bold text-white">Quote Summary</h3>
              <p className="text-sm text-blue-200">
                {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}
              </p>
            </div>
            
            <div className="p-6 space-y-3 text-sm">
              {/* Parts */}
              <div className="flex justify-between">
                <span className="text-neutral-400">Parts (Wheels + Tires)</span>
                <span className="text-white font-medium">${subtotal.toLocaleString()}</span>
              </div>
              
              {/* Labor */}
              {laborTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Mount & Balance</span>
                  <span className="text-white font-medium">${laborTotal.toFixed(2)}</span>
                </div>
              )}
              
              {/* Add-ons breakdown */}
              {selectedAddOns.tpms && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">TPMS Sensors</span>
                  <span className="text-white font-medium">${(adminSettings.tpmsPerSensor * 4).toFixed(2)}</span>
                </div>
              )}
              {selectedAddOns.disposal && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Tire Disposal</span>
                  <span className="text-white font-medium">${(adminSettings.disposalPerTire * 4).toFixed(2)}</span>
                </div>
              )}
              {adminSettings.customAddOns
                .filter((a) => selectedAddOns.customIds.includes(a.id))
                .map((addon) => (
                  <div key={addon.id} className="flex justify-between">
                    <span className="text-neutral-400">{addon.name}</span>
                    <span className="text-white font-medium">
                      ${(addon.perUnit ? addon.price * 4 : addon.price).toFixed(2)}
                    </span>
                  </div>
                ))}
              
              {/* Discount */}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              
              {/* Subtotal before tax */}
              <div className="pt-3 border-t border-neutral-700 flex justify-between">
                <span className="text-neutral-400">Subtotal</span>
                <span className="text-white font-medium">
                  ${(subtotal + laborTotal + addOnsTotal - discountAmount).toFixed(2)}
                </span>
              </div>
              
              {/* Tax */}
              <div className="flex justify-between">
                <span className="text-neutral-400">Tax (6%)</span>
                <span className="text-white font-medium">${taxAmount.toFixed(2)}</span>
              </div>
              
              {/* Credit Card Fee */}
              {creditCardFee > 0 && (
                <div className="flex justify-between text-blue-400">
                  <span>CC Fee ({adminSettings.creditCardFeePercent}%)</span>
                  <span>+${creditCardFee.toFixed(2)}</span>
                </div>
              )}
              
              {/* Out the Door */}
              <div className="pt-4 border-t border-neutral-700">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-white">Out The Door</span>
                  <span className="text-3xl font-black text-green-400">
                    ${outTheDoorPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 text-right mt-1">
                  Installed in-store • Ready today
                </div>
              </div>
            </div>
            
            {/* Continue to Quote */}
            <div className="px-6 pb-6">
              <button
                onClick={() => goToStep("quote")}
                className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-lg transition-colors"
              >
                Generate Quote →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
