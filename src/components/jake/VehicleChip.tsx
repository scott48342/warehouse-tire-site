/**
 * VehicleChip - Shows the customer's saved vehicle above Jake chat
 * 
 * Displays a compact chip with vehicle info and allows changing/clearing.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { SavedVehicle, formatVehicleDisplay } from "@/contexts/VehicleMemoryContext";

interface VehicleChipProps {
  vehicle: SavedVehicle;
  onClear: () => void;
  onSendMessage: (message: string) => void;
  className?: string;
}

export function VehicleChip({ vehicle, onClear, onSendMessage, className = "" }: VehicleChipProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayText = formatVehicleDisplay(vehicle);
  
  const handleChangeVehicle = () => {
    setShowMenu(false);
    onSendMessage("I want to change my vehicle");
  };
  
  const handleClear = () => {
    setShowMenu(false);
    onClear();
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Main Chip */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-600/20 to-red-500/10 
                   border border-red-500/30 rounded-full text-sm text-white/90
                   hover:border-red-500/50 hover:bg-red-600/25 transition-all group"
      >
        {/* Vehicle Icon */}
        <svg 
          className="w-4 h-4 text-red-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" 
          />
        </svg>
        
        <span className="font-medium">{displayText}</span>
        
        {/* Dropdown Arrow */}
        <svg 
          className={`w-3 h-3 text-white/50 transition-transform ${showMenu ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 
                        rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-white/10">
            <p className="text-white/40 text-xs uppercase tracking-wide">Your Vehicle</p>
            <p className="text-white text-sm font-medium mt-0.5">{displayText}</p>
            {vehicle.trim && vehicle.trim !== "Base" && (
              <p className="text-white/50 text-xs mt-0.5">{vehicle.trim}</p>
            )}
          </div>
          
          <div className="p-1">
            <button
              onClick={handleChangeVehicle}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 
                         hover:bg-white/5 rounded transition-colors text-left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Change Vehicle
            </button>
            
            <button
              onClick={handleClear}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 
                         hover:bg-red-500/10 rounded transition-colors text-left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Vehicle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for mobile/embedded use
 */
export function VehicleChipCompact({ vehicle, onClear }: { vehicle: SavedVehicle; onClear: () => void }) {
  const displayText = formatVehicleDisplay(vehicle);
  
  return (
    <div className="flex items-center gap-2 px-2.5 py-1 bg-red-600/20 border border-red-500/30 
                    rounded-full text-xs text-white/80">
      <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span className="truncate max-w-[150px]">{displayText}</span>
      <button
        onClick={onClear}
        className="text-white/40 hover:text-white/70 transition-colors"
        title="Clear vehicle"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default VehicleChip;
