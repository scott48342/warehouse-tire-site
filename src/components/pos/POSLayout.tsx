"use client";

import { useRouter } from "next/navigation";
import { usePOS } from "./POSContext";
import { POSAdminPanel } from "./POSAdminPanel";

// ============================================================================
// POS Header - Minimal employee header
// ============================================================================

export function POSHeader() {
  const router = useRouter();
  const { reset, state, outTheDoorPrice, isComplete, toggleAdminPanel } = usePOS();
  
  const handleNewQuote = () => {
    reset();
    router.push("/pos");
  };
  
  return (
    <header className="sticky top-0 z-50 bg-neutral-900 border-b border-neutral-800">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo / Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛞</span>
              <div>
                <h1 className="text-lg font-bold text-white">Warehouse Tire Direct</h1>
                <p className="text-xs text-neutral-400">In-Store Sales Mode</p>
              </div>
            </div>
          </div>
          
          {/* Vehicle + Build badge */}
          {state.vehicle && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
              <span className="text-sm text-neutral-300">
                {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}
              </span>
              {state.vehicle.trim && (
                <span className="text-xs text-neutral-500">{state.vehicle.trim}</span>
              )}
              {state.buildType !== "stock" && state.liftConfig && (
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                  state.buildType === "lifted" 
                    ? "bg-orange-600/20 text-orange-400" 
                    : "bg-blue-600/20 text-blue-400"
                }`}>
                  {state.buildType === "leveled" ? "Leveled" : `${state.liftConfig.liftInches}" Lift`}
                </span>
              )}
            </div>
          )}
          
          {/* Out the door price + New Quote */}
          <div className="flex items-center gap-4">
            {isComplete && (
              <div className="text-right">
                <div className="text-xs text-neutral-400">Out The Door</div>
                <div className="text-xl font-bold text-green-400">
                  ${outTheDoorPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            
            <button
              onClick={toggleAdminPanel}
              className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white font-semibold text-sm transition-colors"
              title="Admin Settings"
            >
              ⚙️
            </button>
            
            <button
              onClick={handleNewQuote}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors"
            >
              New Quote
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// POS Step Indicator
// ============================================================================

const STEPS = [
  { key: "vehicle", label: "Vehicle", icon: "🚗" },
  { key: "build-type", label: "Build", icon: "🛠️" },
  { key: "package", label: "Package", icon: "📦" },
  { key: "pricing", label: "Pricing", icon: "💰" },
  { key: "quote", label: "Quote", icon: "📄" },
] as const;

export function POSStepIndicator() {
  const { state, goToStep, isComplete } = usePOS();
  
  const currentIndex = STEPS.findIndex((s) => s.key === state.step);
  
  return (
    <div className="bg-neutral-800/50 border-b border-neutral-700/50">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((step, idx) => {
            const isActive = step.key === state.step;
            const isCompleted = idx < currentIndex;
            const isClickable = 
              step.key === "vehicle" ||
              (step.key === "build-type" && state.vehicle) ||
              (step.key === "package" && state.vehicle && state.buildType) ||
              (step.key === "pricing" && state.wheel && state.tire) ||
              (step.key === "quote" && isComplete);
            
            return (
              <button
                key={step.key}
                onClick={() => isClickable && goToStep(step.key as any)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                  ${isActive 
                    ? "bg-blue-600 text-white" 
                    : isCompleted
                      ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                      : isClickable
                        ? "bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700"
                        : "bg-neutral-800/30 text-neutral-600 cursor-not-allowed"
                  }
                `}
              >
                <span>{isCompleted ? "✓" : step.icon}</span>
                <span className="text-sm font-medium">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// POS Footer
// ============================================================================

export function POSFooter() {
  return (
    <footer className="bg-neutral-900 border-t border-neutral-800 py-3">
      <div className="mx-auto max-w-7xl px-4 text-center text-xs text-neutral-500">
        Warehouse Tire Direct POS • Employee Use Only • Not for Customer View
      </div>
    </footer>
  );
}

// ============================================================================
// Main Layout Wrapper
// ============================================================================

export function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <POSHeader />
      <POSStepIndicator />
      <main className="flex-1">
        {children}
      </main>
      <POSFooter />
      
      {/* Admin Settings Modal */}
      <POSAdminPanel />
    </div>
  );
}
