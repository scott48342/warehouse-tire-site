# Jake Standalone Platform — Staged Extraction Plan
*Plan date: 2026-06-16. Planning only — NO build, NO WTD production changes.*

## Guiding principle
```
Build standalone Jake ALONGSIDE WTD. Do not rip Jake out of WTD first.
WTD production (shop.warehousetiredirect.com, shop.warehousetire.net, /garage,
current Jake, fitment, cart, suppliers) stays 100% untouched until the standalone
engine is proven against a WTD adapter AND a demo dealer adapter.
```

The safety mechanism: we **copy** Jake's brain into a new package and make it talk through interfaces. The live `src/lib/jake/*` keeps running exactly as-is. We only swap WTD over to the new package in a far-future phase, behind a flag, after everything is proven.

---

## Phase 0 — Architecture Isolation Audit (the coupling map)

### Current coupling map (from code audit)
| Concern | Where it lives today | Coupling to WTD | Extractable? |
|---|---|---|---|
| Conversation orchestration | `index.ts` + `stream.ts` (**duplicated**) | Low (logic is generic) | ✅ copy to core |
| System prompt / persona | `systemPrompt.ts` (15.6KB hardcoded) | High (WTD phones, tone) | ✅ split static vs config |
| Tool registry + schemas | `tools.ts` `JAKE_TOOLS` | Low (schemas are generic) | ✅ copy to core |
| Tool execution | `tools.ts` `executeTool()` | **Very High** — `fetch(${baseUrl}/api/...)` | ⚠️ replace with providers |
| Fitment | `/api/vehicles/tire-sizes`, `/trims` via fetch | Very High (WTD app) | ⚠️ FitmentProvider |
| Inventory + suppliers | `/api/wheels/fitment-search`, `/api/tires/search`, `/api/search` | Very High | ⚠️ InventoryProvider |
| Pricing | baked inside those WTD APIs | Very High (hidden) | ⚠️ PricingProvider |
| Checkout/cart | `productUrl=${baseUrl}/tires/[sku]`, `cartUrl` passthrough (`stream.ts`) | Very High | ⚠️ CheckoutProvider |
| Mockup | `mockup.ts`/`wheelMockup.ts` (OpenAI) | Low (already self-contained) | ✅ MockupProvider |
| Lead capture | not in Jake core today | n/a | ➕ new LeadProvider |
| Analytics | `JakeAnalytics.tsx` (WTD-scoped) | Medium | ➕ AnalyticsProvider |
| Branding | prompt string + WTD storefront | High | ✅ BrandingProvider/config |
| Model choice | hardcoded `claude-sonnet-4-6` (2 spots) | Low | ✅ config |

### Key finding
Jake is coupled to WTD's **application via HTTP**, not its database. That HTTP seam is the extraction point: anywhere `executeTool` does `fetch(${baseUrl}/api/...)` becomes a **provider call**. The WTD adapter simply makes those same fetches; the demo adapter returns mock data.

### Extraction order (dependency-safe)
1. Conversation engine + tool **schemas** (no external calls) → core
2. Prompt builder split: static philosophy (core) vs tenant config (branding)
3. Provider **interfaces** (types only, zero runtime)
4. WTD adapter (implements interfaces by calling existing WTD APIs)
5. Demo adapter (mock data)
6. Demo app
7. (Future, flagged) WTD app switches to consume the package

### Risk map
| Phase | Touches WTD prod? | Risk |
|---|---|---|
| 0 Audit | No | **None** |
| 1 jake-core package | No (new files only) | **None** |
| 2 Interfaces | No | **None** |
| 3 WTD adapter | No (calls existing APIs read-only) | **Very Low** (no WTD code edits; adapter is new code) |
| 4 Demo adapter | No | **None** |
| 5 Dealer API spec | No (doc) | **None** |
| 6 Demo app | No (separate app) | **None** |
| 7 WTD migration | YES | **High** — out of scope for now, flag-gated, separate decision |

