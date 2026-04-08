"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type TireSearchMode = "vehicle" | "size";

interface TireSearchModeSwitcherProps {
  currentMode: TireSearchMode;
  className?: string;
}

const MODES: { 
  id: TireSearchMode; 
  label: string; 
  shortLabel: string;
  icon: string; 
  description: string;
  activeColor: string;
}[] = [
  { 
    id: "vehicle", 
    label: "Find by Vehicle", 
    shortLabel: "Vehicle",
    icon: "🚗",
    description: "We'll show tires that fit your exact vehicle",
    activeColor: "bg-[var(--brand-red)] text-white shadow-lg shadow-red-500/25",
  },
  { 
    id: "size", 
    label: "Search by Size", 
    shortLabel: "Size",
    icon: "📏",
    description: "Enter your tire size directly",
    activeColor: "bg-blue-600 text-white shadow-lg shadow-blue-500/25",
  },
];

export function TireSearchModeSwitcher({ currentMode, className = "" }: TireSearchModeSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleModeChange = (mode: TireSearchMode) => {
    if (mode === currentMode) return;
    
    const params = new URLSearchParams();
    
    // Preserve entry/intent params if present (homepage intent flows)
    const entry = searchParams.get("entry");
    const intent = searchParams.get("intent");
    if (entry) params.set("entry", entry);
    if (intent) params.set("intent", intent);
    
    // Set the new mode (vehicle is default, so don't add param)
    if (mode !== "vehicle") {
      params.set("searchMode", mode);
    }
    
    const qs = params.toString();
    router.push(`/tires${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className={`flex flex-col items-center justify-center w-full ${className}`}>
      {/* Mode buttons - large, prominent, centered */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-2xl mx-auto">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleModeChange(mode.id)}
            className={`
              relative flex items-center justify-center gap-3 rounded-2xl px-6 py-4 w-full sm:w-auto sm:min-w-[180px]
              text-base font-bold transition-all duration-200 border-2
              ${currentMode === mode.id 
                ? `${mode.activeColor} border-transparent scale-105` 
                : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 hover:scale-[1.02]"
              }
            `}
          >
            <span className="text-xl">{mode.icon}</span>
            <span className="hidden sm:inline">{mode.label}</span>
            <span className="sm:hidden">{mode.shortLabel}</span>
          </button>
        ))}
      </div>
      
      {/* Description text */}
      <p className="mt-4 text-sm text-neutral-600 text-center">
        {MODES.find(m => m.id === currentMode)?.description}
      </p>
    </div>
  );
}
