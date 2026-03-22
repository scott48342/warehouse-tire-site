"use client";

import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart, type CartWheelItem, type CartTireItem } from "@/lib/cart/CartContext";
import { validatePackage } from "@/lib/package/validation";
import { getFitmentMessaging, getFitmentColors, type FitmentClass } from "@/lib/package/fitment";
import { useState, useEffect, Suspense } from "react";

/**
 * Schedule Install Page
 * 
 * Accepts package context from cart or URL params.
 * Pre-fills vehicle info and shows package summary.
 * 
 * URL Params (optional, for direct links):
 * - year, make, model, trim (vehicle)
 * - packageTotal (pre-calculated total)
 */

function SchedulePageContent() {
  const searchParams = useSearchParams();
  const {
    items,
    getWheels,
    getTires,
    getAccessories,
    getTotal,
    hasWheels,
    hasTires,
  } = useCart();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    zip: "",
    vehicle: "",
    preferredTime: "",
    notes: "",
  });

  // Get package info from cart
  const wheels = getWheels();
  const tires = getTires();
  const accessories = getAccessories();
  const validation = validatePackage(items);
  const cartTotal = getTotal();

  // Get vehicle from cart items or URL params
  const cartVehicle = wheels[0]?.vehicle || tires[0]?.vehicle;
  const urlVehicle = {
    year: searchParams.get("year") || "",
    make: searchParams.get("make") || "",
    model: searchParams.get("model") || "",
    trim: searchParams.get("trim") || "",
  };

  const vehicle = cartVehicle || (urlVehicle.year ? urlVehicle : null);
  const fitmentClass = wheels[0]?.fitmentClass as FitmentClass | undefined;
  const fitmentMessaging = getFitmentMessaging(fitmentClass);
  const fitmentColors = getFitmentColors(fitmentClass);

  // Pre-fill vehicle field
  useEffect(() => {
    if (vehicle && !formData.vehicle) {
      const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
      setFormData((prev) => ({ ...prev, vehicle: vehicleStr }));
    }
  }, [vehicle, formData.vehicle]);

  // Generate package summary for notes
  const generatePackageSummary = () => {
    const lines: string[] = [];
    
    if (wheels.length > 0) {
      wheels.forEach((w) => {
        lines.push(`Wheels: ${w.brand} ${w.model} ${w.diameter}" x ${w.width}" (x${w.quantity})`);
      });
    }
    
    if (tires.length > 0) {
      tires.forEach((t) => {
        lines.push(`Tires: ${t.brand} ${t.model} ${t.size} (x${t.quantity})`);
      });
    }
    
    if (accessories.length > 0) {
      lines.push(`Accessories: ${accessories.map((a) => a.name).join(", ")}`);
    }
    
    lines.push(`Package Total: $${cartTotal.toFixed(2)}`);
    
    return lines.join("\n");
  };

  // Build email body with package info
  const buildEmailBody = () => {
    const lines = [
      "Hi Warehouse Tire,",
      "",
      "I'd like to schedule an install.",
      "",
      `Name: ${formData.name}`,
      `Phone: ${formData.phone}`,
      `Email: ${formData.email}`,
      `ZIP: ${formData.zip}`,
      `Vehicle: ${formData.vehicle}`,
      `Preferred time: ${formData.preferredTime}`,
      "",
      "--- Package Details ---",
      generatePackageSummary(),
      "",
      `Notes: ${formData.notes}`,
    ];
    return lines.join("\n");
  };

  const hasPackage = hasWheels() || hasTires();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
        Schedule Your Install
      </h1>
      <p className="mt-2 text-neutral-700">
        Submit a request and we'll call or text you to confirm. If you'd rather
        do it now, call{" "}
        <a className="font-semibold underline" href={BRAND.links.tel}>
          {BRAND.phone.callDisplay}
        </a>{" "}
        or text{" "}
        <a className="font-semibold underline" href={BRAND.links.sms}>
          {BRAND.phone.textDisplay}
        </a>
        .
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Form */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Your Information</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name *"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              label="Phone *"
              placeholder="(248) 555-1234"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
            />
            <Input
              label="Email"
              placeholder="you@email.com"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            />
            <Input
              label="ZIP Code *"
              placeholder="48342"
              value={formData.zip}
              onChange={(e) => setFormData((p) => ({ ...p, zip: e.target.value }))}
            />
            <Input
              label="Vehicle"
              placeholder="2019 Ford F-150"
              value={formData.vehicle}
              onChange={(e) => setFormData((p) => ({ ...p, vehicle: e.target.value }))}
              className="sm:col-span-2"
              readOnly={!!vehicle}
            />
            <Input
              label="Preferred Time"
              placeholder="Tomorrow afternoon"
              value={formData.preferredTime}
              onChange={(e) => setFormData((p) => ({ ...p, preferredTime: e.target.value }))}
              className="sm:col-span-2"
            />
            <TextArea
              label="Notes"
              placeholder="Any special requests or questions..."
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              className="sm:col-span-2"
            />
          </div>

          {/* Validation warnings */}
          {validation.warnings.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="text-sm font-semibold text-amber-800 mb-1">Heads up:</div>
              <ul className="text-sm text-amber-700 space-y-1">
                {validation.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`mailto:${BRAND.email}?subject=${encodeURIComponent(
                `Install Request - ${formData.vehicle || "New Package"}`
              )}&body=${encodeURIComponent(buildEmailBody())}`}
              className="inline-flex items-center justify-center rounded-xl bg-green-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-green-700 shadow-lg shadow-green-600/25"
            >
              📧 Submit Request
            </a>
            <a
              href={BRAND.links.sms}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              💬 Text Us
            </a>
            <a
              href={BRAND.links.tel}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              📞 Call Now
            </a>
          </div>
        </div>

        {/* Package Summary Sidebar */}
        <div className="space-y-4">
          {hasPackage && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <h3 className="font-bold text-neutral-900 mb-3">Your Package</h3>

              {/* Vehicle */}
              {vehicle && (
                <div className="mb-3 rounded-lg bg-neutral-50 p-3 text-sm">
                  <div className="text-neutral-500 text-xs mb-1">Vehicle</div>
                  <div className="font-semibold text-neutral-900">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                    {vehicle.trim && ` ${vehicle.trim}`}
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="space-y-2 text-sm">
                {wheels.map((w) => (
                  <div key={w.sku} className="flex justify-between">
                    <span className="text-neutral-700">
                      {w.brand} {w.model} ×{w.quantity}
                    </span>
                    <span className="font-semibold">${(w.unitPrice * w.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {tires.map((t) => (
                  <div key={t.sku} className="flex justify-between">
                    <span className="text-neutral-700">
                      {t.brand} {t.model} ×{t.quantity}
                    </span>
                    <span className="font-semibold">${(t.unitPrice * t.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {accessories.map((a) => (
                  <div key={a.sku} className="flex justify-between">
                    <span className="text-neutral-700">
                      {a.name} ×{a.quantity}
                    </span>
                    <span className="font-semibold">${(a.unitPrice * a.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-neutral-200 flex justify-between">
                <span className="font-bold text-neutral-900">Total</span>
                <span className="font-extrabold text-neutral-900">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Fitment Guarantee */}
          {hasPackage && (
            <div className={`rounded-xl p-4 ${fitmentColors.bg} border ${fitmentColors.border}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{fitmentMessaging.icon}</span>
                <span className={`font-bold ${fitmentColors.text}`}>{fitmentMessaging.label}</span>
              </div>
              <p className={`text-sm ${fitmentColors.text}`}>
                {fitmentMessaging.installNote}
              </p>
            </div>
          )}

          {/* No package yet */}
          {!hasPackage && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-sm text-neutral-600 mb-3">
                No package selected yet.
              </p>
              <Link
                href="/wheels"
                className="text-sm font-bold text-green-700 hover:underline"
              >
                Build your package →
              </Link>
            </div>
          )}

          {/* What's included */}
          <div className="rounded-xl bg-neutral-50 p-4">
            <h4 className="font-bold text-neutral-800 text-sm mb-2">Professional Install Includes:</h4>
            <ul className="text-sm text-neutral-600 space-y-1">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Mount & balance
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> New valve stems
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> TPMS transfer
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Torque to spec
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Old tire disposal
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link href="/package/review" className="text-sm text-neutral-600 hover:text-neutral-900 underline">
          ← Back to package review
        </Link>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function SchedulePage() {
  return (
    <Suspense fallback={<SchedulePageSkeleton />}>
      <SchedulePageContent />
    </Suspense>
  );
}

function SchedulePageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="h-10 w-64 bg-neutral-200 rounded animate-pulse mb-4" />
      <div className="h-6 w-96 bg-neutral-200 rounded animate-pulse" />
    </div>
  );
}

// ===== Form Components =====

function Input({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`grid gap-1 ${className ?? ""}`}>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <input
        {...props}
        className={`h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 ${
          props.readOnly ? "bg-neutral-50 text-neutral-700" : ""
        }`}
      />
    </label>
  );
}

function TextArea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={`grid gap-1 ${className ?? ""}`}>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <textarea
        {...props}
        className="min-h-24 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
      />
    </label>
  );
}
