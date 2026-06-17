# Phase 0 — Provider Interface Draft (TEXT ONLY)
*Covers P0-7. These are DRAFT types in Markdown for review — NOT compiled `.ts` files.*
*Nothing here is implemented. No runtime code exists.*

> Design rule: Jake core depends ONLY on these interfaces. Core contains no URLs,
> no fetch to WTD, no Stripe, no supplier names. Adapters (WTD, demo, future dealers)
> implement these. A per-request `TenantContext` injects the concrete providers.

## TenantContext (the injection seam)
```ts
interface TenantContext {
  tenantId: string;
  branding: BrandingConfig;
  model?: string;              // default "claude-sonnet-4-6"
  fitment: FitmentProvider;
  inventory: InventoryProvider;
  pricing: PricingProvider;
  checkout: CheckoutProvider;
  leads: LeadProvider;
  analytics: AnalyticsProvider;
  mockup: MockupProvider;
}
```

## Shared types
```ts
interface VehicleQuery { year: number; make: string; model: string; trim?: string; }

interface TireResult {
  sku: string; brand: string; model: string; size: string;
  imageUrl?: string; terrain?: string;
  price?: number; productUrl?: string;   // populated via pricing/checkout providers
}
interface WheelResult {
  sku: string; brand: string; model: string; diameter: number;
  finish?: string; imageUrl?: string;
  price?: number; productUrl?: string;
}
```

## FitmentProvider
```ts
interface FitmentProvider {
  getTireSizes(v: VehicleQuery): Promise<{
    tireSizes: string[]; staggered?: unknown; boltPattern?: string;
  }>;
  getWheelFitment(v: VehicleQuery): Promise<{
    boltPattern?: string; centerBore?: string;
    wheelDiameters: number[]; staggered?: unknown;
  }>;
  listTrims(v: Omit<VehicleQuery, "trim">): Promise<{ trims: string[] }>;
}
```

## InventoryProvider
```ts
interface InventoryProvider {
  searchTires(args: {
    vehicle?: VehicleQuery; size?: string; partNumber?: string; limit?: number;
  }): Promise<TireResult[]>;

  searchWheels(args: {
    vehicle: VehicleQuery; diameter?: number;
    finish?: string; excludeFinishes?: string[]; limit?: number;
  }): Promise<WheelResult[]>;

  getInventory(skus: string[]): Promise<Record<string, { inStock: boolean; qty: number }>>;

  // Used by mockup flow to resolve authoritative product image from a SKU
  resolveProductImage(sku: string, type: "tire" | "wheel", size?: string):
    Promise<{ imageUrl?: string; brand?: string; model?: string; finish?: string }>;
}
```

## PricingProvider
```ts
interface PricingProvider {
  getPricing(items: { sku: string; type: "tire" | "wheel" }[]):
    Promise<Record<string, { price: number; map?: number; currency: string }>>;
}
```
> NOTE: WTD adapter gets pricing "for free" (embedded in inventory responses today).
> Standalone dealers need explicit rules. See RISK_REGISTER R-1.

## CheckoutProvider
```ts
interface CheckoutProvider {
  productUrl(sku: string, type: "tire" | "wheel"): string;
  buildCart(
    items: { sku: string; qty: number; type: "tire" | "wheel" }[],
    ctx: { vehicle?: VehicleQuery }
  ): Promise<{ cartUrl: string; payload?: unknown }>;
}
```

## LeadProvider
```ts
interface LeadProvider {
  capture(lead: {
    name?: string; phone?: string; email?: string;
    vehicle?: VehicleQuery; notes?: string;
  }): Promise<{ leadId: string }>;
}
```

## AnalyticsProvider
```ts
interface AnalyticsProvider {
  track(event: string, props: Record<string, unknown>): Promise<void>; // tenant-scoped by impl
}
```

## BrandingProvider / BrandingConfig
```ts
interface BrandingProvider { getConfig(): BrandingConfig; }

interface BrandingConfig {
  assistantName: string;                 // "Jake" | "Mike" | "TireBot"
  personality?: string;                  // tone override
  contact?: { phones?: { label: string; number: string }[] };
  services?: string[];                   // e.g. "in-store install", "free shipping", "financing"
  policies?: string[];                   // e.g. used-tire policy text
  theme?: { primary?: string; logoUrl?: string };
}
```

## MockupProvider
```ts
interface MockupProvider {
  generate(req: MockupRequest): Promise<{
    success: boolean; imageUrl?: string; confidence?: string;
    method?: string; cached?: boolean; error?: string;
  }>;
}

interface MockupRequest {
  vehicle: { year: number; make: string; model: string; color: string };
  wheel: { brand?: string; model?: string; sku?: string; imageUrl?: string; finish?: string; size: number };
  tire?: { size?: string; sku?: string; brand?: string; model?: string; imageUrl?: string; terrain?: string };
  lift?: string;
}
```

## Open interface questions (resolve before Phase 2 implementation)
1. Does `PricingProvider` merge into `InventoryProvider` (since WTD bundles them) or stay separate? Draft keeps separate for dealer flexibility.
2. Should `resolveProductImage` live on InventoryProvider (chosen) or a dedicated resolver?
3. `staggered`/`payload` typed as `unknown` for now — tighten when WTD adapter is written (Phase 3).
4. Streaming: engine needs a `mode: "stream" | "collect"` — not a provider concern, but noted for engine API.
