# Phase 0 — Risk Register
*Covers P0-6 (pricing investigation) + P0-9 (consolidated risks).*
*Analysis only. No code changed.*

## P0-6 — Pricing-location investigation (finding)
**Finding:** Jake does NOT compute pricing. Prices arrive **embedded in WTD API responses** (`/api/wheels/fitment-search`, `/api/tires/search`). `executeTool` maps those response fields straight into product results; the actual pricing math (per MEMORY.md: wheels = cost×1.30 capped at MSRP; tires = (MSRP×0.85)+$40; MAP floor; ≥4-in-stock supplier gating) lives **server-side in the WTD APIs**, invisible to Jake.

**Implication:**
- The **WTD adapter** inherits pricing for free (it just reads the same response fields).
- A **standalone dealer** has no such API. A real `PricingProvider` must either (a) accept dealer-supplied prices in feeds, or (b) implement configurable markup rules. The WTD pricing formulas are a WTD asset and are NOT portable as-is.

## Consolidated risk table
| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | **Pricing hidden in WTD APIs** — standalone PricingProvider needs rules WTD never exposed to Jake | High | High | Phase 3: document exact price fields WTD returns; Phase 2: design configurable markup engine; never reuse WTD formulas for other dealers without decision |
| R-2 | **Fitment data licensing** — centralizing WTD's fitment DB and serving competitors is a business/legal question, plus liability/disclaimer terms | Med | High | Out-of-band decision by Scott; technical design keeps FitmentProvider swappable so WTD fitment is optional |
| R-3 | **Checkout diversity** — each dealer checkout (Shopify/TireConnect/custom) is its own adapter | High | Med | CheckoutProvider interface isolates it; scope = how many integrations promised; demo uses fake cart |
| R-4 | **index.ts / stream.ts duplication drift** — unifying two orchestration loops may change behavior subtly | Med | Med | PARITY_TEST_PLAN.md: fixed 10-conversation script vs live Jake before accepting Phase 3 |
| R-5 | **UI portability** — Jake chat components live in WTD, may carry WTD assumptions | Med | Med | Phase 6: port a clean themeable widget into apps/jake-demo; surface coupling then |
| R-6 | **Mockup cost/perf at multi-tenant scale** — OpenAI gen per request, per dealer | Med | Med | Per-tenant rate limits + cache strategy before commercial use; MockupProvider can be disabled per tenant |
| R-7 | **Accidental WTD production change during extraction** | Low | **Critical** | Sibling-repo isolation; banned-token gate; validation commands; WTD adapter is read-only HTTP client |
| R-8 | **Model coupling** (`claude-sonnet-4-6` hardcoded ×4) | Low | Low | Move to TenantContext.model with default; trivial |
| R-9 | **Saved-vehicle / build-context shape** assumed across engine | Low | Low | Capture types in core; covered by parity test |
| R-10 | **Anthropic SDK + OpenAI SDK as core deps** — core must stay runtime-light | Low | Med | Engine depends on Anthropic SDK (unavoidable); MockupProvider abstracts OpenAI out of core |

## Top blockers (priority order)
1. **R-7** (never break WTD) — addressed by isolation strategy; non-negotiable.
2. **R-1** (pricing) — biggest *technical* unknown for true dealer support.
3. **R-3** (checkout) — biggest *scope* driver.
4. **R-2** (fitment licensing) — biggest *business* gate.
