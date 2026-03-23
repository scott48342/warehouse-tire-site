"use client";

import { useCart } from "@/lib/cart/CartContext";
import Link from "next/link";

/**
 * PackageSummary - Live package builder showing wheels + tires + accessories
 * 
 * Reads directly from cart state (source of truth).
 * Updates live when items change.
 */
export function PackageSummary({
  variant = "sidebar",
  showCheckout = true,
}: {
  variant?: "sidebar" | "compact" | "inline";
  showCheckout?: boolean;
}) {
  const {
    getWheels,
    getTires,
    getAccessories,
    getRequiredAccessories,
    getTotal,
    accessoryState,
  } = useCart();

  const wheels = getWheels();
  const tires = getTires();
  const accessories = getAccessories();
  const requiredAccessories = getRequiredAccessories();
  const total = getTotal();

  const hasPackage = wheels.length > 0;
  const isComplete = wheels.length > 0 && tires.length > 0;

  // Calculate subtotals (defensive: handle items with missing unitPrice/quantity)
  const wheelSubtotal = wheels.reduce((sum, w) => sum + (w.unitPrice ?? 0) * (w.quantity ?? 0), 0);
  const tireSubtotal = tires.reduce((sum, t) => sum + (t.unitPrice ?? 0) * (t.quantity ?? 0), 0);
  const accessorySubtotal = accessories.reduce((sum, a) => sum + (a.unitPrice ?? 0) * (a.quantity ?? 0), 0);

  // Log state changes for debugging
  console.log("[PackageSummary] State update:", {
    wheels: wheels.length,
    tires: tires.length,
    accessories: accessories.length,
    total,
    isComplete,
  });

  if (!hasPackage && variant !== "inline") {
    return null; // Don't show until wheels are added
  }

  // Compact variant for mobile/inline use
  if (variant === "compact") {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {wheels.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                <span className="text-green-600">✓</span> Wheels
              </span>
            )}
            {tires.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                <span className="text-green-600">✓</span> Tires
              </span>
            )}
            {accessories.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                <span className="text-green-600">✓</span> Accessories
              </span>
            )}
          </div>
          <div className="text-sm font-extrabold text-neutral-900">
            ${total.toFixed(2)}
          </div>
        </div>
      </div>
    );
  }

  // Inline variant for embedding in pages
  if (variant === "inline") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📦</span>
          <span className="text-sm font-extrabold text-green-900">Your Package</span>
          {isComplete && (
            <span className="ml-auto rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
              COMPLETE
            </span>
          )}
        </div>

        <div className="space-y-2">
          {/* Wheels */}
          {wheels.map((w) => (
            <div key={w.sku} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="font-semibold text-neutral-900">{w.quantity ?? 0}× {w.brand} {w.model}</span>
              </div>
              <span className="font-semibold text-neutral-700">${((w.unitPrice ?? 0) * (w.quantity ?? 0)).toFixed(0)}</span>
            </div>
          ))}

          {/* Tires */}
          {tires.map((t) => (
            <div key={t.sku} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="font-semibold text-neutral-900">{t.quantity ?? 0}× {t.brand} {t.model}</span>
              </div>
              <span className="font-semibold text-neutral-700">${((t.unitPrice ?? 0) * (t.quantity ?? 0)).toFixed(0)}</span>
            </div>
          ))}

          {/* Accessories */}
          {accessories.map((a) => (
            <div key={a.sku} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-neutral-700">
                  {a.quantity ?? 0}× {a.name}
                  {a.required && <span className="ml-1 text-[10px] text-green-700">(Required)</span>}
                </span>
              </div>
              <span className="text-neutral-600">${((a.unitPrice ?? 0) * (a.quantity ?? 0)).toFixed(0)}</span>
            </div>
          ))}

          {/* Missing items */}
          {wheels.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <span>○</span>
              <span>Select wheels</span>
            </div>
          )}
          {tires.length === 0 && wheels.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <span>○</span>
              <span>Select tires</span>
            </div>
          )}
        </div>

        {/* Total */}
        {total > 0 && (
          <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between">
            <span className="text-sm font-extrabold text-green-900">Package Total</span>
            <span className="text-lg font-extrabold text-green-900">${total.toFixed(2)}</span>
          </div>
        )}
      </div>
    );
  }

  // Full sidebar variant
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <span className="text-sm font-extrabold text-white">Your Package</span>
          </div>
          {isComplete ? (
            <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
              COMPLETE
            </span>
          ) : (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              BUILDING
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Wheels Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {wheels.length > 0 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 text-xs font-bold">1</span>
            )}
            <span className="text-xs font-extrabold text-neutral-900">WHEELS</span>
          </div>

          {wheels.length > 0 ? (
            wheels.map((w) => (
              <div key={w.sku} className="ml-7 rounded-lg bg-neutral-50 p-3">
                <div className="flex gap-3">
                  {w.imageUrl && (
                    <img src={w.imageUrl} alt={w.model} className="h-12 w-12 rounded-lg object-contain bg-white border border-neutral-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-neutral-600">{w.brand}</div>
                    <div className="text-sm font-extrabold text-neutral-900 truncate">{w.model}</div>
                    <div className="text-xs text-neutral-600">
                      {w.diameter && `${w.diameter}"`} {w.finish && `• ${w.finish}`}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{w.quantity ?? 0}× ${(w.unitPrice ?? 0).toFixed(2)}</span>
                  <span className="font-extrabold text-neutral-900">${((w.unitPrice ?? 0) * (w.quantity ?? 0)).toFixed(2)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="ml-7 rounded-lg border border-dashed border-neutral-200 p-3 text-center">
              <div className="text-xs text-neutral-500">No wheels selected</div>
              <Link href="/wheels" className="mt-1 inline-block text-xs font-semibold text-red-600 hover:underline">
                Browse wheels →
              </Link>
            </div>
          )}
        </div>

        {/* Tires Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {tires.length > 0 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 text-xs font-bold">2</span>
            )}
            <span className="text-xs font-extrabold text-neutral-900">TIRES</span>
          </div>

          {tires.length > 0 ? (
            tires.map((t) => (
              <div key={t.sku} className="ml-7 rounded-lg bg-neutral-50 p-3">
                <div className="flex gap-3">
                  {t.imageUrl && (
                    <img src={t.imageUrl} alt={t.model} className="h-12 w-12 rounded-lg object-contain bg-white border border-neutral-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-neutral-600">{t.brand}</div>
                    <div className="text-sm font-extrabold text-neutral-900 truncate">{t.model}</div>
                    <div className="text-xs text-neutral-600">{t.size}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{t.quantity ?? 0}× ${(t.unitPrice ?? 0).toFixed(2)}</span>
                  <span className="font-extrabold text-neutral-900">${((t.unitPrice ?? 0) * (t.quantity ?? 0)).toFixed(2)}</span>
                </div>
              </div>
            ))
          ) : wheels.length > 0 ? (
            <div className="ml-7 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-center">
              <div className="text-xs text-amber-700">Select tires to complete package</div>
            </div>
          ) : (
            <div className="ml-7 rounded-lg border border-dashed border-neutral-200 p-3 text-center">
              <div className="text-xs text-neutral-400">Add wheels first</div>
            </div>
          )}
        </div>

        {/* Accessories Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {accessories.length > 0 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
            ) : accessoryState ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 text-xs font-bold">—</span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 text-xs font-bold">3</span>
            )}
            <span className="text-xs font-extrabold text-neutral-900">ACCESSORIES</span>
            {requiredAccessories.length > 0 && (
              <span className="text-[10px] text-green-600 font-semibold">Auto-added</span>
            )}
          </div>

          {accessories.length > 0 ? (
            <div className="ml-7 space-y-2">
              {accessories.map((a) => (
                <div key={a.sku} className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                  <div>
                    <div className="text-xs font-semibold text-neutral-900">{a.name}</div>
                    <div className="text-[10px] text-neutral-600">
                      {a.quantity ?? 0}× ${(a.unitPrice ?? 0).toFixed(2)}
                      {a.required && <span className="ml-1 text-green-600">(Required)</span>}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-neutral-700">${((a.unitPrice ?? 0) * (a.quantity ?? 0)).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : wheels.length > 0 ? (
            <div className="ml-7 rounded-lg bg-neutral-50 px-3 py-2">
              <div className="text-xs text-neutral-500">
                {accessoryState?.lugNuts?.status === "skipped" && accessoryState?.hubRings?.status === "skipped"
                  ? "Vehicle data unavailable for auto-add"
                  : accessoryState?.hubRings?.status === "not_needed"
                    ? "Hub rings not needed (bore matches)"
                    : "Calculated with wheel selection"}
              </div>
            </div>
          ) : null}
        </div>

        {/* Subtotal Breakdown */}
        {total > 0 && (
          <div className="border-t border-neutral-100 pt-3 space-y-1">
            {wheelSubtotal > 0 && (
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Wheels</span>
                <span>${wheelSubtotal.toFixed(2)}</span>
              </div>
            )}
            {tireSubtotal > 0 && (
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Tires</span>
                <span>${tireSubtotal.toFixed(2)}</span>
              </div>
            )}
            {accessorySubtotal > 0 && (
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Accessories</span>
                <span>${accessorySubtotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* Total */}
        <div className="border-t border-neutral-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-neutral-900">Package Total</span>
            <span className="text-xl font-extrabold text-neutral-900">${total.toFixed(2)}</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Before tax & shipping
          </div>
        </div>

        {/* CTA */}
        {showCheckout && isComplete && (
          <Link
            href="/cart"
            className="block w-full rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-green-700 transition-colors"
          >
            Review Package →
          </Link>
        )}

        {showCheckout && !isComplete && wheels.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
            <div className="text-xs font-semibold text-amber-800">Select tires to complete your package</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact package indicator for headers/navbars
 */
export function PackageIndicator() {
  const { hasWheels, hasTires, getTotal } = useCart();
  const total = getTotal();

  if (!hasWheels()) return null;

  return (
    <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1">
      <span className="text-xs">📦</span>
      <span className="text-xs font-semibold text-green-800">
        {hasWheels() && hasTires() ? "Package Ready" : "Building..."}
      </span>
      {total > 0 && (
        <span className="text-xs font-bold text-green-900">${total.toFixed(0)}</span>
      )}
    </div>
  );
}