### No-production-risk strategy
- New code only lives in `packages/` and `apps/jake-demo/`. **Zero edits** to `src/lib/jake/*` or any WTD route.
- WTD adapter is **read-only** against existing public-ish APIs; it adds no load path the site doesn't already have.
- Monorepo or sibling repo — either works. Recommend a **pnpm/npm workspace** so the demo app imports `@jake/core` without publishing.
- CI for the package is independent of WTD's Vercel deploys.

---

## Phase 1 — Standalone Jake Core Package

### Proposed structure
```
packages/
  jake-core/
    src/
      engine/
        conversation.ts      # unified from index.ts + stream.ts (one impl, streaming + sync)
        toolLoop.ts           # the tool_use loop, provider-driven
      prompt/
        philosophy.ts         # dealer-AGNOSTIC advisor rules, fitment philosophy
        promptBuilder.ts      # composes philosophy + BrandingProvider config + context
      tools/
        registry.ts           # JAKE_TOOLS schemas (generic)
        handlers.ts           # map tool name -> provider call (NO fetch/URLs)
      context/
        buildContext.ts       # GalleryBuildContext, savedVehicle handling
        vehicle.ts            # vehicle parsing/normalization
      reasoning/
        recommendation.ts     # product recommendation reasoning
        enthusiastPlatforms.ts # moved from tools.ts (generic knowledge)
      mockup/
        mockupOrchestration.ts # calls MockupProvider interface
      types.ts
      index.ts                # exports engine + interfaces
    package.json              # name: @jake/core, no WTD deps
```

**Contains:** conversation orchestration, prompt builder, tool registry, build context, vehicle parsing, advisor rules, recommendation reasoning, fitment philosophy, mockup orchestration interface.
**Forbidden in core (lint-enforced):** any `warehousetiredirect`/`warehousetire.net` string, phone numbers, `fetch(` to WTD, Stripe, supplier names, checkout assumptions. Add an ESLint rule + a test that greps the build output for banned tokens.

---

## Phase 2 — Provider Interfaces

```ts
// packages/jake-core/src/providers.ts  (types only)

export interface TenantContext {
  tenantId: string;
  branding: BrandingConfig;
  // provider instances injected per request
  fitment: FitmentProvider;
  inventory: InventoryProvider;
  pricing: PricingProvider;
  checkout: CheckoutProvider;
  leads: LeadProvider;
  analytics: AnalyticsProvider;
  mockup: MockupProvider;
  model?: string; // default claude-sonnet-4-6
}

export interface VehicleQuery { year: number; make: string; model: string; trim?: string; }

export interface FitmentProvider {
  getTireSizes(v: VehicleQuery): Promise<{ tireSizes: string[]; staggered?: any; boltPattern?: string }>;
  getWheelFitment(v: VehicleQuery): Promise<{ boltPattern?: string; centerBore?: string; wheelDiameters: number[]; staggered?: any }>;
  listTrims(v: Omit<VehicleQuery,'trim'>): Promise<{ trims: string[] }>;
}

export interface TireResult { sku: string; brand: string; model: string; size: string; imageUrl?: string; terrain?: string; }
export interface WheelResult { sku: string; brand: string; model: string; diameter: number; finish?: string; imageUrl?: string; }

export interface InventoryProvider {
  searchTires(args: { vehicle?: VehicleQuery; size?: string; partNumber?: string; limit?: number }): Promise<TireResult[]>;
  searchWheels(args: { vehicle: VehicleQuery; diameter?: number; finish?: string; excludeFinishes?: string[]; limit?: number }): Promise<WheelResult[]>;
  getInventory(skus: string[]): Promise<Record<string, { inStock: boolean; qty: number }>>;
}

export interface PricingProvider {
  getPricing(items: { sku: string; type: 'tire'|'wheel' }[]): Promise<Record<string, { price: number; map?: number; currency: string }>>;
}

export interface CheckoutProvider {
  buildCart(items: { sku: string; qty: number; type: 'tire'|'wheel' }[], ctx: { vehicle?: VehicleQuery }): Promise<{ cartUrl: string; payload?: unknown }>;
  productUrl(sku: string, type: 'tire'|'wheel'): string;
}

export interface LeadProvider {
  capture(lead: { name?: string; phone?: string; email?: string; vehicle?: VehicleQuery; notes?: string }): Promise<{ leadId: string }>;
}

export interface AnalyticsProvider {
  track(event: string, props: Record<string, unknown>): Promise<void>; // tenant-scoped by impl
}

export interface BrandingProvider {
  getConfig(): BrandingConfig;
}
export interface BrandingConfig {
  assistantName: string;          // "Jake" | "Mike" | "TireBot"
  personality?: string;
  contact?: { phones?: { label: string; number: string }[]; };
  services?: string[];            // install? shipping? financing?
  policies?: string[];
  theme?: { primary?: string; logoUrl?: string };
}

export interface MockupProvider {
  generate(req: MockupRequest): Promise<{ success: boolean; imageUrl?: string; confidence?: string; error?: string }>;
}
export interface MockupRequest { /* vehicle + wheel(sku/img) + tire(sku/img) + lift */ }
```

