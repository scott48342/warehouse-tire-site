'use client';

/**
 * LocalMobileCheckout - Mobile-first checkout wizard for local mode
 * 
 * ONLY renders on:
 * - Mobile viewport (< 768px)
 * - Local mode (shop.warehousetire.net)
 * 
 * Features:
 * - Stacked single-column layout
 * - Large touch targets (52px buttons)
 * - Sticky bottom CTAs per step
 * - Collapsed order summary with visible total
 * - Simplified item cards
 * - Store selector as stacked cards
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
// Image import removed - using native img for tireweb.tirelibrary.com compatibility
import { useCart, type CartWheelItem, type CartTireItem, type CartAccessoryItem } from '@/lib/cart/CartContext';
import { useShopContext, useIsLocalMode } from '@/contexts/ShopContextProvider';
import { STORES, type LocalStore } from '@/lib/shopContext';
import { StripePaymentElement } from '@/components/StripePaymentElement';
import { getCartId } from '@/lib/cart/useCartTracking';

// ============================================================================
// TYPES
// ============================================================================

type CheckoutStep = 'review' | 'details' | 'payment';

interface LocalMobileCheckoutProps {
  onDesktopView?: () => void;
}

// ============================================================================
// LOCAL FEES
// ============================================================================

const LOCAL_FEES = {
  installPerTire: 20,
  installPerWheel: 15,
  disposalPerTire: 5,
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: CheckoutStep }) {
  const steps = [
    { key: 'review', label: '1' },
    { key: 'details', label: '2' },
    { key: 'payment', label: '3' },
  ];
  
  const currentIndex = steps.findIndex(s => s.key === currentStep);
  
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              i <= currentIndex
                ? 'bg-green-600 text-white'
                : 'bg-neutral-200 text-neutral-500'
            }`}
          >
            {i < currentIndex ? '✓' : step.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 ${i < currentIndex ? 'bg-green-600' : 'bg-neutral-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function MobileItemCard({
  item,
  type,
  onUpdateQty,
  onRemove,
}: {
  item: CartWheelItem | CartTireItem | CartAccessoryItem;
  type: 'wheel' | 'tire' | 'accessory';
  onUpdateQty: (sku: string, qty: number) => void;
  onRemove: (sku: string) => void;
}) {
  const icons = { wheel: '🛞', tire: '⚫', accessory: '🔩' };
  
  // Get display name based on item type
  const displayName = type === 'accessory' 
    ? (item as CartAccessoryItem).name 
    : `${(item as CartWheelItem | CartTireItem).brand} ${(item as CartWheelItem | CartTireItem).model}`;
  
  const sku = item.sku;
  const qty = item.quantity;
  
  return (
    <div className="bg-neutral-50 rounded-xl p-3">
      <div className="flex gap-3">
        {/* Image or icon */}
        <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-white flex items-center justify-center overflow-hidden">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={displayName}
              loading="lazy"
              className="w-16 h-16 object-contain"
            />
          ) : (
            <span className="text-2xl">{icons[type]}</span>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">{displayName}</p>
          {'size' in item && item.size && (
            <p className="text-xs text-neutral-500">{item.size}</p>
          )}
          <p className="text-sm font-bold text-neutral-900 mt-1">
            ${(item.unitPrice || 0).toFixed(2)} each
          </p>
        </div>
      </div>
      
      {/* Qty controls and total */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => qty > 1 ? onUpdateQty(sku, qty - 1) : onRemove(sku)}
            className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-lg font-bold text-neutral-700 active:bg-neutral-100"
          >
            {qty === 1 ? '🗑️' : '−'}
          </button>
          <span className="w-8 text-center font-bold text-base">{qty}</span>
          <button
            onClick={() => onUpdateQty(sku, qty + 1)}
            className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-lg font-bold text-neutral-700 active:bg-neutral-100"
          >
            +
          </button>
        </div>
        <span className="text-base font-bold text-neutral-900">
          ${((item.unitPrice || 0) * qty).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function StoreCard({
  storeId,
  isSelected,
  onSelect,
}: {
  storeId: LocalStore;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const store = STORES[storeId];
  
  return (
    <button
      onClick={onSelect}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
        isSelected
          ? 'border-green-500 bg-green-50'
          : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold text-neutral-900">{store.displayName}</p>
          <p className="text-sm text-neutral-600 mt-0.5">{store.address}</p>
          <p className="text-sm text-neutral-500">
            {store.city}, {store.state} {store.zip}
          </p>
        </div>
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
          isSelected ? 'border-green-500 bg-green-500' : 'border-neutral-300'
        }`}>
          {isSelected && <span className="text-white text-sm">✓</span>}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-neutral-100">
        <p className="text-xs text-neutral-500">Mon-Fri: {store.hours.weekday}</p>
        <p className="text-xs text-neutral-500">Sat: {store.hours.saturday}</p>
      </div>
    </button>
  );
}

function CollapsibleOrderSummary({
  subtotal,
  installFees,
  disposalFees,
  tax,
  total,
  itemCount,
}: {
  subtotal: number;
  installFees: number;
  disposalFees: number;
  tax: number;
  total: number;
  itemCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-neutral-100 rounded-xl overflow-hidden">
      {/* Always visible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700">
            Order summary ({itemCount} items)
          </span>
          <svg
            className={`w-4 h-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <span className="text-lg font-bold text-neutral-900">${total.toFixed(2)}</span>
      </button>
      
      {/* Expandable details */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-2 border-t border-neutral-200 pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Subtotal</span>
            <span className="text-neutral-900">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Installation</span>
            <span className="text-neutral-900">${installFees.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Tire recycling</span>
            <span className="text-neutral-900">${disposalFees.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Tax (MI 6%)</span>
            <span className="text-neutral-900">${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-neutral-200">
            <span className="text-neutral-900">Total</span>
            <span className="text-green-600">${total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LocalMobileCheckout({ onDesktopView }: LocalMobileCheckoutProps) {
  const router = useRouter();
  const isLocal = useIsLocalMode();
  const { selectedStore, selectStore, storeInfo } = useShopContext();
  
  const {
    items,
    isHydrated,
    getWheels,
    getTires,
    getAccessories,
    getTotal,
    hasWheels,
    hasTires,
    clearCart,
    updateQuantity,
    removeItem,
  } = useCart();
  
  const [step, setStep] = useState<CheckoutStep>('review');
  const [processing, setProcessing] = useState(false);
  
  // Form state
  const [contact, setContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: 'MI',
    zip: '',
  });
  
  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  
  // Don't render on non-local or desktop
  if (!isLocal) return null;
  
  // Get items
  const wheels = getWheels();
  const tires = getTires();
  const accessories = getAccessories();
  const vehicle = wheels[0]?.vehicle || tires[0]?.vehicle;
  
  // Calculate totals
  const subtotal = getTotal();
  const tireCount = tires.reduce((sum, t) => sum + t.quantity, 0);
  const wheelOnlyCount = hasWheels() && !hasTires() ? wheels.reduce((sum, w) => sum + w.quantity, 0) : 0;
  
  const installFees = (tireCount * LOCAL_FEES.installPerTire) + (wheelOnlyCount * LOCAL_FEES.installPerWheel);
  const disposalFees = tireCount * LOCAL_FEES.disposalPerTire;
  const taxableAmount = subtotal;
  const tax = taxableAmount * 0.06;
  const total = subtotal + installFees + disposalFees + tax;
  
  const itemCount = items.length;
  
  // Validation
  const isContactValid = 
    contact.firstName.trim() !== '' &&
    contact.lastName.trim() !== '' &&
    contact.email.trim() !== '' &&
    contact.phone.trim() !== '' &&
    contact.address.trim() !== '' &&
    contact.city.trim() !== '' &&
    contact.zip.trim() !== '';
  
  const canProceedToPayment = isContactValid && selectedStore;
  
  // Create PaymentIntent when entering payment step
  const createPaymentIntent = useCallback(async () => {
    if (clientSecret || paymentLoading) return;
    
    try {
      setPaymentLoading(true);
      setPaymentError(null);
      
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items,
          customer: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
          },
          vehicle,
          cartId: getCartId(),
          installStore: selectedStore,
          shipping: {
            address: contact.address,
            city: contact.city,
            state: contact.state,
            zip: contact.zip,
            amount: 0,
            isFree: true,
          },
          tax: {
            rate: 0.06,
            amount: tax,
            state: 'MI',
          },
          localFees: {
            installation: installFees,
            recycling: disposalFees,
            cardProcessing: 0,
            tireCount,
          },
        }),
      });
      
      const data = await res.json();
      if (!res.ok || !data?.clientSecret) {
        setPaymentError(data?.error || 'Failed to initialize payment');
        return;
      }
      
      setClientSecret(data.clientSecret);
      setQuoteId(data.quoteId);
    } catch (e: any) {
      setPaymentError(e?.message || 'Failed to initialize payment');
    } finally {
      setPaymentLoading(false);
    }
  }, [
    clientSecret, paymentLoading, items, contact, vehicle, selectedStore,
    installFees, disposalFees, tax, tireCount
  ]);
  
  useEffect(() => {
    if (step === 'payment' && !clientSecret && !paymentLoading) {
      createPaymentIntent();
    }
  }, [step, clientSecret, paymentLoading, createPaymentIntent]);
  
  const handlePaymentSuccess = useCallback((paymentIntentId: string) => {
    clearCart();
    router.push(`/checkout/success?payment_intent=${paymentIntentId}&quote_id=${quoteId}`);
  }, [clearCart, router, quoteId]);
  
  // Empty cart
  if (!isHydrated || items.length === 0) {
    return (
      <div className="md:hidden min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="text-center">
          <span className="text-5xl mb-4 block">🛒</span>
          <h2 className="text-xl font-bold text-neutral-900">Your cart is empty</h2>
          <p className="text-sm text-neutral-500 mt-2">Add tires to get started</p>
          <button
            onClick={() => router.push('/tires')}
            className="mt-6 h-[52px] px-8 rounded-xl bg-green-600 text-white font-bold"
          >
            Shop Tires
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="md:hidden min-h-screen bg-neutral-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-4 py-4">
        <h1 className="text-2xl font-extrabold text-neutral-900 text-center">Checkout</h1>
        <StepIndicator currentStep={step} />
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1: REVIEW
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 'review' && (
          <>
            {/* Vehicle */}
            {vehicle && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <p className="text-sm text-green-700">Fitment for</p>
                <p className="text-base font-bold text-green-900">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
                <p className="text-sm text-green-700 mt-1">✔ Guaranteed bolt-on fit</p>
              </div>
            )}
            
            {/* Items */}
            <div className="space-y-3">
              {wheels.map((w) => (
                <MobileItemCard 
                  key={w.sku} 
                  item={w} 
                  type="wheel" 
                  onUpdateQty={(sku, qty) => updateQuantity(sku, 'wheel', qty)}
                  onRemove={removeItem}
                />
              ))}
              {tires.map((t) => (
                <MobileItemCard 
                  key={t.sku} 
                  item={t} 
                  type="tire" 
                  onUpdateQty={(sku, qty) => updateQuantity(sku, 'tire', qty)}
                  onRemove={removeItem}
                />
              ))}
              {accessories.map((a) => (
                <MobileItemCard 
                  key={a.sku} 
                  item={a} 
                  type="accessory" 
                  onUpdateQty={(sku, qty) => updateQuantity(sku, 'accessory', qty)}
                  onRemove={removeItem}
                />
              ))}
            </div>
            
            {/* Road hazard option */}
            {tires.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🛡️</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-900">Road Hazard Protection</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Cover damage from potholes, nails, and road debris
                    </p>
                    <p className="text-sm font-bold text-blue-900 mt-2">
                      ${(tireCount * 15).toFixed(2)} for {tireCount} tires
                    </p>
                  </div>
                  <button className="text-xs text-blue-600 font-medium underline">
                    Add
                  </button>
                </div>
              </div>
            )}
            
            {/* Trust bullets */}
            <div className="bg-neutral-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-neutral-700">
                <span className="text-green-600">✔</span>
                <span>Guaranteed fitment or we make it right</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-700">
                <span className="text-green-600">✔</span>
                <span>Professional installation included</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-700">
                <span className="text-green-600">✔</span>
                <span>Real support: 248-332-4120</span>
              </div>
            </div>
            
            {/* Order summary */}
            <CollapsibleOrderSummary
              subtotal={subtotal}
              installFees={installFees}
              disposalFees={disposalFees}
              tax={tax}
              total={total}
              itemCount={itemCount}
            />
          </>
        )}
        
        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2: DETAILS
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 'details' && (
          <>
            {/* Store selection */}
            <div>
              <h2 className="text-lg font-bold text-neutral-900 mb-3">
                🔧 Installation Location
              </h2>
              <div className="space-y-3">
                <StoreCard
                  storeId="pontiac"
                  isSelected={selectedStore === 'pontiac'}
                  onSelect={() => selectStore('pontiac')}
                />
                <StoreCard
                  storeId="waterford"
                  isSelected={selectedStore === 'waterford'}
                  onSelect={() => selectStore('waterford')}
                />
              </div>
              {!selectedStore && (
                <p className="text-sm text-red-600 mt-2">
                  ⚠️ Please select an installation location
                </p>
              )}
            </div>
            
            {/* Contact info */}
            <div className="bg-white rounded-xl p-4 border border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">
                Contact Information
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1 block">
                    First name *
                  </label>
                  <input
                    type="text"
                    value={contact.firstName}
                    onChange={(e) => setContact(p => ({ ...p, firstName: e.target.value }))}
                    className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1 block">
                    Last name *
                  </label>
                  <input
                    type="text"
                    value={contact.lastName}
                    onChange={(e) => setContact(p => ({ ...p, lastName: e.target.value }))}
                    className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1 block">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact(p => ({ ...p, email: e.target.value }))}
                    className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1 block">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => setContact(p => ({ ...p, phone: e.target.value }))}
                    className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                  />
                </div>
                
                {/* Billing address */}
                <div className="pt-3 border-t border-neutral-100">
                  <p className="text-sm font-medium text-neutral-700 mb-3">Billing Address</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1 block">
                    Street address *
                  </label>
                  <input
                    type="text"
                    value={contact.address}
                    onChange={(e) => setContact(p => ({ ...p, address: e.target.value }))}
                    className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1 block">
                    City *
                  </label>
                  <input
                    type="text"
                    value={contact.city}
                    onChange={(e) => setContact(p => ({ ...p, city: e.target.value }))}
                    className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-neutral-700 mb-1 block">
                      State
                    </label>
                    <input
                      type="text"
                      value="MI"
                      disabled
                      className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base bg-neutral-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-700 mb-1 block">
                      ZIP *
                    </label>
                    <input
                      type="text"
                      value={contact.zip}
                      onChange={(e) => setContact(p => ({ ...p, zip: e.target.value }))}
                      className="w-full h-12 rounded-xl border border-neutral-200 px-4 text-base"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Order summary (collapsed) */}
            <CollapsibleOrderSummary
              subtotal={subtotal}
              installFees={installFees}
              disposalFees={disposalFees}
              tax={tax}
              total={total}
              itemCount={itemCount}
            />
          </>
        )}
        
        {/* ══════════════════════════════════════════════════════════════════════
            STEP 3: PAYMENT
            ══════════════════════════════════════════════════════════════════════ */}
        {step === 'payment' && (
          <>
            {/* Payment options */}
            <div className="bg-white rounded-xl p-4 border border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">
                💳 Payment
              </h2>
              
              {/* BNPL teaser */}
              {total >= 50 && (
                <div className="bg-blue-50 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-blue-900">
                    Pay over time with Affirm, Klarna, or Afterpay
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    As low as ${Math.ceil(total / 12)}/mo • 0% APR available
                  </p>
                </div>
              )}
              
              {/* Payment loading */}
              {paymentLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-neutral-600">Loading payment...</span>
                  </div>
                </div>
              )}
              
              {/* Payment error */}
              {paymentError && (
                <div className="bg-red-50 rounded-xl p-4 mb-4 border border-red-200">
                  <p className="text-sm text-red-700">{paymentError}</p>
                </div>
              )}
              
              {/* Stripe Payment Element */}
              {clientSecret && (
                <StripePaymentElement
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  onError={(err) => setPaymentError(err)}
                  onProcessing={(p) => setProcessing(p)}
                  totalAmount={total}
                  returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/checkout/success?quote_id=${quoteId}`}
                />
              )}
            </div>
            
            {/* Install location summary */}
            {storeInfo && (
              <div className="bg-neutral-100 rounded-xl p-4">
                <p className="text-sm font-medium text-neutral-700">Installing at</p>
                <p className="text-base font-bold text-neutral-900">{storeInfo.name}</p>
                <p className="text-sm text-neutral-600">{storeInfo.address}</p>
              </div>
            )}
            
            {/* Order summary (collapsed) */}
            <CollapsibleOrderSummary
              subtotal={subtotal}
              installFees={installFees}
              disposalFees={disposalFees}
              tax={tax}
              total={total}
              itemCount={itemCount}
            />
          </>
        )}
      </div>
      
      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 md:hidden z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        {step === 'review' && (
          <button
            onClick={() => setStep('details')}
            className="w-full h-[52px] rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-base"
          >
            Secure Your Setup →
          </button>
        )}
        
        {step === 'details' && (
          <div className="space-y-2">
            <button
              onClick={() => setStep('payment')}
              disabled={!canProceedToPayment}
              className={`w-full h-[52px] rounded-xl font-bold text-base ${
                canProceedToPayment
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
              }`}
            >
              Continue to Payment
            </button>
            <button
              onClick={() => setStep('review')}
              className="w-full h-11 rounded-xl border border-neutral-200 text-neutral-700 font-medium text-sm"
            >
              ← Back
            </button>
          </div>
        )}
        
        {step === 'payment' && (
          <button
            onClick={() => {
              setStep('details');
              setClientSecret(null);
              setPaymentError(null);
            }}
            disabled={processing}
            className="w-full h-11 rounded-xl border border-neutral-200 text-neutral-700 font-medium text-sm disabled:opacity-50"
          >
            ← Back to Details
          </button>
        )}
      </div>
    </div>
  );
}

export default LocalMobileCheckout;
