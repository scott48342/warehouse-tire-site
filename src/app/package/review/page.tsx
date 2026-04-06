"use client";

import Link from "next/link";
import { useCart, type CartWheelItem, type CartTireItem, type CartAccessoryItem } from "@/lib/cart/CartContext";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { PackageJourneyBar } from "@/components/PackageJourneyBar";
import { CheckoutTrustStrip, ReviewsMini } from "@/components/StoreReviews";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping/shippingService";
import { TPMSSuggestion } from "@/components/TPMSSuggestion";

/**
 * Review Package Page
 * 
 * Final step before checkout in the package builder flow.
 * Shows: vehicle confirmation, wheels, tires, accessories, fitment guarantee, pricing, CTAs
 * 
 * Cart is the single source of truth.
 */

const FITMENT_CLASS_INFO = {
  surefit: {
    label: "Guaranteed Fit",
    description: "These wheels are verified to fit your vehicle exactly. No modifications needed.",
    color: "green",
    icon: "✓",
  },
  specfit: {
    label: "Verified Fit",
    description: "These wheels fit your vehicle with standard specifications.",
    color: "blue",
    icon: "✓",
  },
  extended: {
    label: "Extended Fit",
    description: "These wheels may require minor modifications for optimal fitment.",
    color: "amber",
    icon: "⚡",
  },
} as const;

// ===== INDIVIDUAL COMPONENTS =====

