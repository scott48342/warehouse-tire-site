# Phase 0 — Jake ↔ WTD Coupling Map
*Evidence-backed. Read-only audit of `src/lib/jake/*` + `src/app/api/jake/*`. No code changed.*
*Covers tasks P0-2 (tool inventory), P0-3 (master coupling), P0-5 (checkout coupling).*

## Master coupling table
| # | Concern | Lives in | Coupling | Code reference | Target provider |
|---|---|---|---|---|---|
| 1 | Conversation orchestration | `index.ts` `chat()` + `stream.ts` `streamChat()` (duplicated) | Low (logic generic) | index.ts ~L46; stream.ts ~L107 | core engine |
| 2 | Model selection | hardcoded `claude-sonnet-4-6` | Low | index.ts (2×: initial + tool-loop call); stream.ts | core config / TenantContext.model |
| 3 | System prompt / persona | `systemPrompt.ts` `JAKE_SYSTEM_PROMPT` (~15.6KB) | High | systemPrompt.ts L8 onward | core philosophy + BrandingProvider |
| 4 | Tool schemas | `tools.ts` `JAKE_TOOLS` | Low (schemas generic) | tools.ts L137–266 | core registry |
| 5 | Tool execution | `tools.ts` `executeTool()` | **Very High** | tools.ts L268+ (`const baseUrl = getBaseUrl()`) | provider dispatch |
| 6 | Base URL / domain | `getBaseUrl()` default `shop.warehousetiredirect.com` | **Very High** | tools.ts L10–15; stream.ts L58–61; wheelMockup ~L211–218 | removed from core (adapter owns) |
| 7 | Fitment: tire sizes | `lookup_tire_sizes` → `/api/vehicles/tire-sizes` | Very High | tools.ts L~290 | FitmentProvider.getTireSizes |
| 8 | Fitment: wheel specs | `lookup_wheel_fitment` → `/api/vehicles/tire-sizes` | Very High | tools.ts L~318 | FitmentProvider.getWheelFitment |
| 9 | Fitment: trims | `list_trims` → `/api/vehicles/trims` | Very High | tools.ts L~378 | FitmentProvider.listTrims |
| 10 | Inventory: wheels | `search_wheels` → `/api/wheels/fitment-search` | Very High | tools.ts L~414 | InventoryProvider.searchWheels |
| 11 | Inventory: tires | `search_tires` → `/api/tires/search` | Very High | tools.ts L~540 | InventoryProvider.searchTires |
| 12 | SKU resolution (mockup) | `/api/search?q=SKU`, `/api/tires/search?size&partNumber` | Very High | tools.ts L~660–690 | InventoryProvider lookup |
| 13 | Pricing | embedded inside WTD API responses (not computed in Jake) | Very High (hidden) | implicit in search results | PricingProvider (see RISK_REGISTER) |
| 14 | Checkout: product URL | `productUrl = ${baseUrl}/wheels/[sku]` / `/tires/[sku]` | Very High | tools.ts L476 (wheels), L576 (tires) | CheckoutProvider.productUrl |
| 15 | Checkout: cart URL | `cartUrl` passthrough from tool results | Very High | stream.ts L67,123,321–322,437–438 | CheckoutProvider.buildCart |
| 16 | Enthusiast platform knowledge | `ENTHUSIAST_PLATFORMS` map + `detectEnthusiastPlatform()` | None (generic auto knowledge) | tools.ts L18–135 | core reasoning |
| 17 | Mockup generation | `mockup.ts` / `wheelMockup.ts` (OpenAI direct) | Low (self-contained) | wheelMockup.ts | MockupProvider |
| 18 | Lead capture | not present in Jake core today | n/a | — | new LeadProvider |
| 19 | Analytics | `JakeAnalytics.tsx` (UI, WTD-scoped) | Medium | components/jake/JakeAnalytics.tsx | new AnalyticsProvider |
| 20 | `isLocal` variant | toggles one install sentence | Low | index.ts L~100; stream.ts L~169 | BrandingProvider config |

## The 8 Jake tools (P0-2)
| Tool | Schema required args | Execution target (WTD URL) | Provider mapping |
|---|---|---|---|
| `lookup_tire_sizes` | year, make, model (+trim) | `GET /api/vehicles/tire-sizes` | FitmentProvider.getTireSizes |
| `lookup_wheel_fitment` | year, make, model (+trim) | `GET /api/vehicles/tire-sizes` (+ enthusiast fallback) | FitmentProvider.getWheelFitment |
| `list_trims` | year, make, model | `GET /api/vehicles/trims` | FitmentProvider.listTrims |
| `search_wheels` | year, make, model (+diameter, limit, excludeFinishes, preferFinish) | `GET /api/wheels/fitment-search` | InventoryProvider.searchWheels |
| `search_tires` | (none required; size OR vehicle) | `GET /api/tires/search` | InventoryProvider.searchTires |
| `get_platform_context` | year, make, model | **none** — pure in-code knowledge | core reasoning (no provider) |
| `generate_wheel_mockup` | year, make, model, color, wheelBrand, wheelModel, wheelSize | `/api/search`, `/api/tires/search`, then `wheelMockup.ts` (OpenAI) | InventoryProvider (resolve) + MockupProvider |

**Note:** `get_platform_context` is the only tool with ZERO external coupling — it's pure knowledge. It moves to core cleanly as a model.

## Checkout coupling detail (P0-5)
- **Product URLs** are built directly in `executeTool`:
  - wheels: `productUrl: \`${baseUrl}/wheels/${w.sku}\`` (tools.ts L476)
  - tires: `productUrl: \`${baseUrl}/tires/${t.partNumber || t.sku}?source=...\`` (tools.ts L576)
- **Cart URL** flows through the stream as a typed event `{ type: "cartUrl"; cartUrl }` (stream.ts L67) — set from `resultObj.cartUrl` (L321–322) and yielded to the UI (L437–438).
- **Assumptions baked in:** WTD's Next.js storefront route shape (`/wheels/[sku]`, `/tires/[sku]`), WTD's cart, and (downstream of the storefront) Stripe. A standalone `CheckoutProvider` must own both `productUrl(sku,type)` and `buildCart(items,ctx) → { cartUrl }`.

## Domain literals found (for BANNED_TOKENS + branding split)
- `shop.warehousetiredirect.com` — `getBaseUrl()` default (tools.ts, stream.ts, wheelMockup.ts)
- `warehousetire.net` — `isLocal` prompt note (index.ts, stream.ts)
- `(248) 332-4120` (Pontiac), `(248) 683-0070` (Waterford) — systemPrompt.ts L32–33 and used-tire section
- Persona name "Jake" — systemPrompt.ts L8
