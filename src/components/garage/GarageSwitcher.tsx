"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGarage, formatGarageVehicle, formatVehicleShort, type GarageVehicle } from "@/contexts/GarageContext";

// ═══════════════════════════════════════════════════════════════════════════════
// GARAGE SWITCHER
// Header component for switching between vehicles in the garage
// ═══════════════════════════════════════════════════════════════════════════════

const CarIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);

const CheckIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const PlusIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const GarageIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

export function GarageSwitcher() {
  const router = useRouter();
  const {
    garage,
    activeVehicle,
    isLoaded,
    setActiveVehicle,
    hasCompleteVehicle,
    buildVehicleParams,
  } = useGarage();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Don't render until loaded
  if (!isLoaded) return null;

  // No vehicles - show "Add Vehicle" prompt
  if (garage.length === 0) {
    return (
      <Link
        href="/garage"
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-full transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Add Vehicle</span>
      </Link>
    );
  }

  // Single vehicle - show vehicle chip with quick actions
  if (garage.length === 1 && hasCompleteVehicle) {
    const displayText = formatVehicleShort(activeVehicle);
    
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-neutral-900 bg-white hover:bg-neutral-100 rounded-full transition-colors"
        >
          <CarIcon className="w-4 h-4 text-neutral-600" />
          <span className="max-w-[150px] truncate">{displayText}</span>
          <ChevronDownIcon className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <VehicleDropdown
            vehicles={garage}
            activeVehicle={activeVehicle}
            onSwitch={(id) => {
              setActiveVehicle(id);
              setIsOpen(false);
            }}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>
    );
  }

  // Multiple vehicles - show switcher dropdown
  const displayText = formatVehicleShort(activeVehicle);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-neutral-900 bg-white hover:bg-neutral-100 rounded-full transition-colors"
      >
        <CarIcon className="w-4 h-4 text-neutral-600" />
        <span className="max-w-[150px] truncate">{displayText}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500 bg-neutral-200 px-1.5 py-0.5 rounded-full">
            {garage.length}
          </span>
          <ChevronDownIcon className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && (
        <VehicleDropdown
          vehicles={garage}
          activeVehicle={activeVehicle}
          onSwitch={(id) => {
            setActiveVehicle(id);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DROPDOWN MENU
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleDropdown({
  vehicles,
  activeVehicle,
  onSwitch,
  onClose,
}: {
  vehicles: GarageVehicle[];
  activeVehicle: GarageVehicle | null;
  onSwitch: (id: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();

  // Sort: active first, then by last active
  const sorted = [...vehicles].sort((a, b) => {
    if (a.id === activeVehicle?.id) return -1;
    if (b.id === activeVehicle?.id) return 1;
    return b.lastActiveAt - a.lastActiveAt;
  });

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-40 sm:hidden"
        onClick={onClose}
      />

      <div className="absolute right-0 top-full z-50 mt-2 w-72 sm:w-80 bg-white rounded-xl border border-neutral-200 shadow-lg overflow-hidden">
        {/* Vehicle List */}
        <div className="max-h-[300px] overflow-y-auto">
          {sorted.map((vehicle) => {
            const isActive = vehicle.id === activeVehicle?.id;
            const displayName = formatGarageVehicle(vehicle);
            const subtext = vehicle.nickname
              ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
              : vehicle.trim && vehicle.trim !== "Base"
              ? vehicle.trim
              : null;

            return (
              <button
                key={vehicle.id}
                onClick={() => {
                  if (!isActive) {
                    onSwitch(vehicle.id);
                  }
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isActive
                    ? "bg-red-50"
                    : "hover:bg-neutral-50"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isActive ? "bg-red-100 text-red-600" : "bg-neutral-100 text-neutral-500"
                }`}>
                  <CarIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate ${isActive ? "text-red-600" : "text-neutral-900"}`}>
                    {displayName}
                  </p>
                  {subtext && (
                    <p className="text-xs text-neutral-500 truncate">{subtext}</p>
                  )}
                </div>
                {isActive && (
                  <div className="flex-shrink-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <CheckIcon className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-neutral-200 p-2">
          <Link
            href="/garage"
            onClick={onClose}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <GarageIcon />
            Manage Garage
          </Link>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT VERSION FOR MOBILE
// ═══════════════════════════════════════════════════════════════════════════════

export function GarageSwitcherCompact() {
  const { garage, activeVehicle, isLoaded, hasCompleteVehicle } = useGarage();

  if (!isLoaded || !hasCompleteVehicle || !activeVehicle) {
    return null;
  }

  const displayText = formatVehicleShort(activeVehicle);

  return (
    <Link
      href="/garage"
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors"
    >
      <CarIcon className="w-3.5 h-3.5" />
      <span className="max-w-[100px] truncate">{displayText}</span>
      {garage.length > 1 && (
        <span className="text-neutral-500">+{garage.length - 1}</span>
      )}
    </Link>
  );
}

export default GarageSwitcher;