function VehicleConfirmation({
  vehicle,
  fitmentClass,
}: {
  vehicle: { year: string; make: string; model: string; trim?: string };
  fitmentClass?: "surefit" | "specfit" | "extended";
}) {
  const fitmentInfo = fitmentClass ? FITMENT_CLASS_INFO[fitmentClass] : null;
  const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;

  return (
    <div className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-100 text-2xl">
          🚗
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-green-700">Your Vehicle</div>
          <h2 className="text-xl font-extrabold text-neutral-900">{vehicleStr}</h2>
          
          {fitmentInfo && (
            <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold
              ${fitmentInfo.color === "green" ? "bg-green-100 text-green-800" : ""}
              ${fitmentInfo.color === "blue" ? "bg-blue-100 text-blue-800" : ""}
              ${fitmentInfo.color === "amber" ? "bg-amber-100 text-amber-800" : ""}
            `}>
              <span>{fitmentInfo.icon}</span>
              <span>{fitmentInfo.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WheelItem({ item }: { item: CartWheelItem }) {
  const lineTotal = item.unitPrice * item.quantity;

  return (
    <div className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      {/* Image */}
      <div className="w-24 h-24 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.model} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-3xl">⚙️</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-500">{item.brand}</div>
        <h3 className="font-extrabold text-neutral-900">{item.model}</h3>
        {item.finish && <div className="text-sm text-neutral-600">{item.finish}</div>}
        
        <div className="mt-1 flex flex-wrap gap-2 text-sm text-neutral-600">
          {item.diameter && <span>{item.diameter}"</span>}
          {item.width && <span>× {item.width}"</span>}
          {item.boltPattern && <span>• {item.boltPattern}</span>}
          {item.offset && <span>• ET{item.offset}</span>}
        </div>
        
        {/* SKU / Part Number */}
        <div className="mt-0.5 text-xs text-neutral-400 font-mono">SKU: {item.sku}</div>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm text-neutral-500">Qty: {item.quantity}</div>
        <div className="font-extrabold text-neutral-900">${lineTotal.toFixed(2)}</div>
        {item.quantity > 1 && (
          <div className="text-xs text-neutral-500">${item.unitPrice.toFixed(2)} each</div>
        )}
      </div>
    </div>
  );
}

function TireItem({ item }: { item: CartTireItem }) {
  const lineTotal = item.unitPrice * item.quantity;
  
  // Build load/speed display (e.g., "102H")
  const loadSpeedDisplay = [item.loadIndex, item.speedRating].filter(Boolean).join("");

  return (
    <div className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      {/* Image */}
      <div className="w-24 h-24 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.model} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-3xl">🛞</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-500">{item.brand}</div>
        <h3 className="font-extrabold text-neutral-900">{item.model}</h3>
        
        {/* Tire size with load/speed rating */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-neutral-800">{item.size}</span>
          {loadSpeedDisplay ? (
            <span className="text-neutral-600">• {loadSpeedDisplay}</span>
          ) : null}
        </div>
        
        {item.staggered && item.rearSize && (
          <div className="text-sm text-neutral-500">Rear: {item.rearSize}</div>
        )}
        
        {/* SKU / Part Number */}
        <div className="mt-0.5 text-xs text-neutral-400 font-mono">SKU: {item.sku}</div>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm text-neutral-500">Qty: {item.quantity}</div>
        <div className="font-extrabold text-neutral-900">${lineTotal.toFixed(2)}</div>
        {item.quantity > 1 && (
          <div className="text-xs text-neutral-500">${item.unitPrice.toFixed(2)} each</div>
        )}
      </div>
    </div>
  );
}

function AccessoryItem({ item }: { item: CartAccessoryItem }) {
  const lineTotal = item.unitPrice * item.quantity;
  const isRequired = item.required;

  // Icon based on category
  const iconMap: Record<string, string> = {
    lug_nut: "🔩",
    lug_bolt: "🔩",
    hub_ring: "⭕",
    valve_stem: "🔘",
    tpms: "📡",
  };
  const icon = iconMap[item.category] || "🔧";

  // Format spec for display
  const specDisplay = item.spec 
    ? [
        item.spec.threadSize,
        item.spec.seatType,
        item.spec.outerDiameter && item.spec.innerDiameter 
          ? `${item.spec.outerDiameter}/${item.spec.innerDiameter}mm`
          : null,
      ].filter(Boolean).join(" • ")
    : null;

  return (
    <div className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      {/* Icon */}
      <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-neutral-100 flex items-center justify-center text-xl">
        {icon}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-neutral-900">{item.name}</h3>
          {isRequired && (
            <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              Required
            </span>
          )}
        </div>
        {specDisplay && (
          <div className="text-sm text-neutral-600">{specDisplay}</div>
        )}
        
        {/* SKU / Part Number */}
        <div className="mt-0.5 text-xs text-neutral-400 font-mono">SKU: {item.sku}</div>
        
        {item.reason && (
          <div className="text-xs text-neutral-500 mt-0.5">{item.reason}</div>
        )}
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm text-neutral-500">Qty: {item.quantity}</div>
        <div className="font-extrabold text-neutral-900">
          {lineTotal === 0 ? "Included" : `$${lineTotal.toFixed(2)}`}
        </div>
      </div>
    </div>
  );
}

function FitmentGuarantee({ fitmentClass }: { fitmentClass?: "surefit" | "specfit" | "extended" }) {
  const fitmentInfo = fitmentClass ? FITMENT_CLASS_INFO[fitmentClass] : null;
  const description = fitmentInfo?.description || 
    "All items in this package have been verified to fit your vehicle.";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white text-xl">
          ✓
        </div>
        <div className="flex-1">
          <h3 className="font-extrabold text-green-900">Fitment Guarantee</h3>
          <p className="mt-1 text-sm text-green-800">{description}</p>
          <p className="mt-2 text-xs text-green-700">
            If there's ever a fitment issue, we'll make it right — guaranteed.
          </p>
        </div>
      </div>
    </div>
  );
}

function PricingBreakdown({
  wheelSubtotal,
  tireSubtotal,
  accessorySubtotal,
  total,
}: {
  wheelSubtotal: number;
  tireSubtotal: number;
  accessorySubtotal: number;
  total: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h3 className="text-lg font-bold text-neutral-900 mb-4">Price Breakdown</h3>

      <div className="space-y-3 text-sm">
        {wheelSubtotal > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-600">Wheels</span>
            <span className="font-semibold text-neutral-900">${wheelSubtotal.toFixed(2)}</span>
          </div>
        )}
        {tireSubtotal > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-600">Tires</span>
            <span className="font-semibold text-neutral-900">${tireSubtotal.toFixed(2)}</span>
          </div>
        )}
        {accessorySubtotal > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-600">Accessories</span>
            <span className="font-semibold text-neutral-900">${accessorySubtotal.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between pt-3 border-t border-neutral-100">
          <span className="text-neutral-600">Shipping</span>
          {total >= FREE_SHIPPING_THRESHOLD ? (
            <span className="font-bold text-green-700">FREE</span>
          ) : (
            <span className="text-neutral-500 text-xs">Calculated at checkout</span>
          )}
        </div>
        {total < FREE_SHIPPING_THRESHOLD && (
          <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">
            Add ${(FREE_SHIPPING_THRESHOLD - total).toFixed(0)} more for free shipping
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-neutral-600">Tax</span>
          <span className="text-neutral-500 text-xs">Calculated at checkout</span>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-neutral-200">
          <span className="text-lg font-bold text-neutral-900">Package Total</span>
          <span className="text-2xl font-extrabold text-neutral-900">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function ActionButtons({ 
  onSchedule, 
  hasVehicle,
  isComplete,
}: { 
  onSchedule: () => void;
  hasVehicle: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Primary CTA: Proceed to Checkout */}
      <Link
        href="/checkout"
        className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-extrabold transition
          ${isComplete 
            ? "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/25" 
            : "bg-neutral-200 text-neutral-500 cursor-not-allowed pointer-events-none"
          }
        `}
      >
        <span className="text-xl">🛒</span>
        <span>Proceed to Checkout</span>
      </Link>

      {!isComplete && (
        <p className="text-center text-sm text-amber-600 font-medium">
          Add wheels and tires to complete your package
        </p>
      )}
    </div>
  );
}

function TrustSection() {
  return (
    <div className="space-y-4">
      {/* Store Reviews Trust Strip */}
      <CheckoutTrustStrip />
      
      {/* Service Guarantees */}
      <div className="rounded-xl bg-neutral-50 p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>Free shipping over ${FREE_SHIPPING_THRESHOLD.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>Most packages qualify for free shipping</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>Ships mounted & balanced</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>30-day hassle-free returns</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>Expert support: {BRAND.phone.callDisplay}</span>
        </div>
      </div>
      
      {/* Customer Reviews */}
      <ReviewsMini count={2} />
    </div>
  );
}

// ===== EMPTY STATE =====

function EmptyPackage() {
  return (
    <main className="bg-neutral-50 min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-extrabold text-neutral-900">Review Package</h1>
        
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-xl font-bold text-neutral-900">Your package is empty</h2>
          <p className="mt-2 text-neutral-600">
            Start by selecting your vehicle and adding wheels to build your package.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/wheels"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-6 text-sm font-extrabold text-white hover:bg-green-700"
            >
              Shop Wheels
            </Link>
            <Link
              href="/tires"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-6 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              Shop Tires
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

// ===== INCOMPLETE PACKAGE (missing tires) =====

function IncompletePackage({
  wheels,
  accessories,
  vehicle,
  wheelSubtotal,
  accessorySubtotal,
}: {
  wheels: CartWheelItem[];
  accessories: CartAccessoryItem[];
  vehicle: CartWheelItem["vehicle"];
  wheelSubtotal: number;
  accessorySubtotal: number;
}) {
  // Build tires URL with vehicle + wheel context
  const tiresParams = new URLSearchParams();
  if (vehicle) {
    tiresParams.set("year", vehicle.year);
    tiresParams.set("make", vehicle.make);
    tiresParams.set("model", vehicle.model);
    if (vehicle.trim) tiresParams.set("trim", vehicle.trim);
    if (vehicle.modification) tiresParams.set("modification", vehicle.modification);
  }
  if (wheels[0]) {
    tiresParams.set("wheelSku", wheels[0].sku);
    if (wheels[0].diameter) tiresParams.set("wheelDia", wheels[0].diameter);
  }

  return (
    <main className="bg-neutral-50 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <span>Step 1 ✓</span>
            <span>→</span>
            <span className="font-bold text-amber-600">Step 2: Add Tires</span>
            <span>→</span>
            <span className="text-neutral-400">Review</span>
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-900">Almost There!</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Vehicle Confirmation */}
            {vehicle && (
              <VehicleConfirmation 
                vehicle={vehicle} 
                fitmentClass={wheels[0]?.fitmentClass}
              />
            )}

            {/* What you have */}
            <div>
              <h2 className="text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span className="text-green-600">✓</span> Wheels Selected
              </h2>
              <div className="space-y-3">
                {wheels.map((wheel) => (
                  <WheelItem key={wheel.sku} item={wheel} />
                ))}
              </div>
            </div>

            {/* Auto-added accessories */}
            {accessories.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <span className="text-green-600">✓</span> Accessories
                </h2>
                <div className="space-y-3">
                  {accessories.map((acc) => (
                    <AccessoryItem key={acc.sku} item={acc} />
                  ))}
                </div>
              </div>
            )}

            {/* CTA to add tires */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-200 p-6">
              <div className="flex items-start gap-4">
                <span className="text-4xl">🛞</span>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-amber-900">Add Matching Tires</h3>
                  <p className="mt-1 text-sm text-amber-800">
                    Complete your package with tires that fit your new wheels.
                    We'll show you sizes that match perfectly.
                  </p>
                  <Link
                    href={`/tires?${tiresParams.toString()}`}
                    className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-amber-600 px-8 text-sm font-extrabold text-white hover:bg-amber-700 shadow-lg shadow-amber-600/25"
                  >
                    Select Tires →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <PricingBreakdown
              wheelSubtotal={wheelSubtotal}
              tireSubtotal={0}
              accessorySubtotal={accessorySubtotal}
              total={wheelSubtotal + accessorySubtotal}
            />
            
            <div className="text-center text-sm text-neutral-500">
              Add tires to complete your package and unlock scheduling
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ===== MAIN PAGE COMPONENT =====

export default function ReviewPackagePage() {
  const router = useRouter();
  const {
    items,
    getWheels,
    getTires,
    getAccessories,
    getTotal,
    hasWheels,
    hasTires,
  } = useCart();

  const wheels = getWheels();
  const tires = getTires();
  const accessories = getAccessories();
  const total = getTotal();

  // Extract vehicle from first wheel (source of truth)
  const vehicle = wheels[0]?.vehicle || tires[0]?.vehicle;
  const fitmentClass = wheels[0]?.fitmentClass;

  // Calculate subtotals
  const wheelSubtotal = wheels.reduce((sum, w) => sum + w.unitPrice * w.quantity, 0);
  const tireSubtotal = tires.reduce((sum, t) => sum + t.unitPrice * t.quantity, 0);
  const accessorySubtotal = accessories.reduce((sum, a) => sum + a.unitPrice * a.quantity, 0);

  const isComplete = hasWheels() && hasTires();

  // Handler for schedule install button
  const handleScheduleInstall = () => {
    // Build URL params for schedule page
    const params = new URLSearchParams();
    if (vehicle) {
      params.set("year", vehicle.year);
      params.set("make", vehicle.make);
      params.set("model", vehicle.model);
      if (vehicle.trim) params.set("trim", vehicle.trim);
    }
    params.set("packageTotal", total.toFixed(2));
    
    router.push(`/schedule?${params.toString()}`);
  };

  // Empty state
  if (!hasWheels() && !hasTires()) {
    return <EmptyPackage />;
  }

  // Incomplete state (wheels but no tires)
  if (hasWheels() && !hasTires()) {
    return (
      <IncompletePackage
        wheels={wheels}
        accessories={accessories}
        vehicle={vehicle}
        wheelSubtotal={wheelSubtotal}
        accessorySubtotal={accessorySubtotal}
      />
    );
  }

  // Complete package view
  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Package Journey Bar */}
      <PackageJourneyBar
        currentStep="review"
        vehicle={vehicle ? {
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
        } : null}
      />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-neutral-900">Review Your Package</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Vehicle Confirmation */}
            {vehicle && (
              <VehicleConfirmation 
                vehicle={vehicle} 
                fitmentClass={fitmentClass}
              />
            )}

            {/* Wheels Section */}
            <div>
              <h2 className="text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span className="text-green-600">✓</span> Wheels
              </h2>
              <div className="space-y-3">
                {wheels.map((wheel) => (
                  <WheelItem key={wheel.sku} item={wheel} />
                ))}
              </div>
            </div>

            {/* Tires Section */}
            <div>
              <h2 className="text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
                <span className="text-green-600">✓</span> Tires
              </h2>
              <div className="space-y-3">
                {tires.map((tire) => (
                  <TireItem key={tire.sku} item={tire} />
                ))}
              </div>
            </div>

            {/* Accessories Section */}
            {accessories.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <span className="text-green-600">✓</span> Accessories
                  <span className="text-xs font-normal text-neutral-500">(included for proper fitment)</span>
                </h2>
                <div className="space-y-3">
                  {accessories.map((accessory) => (
                    <AccessoryItem key={accessory.sku} item={accessory} />
                  ))}
                </div>
              </div>
            )}

            {/* TPMS Suggestion (if not already in accessories) */}
            {!accessories.some(a => a.category === "tpms") && vehicle && (
              <TPMSSuggestion
                vehicleYear={vehicle.year}
                vehicleMake={vehicle.make}
                vehicleModel={vehicle.model}
                context="package"
              />
            )}

            {/* Missing accessories warning (if no accessories at all) */}
            {accessories.length === 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-amber-600">⚠️</span>
                  <div className="text-sm text-amber-800">
                    <strong>No accessories detected.</strong> Your local installer can advise if additional 
                    hardware (lug nuts, hub rings) is needed for your vehicle.
                  </div>
                </div>
              </div>
            )}

            {/* Fitment Guarantee */}
            <FitmentGuarantee fitmentClass={fitmentClass} />
          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <PricingBreakdown
              wheelSubtotal={wheelSubtotal}
              tireSubtotal={tireSubtotal}
              accessorySubtotal={accessorySubtotal}
              total={total}
            />

            <ActionButtons
              onSchedule={handleScheduleInstall}
              hasVehicle={!!vehicle}
              isComplete={isComplete}
            />

            <TrustSection />

            {/* Edit link */}
            <div className="text-center">
              <Link 
                href="/cart"
                className="text-sm text-neutral-600 hover:text-neutral-900 font-medium underline"
              >
                Edit items in cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
