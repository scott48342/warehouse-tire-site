# Jake → Dealer SaaS: Honest Architecture Review
*Assessment date: 2026-06-16 — based on direct audit of `src/lib/jake/*` and `src/app/api/jake/*`*

## TL;DR

**SaaS Readiness Score: 38/100**

Jake's *AI conversation engine* is genuinely reusable (~65% of the brain). But "Jake the product" is **not** a platform — it's a thin orchestration layer hard-wired to Warehouse Tire Direct's own Next.js APIs. Every tool call hits `${baseUrl}/api/...` on the **same app**. There is no tenant concept, no inventory abstraction, no checkout abstraction, and branding/policy live in a hardcoded prompt string. Turning it into multi-tenant SaaS is a real build (~4–6 months for a credible v1), not a refactor.

**If a dealer called tomorrow:** We could put a Jake-branded chat widget on their site in ~1–2 weeks **only if they let us resell OUR inventory/fitment/checkout** (i.e. they're really a WTD affiliate). Putting Jake on **their** inventory + **their** checkout = months of work. Those are two completely different products.

---

## How Jake actually works today (the ground truth)

```
Browser ──> /api/jake/chat(/stream) ──> lib/jake/index.ts (chat loop)
                                          │
                                          ├─ systemPrompt.ts   (hardcoded WTD persona, phone #s)
                                          ├─ tools.ts          (8 tools)
                                          │     └─ every tool does: fetch(`${baseUrl}/api/...`)
                                          │            /api/vehicles/tire-sizes
                                          │            /api/wheels/fitment-search
                                          │            /api/tires/search
                                          │            /api/search   (SKU lookup)
                                          │     baseUrl = VERCEL_URL ?? "shop.warehousetiredirect.com"
                                          └─ mockup/wheelMockup.ts (OpenAI vision+gen)
```

Key facts from the audit:
- **Model:** hardcoded `claude-sonnet-4-6` in `index.ts` (two places).
- **Inventory/fitment/pricing:** NOT in Jake. Jake calls WTD's own internal REST APIs by URL. Those APIs contain all the supplier logic (WheelPros, TireWeb/ATD/NTW/K&M, USAF), pricing rules, MAP floor, inventory feeds.
- **Tenancy:** none. No `tenantId`/`dealerId` anywhere. `isLocal` boolean is the only "variant" and it just toggles one prompt sentence about Pontiac/Waterford install.
- **Branding/persona/policy:** a 15.6KB hardcoded string (`JAKE_SYSTEM_PROMPT`) + store phone numbers baked in.
- **Checkout:** `productUrl` = `${baseUrl}/tires/${sku}` / `/wheels/${sku}` — i.e. links into WTD's own PDP/cart. `cartUrl` is passed through from tool results. Assumes WTD's Next.js storefront + Stripe.
- **Analytics:** `JakeAnalytics.tsx` exists but is WTD-scoped; no tenant isolation.

**The uncomfortable truth:** Jake isn't coupled to WTD's *database* directly — it's coupled to WTD's *entire application* via internal API calls. That's actually slightly better than DB coupling (there's an HTTP seam to exploit) but it means Jake has zero standalone capability. Without the WTD app behind it, Jake can't search, price, or sell anything.

---

## Layer-by-layer assessment

### 1. Multi-Tenant Readiness — ❌ Not ready (largest gap)
- No tenant model at all. Single hardcoded persona, single API target, single brand.
- Every request would need to resolve `dealerId → { apiConfig, branding, suppliers, pricing, checkout, prompt }`.
- **Required:** introduce a `TenantContext` resolved from domain/API key, threaded through `chat()`, `executeTool()`, mockup, and analytics. This touches every file.
- Complexity: **High.** This is the foundational refactor everything else depends on.

