"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGarage, formatGarageVehicle, type GarageVehicle } from "@/contexts/GarageContext";
import { VehicleSelector } from "@/components/garage/VehicleSelector";

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const CarIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);

const PlusIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const CheckIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const TrashIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PencilIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleCard({
  vehicle,
  isActive,
  onSetActive,
  onRemove,
  onUpdateNickname,
}: {
  vehicle: GarageVehicle;
  isActive: boolean;
  onSetActive: () => void;
  onRemove: () => void;
  onUpdateNickname: (nickname: string) => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(vehicle.nickname || "");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const displayName = formatGarageVehicle(vehicle);
  const vehicleSlug = `${vehicle.year}-${vehicle.make}-${vehicle.model}`.toLowerCase().replace(/\s+/g, "-");

  const handleSaveNickname = () => {
    onUpdateNickname(nickname);
    setIsEditing(false);
  };

  const handleShopTires = () => {
    router.push(`/tires/for/${vehicleSlug}`);
  };

  const handleShopWheels = () => {
    router.push(`/wheels/for/${vehicleSlug}`);
  };

  return (
    <div
      className={`relative bg-[#1a1a1a] border rounded-xl p-4 sm:p-5 transition-all ${
        isActive
          ? "border-red-500/50 ring-2 ring-red-500/20"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      {/* Active Badge */}
      {isActive && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <CheckIcon className="w-3 h-3" />
          Active
        </div>
      )}

      {/* Vehicle Info */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center ${
          isActive ? "bg-red-600/20 text-red-500" : "bg-white/5 text-white/50"
        }`}>
          <CarIcon className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter nickname..."
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-red-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveNickname();
                  if (e.key === "Escape") setIsEditing(false);
                }}
              />
              <button
                onClick={handleSaveNickname}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-lg truncate">{displayName}</h3>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-white/40 hover:text-white/60 transition-colors"
                  title="Edit nickname"
                >
                  <PencilIcon />
                </button>
              </div>
              {vehicle.nickname && (
                <p className="text-white/50 text-sm truncate">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                  {vehicle.trim && vehicle.trim !== "Base" ? ` ${vehicle.trim}` : ""}
                </p>
              )}
              {!vehicle.nickname && vehicle.trim && vehicle.trim !== "Base" && (
                <p className="text-white/50 text-sm">{vehicle.trim}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!isActive && (
          <button
            onClick={onSetActive}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <CheckIcon className="w-4 h-4" />
            Set Active
          </button>
        )}
        
        <button
          onClick={handleShopTires}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
        >
          🛞 Tires
        </button>
        
        <button
          onClick={handleShopWheels}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ⭕ Wheels
        </button>

        <div className="relative ml-auto">
          {showConfirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-xs">Remove?</span>
              <button
                onClick={() => {
                  onRemove();
                  setShowConfirmDelete(false);
                }}
                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="p-2 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Remove vehicle"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function GaragePageClient() {
  const {
    garage,
    activeVehicle,
    isLoaded,
    addVehicle,
    removeVehicle,
    setActiveVehicle,
    updateNickname,
  } = useGarage();

  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const handleAddVehicle = (vehicle: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  }) => {
    addVehicle(vehicle, true);
    setShowAddVehicle(false);
  };

  // Sort: active first, then by last active
  const sortedGarage = [...garage].sort((a, b) => {
    if (a.id === activeVehicle?.id) return -1;
    if (b.id === activeVehicle?.id) return 1;
    return b.lastActiveAt - a.lastActiveAt;
  });

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-48 mb-6" />
            <div className="space-y-4">
              <div className="h-32 bg-white/10 rounded-xl" />
              <div className="h-32 bg-white/10 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600/20 rounded-xl flex items-center justify-center">
              <CarIcon className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl sm:text-2xl">My Garage</h1>
              <p className="text-white/50 text-sm">
                {garage.length === 0
                  ? "Add your first vehicle"
                  : `${garage.length} vehicle${garage.length === 1 ? "" : "s"} saved`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddVehicle(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Add Vehicle</span>
          </button>
        </div>

        {/* Vehicle List */}
        {garage.length === 0 ? (
          <div className="text-center py-16 sm:py-20">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <CarIcon className="w-10 h-10 sm:w-12 sm:h-12 text-white/30" />
            </div>
            <h2 className="text-white font-bold text-xl mb-2">Your garage is empty</h2>
            <p className="text-white/50 mb-6 max-w-sm mx-auto">
              Save your vehicles for quick access to tires, wheels, and packages that fit.
            </p>
            <button
              onClick={() => setShowAddVehicle(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Add Your First Vehicle
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGarage.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                isActive={vehicle.id === activeVehicle?.id}
                onSetActive={() => setActiveVehicle(vehicle.id)}
                onRemove={() => removeVehicle(vehicle.id)}
                onUpdateNickname={(nickname) => updateNickname(vehicle.id, nickname)}
              />
            ))}
          </div>
        )}

        {/* Bottom Actions */}
        {garage.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <Link
              href="/"
              className="text-red-500 hover:text-red-400 text-sm font-medium transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        )}

        {/* Add Vehicle Modal */}
        {showAddVehicle && (
          <VehicleSelector
            onSelect={handleAddVehicle}
            onClose={() => setShowAddVehicle(false)}
          />
        )}
      </div>
    </div>
  );
}
