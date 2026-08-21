/**
 * useAccountGarage Hook
 * 
 * Extends GarageContext with server-backed persistence for authenticated users.
 * 
 * Behavior:
 * - When logged out: Uses local GarageContext (localStorage)
 * - When logged in: Syncs with server, server becomes source of truth
 * - On login: Merges local garage into server garage (no duplicates)
 * - On logout: Keeps local garage as-is (server data persists for next login)
 * 
 * Usage:
 * ```tsx
 * const { garage, isLoading, isSynced, syncGarage } = useAccountGarage();
 * ```
 * 
 * @created 2026-08-21
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useGarage, type GarageVehicle } from "@/contexts/GarageContext";
import { authClient } from "@/lib/auth-client";

type AccountGarageState = {
  /** Whether we're currently syncing with server */
  isLoading: boolean;
  /** Whether local garage has been synced with server (after login) */
  isSynced: boolean;
  /** Last sync error, if any */
  error: string | null;
  /** Server-side active vehicle ID (may differ from local during sync) */
  serverActiveId: string | null;
};

/**
 * Sync local garage to server
 * Returns merged server state
 */
async function syncToServer(
  localVehicles: GarageVehicle[],
  localActiveId: string | null
): Promise<{ vehicles: GarageVehicle[]; activeId: string | null; merged: number }> {
  const response = await fetch("/api/garage/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      localVehicles,
      activeId: localActiveId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch server garage state
 */
async function fetchServerGarage(): Promise<{ vehicles: GarageVehicle[]; count: number }> {
  const response = await fetch("/api/garage");
  
  if (!response.ok) {
    if (response.status === 401) {
      return { vehicles: [], count: 0 };
    }
    throw new Error(`Fetch failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Add vehicle to server garage
 */
async function addToServer(vehicle: Partial<GarageVehicle>): Promise<GarageVehicle | null> {
  const response = await fetch("/api/garage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicle }),
  });

  if (!response.ok) {
    throw new Error(`Add failed: ${response.status}`);
  }

  const result = await response.json();
  return result.vehicles?.[0] || null;
}

/**
 * Remove vehicle from server garage
 */
async function removeFromServer(vehicleId: string): Promise<boolean> {
  const response = await fetch("/api/garage", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicleId }),
  });

  return response.ok;
}

/**
 * Update vehicle on server (nickname, wheelDia, lastActiveAt)
 */
async function updateOnServer(
  vehicleId: string,
  updates: { nickname?: string; wheelDia?: number; lastActiveAt?: number }
): Promise<boolean> {
  const response = await fetch("/api/garage", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicleId, ...updates }),
  });

  return response.ok;
}

export function useAccountGarage() {
  const garage = useGarage();
  const { data: session } = authClient.useSession();
  
  const [state, setState] = useState<AccountGarageState>({
    isLoading: false,
    isSynced: false,
    error: null,
    serverActiveId: null,
  });

  const isAuthenticated = !!session?.user?.id;

  /**
   * Sync local garage with server on login
   */
  const syncGarage = useCallback(async () => {
    if (!isAuthenticated) {
      setState(prev => ({ ...prev, isSynced: false, error: null }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await syncToServer(
        garage.garage,
        garage.activeVehicle?.id || null
      );

      // Replace local garage with server state (server is source of truth)
      // Use replaceGarage if available, otherwise add missing vehicles
      if (typeof garage.replaceGarage === "function") {
        // Preferred: atomic replacement
        garage.replaceGarage(result.vehicles, result.activeId);
      } else {
        // Fallback: add server vehicles not in local
        const localIds = new Set(garage.garage.map(v => v.id));
        for (const serverVehicle of result.vehicles) {
          if (!localIds.has(serverVehicle.id)) {
            garage.addVehicle(serverVehicle, false);
          }
        }
        // Set active vehicle
        if (result.activeId) {
          garage.setActiveVehicle(result.activeId);
        }
      }

      setState({
        isLoading: false,
        isSynced: true,
        error: null,
        serverActiveId: result.activeId,
      });

      console.log("[useAccountGarage] Synced:", {
        merged: result.merged,
        total: result.vehicles.length,
        activeId: result.activeId,
      });
    } catch (error) {
      console.error("[useAccountGarage] Sync error:", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Sync failed",
      }));
    }
  }, [isAuthenticated, garage]);

  /**
   * Wrap garage.addVehicle to also sync to server when authenticated
   */
  const addVehicle = useCallback(
    async (
      vehicle: Omit<GarageVehicle, "id" | "addedAt" | "lastActiveAt">,
      setActive = true
    ): Promise<GarageVehicle | null> => {
      // Always add locally first
      const localResult = garage.addVehicle(vehicle, setActive);

      // If authenticated, also add to server
      if (isAuthenticated && localResult) {
        try {
          await addToServer(localResult);
        } catch (error) {
          console.error("[useAccountGarage] Server add failed:", error);
          // Local add succeeded, don't throw
        }
      }

      return localResult;
    },
    [garage, isAuthenticated]
  );

  /**
   * Wrap garage.removeVehicle to also sync to server
   */
  const removeVehicle = useCallback(
    async (vehicleId: string): Promise<boolean> => {
      // Remove locally
      const localResult = garage.removeVehicle(vehicleId);

      // If authenticated, also remove from server
      if (isAuthenticated && localResult) {
        try {
          await removeFromServer(vehicleId);
        } catch (error) {
          console.error("[useAccountGarage] Server remove failed:", error);
        }
      }

      return localResult;
    },
    [garage, isAuthenticated]
  );

  /**
   * Wrap garage.setActiveVehicle to also update server
   */
  const setActiveVehicle = useCallback(
    async (vehicleId: string): Promise<boolean> => {
      // Set locally
      const localResult = garage.setActiveVehicle(vehicleId);

      // If authenticated, update lastActiveAt on server
      if (isAuthenticated && localResult) {
        try {
          await updateOnServer(vehicleId, { lastActiveAt: Date.now() });
        } catch (error) {
          console.error("[useAccountGarage] Server setActive failed:", error);
        }
      }

      return localResult;
    },
    [garage, isAuthenticated]
  );

  /**
   * Wrap garage.updateNickname to also update server
   */
  const updateNickname = useCallback(
    async (vehicleId: string, nickname: string): Promise<boolean> => {
      // Update locally
      const localResult = garage.updateNickname(vehicleId, nickname);

      // If authenticated, also update server
      if (isAuthenticated && localResult) {
        try {
          await updateOnServer(vehicleId, { nickname });
        } catch (error) {
          console.error("[useAccountGarage] Server updateNickname failed:", error);
        }
      }

      return localResult;
    },
    [garage, isAuthenticated]
  );

  // Auto-sync on login
  useEffect(() => {
    if (isAuthenticated && !state.isSynced && !state.isLoading) {
      syncGarage();
    }
  }, [isAuthenticated, state.isSynced, state.isLoading, syncGarage]);

  // Reset sync state on logout
  useEffect(() => {
    if (!isAuthenticated && state.isSynced) {
      setState({
        isLoading: false,
        isSynced: false,
        error: null,
        serverActiveId: null,
      });
    }
  }, [isAuthenticated, state.isSynced]);

  return {
    // Garage state (from local GarageContext)
    garage: garage.garage,
    activeVehicle: garage.activeVehicle,
    isLoaded: garage.isLoaded,
    vehicleCount: garage.vehicleCount,
    hasCompleteVehicle: garage.hasCompleteVehicle,
    buildVehicleParams: garage.buildVehicleParams,
    isInGarage: garage.isInGarage,
    clearActiveVehicle: garage.clearActiveVehicle,

    // Auth-aware operations
    addVehicle,
    removeVehicle,
    setActiveVehicle,
    updateNickname,
    setActiveVehicleByData: garage.setActiveVehicleByData,

    // Account sync state
    isAuthenticated,
    isLoading: state.isLoading,
    isSynced: state.isSynced,
    syncError: state.error,
    syncGarage,
  };
}
