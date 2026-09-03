"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartWheelItem, type CartTireItem, type CartAccessoryItem } from "@/lib/cart/CartContext";
import { validatePackage, verifyTotalMatch } from "@/lib/package/validation";
import { getFitmentMessaging, getFitmentColors, type FitmentClass } from "@/lib/package/fitment";
import { BRAND } from "@/lib/brand";
import { normalizeTireSize } from "@/lib/productFormat";
import { isCommercialTireSize } from "@/lib/localPricing";
import { US_STATES } from "@/lib/geo/usStates";
import { useCartTracking, getCartId } from "@/lib/cart/useCartTracking";
import { calculateShipping, isOversizedTireSize, type ShippingItem } from "@/lib/shipping/shippingService";
import { CheckoutTrustStrip } from "@/components/StoreReviews";
import { CheckoutTrustBadges } from "@/components/trust/TrustSignals";
import { TPMSSuggestion } from "@/components/TPMSSuggestion";
import { RoadHazardProtection } from "@/components/RoadHazardProtection";
import { useShopContext, LocalOnly } from "@/contexts/ShopContextProvider";
import { StoreSelector, StoreInfoCard } from "@/components/local";
import { StripePaymentElement } from "@/components/StripePaymentElement";
import { useDiscount } from "@/lib/discounts/DiscountContext";
import { InstallTimeIndicator } from "@/components/InstallTimeIndicator";
// Funnel analytics tracking (2026-04-26)
import { 
  trackBeginCheckout, 
  trackCheckoutStep2, 
  trackAddShippingInfo, 
  trackAddPaymentInfo 
} from "@/components/FunnelTracker";
import { ga4BeginCheckout } from "@/lib/ga4";
// Checkout diagnostics + cart recovery consent (2026-08-03 Phase 1)
import { logCheckoutDiagnostic } from "@/lib/checkout/diagnosticsClient";
import { CART_RECOVERY_CONSENT_WORDING } from "@/lib/cart/recoveryConsentWording";

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
    isHydrated,
    getWheels,
    getTires,
    getAccessories,
    getTotal,
    hasWheels,
    hasTires,
    clearCart,
    removeItem,
    updateQuantity,
    resumedFromQuoteId,
  } = useCart();
  
  // Shop context for local mode detection
  const { isLocal, selectedStore, storeInfo } = useShopContext();
  
  // Discount context
  const { activeDiscount, calculateDiscount, hasDiscount } = useDiscount();

  // Validate package
  const validation = validatePackage(items);
  const cartTotal = getTotal();

  // Verify totals match (important for integrity)
  // Compare against subtotal since we calculate shipping/tax/fees separately
  const totalCheck = verifyTotalMatch(cartTotal, validation.totals.subtotal);
  
  useEffect(() => {
    if (!totalCheck.matches) {
      console.warn("[Checkout] Total mismatch!", {
        cart: cartTotal,
        calculated: validation.totals.subtotal,
        diff: totalCheck.difference,
      });
    }
  }, [cartTotal, validation.totals.subtotal, totalCheck]);

  // Get items
  const wheels = getWheels();
  const tires = getTires();
  const accessories = getAccessories();

  // Get vehicle and fitment from cart
  const vehicle = wheels[0]?.vehicle || tires[0]?.vehicle;
  const fitmentClass = wheels[0]?.fitmentClass as FitmentClass | undefined;
  const fitmentMessaging = getFitmentMessaging(fitmentClass);
  const fitmentColors = getFitmentColors(fitmentClass);

  // Form state - single page checkout (no steps)
  const [mobileOrderSummaryOpen, setMobileOrderSummaryOpen] = useState(false);
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
  const [paymentCanceled, setPaymentCanceled] = useState(false);
  const [installSelectorExpanded, setInstallSelectorExpanded] = useState(false);

  // ═══ CART RECOVERY CONSENT (2026-08-03) ═══
  // Dedicated opt-in for cart-save/reminder emails. Does NOT subscribe the
  // customer to marketing. Unchecked by default (explicit consent).
  const [recoveryConsent, setRecoveryConsent] = useState(false);
  const lastConsentSyncRef = useRef<string>("");

  // ═══ CHECKOUT DIAGNOSTICS (2026-08-03) ═══
  // Tracks the furthest step reached so exit events can attribute drop-off.
  const checkoutStepRef = useRef<string>("contact");
  const checkoutCompletedRef = useRef(false);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNNEL TRACKING
  // Track begin_checkout when cart is ready (must wait for hydration)
  // ═══════════════════════════════════════════════════════════════════════════
  const checkoutTracked = useRef(false);
  useEffect(() => {
    // Wait for cart to load from localStorage
    if (!isHydrated) return;
    // Only track once per page load
    if (checkoutTracked.current) return;
    // Only track if cart has items
    if (items.length > 0) {
      checkoutTracked.current = true;
      trackBeginCheckout(cartTotal);
      logCheckoutDiagnostic({ eventType: "checkout_loaded", checkoutStep: "contact", status: "ok", detail: { itemCount: items.length } });

      // GA4 standard ecommerce event (additive; no-ops without gtag)
      ga4BeginCheckout({
        value: cartTotal,
        items: items
          .filter((it) => it.type === "tire" || it.type === "wheel")
          .map((it) => {
            const ti = it as { sku: string; brand?: string; model?: string; unitPrice: number; quantity: number; type: string };
            return {
              item_id: ti.sku,
              item_name: `${ti.brand ?? ""} ${ti.model ?? ""}`.trim() || ti.sku,
              item_brand: ti.brand,
              item_category: ti.type,
              price: ti.unitPrice,
              quantity: ti.quantity,
            };
          }),
      });
    }
  }, [isHydrated, items, cartTotal]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT STATE PERSISTENCE
  // Restore shipping info when returning from canceled payment
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Check if returning from canceled payment
    const params = new URLSearchParams(window.location.search);
    const canceled = params.get("canceled") === "1";
    
    if (canceled) {
      // Restore shipping info from sessionStorage
      try {
        const saved = sessionStorage.getItem("checkout_shipping");
        if (saved) {
          const parsed = JSON.parse(saved);
          setShipping(parsed);
          setPaymentCanceled(true);
          // Clean up URL
          window.history.replaceState({}, "", "/checkout");
        }
      } catch (e) {
        console.warn("[Checkout] Failed to restore shipping info:", e);
      }
    }
  }, []);

  // Save shipping info when form is filled (for payment cancel recovery)
  useEffect(() => {
    if (shipping.firstName && shipping.email) {
      try {
        sessionStorage.setItem("checkout_shipping", JSON.stringify(shipping));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [shipping]);
  
  // Default state to Michigan for local mode
  useEffect(() => {
    if (isLocal && !shipping.state) {
      setShipping((p) => ({ ...p, state: "MI" }));
    }
  }, [isLocal, shipping.state]);
  
  // Track when shipping info is filled (for funnel analytics)
  const shippingTracked = useRef(false);
  useEffect(() => {
    if (shippingTracked.current) return;
    if (shipping.firstName && shipping.email && shipping.address && shipping.city && shipping.state && shipping.zip) {
      shippingTracked.current = true;
      checkoutStepRef.current = "shipping";
      trackCheckoutStep2(cartTotal);
      trackAddShippingInfo(cartTotal);
    }
  }, [shipping, cartTotal]);

  // ═══ CART RECOVERY CONSENT SYNC (2026-08-03) ═══
  // Record/revoke the dedicated cart-recovery consent when the customer
  // checks/unchecks the box with a valid email. Debounced; dedupes on
  // (email + consent state) so we never spam the endpoint.
  useEffect(() => {
    const email = shipping.email.trim().toLowerCase();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) return;
    // Only sync revocation if we previously recorded consent for this email
    if (!recoveryConsent && !lastConsentSyncRef.current.startsWith(`${email}|true`)) return;

    const syncKey = `${email}|${recoveryConsent}`;
    if (lastConsentSyncRef.current === syncKey) return;

    const timeoutId = setTimeout(() => {
      lastConsentSyncRef.current = syncKey;
      fetch("/api/cart/recovery-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          cartId: getCartId(),
          sessionId: (() => { try { return sessionStorage.getItem("wt_session_id") || undefined; } catch { return undefined; } })(),
          consented: recoveryConsent,
          source: "checkout_checkbox",
        }),
        keepalive: true,
      }).catch(() => {
        // Allow retry on next change
        lastConsentSyncRef.current = "";
      });
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [recoveryConsent, shipping.email]);

  // ═══ CHECKOUT DIAGNOSTICS: exit + JS exception capture (2026-08-03) ═══
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      logCheckoutDiagnostic({
        eventType: "js_exception",
        checkoutStep: checkoutStepRef.current,
        status: "error",
        errorCode: e.message || "unknown_js_error",
        detail: { source: e.filename ? e.filename.split("/").pop() : undefined, line: e.lineno },
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      logCheckoutDiagnostic({
        eventType: "js_exception",
        checkoutStep: checkoutStepRef.current,
        status: "error",
        errorCode: String(e.reason?.message || e.reason || "unhandled_rejection"),
      });
    };
    const onPageHide = () => {
      if (checkoutCompletedRef.current) return;
      logCheckoutDiagnostic({
        eventType: "checkout_exit",
        checkoutStep: checkoutStepRef.current,
        status: "ok",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
  
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<"stripe" | "paypal">("stripe");
  
  // Embedded Payment Element state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // Tax rate based on shipping state (local mode: auto-apply Michigan 6%)
  const MICHIGAN_TAX_RATE = 0.06;
  const [taxRate, setTaxRate] = useState<number>(isLocal ? MICHIGAN_TAX_RATE : 0);
  const [taxLoading, setTaxLoading] = useState(false);

  // For local mode, always use Michigan tax
  // For national mode, fetch tax rate when shipping state changes
  useEffect(() => {
    if (isLocal) {
      setTaxRate(MICHIGAN_TAX_RATE);
      return;
    }
    
    if (!shipping.state || shipping.state.length !== 2) {
      setTaxRate(0);
      return;
    }

    setTaxLoading(true);
    fetch(`/api/tax?state=${encodeURIComponent(shipping.state)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && typeof data.taxRate === "number") {
          setTaxRate(data.taxRate);
        } else {
          setTaxRate(0);
          logCheckoutDiagnostic({ eventType: "tax_calc_result", checkoutStep: checkoutStepRef.current, status: "fail", endpoint: "/api/tax", errorCode: String(data?.error || "tax_lookup_failed") });
        }
      })
      .catch((err) => {
        setTaxRate(0);
        logCheckoutDiagnostic({ eventType: "tax_calc_result", checkoutStep: checkoutStepRef.current, status: "error", endpoint: "/api/tax", errorCode: String(err?.message || "tax_fetch_error") });
      })
      .finally(() => setTaxLoading(false));
  }, [isLocal, shipping.state]);

  // Calculate tax on taxable items (wheels + tires, not accessories)
  const taxableSubtotal = useMemo(() => {
    return items
      .filter((item) => item.type === "wheel" || item.type === "tire")
      .reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0);
  }, [items]);

  const calculatedTax = taxableSubtotal * taxRate;

  // Calculate shipping based on ZIP code and cart items
  const shippingItems: ShippingItem[] = useMemo(() => items.map((item) => ({
    type: item.type as "wheel" | "tire" | "accessory",
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice,
    // Wheel-1 landed-cost: freight baked in, no shipping charge
    freeShipping: (item as { freeShipping?: boolean }).freeShipping === true || undefined,
    // Tire size label for oversized/heavy detection (LT, flotation, large metric)
    sizeLabel: item.type === "tire" ? (item as { size?: string }).size : undefined,
  })), [items]);

  // Zone-based estimate (instant fallback)
  const zoneEstimate = useMemo(() => {
    return calculateShipping({
      zipCode: shipping.zip,
      items: shippingItems,
      subtotal: validation.totals.total,
    });
  }, [shippingItems, shipping.zip, validation.totals.total]);

  // Check if cart has heavy/oversized items that need FedEx lookup
  const needsFedExLookup = useMemo(() => {
    return shippingItems.some(item => {
      if (item.freeShipping) return false;
      if (item.type !== "tire") return false;
      return isOversizedTireSize(item.sizeLabel);
    });
  }, [shippingItems]);

  // Live FedEx rate for heavy items
  const [liveShippingRate, setLiveShippingRate] = useState<{
    amount: number | null;
    requiresQuote: boolean;
    quoteReason?: string;
    loading: boolean;
  }>({ amount: null, requiresQuote: false, loading: false });

  // Fetch live FedEx rate for heavy/oversized items
  useEffect(() => {
    if (isLocal) return;
    if (!needsFedExLookup) {
      setLiveShippingRate({ amount: null, requiresQuote: false, loading: false });
      return;
    }
    if (!shipping.zip || shipping.zip.length !== 5) return;

    const controller = new AbortController();
    setLiveShippingRate(prev => ({ ...prev, loading: true }));

    (async () => {
      try {
        const body = {
          zipCode: shipping.zip,
          stateCode: shipping.state,
          items: items.map(item => ({
            type: item.type,
            quantity: item.quantity || 1,
            sizeLabel: item.type === "tire" ? (item as { size?: string }).size : undefined,
            freeShipping: (item as { freeShipping?: boolean }).freeShipping === true || undefined,
            weightLbs: (item as { weightLbs?: number }).weightLbs,
            source: (item as { source?: string }).source,
            // Part number enables USAF branch-aware freight origin
            partNumber: (item as { sku?: string }).sku,
          })),
          subtotal: validation.totals.total,
        };
        const res = await fetch("/api/shipping/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.success && data.estimate) {
          setLiveShippingRate({
            amount: data.estimate.amount,
            requiresQuote: data.estimate.requiresQuote || false,
            quoteReason: data.estimate.quoteReason,
            loading: false,
          });
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[checkout] FedEx rate fetch failed:", err);
          setLiveShippingRate({ amount: null, requiresQuote: false, loading: false });
        }
      }
    })();

    return () => controller.abort();
  }, [isLocal, needsFedExLookup, shipping.zip, shipping.state, items, validation.totals.total]);

  // Final shipping estimate: use live FedEx rate for heavy items, zone estimate otherwise
  const shippingEstimate = useMemo(() => {
    if (liveShippingRate.requiresQuote) {
      return {
        ...zoneEstimate,
        amount: 0,
        displayAmount: "Call for Quote",
        requiresQuote: true,
        quoteReason: liveShippingRate.quoteReason,
      };
    }
    if (needsFedExLookup && liveShippingRate.amount !== null) {
      return {
        ...zoneEstimate,
        amount: liveShippingRate.amount,
        displayAmount: `$${liveShippingRate.amount}`,
        isEstimate: false,
      };
    }
    return zoneEstimate;
  }, [zoneEstimate, needsFedExLookup, liveShippingRate]);

  // Local mode: no shipping charges (delivery to store included)
  const shippingAmount = isLocal ? 0 : (shippingEstimate.isFree ? 0 : shippingEstimate.amount);

  // Diagnostics: log shipping calculation result once per ZIP (2026-08-03)
  const lastShippingZipLogged = useRef<string>("");
  useEffect(() => {
    if (isLocal) return;
    const zip = shipping.zip.trim();
    if (zip.length !== 5 || lastShippingZipLogged.current === zip) return;
    lastShippingZipLogged.current = zip;
    const failed = !shippingEstimate || (typeof shippingEstimate.amount !== "number") || Number.isNaN(shippingEstimate.amount);
    logCheckoutDiagnostic({
      eventType: "shipping_calc_result",
      checkoutStep: checkoutStepRef.current,
      status: failed ? "fail" : "ok",
      detail: { isFree: !!shippingEstimate?.isFree, amountKnown: !failed },
    });
  }, [isLocal, shipping.zip, shippingEstimate]);

  // Diagnostics: log client-side validation failures once per error set (2026-08-03)
  const lastValidationLogged = useRef<string>("");
  useEffect(() => {
    if (validation.errors.length === 0) return;
    const key = validation.errors.join("|");
    if (lastValidationLogged.current === key) return;
    lastValidationLogged.current = key;
    logCheckoutDiagnostic({
      eventType: "validation_failed",
      checkoutStep: checkoutStepRef.current,
      status: "fail",
      errorCode: "package_validation",
      detail: { errorCount: validation.errors.length },
    });
  }, [validation.errors]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL SERVICE FEES
  // ═══════════════════════════════════════════════════════════════════════════
  // Installation, disposal, and other local services (Warehouse Tire Pontiac)
  const LOCAL_FEES = {
    installPerTire: 20,      // Mount, balance, install per tire ($80/set of 4)
    installPerWheel: 15,     // Wheel-only install (no tire)
    disposalPerTire: 5,      // Tire recycling fee ($20/set of 4)
    // Commercial/medium-truck rates (19.5/22.5/24.5 rims, R-style sizes)
    commercialInstallPerTire: 40,
    commercialDisposalPerTire: 25,
  };
  
  // Card processing fee - REMOVED per business decision (2025-07-22)
  // Was 3.99% non-cash fee, now absorbed by business
  // const CARD_FEE_RATE = 0.0399;
  
  // Calculate local service fees
  const tireCount = tires.reduce((sum, t) => sum + t.quantity, 0);
  const wheelOnlyCount = hasWheels() && !hasTires() ? wheels.reduce((sum, w) => sum + w.quantity, 0) : 0;
  
  const localServiceFees = useMemo(() => {
    if (!isLocal) return { install: 0, disposal: 0, total: 0 };
    
    // Tire install includes mounting on wheel.
    // Commercial/medium-truck tires use commercial rates per tire.
    let installFee = wheelOnlyCount * LOCAL_FEES.installPerWheel;
    let disposalFee = 0;
    for (const t of tires) {
      const commercial = isCommercialTireSize(t.size);
      installFee += t.quantity * (commercial ? LOCAL_FEES.commercialInstallPerTire : LOCAL_FEES.installPerTire);
      disposalFee += t.quantity * (commercial ? LOCAL_FEES.commercialDisposalPerTire : LOCAL_FEES.disposalPerTire);
    }
    
    return {
      install: installFee,
      disposal: disposalFee,
      total: installFee + disposalFee,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal, tires, wheelOnlyCount]);

  // Card processing fee - REMOVED (absorbed by business)
  // Previously calculated 3.99% for local orders, now $0
  const cardProcessingFee = 0;

  // Calculate discount amount (if any)
  const discountAmount = calculateDiscount(validation.totals.subtotal);

  // Use subtotal + our own shipping/tax/fees calculation (validation.totals.total has shipping baked in)
  // Subtract discount from subtotal
  const totalWithTaxAndShipping = validation.totals.subtotal - discountAmount + calculatedTax + shippingAmount + localServiceFees.total + cardProcessingFee;

  // Prepare customer info for tracking (memoized to avoid re-renders)
  const customerInfo = useMemo(() => ({
    firstName: shipping.firstName || undefined,
    lastName: shipping.lastName || undefined,
    email: shipping.email || undefined,
    phone: shipping.phone || undefined,
  }), [shipping.firstName, shipping.lastName, shipping.email, shipping.phone]);

  // Track cart state on checkout page
  useCartTracking(items, {
    customer: customerInfo,
    isCheckout: true,
  });

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
          // Local mode: include install store for order routing
          ...(isLocal && selectedStore ? { installStore: selectedStore } : {}),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.approvalUrl) {
        setPaypalError(String(data?.error || data?.detail || "PayPal checkout failed"));
        logCheckoutDiagnostic({ eventType: "api_failure", checkoutStep: "payment", status: "fail", endpoint: "/api/paypal/create-order", httpStatus: res.status, errorCode: String(data?.error || "paypal_create_failed") });
        setProcessing(false);
        return;
      }

      // Store tracking data before redirect (retrieved by paypal-return page)
      const cartId = getCartId();
      if (cartId) {
        sessionStorage.setItem("wt_paypal_cart_id", cartId);
      }
      if (resumedFromQuoteId) {
        sessionStorage.setItem("wt_paypal_saved_quote_id", resumedFromQuoteId);
      }
      
      // Redirect to PayPal
      checkoutCompletedRef.current = true; // leaving intentionally for PayPal
      window.location.href = String(data.approvalUrl);
    } catch (e: any) {
      setPaypalError(e?.message || String(e));
      logCheckoutDiagnostic({ eventType: "api_failure", checkoutStep: "payment", status: "error", endpoint: "/api/paypal/create-order", errorCode: String(e?.message || "paypal_exception") });
      setProcessing(false);
    }
  }

  async function startStripeCheckout(options?: { forceAffirm?: boolean }) {
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
          cartId: getCartId(),
          // If cart was resumed from a saved quote, include for conversion tracking
          ...(resumedFromQuoteId ? { savedQuoteId: resumedFromQuoteId } : {}),
          // Force Affirm-only checkout
          ...(options?.forceAffirm ? { paymentMethod: "affirm" } : {}),
          // Local mode: include install store for order routing
          ...(isLocal && selectedStore ? { installStore: selectedStore } : {}),
          shipping: {
            address: shipping.address,
            address2: shipping.address2,
            city: shipping.city,
            state: shipping.state,
            zip: shipping.zip,
            amount: shippingAmount,
            isFree: shippingEstimate.isFree,
          },
          tax: {
            rate: taxRate,
            amount: calculatedTax,
            state: shipping.state,
          },
          // Local mode service fees
          ...(isLocal ? {
            localFees: {
              installation: localServiceFees.install,
              recycling: localServiceFees.disposal,
              cardProcessing: cardProcessingFee,
              tireCount,
            },
          } : {}),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        setStripeError(String(data?.error || data?.detail || "Stripe checkout failed"));
        logCheckoutDiagnostic({ eventType: "api_failure", checkoutStep: "payment", status: "fail", endpoint: "/api/stripe/create-checkout-session", httpStatus: res.status, errorCode: String(data?.error || "stripe_session_failed") });
        setProcessing(false);
        return;
      }

      // Redirect to Stripe Checkout
      checkoutCompletedRef.current = true; // leaving intentionally for Stripe
      window.location.href = String(data.url);
    } catch (e: any) {
      setStripeError(e?.message || String(e));
      logCheckoutDiagnostic({ eventType: "api_failure", checkoutStep: "payment", status: "error", endpoint: "/api/stripe/create-checkout-session", errorCode: String(e?.message || "stripe_session_exception") });
      setProcessing(false);
    }
  }

  // Create PaymentIntent for embedded Payment Element
  const createPaymentIntent = useCallback(async () => {
    // Skip if already created or loading
    if (clientSecret || paymentLoading) return;
    
    try {
      setPaymentLoading(true);
      setStripeError(null);

      const customer = {
        firstName: shipping.firstName,
        lastName: shipping.lastName,
        email: shipping.email,
        phone: shipping.phone,
      };

      const res = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items,
          customer,
          vehicle,
          cartId: getCartId(),
          // If cart was resumed from a saved quote, include for conversion tracking
          ...(resumedFromQuoteId ? { savedQuoteId: resumedFromQuoteId } : {}),
          ...(isLocal && selectedStore ? { installStore: selectedStore } : {}),
          shipping: {
            address: shipping.address,
            address2: shipping.address2,
            city: shipping.city,
            state: shipping.state,
            zip: shipping.zip,
            amount: shippingAmount,
            isFree: shippingEstimate.isFree,
          },
          tax: {
            rate: taxRate,
            amount: calculatedTax,
            state: shipping.state,
          },
          ...(isLocal ? {
            localFees: {
              installation: localServiceFees.install,
              recycling: localServiceFees.disposal,
              cardProcessing: cardProcessingFee,
              tireCount,
            },
          } : {}),
          // Include discount info if active (for purchase analytics)
          ...(hasDiscount && activeDiscount ? {
            discount: {
              code: activeDiscount.code,
              amount: discountAmount,
              type: activeDiscount.source,
            },
          } : {}),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.clientSecret) {
        setStripeError(String(data?.error || data?.detail || "Failed to initialize payment"));
        logCheckoutDiagnostic({ eventType: "payment_element_init", checkoutStep: "payment", status: "fail", endpoint: "/api/stripe/create-payment-intent", httpStatus: res.status, errorCode: String(data?.error || "payment_intent_failed") });
        return;
      }
      logCheckoutDiagnostic({ eventType: "payment_element_init", checkoutStep: "payment", status: "ok", endpoint: "/api/stripe/create-payment-intent" });

      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setQuoteId(data.quoteId);
    } catch (e: any) {
      setStripeError(e?.message || String(e));
      logCheckoutDiagnostic({ eventType: "payment_element_init", checkoutStep: "payment", status: "error", endpoint: "/api/stripe/create-payment-intent", errorCode: String(e?.message || "payment_intent_exception") });
    } finally {
      setPaymentLoading(false);
    }
  }, [
    clientSecret, paymentLoading, shipping, items, vehicle, isLocal, selectedStore,
    shippingAmount, shippingEstimate.isFree, taxRate, calculatedTax, 
    localServiceFees, cardProcessingFee, tireCount
  ]);

  // Check if shipping form is complete
  const isShippingComplete = Boolean(
    shipping.firstName && 
    shipping.lastName && 
    shipping.email && 
    shipping.phone && 
    shipping.address && 
    shipping.city && 
    shipping.state && 
    shipping.zip &&
    (!isLocal || selectedStore) // Local mode requires store selection
  );

  // Create PaymentIntent when shipping info is complete
  useEffect(() => {
    if (isShippingComplete && !clientSecret && !paymentLoading) {
      checkoutStepRef.current = "payment";
      createPaymentIntent();
      trackAddPaymentInfo(cartTotal);
    }
  }, [isShippingComplete, clientSecret, paymentLoading, createPaymentIntent, cartTotal]);

  // Handle successful payment
  const handlePaymentSuccess = useCallback((paymentIntentId: string) => {
    checkoutCompletedRef.current = true;
    logCheckoutDiagnostic({ eventType: "payment_succeeded", checkoutStep: "payment", status: "ok" });
    // Clear cart and redirect to success page
    clearCart();
    router.push(`/checkout/success?payment_intent=${paymentIntentId}&quote_id=${quoteId}`);
  }, [clearCart, router, quoteId]);

  // Handle payment error
  const handlePaymentError = useCallback((error: string) => {
    setStripeError(error);
    // Classify: declines are customer-side, everything else is provider/technical
    const declinePattern = /(declin|insufficient|card was|card_declined|expired_card|incorrect_cvc|incorrect_number|invalid.*(card|cvc|expir))/i;
    logCheckoutDiagnostic({
      eventType: declinePattern.test(error) ? "payment_declined" : "payment_provider_error",
      checkoutStep: "payment",
      status: "fail",
      errorCode: error,
    });
  }, []);

  // Handle processing state
  const handlePaymentProcessing = useCallback((isProcessing: boolean) => {
    setProcessing(isProcessing);
  }, []);

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
    <>
      {/* Single-page checkout for all devices */}
      <main className="bg-neutral-50 min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900">Checkout</h1>
            <p className="text-sm text-neutral-500 mt-1">Complete your order below</p>
          </div>
          <Link href="/cart" className="text-sm text-neutral-600 hover:text-neutral-900 underline">
            Edit cart
          </Link>
        </div>

        {/* Optional tire upsell - soft suggestion, not a warning */}
        {isIncomplete && (
          <div className="mb-6 rounded-xl bg-blue-50 border border-blue-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">🛞</span>
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Need tires too?</span>{" "}
                  <span className="text-blue-600">Save on shipping when you bundle.</span>
                </p>
              </div>
              <Link
                href="/tires"
                className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline whitespace-nowrap"
              >
                Add tires →
              </Link>
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Main Content - Single Page Checkout */}
          <div className="min-w-0 space-y-6">
            {/* Mobile Order Summary - Collapsible */}
            <div className="lg:hidden">
              <button
                onClick={() => setMobileOrderSummaryOpen(!mobileOrderSummaryOpen)}
                className="w-full flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🛒</span>
                  <span className="font-semibold text-neutral-900">
                    Order Summary ({wheels.length + tires.length + accessories.length} items)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-neutral-900">${totalWithTaxAndShipping.toFixed(2)}</span>
                  <svg 
                    className={`w-5 h-5 text-neutral-500 transition-transform ${mobileOrderSummaryOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {mobileOrderSummaryOpen && (
                <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
                  {wheels.map((w) => (
                    <div key={w.sku} className="flex gap-3">
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
                        {w.imageUrl ? (
                          <img src={w.imageUrl} alt={w.model} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-300">🛞</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{w.brand} {w.model}</p>
                        <p className="text-xs text-neutral-500">{w.diameter}{w.width ? `x${w.width}` : ''} • Qty: {w.quantity}</p>
                      </div>
                      <div className="text-sm font-semibold">${(w.unitPrice * w.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                  {tires.map((t) => (
                    <div key={t.sku} className="flex gap-3">
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
                        {t.imageUrl ? (
                          <img src={t.imageUrl} alt={t.model} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-300">🔘</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{t.brand} {t.model}</p>
                        <p className="text-xs text-neutral-500">{t.size} • Qty: {t.quantity}</p>
                      </div>
                      <div className="text-sm font-semibold">${(t.unitPrice * t.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                  {accessories.map((a) => (
                    <div key={a.sku} className="flex gap-3">
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden flex items-center justify-center text-neutral-300">
                        🔩
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{a.name}</p>
                        <p className="text-xs text-neutral-500">Qty: {a.quantity}</p>
                      </div>
                      <div className="text-sm font-semibold">${(a.unitPrice * a.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-neutral-100 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${totalWithTaxAndShipping.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle Confirmation */}
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
              </div>
            )}

            {/* Section 1: Contact Information */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 text-sm font-bold">1</span>
                Contact Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="First name *"
                  value={shipping.firstName}
                  onChange={(e) => setShipping((p) => ({ ...p, firstName: e.target.value }))}
                  className="h-12 rounded-xl border border-neutral-200 px-4 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
                <input
                  type="text"
                  placeholder="Last name *"
                  value={shipping.lastName}
                  onChange={(e) => setShipping((p) => ({ ...p, lastName: e.target.value }))}
                  className="h-12 rounded-xl border border-neutral-200 px-4 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={shipping.email}
                  onChange={(e) => setShipping((p) => ({ ...p, email: e.target.value }))}
                  className="h-12 rounded-xl border border-neutral-200 px-4 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
                <input
                  type="tel"
                  placeholder="Phone *"
                  value={shipping.phone}
                  onChange={(e) => setShipping((p) => ({ ...p, phone: e.target.value }))}
                  className="h-12 rounded-xl border border-neutral-200 px-4 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              {/* Cart recovery consent - SEPARATE from marketing (2026-08-03) */}
              <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recoveryConsent}
                  onChange={(e) => setRecoveryConsent(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-neutral-300 text-green-600 focus:ring-green-500/30 accent-green-600"
                />
                <span className="text-sm text-neutral-600 leading-snug">
                  {CART_RECOVERY_CONSENT_WORDING}
                </span>
              </label>
            </div>

            {/* Section 2: Shipping/Installation */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 text-sm font-bold">2</span>
                {isLocal ? "Installation Details" : "Billing & Shipping Address"}
              </h2>
              
              {/* FRAUD PREVENTION NOTICE - National orders only */}
              {!isLocal && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">📦 Shipping Policy:</span> For your protection, all orders ship to the billing address on file with your credit card.
                  </p>
                </div>
              )}
              
              {/* Local Mode: Compact Install Summary OR Expanded Selector */}
              {isLocal && (
                <div className="mb-4">
                  {selectedStore && !installSelectorExpanded ? (
                    /* Compact summary when store selected */
                    <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-xs text-neutral-500 mb-1">Installing at:</p>
                          <p className="font-bold text-neutral-900">{storeInfo?.name || "Warehouse Tire"}</p>
                          <p className="text-sm text-neutral-600">{storeInfo?.address}</p>
                          <div className="mt-2">
                            <InstallTimeIndicator variant="badge" />
                          </div>
                        </div>
                        <button
                          onClick={() => setInstallSelectorExpanded(true)}
                          className="text-sm text-green-700 hover:text-green-800 font-medium hover:underline whitespace-nowrap"
                        >
                          Change Location
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Expanded selector or no store selected */
                    <div>
                      <StoreSelector variant="cards" showHours={true} showPhone={true} />
                      {selectedStore && (
                        <button
                          onClick={() => setInstallSelectorExpanded(false)}
                          className="mt-3 text-sm text-neutral-600 hover:text-neutral-800 font-medium"
                        >
                          ← Collapse
                        </button>
                      )}
                      {!selectedStore && (
                        <p className="text-sm text-amber-600 mt-2 font-medium">
                          ⚠️ Please select an installation location
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Address Form */}
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Address *"
                  value={shipping.address}
                  onChange={(e) => setShipping((p) => ({ ...p, address: e.target.value }))}
                  className="h-12 rounded-xl border border-neutral-200 px-4 text-sm sm:col-span-2 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
                <input
                  type="text"
                  placeholder="Apt, suite, etc. (optional)"
                  value={shipping.address2}
                  onChange={(e) => setShipping((p) => ({ ...p, address2: e.target.value }))}
                  className="h-12 rounded-xl border border-neutral-200 px-4 text-sm sm:col-span-2 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
                <input
                  type="text"
                  placeholder="City *"
                  value={shipping.city}
                  onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
                  className="h-12 rounded-xl border border-neutral-200 px-4 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={shipping.state}
                    onChange={(e) => setShipping((p) => ({ ...p, state: e.target.value }))}
                    className="h-12 rounded-xl border border-neutral-200 px-3 text-sm focus:border-green-500"
                  >
                    <option value="">State *</option>
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="ZIP *"
                    value={shipping.zip}
                    onChange={(e) => setShipping((p) => ({ ...p, zip: e.target.value }))}
                    className="h-12 rounded-xl border border-neutral-200 px-4 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
              </div>

              {/* Billing = Shipping notice removed - address above IS the billing/shipping address */}
            </div>

            {/* LOCAL ONLY: Why Local Customers Choose Us - Conversion Section */}
            {isLocal && (
              <div className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50/50 p-5">
                <h3 className="text-lg font-bold text-green-900 mb-4">Why Local Customers Choose Us</h3>
                
                {/* Key Differentiators */}
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2.5 bg-white/60 rounded-lg px-3 py-2.5">
                    <span className="text-green-600 text-lg">✓</span>
                    <span className="text-sm font-medium text-green-900">Same-day installation available</span>
                  </div>
                  <div className="flex items-center gap-2.5 bg-white/60 rounded-lg px-3 py-2.5">
                    <span className="text-green-600 text-lg">✓</span>
                    <span className="text-sm font-medium text-green-900">No appointment needed</span>
                  </div>
                  <div className="flex items-center gap-2.5 bg-white/60 rounded-lg px-3 py-2.5">
                    <span className="text-green-600 text-lg">✓</span>
                    <span className="text-sm font-medium text-green-900">Walk-ins welcome</span>
                  </div>
                  <div className="flex items-center gap-2.5 bg-white/60 rounded-lg px-3 py-2.5">
                    <span className="text-green-600 text-lg">✓</span>
                    <span className="text-sm font-medium text-green-900">Real installed pricing upfront</span>
                  </div>
                </div>
                
                {/* Contact */}
                <div className="flex items-center gap-2 bg-white/80 rounded-lg px-4 py-3 mb-4">
                  <span className="text-xl">📞</span>
                  <div>
                    <span className="text-sm text-green-800">Questions before checkout?</span>{" "}
                    <a 
                      href={storeInfo ? `tel:${storeInfo.phone.replace(/\D/g, '')}` : BRAND.links.tel} 
                      className="font-bold text-green-700 hover:underline"
                    >
                      Call or text {storeInfo?.phone || BRAND.phone.callDisplay}
                    </a>
                  </div>
                </div>
                
                {/* FREE Lifetime Services - Matches Belle Tire/Discount Tire value prop */}
                <div className="border-t border-green-200/60 pt-3">
                  <p className="text-xs font-semibold text-green-800 mb-2">FREE Lifetime Services Included:</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-700">
                    <span className="flex items-center gap-1"><span className="text-green-600">✓</span> <strong>FREE lifetime rotations</strong></span>
                    <span className="flex items-center gap-1"><span className="text-green-600">✓</span> <strong>FREE lifetime balancing</strong></span>
                    <span className="flex items-center gap-1"><span className="text-green-600">✓</span> <strong>FREE flat repairs</strong></span>
                    <span className="flex items-center gap-1"><span className="text-green-600">✓</span> FREE air checks</span>
                  </div>
                </div>
              </div>
            )}

            {/* LOCAL ONLY: Financing Section */}
            {isLocal && totalWithTaxAndShipping > 200 && (
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5">
                <h3 className="text-lg font-bold text-blue-900 mb-3">Flexible Financing Options</h3>
                
                <div className="space-y-3">
                  {/* Affirm */}
                  <div className="flex items-center gap-3 bg-white/70 rounded-lg px-4 py-3">
                    <img src="/images/affirm-logo.png" alt="Affirm" className="h-6" />
                    <div className="flex-1">
                      <p className="font-bold text-blue-900">As low as ${Math.ceil(totalWithTaxAndShipping / 12)}/mo with Affirm</p>
                      <p className="text-sm text-blue-700">0% APR available • 3-36 month terms</p>
                    </div>
                    <a
                      href="https://www.affirm.com/apps/prequal"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Pre-qualify
                    </a>
                  </div>
                </div>
                
                <p className="text-xs text-blue-600 mt-3 text-center">
                  Pre-qualify with no impact to your credit score • Select financing in Payment below ↓
                </p>
              </div>
            )}

            {/* Section 3: Payment */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 text-sm font-bold">3</span>
                Payment
              </h2>

              {/* Form incomplete message */}
              {!isShippingComplete && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p>👆 Please complete your contact and {isLocal ? "installation" : "shipping"} information above to continue.</p>
                </div>
              )}

              {/* Payment options - only show when form is complete */}
              {isShippingComplete && (
                <div className="space-y-4">
                  {/* Canceled payment notice */}
                  {paymentCanceled && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      <p>👋 No problem! Choose a different payment option below.</p>
                    </div>
                  )}

                  {/* Error state */}
                  {stripeError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      <p>{stripeError}</p>
                    </div>
                  )}

                  {/* Buy Now Pay Later Options */}
                  {totalWithTaxAndShipping >= 50 && (
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-sm font-semibold text-neutral-700">Pay over time — 0% APR available</p>
                        <p className="text-xs text-neutral-500">As low as ${Math.ceil(totalWithTaxAndShipping / 12)}/mo</p>
                      </div>
                      
                      {/* Affirm */}
                      <button
                        onClick={() => startStripeCheckout({ forceAffirm: true })}
                        disabled={processing}
                        className={`w-full rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-left transition-all hover:border-blue-400 hover:shadow-md ${
                          processing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img src="/images/affirm-logo.png" alt="Affirm" className="h-7" />
                            <div>
                              <p className="font-semibold text-neutral-900">Pay with Affirm</p>
                              <p className="text-xs text-neutral-600">3-12 monthly payments</p>
                            </div>
                          </div>
                          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-medium">0% APR</span>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 border-t border-neutral-200"></div>
                    <span className="text-sm text-neutral-400 font-medium">or pay with card</span>
                    <div className="flex-1 border-t border-neutral-200"></div>
                  </div>

                  {/* Card Payment */}
                  <div className="space-y-4">
                    {/* Loading state */}
                    {paymentLoading && !clientSecret && (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-3">
                          <svg className="animate-spin h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-neutral-600">Loading payment form...</span>
                        </div>
                      </div>
                    )}

                    {/* Stripe Payment Element */}
                    {clientSecret && (
                      <StripePaymentElement
                        clientSecret={clientSecret}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onProcessing={handlePaymentProcessing}
                        totalAmount={totalWithTaxAndShipping}
                        returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/checkout/success?quote_id=${quoteId}`}
                      />
                    )}

                    {/* Card logos */}
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <img src="/images/cards/visa.svg" alt="Visa" className="h-5 object-contain opacity-60" />
                      <img src="/images/cards/mastercard.svg" alt="Mastercard" className="h-5 object-contain opacity-60" />
                      <img src="/images/cards/amex.svg" alt="Amex" className="h-5 object-contain opacity-60" />
                    </div>
                  </div>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 pt-2">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Secure checkout</span>
                    </div>
                    <span>•</span>
                    <span>256-bit encryption</span>
                  </div>
                </div>
              )}
            </div>

            {/* Help Line */}
            <div className="text-center text-sm text-neutral-500">
              Need help? <a href="tel:2483324120" className="font-semibold text-green-700 hover:underline">Call or text 248-332-4120</a>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="min-w-0 lg:sticky lg:top-24 h-fit space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              {/* Order Summary header - DESKTOP ONLY (mobile has collapsible at top) */}
              <h2 className="hidden lg:block text-lg font-bold text-neutral-900 mb-4">Order Summary</h2>

              {/* Cart Items - DESKTOP ONLY (mobile shows in collapsible dropdown) */}
              <div className="hidden lg:block space-y-3 mb-4 pb-4 border-b border-neutral-100">
                {wheels.map((wheel) => (
                  <div key={wheel.sku} className="flex gap-3">
                    <div className="w-14 h-14 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
                      {wheel.imageUrl ? (
                        <img src={wheel.imageUrl} alt={wheel.model} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">🛞</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-500">{wheel.brand}</p>
                      <p className="text-sm font-semibold text-neutral-900 truncate">{wheel.model}</p>
                      <p className="text-xs text-neutral-500">{wheel.diameter}{wheel.width ? `x${wheel.width}` : ''} • Qty: {wheel.quantity}</p>
                    </div>
                    <div className="text-sm font-semibold text-neutral-900">
                      ${(wheel.unitPrice * wheel.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
                {tires.map((tire) => (
                  <div key={tire.sku} className="flex gap-3">
                    <div className="w-14 h-14 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
                      {tire.imageUrl ? (
                        <img src={tire.imageUrl} alt={tire.model} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">🔘</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-500">{tire.brand}</p>
                      <p className="text-sm font-semibold text-neutral-900 truncate">{tire.model}</p>
                      <p className="text-xs text-neutral-500">{tire.size} • Qty: {tire.quantity}</p>
                      {/* Per-tire price visibility for local checkout */}
                      {isLocal && tire.quantity > 1 && (
                        <p className="text-[10px] text-neutral-400">${tire.unitPrice.toFixed(2)} per tire × {tire.quantity}</p>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-neutral-900">
                      ${(tire.unitPrice * tire.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
                {accessories.map((acc) => (
                  <div key={acc.sku} className="flex gap-3">
                    <div className="w-14 h-14 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden flex items-center justify-center text-neutral-300 text-xs">
                      🔩
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{acc.name}</p>
                      <p className="text-xs text-neutral-500">Qty: {acc.quantity}</p>
                    </div>
                    <div className="text-sm font-semibold text-neutral-900">
                      ${(acc.unitPrice * acc.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Road Hazard Protection - Local mode only, when tires in cart */}
              {isLocal && tires.length > 0 && (
                <div className="pt-3 border-t border-neutral-100">
                  <RoadHazardProtection 
                    tireCount={tireCount}
                    tireSubtotal={validation.totals.tireSubtotal}
                    context="checkout"
                  />
                </div>
              )}

              {/* Totals */}
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
                
                {/* First Order Discount */}
                {hasDiscount && (
                  <div className="flex justify-between items-center bg-green-50 -mx-2 px-2 py-2 rounded-lg">
                    <span className="flex items-center gap-1.5 text-green-700">
                      <span>🎉</span>
                      <span className="font-medium">First Order Savings ({activeDiscount?.discountPercent}%)</span>
                    </span>
                    <span className="font-bold text-green-700">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">
                    {isLocal ? "Store Delivery" : "Shipping"}
                  </span>
                  {isLocal ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-green-700">INCLUDED</span>
                    </div>
                  ) : shippingEstimate.isFree ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-green-700">FREE</span>
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                        Qualified!
                      </span>
                    </div>
                  ) : (
                    <span className="font-semibold">${shippingAmount.toFixed(2)}</span>
                  )}
                </div>
                {/* Local Professional Installation Package */}
                {isLocal && (localServiceFees.install > 0 || localServiceFees.disposal > 0) && (
                  <div className="rounded-lg border border-green-100 bg-green-50/50 p-3 -mx-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-neutral-800">Professional Installation Package</span>
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-[11px] text-green-700 flex items-center gap-1">
                            <span className="text-green-600">✓</span> Mounting & balancing
                          </p>
                          <p className="text-[11px] text-green-700 flex items-center gap-1">
                            <span className="text-green-600">✓</span> Tire recycling & disposal bundled
                          </p>
                          <p className="text-[11px] text-green-700 flex items-center gap-1">
                            <span className="text-green-600">✓</span> Same-day installation available
                          </p>
                          <p className="text-[11px] text-green-700 flex items-center gap-1">
                            <span className="text-green-600">✓</span> No appointment needed
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-neutral-900">
                        ${(localServiceFees.install + localServiceFees.disposal).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                {isLocal && cardProcessingFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">
                      Non-Cash Price
                    </span>
                    <span className="font-semibold">${cardProcessingFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Tax {isLocal ? "(MI)" : shipping.state ? `(${shipping.state})` : ""}
                  </span>
                  {taxLoading ? (
                    <span className="text-neutral-400 text-xs">Loading...</span>
                  ) : isLocal || shipping.state ? (
                    <span className="font-semibold">
                      {calculatedTax > 0 ? `$${calculatedTax.toFixed(2)}` : "$0.00"}
                    </span>
                  ) : (
                    <span className="text-neutral-500 text-xs">Select state</span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-neutral-900">Total</span>
                  <span className="text-2xl font-extrabold text-neutral-900">
                    ${totalWithTaxAndShipping.toFixed(2)}
                  </span>
                </div>
                {calculatedTax > 0 && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Includes ${calculatedTax.toFixed(2)} tax ({(taxRate * 100).toFixed(2)}%)
                  </p>
                )}
                
                {/* Local: Drive out installed today */}
                {isLocal && (
                  <div className="mt-3 py-2.5 px-3 -mx-1 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-sm font-bold text-green-800">
                      🚗 Drive out installed today for ${totalWithTaxAndShipping.toFixed(2)}
                    </p>
                  </div>
                )}
                
                {/* Value Framing */}
                <div className="mt-3 pt-3 border-t border-neutral-100 space-y-1">
                  <p className="text-xs text-green-600 font-medium">
                    ✔ Complete wheel & tire package — ready to install
                  </p>
                  <p className="text-xs text-green-600 font-medium">
                    ✔ Everything matched specifically for your vehicle
                  </p>
                  {vehicle && (
                    <p className="text-xs text-green-600 font-medium">
                      ✔ Fitment verified for your {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                  )}
                </div>
                {!totalCheck.matches && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Total verification pending (diff: ${totalCheck.difference.toFixed(2)})
                  </p>
                )}
              </div>
            </div>

            {/* Minimal trust line - LOCAL (conversion content moved to left column) */}
            {isLocal ? (
              <CheckoutTrustBadges className="py-2" />
            ) : (
              <>
                {/* National Mode: Keep existing trust strip */}
                <CheckoutTrustStrip />
                
                {/* National trust badges */}
                <div className="rounded-xl bg-neutral-50 p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-neutral-700">
                    <span className="text-green-600">✓</span>
                    <span>Secure checkout</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-700">
                    <span className="text-green-600">✓</span>
                    <span>Fast, reliable nationwide shipping</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-700">
                    <span className="text-green-600">✓</span>
                    <span>30-day returns</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-700">
                    <span className="text-green-600">✓</span>
                    <span>We can connect you with a trusted installer near you</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-700">
                    <span className="text-green-600">✓</span>
                    <span>Guaranteed fitment</span>
                  </div>
                </div>
                
                {/* Need help - National mode only */}
                <div className="text-center text-sm text-neutral-600">
                  Need help?{" "}
                  <a 
                    href={BRAND.links.tel} 
                    className="font-bold text-green-700 hover:underline"
                  >
                    {BRAND.phone.callDisplay}
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

// ===== Checkout Item Component =====

/**
 * Enhanced Checkout Item Component
 * Features:
 * - Remove button for all item types
 * - Quantity controls (wheels/tires: 4-5, accessories: flexible)
 * - Immediate total updates
 * - Visual feedback
 */
function CheckoutItem({
  item,
  type,
  onRemove,
  onQuantityChange,
}: {
  item: CartWheelItem | CartTireItem | CartAccessoryItem;
  type: "wheel" | "tire" | "accessory";
  onRemove: () => void;
  onQuantityChange: (newQty: number) => void;
}) {
  const lineTotal = item.unitPrice * item.quantity;
  
  // Quantity constraints
  // Wheels/tires: 4 (standard) or 5 (with spare), accessories: 1-99
  const minQty = type === "accessory" ? 1 : 4;
  const maxQty = type === "accessory" ? 99 : 5;
  const canDecrement = item.quantity > minQty;
  const canIncrement = item.quantity < maxQty;

  const QuantityControls = () => (
    <div className="flex items-center gap-1 mt-1">
      <button
        onClick={() => canDecrement && onQuantityChange(item.quantity - 1)}
        disabled={!canDecrement}
        className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors ${
          canDecrement
            ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
            : "bg-neutral-50 text-neutral-300 cursor-not-allowed"
        }`}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
      <button
        onClick={() => canIncrement && onQuantityChange(item.quantity + 1)}
        disabled={!canIncrement}
        className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors ${
          canIncrement
            ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
            : "bg-neutral-50 text-neutral-300 cursor-not-allowed"
        }`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );

  const RemoveButton = () => (
    <button
      onClick={onRemove}
      className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
    >
      Remove
    </button>
  );

  if (type === "wheel") {
    const wheel = item as CartWheelItem;
    return (
      <div className="flex gap-4 p-4 group">
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
          <QuantityControls />
        </div>
        <div className="text-right space-y-1">
          <div className="font-bold text-neutral-900">${lineTotal.toFixed(2)}</div>
          <div className="text-xs text-neutral-500">${wheel.unitPrice.toFixed(2)} each</div>
          <RemoveButton />
        </div>
      </div>
    );
  }

  if (type === "tire") {
    const tire = item as CartTireItem;
    return (
      <div className="flex gap-4 p-4 group">
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
          <div className="text-sm text-neutral-600">{normalizeTireSize(tire.size)}</div>
          <QuantityControls />
        </div>
        <div className="text-right space-y-1">
          <div className="font-bold text-neutral-900">${lineTotal.toFixed(2)}</div>
          <div className="text-xs text-neutral-500">${tire.unitPrice.toFixed(2)} each</div>
          <RemoveButton />
        </div>
      </div>
    );
  }

  // Accessory
  const acc = item as CartAccessoryItem;
  const isRequired = acc.required;
  
  return (
    <div className="flex gap-4 p-4 bg-neutral-50 group">
      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-neutral-200 flex items-center justify-center text-lg">
        {acc.category === "lug_nut" ? "🔩" : acc.category === "hub_ring" ? "⭕" : acc.category === "tpms" ? "📡" : "🔧"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-neutral-900 flex items-center gap-2">
          {acc.name}
          {isRequired && (
            <span className="text-[10px] uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Required</span>
          )}
        </div>
        {acc.spec?.threadSize && (
          <div className="text-xs text-neutral-500">{acc.spec.threadSize}</div>
        )}
        {!isRequired && <QuantityControls />}
        {isRequired && (
          <div className="text-xs text-neutral-400 mt-1">Qty: {acc.quantity} (required for fitment)</div>
        )}
      </div>
      <div className="text-right space-y-1">
        <div className="font-semibold text-neutral-900">
          {acc.unitPrice > 0 ? `$${lineTotal.toFixed(2)}` : "Included"}
        </div>
        {acc.unitPrice > 0 && (
          <div className="text-xs text-neutral-500">${acc.unitPrice.toFixed(2)} each</div>
        )}
        {!isRequired && <RemoveButton />}
      </div>
    </div>
  );
}