Core's tool handlers call **only** these interfaces. No URLs in core.

---

## Phase 3 — WTD Adapter (proves engine works on real data, no WTD edits)
```
packages/adapters/wtd/
  src/
    wtdInventoryProvider.ts   # fetch(${WTD_BASE}/api/wheels/fitment-search ...)
    wtdFitmentProvider.ts     # fetch(${WTD_BASE}/api/vehicles/tire-sizes ...)
    wtdPricingProvider.ts     # (pricing comes embedded in WTD responses today)
    wtdCheckoutProvider.ts    # productUrl=${WTD_BASE}/tires/[sku]; cart passthrough
    wtdMockupProvider.ts      # POST ${WTD_BASE}/api/jake/mockup
    wtdBranding.ts            # Jake persona + Pontiac/Waterford phones
    config.ts                 # WTD_BASE from env
```
This is exactly today's `executeTool` logic, relocated behind interfaces. **WTD app is not modified** — the adapter is a new external client of existing endpoints. Definition of success: standalone engine + WTD adapter reproduces current Jake behavior.

---

## Phase 4 — Demo Dealer Adapter (THE milestone)
```
packages/adapters/demo-dealer/
  src/
    fixtures/{tires,wheels,inventory,pricing}.json
    demoInventoryProvider.ts  # serves fixtures
    demoFitmentProvider.ts    # small canned fitment set (or reuse a static map)
    demoPricingProvider.ts    # simple markup math
    demoCheckoutProvider.ts   # returns fake cart URL / logs payload
    demoLeadProvider.ts       # writes to local json/console
    demoAnalyticsProvider.ts  # console/file
    demoBranding.ts           # "TireBot", different theme/policies
```
**If Jake runs end-to-end on demo data with zero WTD dependency → Jake is becoming a platform.**

---

## Phase 5 — External Dealer API Spec (doc deliverable)
Dealer integrates via one of:
- **Option A — REST:** `/search-tires`, `/search-wheels`, `/get-pricing`, `/get-inventory`, `/create-cart` (we publish request/response schemas matching the provider interfaces).
- **Option B — Feeds:** `tires.csv`, `wheels.csv`, `inventory.csv`, `pricing.csv` (we provide an ingestion adapter that implements the providers over the parsed feeds).
- **Option C — Known vendors:** prebuilt adapters for TireConnect, TireTutor, TireWorks, ATD, K&M, USAF, WheelPros, Shopify, WooCommerce, custom. Each is just another provider implementation.
Fitment can stay **centralized** (our FitmentProvider hosted as a service) and offered as part of the subscription, independent of the dealer's inventory source.

---

