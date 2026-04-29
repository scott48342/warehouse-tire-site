"use client";

import { useState, useRef } from "react";
import { usePOS } from "./POSContext";

// ============================================================================
// POS Quote Step - Printable quote with optional customer info & email
// ============================================================================

export function POSQuoteStep() {
  const {
    state,
    subtotal,
    laborTotal,
    addOnsTotal,
    discountAmount,
    taxAmount,
    creditCardFee,
    outTheDoorPrice,
    setCustomer,
    setNotes,
    reset,
  } = usePOS();
  
  const { adminSettings, selectedAddOns } = state;
  
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [showCustomerOnPrint, setShowCustomerOnPrint] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  
  if (!state.vehicle || !state.wheel || !state.tire) {
    return (
      <div className="text-center py-12 text-neutral-400">
        Please complete the quote first.
      </div>
    );
  }
  
  // Generate quote ID
  const quoteId = `WTD-${Date.now().toString(36).toUpperCase()}`;
  const quoteDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  // Generate shareable URL
  const generateQuoteUrl = () => {
    const params = new URLSearchParams({
      q: quoteId,
      v: `${state.vehicle!.year}-${state.vehicle!.make}-${state.vehicle!.model}`,
      w: state.wheel!.sku,
      t: state.tire!.sku,
      p: outTheDoorPrice.toFixed(2),
    });
    return `${window.location.origin}/pos/quote?${params.toString()}`;
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(generateQuoteUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleEmail = async () => {
    if (!state.customerEmail) {
      setEmailError("Please enter customer email first");
      return;
    }
    
    setEmailSending(true);
    setEmailError(null);
    
    try {
      const response = await fetch("/api/pos/send-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: state.customerEmail,
          customerName: state.customerName || "Valued Customer",
          quoteId,
          vehicle: state.vehicle,
          wheel: state.wheel,
          tire: state.tire,
          laborTotal,
          addOnsTotal,
          discountAmount,
          taxAmount,
          creditCardFee,
          outTheDoorPrice,
          selectedAddOns,
          adminSettings,
          notes: state.notes,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }
      
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 5000);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  };
  
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-white">Quote Ready</h2>
          <p className="text-neutral-400">Quote #{quoteId}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-medium flex items-center gap-2"
          >
            {copied ? "✓ Copied!" : "🔗 Copy Link"}
          </button>
          
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-medium flex items-center gap-2"
          >
            🖨️ Print
          </button>
          
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium"
          >
            New Quote
          </button>
        </div>
      </div>
      
      {/* Customer Info (Editable) */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 mb-6 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Customer Info (Optional)</h3>
          <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showCustomerOnPrint}
              onChange={(e) => setShowCustomerOnPrint(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-700 text-blue-600"
            />
            Show on printed quote
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Name</label>
            <input
              type="text"
              value={state.customerName || ""}
              onChange={(e) => setCustomer({ name: e.target.value })}
              placeholder="Customer name"
              className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Phone</label>
            <input
              type="tel"
              value={state.customerPhone || ""}
              onChange={(e) => setCustomer({ phone: e.target.value })}
              placeholder="(555) 123-4567"
              className="w-full h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={state.customerEmail || ""}
                onChange={(e) => {
                  setCustomer({ email: e.target.value });
                  setEmailError(null);
                }}
                placeholder="email@example.com"
                className="flex-1 h-10 rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3"
              />
              <button
                onClick={handleEmail}
                disabled={!state.customerEmail || emailSending}
                className="px-4 h-10 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-medium text-sm whitespace-nowrap"
              >
                {emailSending ? "Sending..." : emailSent ? "✓ Sent!" : "📧 Send Quote"}
              </button>
            </div>
            {emailError && (
              <p className="text-red-400 text-xs mt-1">{emailError}</p>
            )}
            {emailSent && (
              <p className="text-green-400 text-xs mt-1">Quote sent to {state.customerEmail}</p>
            )}
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm text-neutral-400 mb-1">Notes</label>
          <textarea
            value={state.notes || ""}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special requests, notes, etc."
            rows={2}
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white px-3 py-2 resize-none"
          />
        </div>
      </div>
      
      {/* Printable Quote */}
      <div ref={printRef} className="bg-white rounded-2xl overflow-hidden print:rounded-none print:shadow-none">
        {/* Header */}
        <div className="bg-neutral-900 px-8 py-6 print:bg-black">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Warehouse Tire Direct</h1>
              <p className="text-neutral-400">Wheel & Tire Package Quote</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-neutral-400">Quote #{quoteId}</div>
              <div className="text-sm text-neutral-400">{quoteDate}</div>
            </div>
          </div>
        </div>
        
        {/* Customer Info (Print version) - only shows if toggle is on and info exists */}
        {showCustomerOnPrint && (state.customerName || state.customerPhone || state.customerEmail) && (
          <div className="px-8 py-4 border-b border-neutral-200 hidden print:block">
            <div className="text-sm text-neutral-600">
              <strong>Customer:</strong>{" "}
              {state.customerName}
              {state.customerPhone && ` • ${state.customerPhone}`}
              {state.customerEmail && ` • ${state.customerEmail}`}
            </div>
          </div>
        )}
        
        {/* Vehicle */}
        <div className="px-8 py-4 bg-neutral-100 print:bg-neutral-100">
          <div className="text-sm text-neutral-500 uppercase tracking-wide">Vehicle</div>
          <div className="text-xl font-bold text-neutral-900">
            {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}
            {state.vehicle.trim && ` ${state.vehicle.trim}`}
          </div>
        </div>
        
        {/* Items */}
        <div className="px-8 py-6">
          {/* Wheels */}
          <div className="flex items-start justify-between py-4 border-b border-neutral-200">
            <div className="flex items-start gap-4">
              {state.wheel.imageUrl && (
                <img
                  src={state.wheel.imageUrl}
                  alt={state.wheel.model}
                  className="h-20 w-20 rounded-lg object-contain bg-neutral-100 print:hidden"
                />
              )}
              <div>
                <div className="text-sm text-neutral-500">Wheels (Set of 4)</div>
                <div className="text-lg font-bold text-neutral-900">
                  {state.wheel.brand} {state.wheel.model}
                </div>
                <div className="text-sm text-neutral-600">
                  {state.wheel.diameter}" × {state.wheel.width}"
                  {state.wheel.finish && ` • ${state.wheel.finish}`}
                </div>
                <div className="text-xs text-neutral-400 mt-1">SKU: {state.wheel.sku}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-neutral-900">${state.wheel.setPrice.toLocaleString()}</div>
              <div className="text-xs text-neutral-500">${state.wheel.unitPrice.toLocaleString()} each</div>
            </div>
          </div>
          
          {/* Tires */}
          <div className="flex items-start justify-between py-4 border-b border-neutral-200">
            <div className="flex items-start gap-4">
              {state.tire.imageUrl && (
                <img
                  src={state.tire.imageUrl}
                  alt={state.tire.model}
                  className="h-20 w-20 rounded-lg object-contain bg-neutral-100 print:hidden"
                />
              )}
              <div>
                <div className="text-sm text-neutral-500">Tires (Set of 4)</div>
                <div className="text-lg font-bold text-neutral-900">
                  {state.tire.brand} {state.tire.model}
                </div>
                <div className="text-sm text-neutral-600">{state.tire.size}</div>
                <div className="text-xs text-neutral-400 mt-1">SKU: {state.tire.sku}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-neutral-900">${state.tire.setPrice.toLocaleString()}</div>
              <div className="text-xs text-neutral-500">${state.tire.unitPrice.toLocaleString()} each</div>
            </div>
          </div>
          
          {/* Labor & Fees */}
          <div className="py-4 space-y-2 text-sm">
            {selectedAddOns.labor && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Mount & Balance</span>
                <span className="text-neutral-900">${laborTotal.toFixed(2)}</span>
              </div>
            )}
            {selectedAddOns.tpms && (
              <div className="flex justify-between">
                <span className="text-neutral-600">TPMS Sensors</span>
                <span className="text-neutral-900">${(adminSettings.tpmsPerSensor * 4).toFixed(2)}</span>
              </div>
            )}
            {selectedAddOns.disposal && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Tire Disposal</span>
                <span className="text-neutral-900">${(adminSettings.disposalPerTire * 4).toFixed(2)}</span>
              </div>
            )}
            {adminSettings.customAddOns
              .filter((a) => selectedAddOns.customIds.includes(a.id))
              .map((addon) => (
                <div key={addon.id} className="flex justify-between">
                  <span className="text-neutral-600">{addon.name}</span>
                  <span className="text-neutral-900">${(addon.perUnit ? addon.price * 4 : addon.price).toFixed(2)}</span>
                </div>
              ))}
          </div>
          
          {/* Discount */}
          {discountAmount > 0 && (
            <div className="py-2 flex justify-between text-green-600">
              <span>
                Discount
                {state.discount?.reason && ` (${state.discount.reason})`}
              </span>
              <span>-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          
          {/* Tax */}
          <div className="py-2 flex justify-between text-sm">
            <span className="text-neutral-600">Tax (6%)</span>
            <span className="text-neutral-900">${taxAmount.toFixed(2)}</span>
          </div>
          
          {/* Non Cash Fee (Credit Card) */}
          {creditCardFee > 0 && (
            <div className="py-2 flex justify-between text-sm">
              <span className="text-neutral-600">Non Cash Fee ({adminSettings.creditCardFeePercent}%)</span>
              <span className="text-neutral-900">${creditCardFee.toFixed(2)}</span>
            </div>
          )}
        </div>
        
        {/* Total */}
        <div className="px-8 py-6 bg-neutral-900 print:bg-black">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-400">Out The Door Price</div>
              <div className="text-xs text-neutral-500">Installed in-store • Parts + Labor + Tax</div>
            </div>
            <div className="text-4xl font-black text-green-400">
              ${outTheDoorPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-8 py-4 text-center text-xs text-neutral-500 border-t border-neutral-200">
          <p>Quote valid for 7 days • Prices subject to change • Warehouse Tire Direct</p>
          {state.notes && (
            <p className="mt-2 italic">Notes: {state.notes}</p>
          )}
        </div>
      </div>
      
      {/* Bottom Actions (Print Hidden) */}
      <div className="mt-8 flex items-center justify-center gap-4 print:hidden">
        <button
          onClick={handlePrint}
          className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg"
        >
          🖨️ Print Quote
        </button>
        
        <button
          onClick={handleCopyLink}
          className="px-8 py-4 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white font-bold text-lg"
        >
          {copied ? "✓ Link Copied!" : "🔗 Copy Quote Link"}
        </button>
      </div>
    </div>
  );
}
