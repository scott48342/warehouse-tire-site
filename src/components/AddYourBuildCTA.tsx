"use client";

import Link from "next/link";
import { useState } from "react";

interface AddYourBuildCTAProps {
  /** Order ID to prefill in submission */
  orderId?: string;
  /** Vehicle info from order to prefill */
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  /** Products from order to prefill */
  products?: {
    wheelBrand?: string;
    wheelModel?: string;
    wheelDiameter?: string;
    tireBrand?: string;
    tireModel?: string;
    tireSize?: string;
  };
  /** Display variant */
  variant?: "banner" | "card" | "minimal";
  /** Allow dismissal */
  dismissible?: boolean;
  /** Incentive text (e.g., "Get 10% off your next order!") */
  incentive?: string;
}

/**
 * Call-to-action component encouraging customers to submit their build photos
 * Used on:
 * - Order confirmation page
 * - Post-purchase emails (future)
 * - Account dashboard
 */
export function AddYourBuildCTA({
  orderId,
  vehicle,
  products,
  variant = "card",
  dismissible = true,
  incentive,
}: AddYourBuildCTAProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Build URL with prefill params
  const buildUrl = new URL("/add-your-build", typeof window !== "undefined" ? window.location.origin : "");
  
  if (orderId) buildUrl.searchParams.set("orderId", orderId);
  if (vehicle?.year) buildUrl.searchParams.set("year", vehicle.year);
  if (vehicle?.make) buildUrl.searchParams.set("make", vehicle.make);
  if (vehicle?.model) buildUrl.searchParams.set("model", vehicle.model);
  if (vehicle?.trim) buildUrl.searchParams.set("trim", vehicle.trim);
  if (products?.wheelBrand) buildUrl.searchParams.set("wheelBrand", products.wheelBrand);
  if (products?.wheelModel) buildUrl.searchParams.set("wheelModel", products.wheelModel);
  if (products?.wheelDiameter) buildUrl.searchParams.set("wheelDiameter", products.wheelDiameter);
  if (products?.tireBrand) buildUrl.searchParams.set("tireBrand", products.tireBrand);
  if (products?.tireModel) buildUrl.searchParams.set("tireModel", products.tireModel);
  if (products?.tireSize) buildUrl.searchParams.set("tireSize", products.tireSize);

  // Banner variant - full width, prominent
  if (variant === "banner") {
    return (
      <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4">
        <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📸</span>
            <div>
              <div className="font-bold">Show off your new setup!</div>
              <div className="text-sm text-white/80">
                Submit photos of your build and get featured in our gallery
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={buildUrl.pathname + buildUrl.search}
              className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-bold text-amber-600 hover:bg-white/90 transition-colors"
            >
              Add Your Build →
            </Link>
            {dismissible && (
              <button
                onClick={() => setDismissed(true)}
                className="p-1 text-white/70 hover:text-white"
                aria-label="Dismiss"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Minimal variant - inline link style
  if (variant === "minimal") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span>📸</span>
        <span className="text-neutral-600">Got your build installed?</span>
        <Link
          href={buildUrl.pathname + buildUrl.search}
          className="font-medium text-amber-600 hover:text-amber-700 underline underline-offset-2"
        >
          Share it with us
        </Link>
      </div>
    );
  }

  // Card variant (default) - standalone card
  return (
    <div className="relative rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-sm"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
      
      {/* Incentive badge */}
      {incentive && (
        <div className="absolute -top-2 left-4 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
          🎁 {incentive}
        </div>
      )}
      
      <div className={`flex items-start gap-4 ${incentive ? "mt-2" : ""}`}>
        <div className="text-3xl">📸</div>
        <div className="flex-1">
          <h3 className="font-bold text-neutral-900 mb-1">
            Show Off Your Build!
          </h3>
          <p className="text-sm text-neutral-600 mb-3">
            Once your wheels and tires are installed, snap some photos and submit them to our build gallery. 
            Featured builds inspire thousands of other enthusiasts!
          </p>
          
          {/* What's included from order */}
          {(vehicle?.make || products?.wheelBrand) && (
            <div className="bg-white/60 rounded-xl px-3 py-2 text-xs text-neutral-600 mb-3">
              <span className="font-medium">We&apos;ll prefill:</span>{" "}
              {[
                vehicle?.year,
                vehicle?.make,
                vehicle?.model,
                products?.wheelBrand,
                products?.wheelModel,
              ].filter(Boolean).join(" • ")}
            </div>
          )}
          
          <Link
            href={buildUrl.pathname + buildUrl.search}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 transition-colors"
          >
            Add Your Build
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Simpler prompt for email templates (HTML)
 */
export function getAddYourBuildEmailHTML(orderId?: string): string {
  const url = `https://warehousetiredirect.com/add-your-build${orderId ? `?orderId=${orderId}` : ""}`;
  
  return `
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
      <div style="font-size: 32px; margin-bottom: 12px;">📸</div>
      <h3 style="color: white; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">
        Show Off Your Build!
      </h3>
      <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 16px 0;">
        Got your new wheels installed? Share photos and get featured in our gallery!
      </p>
      <a href="${url}" style="display: inline-block; background: white; color: #d97706; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        Submit Your Build →
      </a>
    </div>
  `;
}
