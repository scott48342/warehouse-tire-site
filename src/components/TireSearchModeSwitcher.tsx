"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type TireSearchMode = "vehicle" | "size" | "brand";

interface TireSearchModeSwitcherProps {
  currentMode: TireSearchMode;
  className?: string;
}

const MODES: { id: TireSearchMode; label: string; icon: string; description: string }[] = [
  { 
    id: "vehicle", 
    label: "Find by Vehicle", 
    icon: "🚗",
    description: "We'll show tires that fit"
  },
  { 
    id: "size", 
    label: "Search by Size", 
    icon: "📏",
    description: "Know your tire size?"
  },
  { 
    id: "brand", 
    label: "Browse by Brand", 
    icon: "🏷️",
    description: "Shop your favorite brands"
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
    <div className={`flex flex-col items-center ${className}`}>
      {/* Mode tabs */}
      <div className="inline-flex rounded-2xl bg-neutral-100 p-1.5 shadow-inner">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleModeChange(mode.id)}
            className={`
              relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200
              ${currentMode === mode.id 
                ? "bg-white text-neutral-900 shadow-md" 
                : "text-neutral-600 hover:text-neutral-900 hover:bg-white/50"
              }
            `}
          >
            <span className="text-base">{mode.icon}</span>
            <span className="hidden sm:inline">{mode.label}</span>
            <span className="sm:hidden">{mode.label.split(" ").pop()}</span>
          </button>
        ))}
      </div>
      
      {/* Description text */}
      <p className="mt-2 text-xs text-neutral-500">
        {MODES.find(m => m.id === currentMode)?.description}
      </p>
    </div>
  );
}
