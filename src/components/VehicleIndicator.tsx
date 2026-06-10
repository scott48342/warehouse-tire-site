"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVehicleMemory, formatVehicleDisplay } from "@/contexts/VehicleMemoryContext";

/**
 * Vehicle Indicator - Shows the active saved vehicle in the header
 * 
 * Displays: "My Vehicle: 2022 Ford F-150 XLT"
 * Actions: Change Vehicle | Clear
 */
export function VehicleIndicator() {
  const router = useRouter();
  const { activeVehicle, isLoaded, clearActiveVehicle, buildVehicleParams, hasCompleteVehicle } = useVehicleMemory();
  const [showMenu, setShowMenu] = useState(false);

  // Don't render until loaded (prevents flash)
  if (!isLoaded) return null;
  
  // No vehicle saved
  if (!hasCompleteVehicle || !activeVehicle) {
    return null;
  }

  const displayText = formatVehicleDisplay(activeVehicle);

  function handleShopTires() {
    const params = buildVehicleParams();
    router.push(`/tires?${params.toString()}`);
    setShowMenu(false);
  }

  function handleShopWheels() {
    const params = buildVehicleParams();
    router.push(`/wheels?${params.toString()}`);
    setShowMenu(false);
  }

  function handleChangeVehicle() {
    // Navigate to tires page without params to trigger vehicle selector
    router.push("/tires");
    setShowMenu(false);
  }

  function handleClear() {
    clearActiveVehicle();
    setShowMenu(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
        aria-expanded={showMenu}
        aria-haspopup="true"
      >
        {/* Car icon */}
        <svg 
          className="h-4 w-4 text-neutral-600" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" 
          />
        </svg>
        
        <span className="max-w-[200px] truncate">
          <span className="text-neutral-500 font-normal hidden sm:inline">My Vehicle: </span>
          <span className="font-bold">{displayText}</span>
        </span>
        
        {/* Chevron */}
        <svg 
          className={`h-4 w-4 text-neutral-400 transition-transform ${showMenu ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
            aria-hidden="true"
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
            <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              {displayText}
            </div>
            
            <div className="border-t border-neutral-100 my-1" />
            
            <button
              type="button"
              onClick={handleShopTires}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              <span className="text-lg">🛞</span>
              Shop Tires
            </button>
            
            <button
              type="button"
              onClick={handleShopWheels}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              <span className="text-lg">⭕</span>
              Shop Wheels
            </button>
            
            <div className="border-t border-neutral-100 my-1" />
            
            <button
              type="button"
              onClick={handleChangeVehicle}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Change Vehicle
            </button>
            
            <button
              type="button"
              onClick={handleClear}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Vehicle
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Compact version for mobile header
 */
export function VehicleIndicatorCompact() {
  const router = useRouter();
  const { activeVehicle, isLoaded, hasCompleteVehicle, buildVehicleParams } = useVehicleMemory();

  if (!isLoaded || !hasCompleteVehicle || !activeVehicle) {
    return null;
  }

  const displayText = formatVehicleDisplay(activeVehicle);

  function handleClick() {
    const params = buildVehicleParams();
    router.push(`/tires?${params.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors"
      title={`Shop for ${displayText}`}
    >
      <svg 
        className="h-3.5 w-3.5" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
        strokeWidth={2}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" 
        />
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" 
        />
      </svg>
      <span className="max-w-[120px] truncate">{displayText}</span>
    </button>
  );
}
