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
  /** Number of sync attempts (for backoff) */
  syncAttempts: number;
  /** Timestamp of last sync attempt */
  lastSyncAttempt: number;
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
    syncAttempts: 0,
    lastSyncAttempt: 0,
  });

  // Max retries before giving up (exponential backoff: 1s, 2s, 4s, 8s)
  const MAX_SYNC_RETRIES = 4;

  const isAuthenticated = !!session?.user?.id;

  /**
   * Sync local garage with server on login
   * Uses exponential backoff on failure (1s, 2s, 4s, 8s max)
   */
  const syncGarage = useCallback(async (isRetry = false) => {
    if (!isAuthenticated) {
      setState(prev => ({ ...prev, isSynced: false, error: null, syncAttempts: 0 }));
      return;
    }

    // Prevent retry storm: check if we've exceeded max retries
    if (isRetry && state.syncAttempts >= MAX_SYNC_RETRIES) {
      console.log("[useAccountGarage] Max retries exceeded, stopping sync attempts");
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      lastSyncAttempt: Date.now(),
    }));

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
        syncAttempts: 0,
        lastSyncAttempt: Date.now(),
      });

      console.log("[useAccountGarage] Synced:", {
        merged: result.merged,
        total: result.vehicles.length,
        activeId: result.activeId,
      });
    } catch (error) {
      console.error("[useAccountGarage] Sync error:", error);
      const newAttempts = state.syncAttempts + 1;
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Sync failed",
        syncAttempts: newAttempts,
        lastSyncAttempt: Date.now(),
      }));

      // Schedule retry with exponential backoff (1s, 2s, 4s, 8s)
      if (newAttempts < MAX_SYNC_RETRIES) {
        const backoffMs = Math.pow(2, newAttempts - 1) * 1000;
        console.log(`[useAccountGarage] Scheduling retry ${newAttempts}/${MAX_SYNC_RETRIES} in ${backoffMs}ms`);
        setTimeout(() => {
          syncGarage(true);
        }, backoffMs);
      } else {
        console.log("[useAccountGarage] Max retries reached, giving up");
      }
    }
  }, [isAuthenticated, garage, state.syncAttempts]);

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

  // Auto-sync on login (only once, not on every state change)
  useEffect(() => {
    // Only attempt sync if:
    // 1. User is authenticated
    // 2. Not already synced
    // 3. Not currently loading
    // 4. Haven't exceeded max retries
    // 5. Not a recent failed attempt (debounce)
    const shouldSync = 
      isAuthenticated && 
      !state.isSynced && 
      !state.isLoading &&
      state.syncAttempts < MAX_SYNC_RETRIES &&
      (state.syncAttempts === 0 || Date.now() - state.lastSyncAttempt > 500);
    
    if (shouldSync && state.syncAttempts === 0) {
      // Initial sync only - retries are handled by the syncGarage function
      syncGarage(false);
    }
  }, [isAuthenticated, state.isSynced, state.isLoading, state.syncAttempts, state.lastSyncAttempt, syncGarage, MAX_SYNC_RETRIES]);

  // Reset sync state on logout
  useEffect(() => {
    if (!isAuthenticated && (state.isSynced || state.syncAttempts > 0)) {
      setState({
        isLoading: false,
        isSynced: false,
        error: null,
        serverActiveId: null,
        syncAttempts: 0,
        lastSyncAttempt: 0,
      });
    }
  }, [isAuthenticated, state.isSynced, state.syncAttempts]);

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
