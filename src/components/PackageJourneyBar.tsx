"use client";

import { useCart } from "@/lib/cart/CartContext";

interface PackageJourneyBarProps {
  currentStep: "wheels" | "tires" | "review";
  vehicle?: {
    year: string;
    make: string;
    model: string;
  } | null;
  estimatedRange?: { min: number; max: number } | null;
}

export function PackageJourneyBar({
  currentStep,
  vehicle,
  estimatedRange,
}: PackageJourneyBarProps) {
  const { hasWheels, hasTires, getTotal } = useCart();

  const steps = [
    { id: "wheels", label: "Wheels", icon: "⚙️", complete: hasWheels() },
    { id: "tires", label: "Tires", icon: "🛞", complete: hasTires() },
    { id: "review", label: "Review", icon: "✓", complete: false },
  ] as const;

  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const cartTotal = getTotal();

  return (
    <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-2xl p-4 md:p-5 mb-6 shadow-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <h2 className="text-lg font-extrabold tracking-tight">BUILD YOUR PACKAGE</h2>
          </div>
          {vehicle && (
            <p className="text-sm text-neutral-400 mt-0.5">
              For your {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          )}
        </div>

        {/* Estimated/Current Total */}
        <div className="text-right">
          {cartTotal > 0 ? (
            <>
              <div className="text-xs text-neutral-400 uppercase tracking-wide">Current Total</div>
              <div className="text-xl font-extrabold text-green-400">
                ${cartTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </>
          ) : estimatedRange ? (
            <>
              <div className="text-xs text-neutral-400 uppercase tracking-wide">Estimated Total</div>
              <div className="text-lg font-bold text-neutral-300">
                ${estimatedRange.min.toLocaleString()} – ${estimatedRange.max.toLocaleString()}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between relative">
        {/* Connector Line (background) */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-neutral-700" />
        
        {/* Connector Line (progress) */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-green-500 transition-all duration-500"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isPast = idx < currentIndex || step.complete;
          const isFuture = idx > currentIndex && !step.complete;

          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-col items-center"
            >
              {/* Step Circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                  transition-all duration-300
                  ${isPast ? "bg-green-500 text-white" : ""}
                  ${isActive ? "bg-white text-neutral-900 ring-4 ring-white/30 scale-110" : ""}
                  ${isFuture ? "bg-neutral-700 text-neutral-400" : ""}
                `}
              >
                {isPast && !isActive ? "✓" : step.icon}
              </div>

              {/* Label */}
              <div
                className={`
                  mt-2 text-xs font-bold uppercase tracking-wide
                  ${isActive ? "text-white" : ""}
                  ${isPast && !isActive ? "text-green-400" : ""}
                  ${isFuture ? "text-neutral-500" : ""}
                `}
              >
                {step.label}
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute -bottom-1 w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Contextual Message */}
      <div className="mt-4 pt-3 border-t border-neutral-700">
        {currentStep === "wheels" && !hasWheels() && (
          <p className="text-sm text-neutral-400 text-center">
            👆 Select wheels to start building your package
          </p>
        )}
        {currentStep === "wheels" && hasWheels() && (
          <p className="text-sm text-green-400 text-center font-medium">
            ✓ Wheels selected! Add tires to complete your package.
          </p>
        )}
        {currentStep === "tires" && !hasTires() && (
          <p className="text-sm text-neutral-400 text-center">
            Choose tires that match your new wheels
          </p>
        )}
        {currentStep === "tires" && hasTires() && (
          <p className="text-sm text-green-400 text-center font-medium">
            ✓ Package complete! Ready for review.
          </p>
        )}
        {currentStep === "review" && (
          <p className="text-sm text-neutral-400 text-center">
            Review your package and schedule installation
          </p>
        )}
      </div>
    </div>
  );
}
