# Phase 0 — Extraction Inventory
*Covers P0-1 (conversation engine), P0-4 (prompt split), P0-11 (extraction order + workspace decision).*
*Read-only analysis. No code changed.*

## P0-1 — Conversation engine inventory

### Two near-duplicate orchestration paths
| File | Export | Purpose | Returns |
|---|---|---|---|
| `index.ts` | `chat()` | synchronous request/response | `JakeResponse` (response, products, toolsUsed, vehicle) |
| `stream.ts` | `streamChat()` | streaming async generator | `StreamEvent` sequence (status, text, products, cartUrl, ...) |

**Both implement the same logic:** build message history → compose system prompt (base + saved-vehicle context + isLocal note) → call Claude with `JAKE_TOOLS` → loop on `stop_reason === "tool_use"` running `executeTool` → collect products + detected vehicle → emit final text.

**Responsibilities core must absorb:**
1. Message history assembly (`history → Anthropic.MessageParam[]`)
2. System prompt composition (base philosophy + per-tenant branding + saved vehicle + variant note)
3. Anthropic client call (model currently hardcoded `claude-sonnet-4-6` — **move to config**)
4. Tool-use loop + tool dispatch (→ providers, not fetch)
5. Product collection from tool results (tires/wheels/staggeredPairs)
6. Vehicle detection from tool inputs
7. Streaming event emission (stream path) + sync aggregation (sync path)

**Key risk:** `chat()` and `streamChat()` can drift. Core must unify into ONE engine that supports both a streaming and a collected mode. Parity test (see PARITY_TEST_PLAN.md) guards behavior equivalence.

### Model usage
- `client.messages.create({ model: "claude-sonnet-4-6", ... })` appears in BOTH files, BOTH the initial call and the in-loop call (4 literal occurrences total). All must become `ctx.model ?? DEFAULT_MODEL`.

## P0-4 — Prompt / persona split spec

`systemPrompt.ts` `JAKE_SYSTEM_PROMPT` is one ~15.6KB template literal. Classification:

### → CORE (dealer-agnostic "philosophy")
- Advisor persona archetype ("enthusiast wheel/tire consultant with database access") — *templatable name*
- Expertise list (OEM sizes, staggered, bolt patterns, plus/minus, HD truck, build culture)
- ENTHUSIAST PLATFORM INTELLIGENCE block (4th-gen F-body, Corvette, Mustang, Mopar LX, trucks) — generic automotive knowledge
- Fitment philosophy / recommendation reasoning / how to use tools
- Mockup flow instructions (SKU-based, tire guidance)

### → BRANDING PROVIDER (tenant config — externalize)
- Assistant NAME ("Jake") — L8
- Store phone numbers `(248) 332-4120`, `(248) 683-0070` — L32–33 + used-tire section
- USED TIRES policy block (WTD-specific store policy → becomes a configurable `policies[]` entry)
- `isLocal` install note re warehousetire.net + Pontiac/Waterford (index.ts/stream.ts) → branding `services[]`/`contact`
- Any "give us a call" closer tied to WTD numbers

### Split mechanism (planned, not built)
`promptBuilder(philosophy, brandingConfig, context)` composes:
`philosophy + renderBranding(brandingConfig) + savedVehicleContext + variantNotes`.
Dealers change name/phones/policies/services via config — **no core edits**.

## P0-11 — Extraction order + workspace decision

### Dependency-safe extraction order
1. Conversation engine + tool **schemas** (no external calls) → core
2. Prompt builder split (philosophy in core, branding via provider)
3. Provider **interface types** (zero runtime)
4. WTD adapter (implements interfaces via existing WTD APIs — read-only)
5. Demo adapter (mock data) ← **milestone: Jake runs with no WTD**
6. Demo app
7. (Future, flag-gated) WTD app consumes the package

### Workspace decision (RECOMMENDATION — for Scott's approval)
- **Recommended:** **separate sibling repo** `jake-platform/` (own git, own CI, own Vercel project), using a pnpm/npm workspace internally for `packages/*` + `apps/jake-demo`.
- **Rationale:** maximal isolation from WTD — zero chance a Jake build/test/deploy touches WTD's repo or Vercel project. The WTD adapter calls WTD over HTTP only.
- **Alternative considered:** monorepo `packages/` inside the existing WTD repo. Rejected for Phase 1 because it increases risk of accidental coupling and shares CI/deploy surface with production.
- **Decision required before Phase 1.** (Listed in next-step gate.)

### Note on current repo location
Active dev repo is `C:\Users\Scott-Pc\backup clawd\warehouse-tire-site` (per TOOLS.md). A sibling repo would live alongside it, e.g. `C:\Users\Scott-Pc\backup clawd\jake-platform` (path TBD on approval).
