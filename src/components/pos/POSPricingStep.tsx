"use client";

import { useState } from "react";
import { usePOS, DEFAULT_FEES } from "./POSContext";

// ============================================================================
// POS Pricing Step
// ============================================================================

export function POSPricingStep() {
  const {
    state,
    setFees,
    setDiscount,
    setTaxRate,
    goToStep,
    subtotal,
    feesTotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    outTheDoorPrice,
  } = usePOS();
  
  const [showDiscount, setShowDiscount] = useState(!!state.discount);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(state.discount?.type || "percent");
  const [discountValue, setDiscountValue] = useState(state.discount?.value || 0);
  const [discountReason, setDiscountReason] = useState(state.discount?.reason || "");
  
  const [customFeeName, setCustomFeeName] = useState("");
  const [customFeeAmount, setCustomFeeAmount] = useState("");
  
  const handleFeeChange = (key: keyof typeof DEFAULT_FEES, value: number) => {
    if (key !== "custom") {
      setFees({ [key]: Math.max(0, value) });
    }
  };
  
  const handleAddCustomFee = () => {
    if (!customFeeName.trim() || !customFeeAmount) return;
    
    const newCustomFees = [
      ...state.fees.custom,
      { name: customFeeName.trim(), amount: parseFloat(customFeeAmount) || 0 },
    ];
    setFees({ custom: newCustomFees });
    setCustomFeeName("");
    setCustomFeeAmount("");
  };
  
  const handleRemoveCustomFee = (index: number) => {
    const newCustomFees = state.fees.custom.filter((_, i) => i !== index);
    setFees({ custom: newCustomFees });
  };
  
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
        <p className="text-neutral-400 mt-2">Add labor, fees, and discounts</p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Fee Controls */}
        <div className="space-y-6">
          {/* Parts Summary */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Parts</h3>
            
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
          
          {/* Labor & Fees */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Labor & Fees</h3>
            
            <div className="space-y-4">
              {/* Installation Labor */}
              <div className="flex items-center justify-between">
                <label className="text-neutral-300">Installation Labor</label>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">$</span>
                  <input
                    type="number"
                    value={state.fees.labor}
                    onChange={(e) => handleFeeChange("labor", parseFloat(e.target.value) || 0)}
                    className="w-24 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-right px-3 font-semibold"
                  />
                </div>
              </div>
              
              {/* TPMS */}
              <div className="flex items-center justify-between">
                <label className="text-neutral-300">TPMS Programming</label>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">$</span>
                  <input
                    type="number"
                    value={state.fees.tpms}
                    onChange={(e) => handleFeeChange("tpms", parseFloat(e.target.value) || 0)}
                    className="w-24 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-right px-3 font-semibold"
                  />
                </div>
              </div>
              
              {/* Tire Disposal */}
              <div className="flex items-center justify-between">
                <label className="text-neutral-300">Tire Disposal (×4)</label>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">$</span>
                  <input
                    type="number"
                    value={state.fees.disposal}
                    onChange={(e) => handleFeeChange("disposal", parseFloat(e.target.value) || 0)}
                    className="w-24 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-right px-3 font-semibold"
                  />
                </div>
              </div>
              
              {/* Alignment */}
              <div className="flex items-center justify-between">
                <label className="text-neutral-300">
                  Alignment
                  <span className="text-xs text-neutral-500 ml-2">(Optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">$</span>
                  <input
                    type="number"
                    value={state.fees.alignment}
                    onChange={(e) => handleFeeChange("alignment", parseFloat(e.target.value) || 0)}
                    className="w-24 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-right px-3 font-semibold"
                    placeholder="0"
                  />
                </div>
              </div>
              
              {/* Custom Fees */}
              {state.fees.custom.map((fee, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <label className="text-neutral-300">{fee.name}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">${fee.amount.toFixed(2)}</span>
                    <button
                      onClick={() => handleRemoveCustomFee(idx)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Add Custom Fee */}
              <div className="pt-4 border-t border-neutral-800">
                <div className="text-sm text-neutral-500 mb-2">Add Custom Fee</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customFeeName}
                    onChange={(e) => setCustomFeeName(e.target.value)}
                    placeholder="Fee name"
                    className="flex-1 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3"
                  />
                  <input
                    type="number"
                    value={customFeeAmount}
                    onChange={(e) => setCustomFeeAmount(e.target.value)}
                    placeholder="$0"
                    className="w-24 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-right px-3"
                  />
                  <button
                    onClick={handleAddCustomFee}
                    disabled={!customFeeName.trim() || !customFeeAmount}
                    className="h-10 px-4 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-medium disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Discount */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Discount</h3>
              {!showDiscount && (
                <button
                  onClick={() => setShowDiscount(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  + Add Discount
                </button>
              )}
            </div>
            
            {showDiscount && (
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
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-32 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-right px-3 font-semibold"
                    placeholder="0"
                  />
                  {discountType === "percent" && (
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
          
          {/* Tax Rate */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Tax Rate</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={(state.taxRate * 100).toFixed(2)}
                onChange={(e) => setTaxRate((parseFloat(e.target.value) || 0) / 100)}
                step="0.25"
                className="w-24 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-right px-3 font-semibold"
              />
              <span className="text-neutral-400">%</span>
              <span className="text-neutral-500 text-sm">
                (Applied to parts: ${taxableAmount.toLocaleString()})
              </span>
            </div>
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
              
              {/* Fees breakdown */}
              {state.fees.labor > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Installation</span>
                  <span className="text-white font-medium">${state.fees.labor.toFixed(2)}</span>
                </div>
              )}
              {state.fees.tpms > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">TPMS</span>
                  <span className="text-white font-medium">${state.fees.tpms.toFixed(2)}</span>
                </div>
              )}
              {state.fees.disposal > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Disposal</span>
                  <span className="text-white font-medium">${state.fees.disposal.toFixed(2)}</span>
                </div>
              )}
              {state.fees.alignment > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Alignment</span>
                  <span className="text-white font-medium">${state.fees.alignment.toFixed(2)}</span>
                </div>
              )}
              {state.fees.custom.map((fee, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-neutral-400">{fee.name}</span>
                  <span className="text-white font-medium">${fee.amount.toFixed(2)}</span>
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
                  ${(subtotal + feesTotal - discountAmount).toFixed(2)}
                </span>
              </div>
              
              {/* Tax */}
              <div className="flex justify-between">
                <span className="text-neutral-400">Tax ({(state.taxRate * 100).toFixed(2)}%)</span>
                <span className="text-white font-medium">${taxAmount.toFixed(2)}</span>
              </div>
              
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
