/**
 * Shop Context Detection Tests
 *
 * Phase 1 (2026-08-03): verifies local/national mode detection for
 * production domains, localhost, preview deployments, and unknown hosts,
 * plus the hardened FORCE_LOCAL_MODE behavior (dev/preview only).
 *
 * @created 2026-08-03
 */

import { detectShopContextFromHostPath } from "./shopContext";

describe("detectShopContextFromHostPath", () => {
  const originalForce = process.env.FORCE_LOCAL_MODE;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalForce === undefined) delete process.env.FORCE_LOCAL_MODE;
    else process.env.FORCE_LOCAL_MODE = originalForce;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  // ── Production domains ────────────────────────────────────────────────

  test("national production host -> national", () => {
    const ctx = detectShopContextFromHostPath("shop.warehousetiredirect.com", "/");
    expect(ctx.mode).toBe("national");
    expect(ctx.detectedFrom).toBe("host");
  });

  test("national apex host -> national", () => {
    expect(detectShopContextFromHostPath("warehousetiredirect.com", "/").mode).toBe("national");
    expect(detectShopContextFromHostPath("www.warehousetiredirect.com", "/").mode).toBe("national");
  });

  test("local production host -> local", () => {
    const ctx = detectShopContextFromHostPath("shop.warehousetire.net", "/");
    expect(ctx.mode).toBe("local");
    expect(ctx.detectedFrom).toBe("host");
    expect(ctx.selectedStore).toBe("pontiac"); // default store
  });

  test("local host with store path -> local with store", () => {
    const ctx = detectShopContextFromHostPath("shop.warehousetire.net", "/waterford/tires");
    expect(ctx.mode).toBe("local");
    expect(ctx.selectedStore).toBe("waterford");
  });

  test("host with port normalizes -> national", () => {
    expect(detectShopContextFromHostPath("shop.warehousetiredirect.com:443", "/").mode).toBe("national");
  });

  test("path-based local (reverse proxy) -> local", () => {
    const ctx = detectShopContextFromHostPath("warehousetire.net", "/shop/pontiac");
    expect(ctx.mode).toBe("local");
    expect(ctx.detectedFrom).toBe("path");
  });

  test("apex warehousetire.net WITHOUT /shop path -> national (default)", () => {
    expect(detectShopContextFromHostPath("warehousetire.net", "/").mode).toBe("national");
  });

  // ── Localhost / previews / unknown ────────────────────────────────────

  test("localhost -> national by default", () => {
    const ctx = detectShopContextFromHostPath("localhost:3001", "/");
    expect(ctx.mode).toBe("national");
    expect(ctx.detectedFrom).toBe("default");
  });

  test("vercel preview host -> national by default", () => {
    const ctx = detectShopContextFromHostPath("warehouse-tire-site-abc123.vercel.app", "/");
    expect(ctx.mode).toBe("national");
  });

  test("unknown host -> national (safety default)", () => {
    const ctx = detectShopContextFromHostPath("evil.example.com", "/");
    expect(ctx.mode).toBe("national");
    expect(ctx.detectedFrom).toBe("default");
  });

  test("empty host -> national (SSR fallback)", () => {
    expect(detectShopContextFromHostPath("", "/").mode).toBe("national");
  });

  // ── FORCE_LOCAL_MODE hardening (2026-08-03) ───────────────────────────
  // NODE_ENV is "test" under jest, which is neither development nor preview,
  // so FORCE_LOCAL_MODE must be ignored here - exactly like production.

  test("FORCE_LOCAL_MODE ignored outside dev/preview (production safety)", () => {
    process.env.FORCE_LOCAL_MODE = "true";
    delete process.env.VERCEL_ENV;
    const ctx = detectShopContextFromHostPath("shop.warehousetiredirect.com", "/");
    expect(ctx.mode).toBe("national"); // NOT flipped to local
  });

  test("FORCE_LOCAL_MODE honored on preview deployments", () => {
    process.env.FORCE_LOCAL_MODE = "true";
    process.env.VERCEL_ENV = "preview";
    const ctx = detectShopContextFromHostPath("warehouse-tire-site-abc123.vercel.app", "/");
    expect(ctx.mode).toBe("local");
  });

  test("production local host still local regardless of FORCE_LOCAL_MODE", () => {
    delete process.env.FORCE_LOCAL_MODE;
    const ctx = detectShopContextFromHostPath("shop.warehousetire.net", "/");
    expect(ctx.mode).toBe("local");
  });
});
