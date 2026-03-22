import type pg from "pg";
import { ensureQuoteTables, getSiteSetting, setSiteSetting } from "@/lib/quoteCatalog";

export type StripeMode = "test" | "live";

export type StripeSettings = {
  enabled: boolean;
  mode: StripeMode;
  publishableKey: string | null;
  /** Stored server-side only; never return this to client code. */
  secretKeyPresent: boolean;
};

const KEYS = {
  enabled: "stripe_enabled",
  mode: "stripe_mode",
  publishable: "stripe_publishable_key",
  secret: "stripe_secret_key",
} as const;

export async function getStripeSettings(db: pg.Pool): Promise<StripeSettings> {
  await ensureQuoteTables(db);
  const enabledRaw = await getSiteSetting(db, KEYS.enabled);
  const modeRaw = (await getSiteSetting(db, KEYS.mode)) as StripeMode | null;
  const publishableKey = await getSiteSetting(db, KEYS.publishable);
  const secretKey = await getSiteSetting(db, KEYS.secret);

  return {
    enabled: enabledRaw === "1" || enabledRaw === "true",
    mode: modeRaw === "live" ? "live" : "test",
    publishableKey: publishableKey || null,
    secretKeyPresent: !!(secretKey && secretKey.trim().length > 0),
  };
}

export async function setStripeSettings(
  db: pg.Pool,
  patch: {
    enabled?: boolean;
    mode?: StripeMode;
    publishableKey?: string;
    /** Optional: only updates if provided (allows leaving it blank in UI). */
    secretKey?: string;
  }
) {
  await ensureQuoteTables(db);

  if (typeof patch.enabled === "boolean") {
    await setSiteSetting(db, KEYS.enabled, patch.enabled ? "1" : "0");
  }
  if (patch.mode === "test" || patch.mode === "live") {
    await setSiteSetting(db, KEYS.mode, patch.mode);
  }
  if (typeof patch.publishableKey === "string") {
    await setSiteSetting(db, KEYS.publishable, patch.publishableKey.trim());
  }
  if (typeof patch.secretKey === "string" && patch.secretKey.trim()) {
    await setSiteSetting(db, KEYS.secret, patch.secretKey.trim());
  }
}

export async function getStripeSecretKey(db: pg.Pool): Promise<string | null> {
  await ensureQuoteTables(db);
  const v = await getSiteSetting(db, KEYS.secret);
  return v && v.trim() ? v.trim() : null;
}