## Phase 6 — Standalone Demo App
```
apps/jake-demo/                 # separate Next.js (or Vite) app, own deploy
  - imports @jake/core
  - wired to adapters/demo-dealer
  - dealer-branded chat UI (reuse/port JakeChat components, de-WTD'd)
  - demo checkout flow, lead capture, analytics panel
  - NO WTD dependency
```
First sellable/provable demo. Deploys to its own Vercel project (not WTD's).

---

## Timeline (1–2 engineers, planning estimate)
| Phase | Effort | WTD risk |
|---|---|---|
| 0 Audit (refine this doc into tickets) | 3–5 days | None |
| 1 jake-core package | 2–3 wks | None |
| 2 Provider interfaces | 3–5 days | None |
| 3 WTD adapter + parity test | 1.5–2 wks | Very Low |
| 4 Demo adapter | 1 wk | None |
| 5 Dealer API spec (doc) | 3–5 days | None |
| 6 Demo app | 2–3 wks | None |
| **Total to provable platform** | **~7–10 wks** | **No prod changes** |
| 7 (future) WTD migration behind flag | 3–6 wks | High — separate go/no-go |

---

## What can be done WITHOUT touching WTD
Phases 0–6 entirely. New packages + new demo app + read-only WTD adapter. WTD's repo and Vercel deploys are never modified.

## What eventually requires WTD integration
Only **Phase 7**: switching the live WTD app to consume `@jake/core` via the WTD adapter (retiring the in-app `src/lib/jake/*`). Flag-gated, reversible, separate decision — not part of this effort.

---

## Definition of Done

### "Jake is PORTABLE"
- `@jake/core` builds with **zero** WTD strings/URLs (lint + token-grep test passes).
- Engine runs against the **demo adapter** end-to-end: vehicle → fitment → search → recommend → mockup → cart link → lead → analytics, with **no** network call to any WTD domain.
- Same engine runs against the **WTD adapter** and reproduces current Jake behavior (parity test vs live Jake on a fixed script of 10 conversations).

### "Jake is DEALER-READY"
- A new dealer can be onboarded by supplying **only** config + one of {REST endpoints | CSV feeds | known-vendor creds} — **no core code changes**.
- Per-tenant branding, pricing, checkout, leads, analytics fully isolated (no cross-tenant reads; verified by an isolation test).
- Demo app deployable per-dealer with their branding; checkout produces a valid dealer cart; leads land in dealer's destination; analytics scoped to dealer.

---

## Biggest unknowns / blockers
1. **Pricing is hidden inside WTD's APIs.** The WTD adapter gets pricing "for free" because responses embed it; a real PricingProvider for dealers needs explicit rules. Unknown: how much WTD pricing logic must be reimplemented vs. lives only server-side. *(Investigate during Phase 3.)*
2. **Fitment data licensing/centralization.** Technically clean to host centrally; the open question is commercial/legal (serving competitors) + liability disclaimers. Not a code blocker.
3. **Checkout diversity.** Each dealer checkout (Shopify/TireConnect/custom) is its own adapter; effort scales with how many we promise. The interface de-risks it but doesn't eliminate per-integration work.
4. **UI portability.** Current Jake chat components live in WTD and may carry WTD assumptions; porting a clean, themeable widget into `apps/jake-demo` may surface hidden coupling.
5. **`index.ts` vs `stream.ts` duplication.** Must be unified into one core engine; risk of subtle behavior drift between sync and streaming paths during merge — parity test mitigates.
6. **Mockup cost/perf at multi-tenant scale** (OpenAI gen per request) — needs per-tenant rate limits/caching strategy before commercial use.

---

## Recommended immediate next step (still no build)
Turn Phase 0 into a tracked checklist + create the **empty** `packages/jake-core` skeleton with the interface stubs (types only, compiles, imports nothing from WTD) so we can validate the seam compiles before writing logic. That alone is zero-risk and confirms the boundary is real.
