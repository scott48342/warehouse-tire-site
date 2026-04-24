"use client";

import { useState, useEffect } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Load Stripe outside of component to avoid recreating on every render
let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error("[StripePaymentElement] Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
      return null;
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

interface PaymentFormProps {
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onProcessing: (isProcessing: boolean) => void;
  totalAmount: number;
  returnUrl: string;
}

function PaymentForm({ onSuccess, onError, onProcessing, totalAmount, returnUrl }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    onProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: "if_required",
      });

      if (error) {
        // Payment failed
        const message = error.message || "Payment failed. Please try again.";
        setErrorMessage(message);
        onError(message);
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Payment succeeded without redirect
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === "processing") {
        // Payment is processing (rare for cards, common for bank debits)
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === "requires_action") {
        // This shouldn't happen with redirect: "if_required", but handle it
        // The redirect will happen automatically
        console.log("[StripePaymentElement] requires_action - redirect should happen");
      }
    } catch (err: any) {
      const message = err?.message || "An unexpected error occurred";
      setErrorMessage(message);
      onError(message);
    } finally {
      setIsSubmitting(false);
      onProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement 
        options={{
          layout: "tabs",
          paymentMethodOrder: ["card"],
          business: {
            name: "Warehouse Tire Direct",
          },
        }}
      />
      
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!stripe || !elements || isSubmitting}
        className={`w-full h-14 rounded-xl font-extrabold text-white text-lg transition-colors ${
          isSubmitting || !stripe || !elements
            ? "bg-neutral-300 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          `Pay $${totalAmount.toFixed(2)}`
        )}
      </button>
      
      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Secured by Stripe</span>
      </div>
    </form>
  );
}

interface StripePaymentElementProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onProcessing: (isProcessing: boolean) => void;
  totalAmount: number;
  returnUrl: string;
}

export function StripePaymentElement({
  clientSecret,
  onSuccess,
  onError,
  onProcessing,
  totalAmount,
  returnUrl,
}: StripePaymentElementProps) {
  const [stripeLoaded, setStripeLoaded] = useState(false);
  
  useEffect(() => {
    const stripe = getStripe();
    if (stripe) {
      stripe.then((s) => {
        if (s) setStripeLoaded(true);
      });
    }
  }, []);

  const stripe = getStripe();
  
  if (!stripe) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Payment system not configured. Please contact support.
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-8 w-8 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#16a34a", // green-600
            colorBackground: "#ffffff",
            colorText: "#171717",
            colorDanger: "#dc2626",
            fontFamily: "system-ui, -apple-system, sans-serif",
            borderRadius: "12px",
            spacingUnit: "4px",
          },
          rules: {
            ".Tab": {
              border: "2px solid #e5e5e5",
              boxShadow: "none",
            },
            ".Tab:hover": {
              border: "2px solid #d4d4d4",
            },
            ".Tab--selected": {
              border: "2px solid #16a34a",
              backgroundColor: "#f0fdf4",
            },
            ".Input": {
              border: "2px solid #e5e5e5",
              boxShadow: "none",
            },
            ".Input:focus": {
              border: "2px solid #16a34a",
              boxShadow: "0 0 0 1px #16a34a",
            },
            ".Label": {
              fontWeight: "600",
            },
          },
        },
      }}
    >
      <PaymentForm
        onSuccess={onSuccess}
        onError={onError}
        onProcessing={onProcessing}
        totalAmount={totalAmount}
        returnUrl={returnUrl}
      />
    </Elements>
  );
}

export default StripePaymentElement;