### 2. Inventory Layer — ⚠️ Abstractable, moderate effort
- Today: tools call WTD APIs which internally fan out to suppliers. The supplier adapters already *exist* but live inside the WTD app, not behind a clean interface Jake owns.
- The proposed `InventoryProvider` interface is the **right** design and is very achievable. WTD itself becomes "Provider #1" (`WtdInternalProvider` that just calls today's APIs).
- New providers (TireConnect, TireTutor, Dealer CSV, direct ATD/USAF/WheelPros) each = one adapter implementing `searchTires/searchWheels/getInventory/getPricing`.
- **Concern:** pricing rules are non-trivial (MAP floor, margin formulas, ≥4-in-stock supplier gating). Per-dealer pricing config is its own subsystem.
- Complexity: **Medium.** ~3–5 weeks for the interface + WTD adapter + 1 external adapter + per-tenant pricing config.

### 3. Fitment Layer — ✅ Strongest candidate, but a business decision
- Fitment is already centralized (internal DB, Universal Fitment Resolver). Exposing it as a shared "Fitment API" all dealers consume is technically clean.
- **Business concern (the real one):** this fitment data is a WTD asset built over months of cleanup. Selling/licensing it to dealers (some of whom may compete with WTD locally) is a strategic call, not a technical one. Also: liability/disclaimer terms when third parties rely on it.
- Complexity: **Low technical / High strategic.**

### 4. Branding Layer — ⚠️ Easy mechanically, needs config plumbing
- Persona ("Jake" → "Mike"/"TireBot"), tone, phone numbers, services are all in one prompt string today.
- **Required:** move persona to per-tenant config (name, personality, contact, services, policies) and template the system prompt. Genuinely doable *without code changes per dealer* once the templating exists.
- Complexity: **Low–Medium.** ~1–2 weeks once TenantContext exists.

### 5. Checkout Layer — ❌ Heavily WTD-assumed
- Jake builds `productUrl`/`cartUrl` pointing at WTD's own storefront routes and assumes WTD's cart + Stripe.
- For a dealer on Shopify/TireConnect/custom, Jake would need a `CheckoutProvider` abstraction (build cart → return dealer-specific URL/payload).
- This is the **second-biggest blocker** after tenancy, because checkout is where money moves and every dealer's is different.
- Complexity: **High.** Each checkout integration is a project; needs a provider interface + per-dealer adapters.

### 6. Analytics Layer — ⚠️ Needs isolation from scratch
- Current analytics are WTD-global. No tenant/lead isolation.
- **Required:** every event tagged with `tenantId`; storage partitioned; dashboards scoped; lead capture per-dealer with no cross-tenant reads. This is also a compliance/trust requirement for SaaS.
- Complexity: **Medium.**

### 7. AI Prompt Layer — ✅ Mostly reusable
- The *conversational intelligence* (tool-use loop, fitment reasoning, enthusiast platform knowledge, mockup flow) is dealer-agnostic and genuinely valuable.
- WTD-specific bits are small and isolatable (phone #s, "local install" note).
- Per-dealer prompts/financing/services/policies = config-driven template. **Achievable without code changes** once templating + TenantContext exist.
- Complexity: **Low** (rides on #1 and #4).

---

## 8. Revenue / Feasibility verdict

**A) Can Jake become a standalone SaaS?**
Yes — *technically feasible*, and the AI core is a real differentiator. But it's a **new product built around Jake's brain**, not a config flip on the current app.

**B) How much work?**
- Affiliate widget (WTD inventory, dealer branding): **1–2 weeks.**
- Credible multi-tenant v1 (dealer inventory + branding + 1 checkout): **4–6 months, 1–2 engineers.**
- Full commercial SaaS (self-serve onboarding, billing, multiple supplier/checkout adapters, isolation, SLAs): **9–15 months.**

**C) Largest blockers (in order):**
1. **No tenant model** — foundational, touches everything.
2. **Checkout coupling** — money path, per-dealer, high effort.
3. **Inventory/pricing abstraction + per-tenant pricing config.**
4. **Analytics/lead isolation** (trust + compliance).
5. **Strategic:** licensing WTD's fitment data to potential competitors.

**D) Refactor first:** `TenantContext` + `InventoryProvider` interface, with WTD as the first adapter. Nothing else is safe to build until tenancy exists.

**E) % already reusable:**
- AI conversation engine / tool loop / fitment reasoning / mockup pipeline: **~65% reusable.**
- Product *as shipped* (tenancy, checkout, branding, analytics, inventory abstraction): **~10–15% reusable.**
- Blended realistic figure: **~35–40%.**

---

## SaaS Readiness Score: 38/100
| Layer | Score | Notes |
|---|---|---|
| AI/Prompt engine | 75 | Strong, dealer-agnostic core |
| Fitment | 70 | Centralized already; strategic Q |
| Inventory | 40 | Adapters exist but not abstracted |
| Branding | 45 | One prompt string; needs config |
| Multi-tenancy | 5 | Does not exist |
| Checkout | 20 | WTD-assumed end to end |
| Analytics | 25 | No tenant isolation |

---

## Recommended Roadmap

### Phase 1 — Minimum Viable Dealer (1–2 wks): "Affiliate Jake"
- Dealer embeds Jake widget; **inventory/fitment/checkout stay WTD's**; dealer gets custom name/colors + referral attribution.
- Ship `TenantConfig` (lite): name, persona, theme, phone, attribution tag. Template the system prompt.
- **This is sellable now** and validates demand without the heavy build. It's really "WTD affiliate program with an AI front end."

### Phase 2 — Multi-Tenant Platform (4–6 mo)
- Real `TenantContext` resolved by domain/API key.
- `InventoryProvider` interface + WTD adapter + 1 external (CSV or one supplier direct).
- Per-tenant pricing config; `CheckoutProvider` with first real integration (Shopify or hosted cart).
- Tenant-isolated analytics + lead capture.

### Phase 3 — Commercial SaaS (9–15 mo)
- Self-serve onboarding, Stripe billing/metering, multiple inventory + checkout adapters, RBAC, audit logs, SLA/monitoring, data-isolation guarantees, fitment-API licensing terms.

---

## The most important answer
> *If a dealer called tomorrow wanting Jake on their site with THEIR inventory and THEIR branding:*

- **Their branding, OUR inventory/checkout:** ~1–2 weeks. Real and sellable. (Affiliate model.)
- **THEIR inventory + THEIR checkout:** not close — that's the Phase 2 build (months). Today Jake literally cannot operate without WTD's app behind it.

**Recommendation:** Sell Phase 1 ("Affiliate Jake") now to validate the market and generate revenue, while building Phase 2's `TenantContext` + `InventoryProvider` foundation. Do **not** promise dealers their-inventory/their-checkout until Phase 2 ships.
