# Phase 0 — Banned Tokens for @jake/core
*Covers P0-8. Spec for the Phase 1 lint/grep gate. No code yet.*

> Purpose: `@jake/core` must be dealer-agnostic. These strings must NEVER appear
> in compiled `packages/jake-core` output. A CI test (Phase 1) greps the built
> bundle + source for these tokens and FAILS the build if any are found.

## Hard-banned (case-insensitive) — WTD identity
| Token | Why | Where it currently appears |
|---|---|---|
| `warehousetiredirect` | WTD domain | getBaseUrl() default |
| `warehousetire.net` | WTD local domain | isLocal note |
| `warehousetire` | WTD brand | broad catch |
| `shop.warehousetiredirect` | WTD storefront host | getBaseUrl() |
| `pos.warehousetiredirect` | WTD POS host | (vercel.json, not Jake — still ban in core) |
| `248) 332-4120` | Pontiac store phone | systemPrompt.ts |
| `248) 683-0070` | Waterford store phone | systemPrompt.ts |
| `Pontiac` (as store ref) | WTD store | systemPrompt.ts ⚠️ see note |
| `Waterford` (as store ref) | WTD store | systemPrompt.ts ⚠️ see note |

> ⚠️ "Pontiac"/"Waterford" are also legitimate vehicle/geographic words. The grep
> gate should target the store-context patterns (phone-adjacent / "our Pontiac
> location"), not bare occurrences. Recommend a regex allowlist exception for
> `Pontiac` appearing as a vehicle make (e.g. "Pontiac Firebird" in enthusiast data).

## Hard-banned — checkout / payment coupling
| Token | Why |
|---|---|
| `stripe` | WTD payment processor — core must not assume it |
| `/cart` (WTD route literal) | checkout assumption |
| `/tires/` , `/wheels/` (as URL path literals) | WTD storefront route shape |

## Hard-banned — supplier names (core must not assume a supplier)
| Token | Why |
|---|---|
| `wheelpros` / `wheel pros` | WTD supplier |
| `tireweb` / `tirewire` | WTD supplier |
| `usautoforce` / `usaf` | WTD supplier |
| `tirelibrary` | WTD tire image CDN |
| `k&m` / `km` (supplier context) | WTD supplier |
| `atd` , `ntw` (supplier context) | WTD suppliers |

## Hard-banned — infra / config literals
| Token | Why |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | WTD env assumption |
| `VERCEL_URL` (as fallback host logic) | host coupling — core shouldn't self-resolve host |
| `prj_aVlk3N6lFlAbxB4g9K8msvOnSBZK` | WTD Vercel project id |
| `team_m8jxeE4BsKZXWOFPBjSC8QUn` | WTD Vercel team id |

## ALLOWED in core (explicitly NOT banned)
- Generic automotive knowledge: bolt patterns, "Camaro", "Mustang", "Silverado", terrain types — these are domain knowledge, not WTD identity.
- `claude-sonnet-4-6` (default model constant) — allowed as config default.
- Enthusiast platform data (`ENTHUSIAST_PLATFORMS`) — generic.
- The assistant name placeholder must be templated; literal "Jake" is ALLOWED only as a default config value in a branding example, NOT hardcoded in engine logic.

## Gate implementation note (Phase 1)
- Test script greps `packages/jake-core/src/**` AND the built `dist/**` for the hard-banned list.
- Phone numbers and project/team ids are exact-match.
- Supplier/domain tokens are case-insensitive substring.
- Store-name tokens use phone-adjacency regex to avoid false positives.
- Build FAILS (non-zero exit) on any hard-banned hit.
