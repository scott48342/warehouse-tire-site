import type pg from "pg";
import { ensureQuoteTables, getSiteSetting, setSiteSetting } from "@/lib/quoteCatalog";

export type PayPalMode = "sandbox" | "live";

export type PayPalSettings = {
  enabled: boolean;
  mode: PayPalMode;
  clientId: string | null;
  /** Stored server-side only; never return this to client code. */
  clientSecretPresent: boolean;
};

const KEYS = {
  enabled: "paypal_enabled",
  mode: "paypal_mode",
  clientId: "paypal_client_id",
  clientSecret: "paypal_client_secret",
} as const;

export async function getPayPalSettings(db: pg.Pool): Promise<PayPalSettings> {
  await ensureQuoteTables(db);
  const enabledRaw = await getSiteSetting(db, KEYS.enabled);
  const modeRaw = (await getSiteSetting(db, KEYS.mode)) as PayPalMode | null;
  const clientId = await getSiteSetting(db, KEYS.clientId);
  const clientSecret = await getSiteSetting(db, KEYS.clientSecret);

  return {
    enabled: enabledRaw === "1" || enabledRaw === "true",
    mode: modeRaw === "live" ? "live" : "sandbox",
    clientId: clientId || null,
    clientSecretPresent: !!(clientSecret && clientSecret.trim().length > 0),
  };
}

export async function setPayPalSettings(
  db: pg.Pool,
  patch: {
    enabled?: boolean;
    mode?: PayPalMode;
    clientId?: string;
    /** Optional: only updates if provided (allows leaving it blank in UI). */
    clientSecret?: string;
  }
) {
  await ensureQuoteTables(db);

  if (typeof patch.enabled === "boolean") {
    await setSiteSetting(db, KEYS.enabled, patch.enabled ? "1" : "0");
  }
  if (patch.mode === "sandbox" || patch.mode === "live") {
    await setSiteSetting(db, KEYS.mode, patch.mode);
  }
  if (typeof patch.clientId === "string") {
    await setSiteSetting(db, KEYS.clientId, patch.clientId.trim());
  }
  if (typeof patch.clientSecret === "string" && patch.clientSecret.trim()) {
    await setSiteSetting(db, KEYS.clientSecret, patch.clientSecret.trim());
  }
}

export async function getPayPalCredentials(db: pg.Pool): Promise<{ clientId: string; clientSecret: string; mode: PayPalMode } | null> {
  await ensureQuoteTables(db);
  const settings = await getPayPalSettings(db);
  
  if (!settings.enabled || !settings.clientId) return null;
  
  const clientSecret = await getSiteSetting(db, KEYS.clientSecret);
  if (!clientSecret?.trim()) return null;
  
  return {
    clientId: settings.clientId,
    clientSecret: clientSecret.trim(),
    mode: settings.mode,
  };
}
