"use client";

/**
 * Account Page Client Component
 * 
 * User account dashboard with:
 * - Profile information
 * - Saved vehicles (garage) with server sync
 * - Order history (future)
 * 
 * @updated 2026-08-21 - Added garage section with useAccountGarage
 */

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import Link from "next/link";
import { useAccountGarage } from "@/hooks/useAccountGarage";

interface User {
  id: string;
  email: string;
  name?: string | null;
  emailVerified: boolean;
}

export function AccountPageClient({ user }: { user: User }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const {
    garage,
    activeVehicle,
    isLoading: garageSyncing,
    isSynced,
    removeVehicle,
    setActiveVehicle,
  } = useAccountGarage();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[account] Sign out error:", err);
      setSigningOut(false);
    }
  };

  const handleRemoveVehicle = async (vehicleId: string) => {
    if (confirm("Remove this vehicle from your garage?")) {
      await removeVehicle(vehicleId);
    }
  };

  const handleSetActive = async (vehicleId: string) => {
    await setActiveVehicle(vehicleId);
  };

  return (
    <div className="min-h-[80vh] px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900">My Account</h1>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg hover:border-neutral-400 transition-colors disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>

        {/* Profile Section */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Signed in as</p>
              <p className="font-semibold text-neutral-900">{user.email}</p>
              {!user.emailVerified && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Email not verified
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Garage Section */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">🚗</span>
              <h2 className="text-lg font-bold text-neutral-900">My Garage</h2>
              {garage.length > 0 && (
                <span className="text-sm text-neutral-500">
                  ({garage.length}/10)
                </span>
              )}
            </div>
            {garageSyncing && (
              <span className="text-sm text-neutral-500">Syncing...</span>
            )}
            {isSynced && !garageSyncing && (
              <span className="text-sm text-green-600">✓ Synced</span>
            )}
          </div>

          {garage.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500 mb-4">No vehicles saved yet</p>
              <p className="text-sm text-neutral-400 mb-4">
                Shop for tires or wheels to add vehicles to your garage
              </p>
              <Link
                href="/tires"
                className="inline-block px-6 py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
              >
                Shop Tires
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {garage.map((vehicle) => {
                const isActive = activeVehicle?.id === vehicle.id;
                return (
                  <div
                    key={vehicle.id}
                    className={`p-4 rounded-xl border ${
                      isActive
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    } transition-colors`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-900">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </span>
                          {vehicle.trim && (
                            <span className="text-neutral-500">{vehicle.trim}</span>
                          )}
                          {isActive && (
                            <span className="text-xs bg-neutral-900 text-white px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        {vehicle.nickname && (
                          <p className="text-sm text-neutral-500 mt-1">
                            "{vehicle.nickname}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {!isActive && (
                          <button
                            onClick={() => handleSetActive(vehicle.id)}
                            className="text-sm text-neutral-600 hover:text-neutral-900 underline"
                          >
                            Set Active
                          </button>
                        )}
                        <Link
                          href={`/tires?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&trim=${encodeURIComponent(vehicle.trim)}` : ""}`}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Shop Tires →
                        </Link>
                        <button
                          onClick={() => handleRemoveVehicle(vehicle.id)}
                          className="text-sm text-red-500 hover:text-red-600 p-1"
                          title="Remove vehicle"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-400">
              Your garage syncs automatically when you sign in. Vehicles you add while shopping
              are saved to your account.
            </p>
          </div>
        </div>

        {/* Orders Section (Coming Soon) */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">📦</span>
            <h2 className="text-lg font-bold text-neutral-900">My Orders</h2>
          </div>
          <p className="text-neutral-500 text-sm">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
