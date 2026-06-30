# Issue A — Active-Vehicle Sync Loop: Scoped Plan (DRAFT, not implemented)

Status: investigation + plan only. No code changed by this document.

## Problem (confirmed live)
Two effects both write `VehicleMemoryContext.setActiveVehicle` from sources that can
disagree, with no arbitration:

- `src/components/VehicleMemorySync.tsx` — writes from **URL params** (mounted in Header, global).
- `src/components/garage/GarageVehicleMemorySync.tsx` — writes from **GarageContext.activeVehicle**
  (mounted in `app/layout.tsx`, global). Garage's active vehicle is never updated from the URL.

On any page whose URL vehicle != the garage's most-recently-active vehicle, the two effects
overwrite each other every render → mount-time oscillation (hundreds of `vehicle_changed`
events), settling on whichever ran last → active vehicle can end up != the page you're on,
and can be corrupted to undefined. This also lets a stale active vehicle swallow a wheel-size
selector navigation (the Ram 2500 symptom).

## Full writer/reader map (as of 2026-06-22)

Writers of `setActiveVehicle` / `clearActiveVehicle`:
- VehicleMemorySync.tsx        — setActiveVehicle from URL (the racing writer #1)
- garage/GarageVehicleMemorySync.tsx — setActiveVehicle from garage (the racing writer #2)
- VehicleEntryGate.tsx L118    — explicit user pick
- SearchModal.tsx L308         — explicit user pick
- VisualFitmentLauncher.tsx L309 — explicit user pick
- jake/JakeChat.tsx L936/1080/1477 — Jake set/clear
- VehicleIndicator.tsx L47     — explicit user clear ("remove vehicle")

Readers of `activeVehicle` (must not regress):
- VehicleIndicator.tsx (header chip)
- homepage/PersonalizedVehicleSection.tsx
- jake/JakeChat.tsx, jake/JakeHomepageSection.tsx
- QuickViewModal.tsx, SearchModal.tsx
- VehicleEntryGate.tsx, VisualFitmentLauncher.tsx

## Options

### Option 1 — Minimal guard (LOWEST RISK, recommended first step)
Stop the loop without changing the data model.
- In `setActiveVehicle` (VehicleMemoryContext): widen the no-op equality check to include
  `trim` and `wheelDia`, AND skip the write when the incoming vehicle deep-equals current.
  (Today it compares year/make/model/modification only.)
- In `GarageVehicleMemorySync`: only write when the garage vehicle is actually newer/changed
  (track last-synced garage id) instead of on every render.
- In `VehicleMemorySync`: unchanged, but it already guards on `isDifferent`.

Effect: the two writers still exist, but neither re-fires when nothing changed, so they cannot
ping-pong. Does NOT fully resolve "which source wins" when URL and garage genuinely disagree —
it just stops the infinite loop and the undefined-corruption.

NOTE: the user explicitly asked NOT to modify VehicleMemoryContext or GarageContext for the
Issue B fix; this Option DOES modify them, so it is out of scope for that fix and must be its
own change.

### Option 2 — Single source of truth (MEDIUM RISK, fully fixes Issue A)
Make exactly one writer authoritative based on context:
- On vehicle-scoped pages (URL has year/make/model): URL wins. `GarageVehicleMemorySync` must
  NOT overwrite from garage on those pages.
- Elsewhere (no URL vehicle): garage wins (current behavior).
Implementation: pass a "URL has a vehicle" signal (or read pathname/searchParams) into
`GarageVehicleMemorySync` so it defers to URL when present. Keep VehicleMemorySync as the
URL writer.

Effect: deterministic active vehicle = what you're looking at. Fixes both the loop and the
"active != page" mismatch, which should also unblock the swallowed wheel-size click (Issue A
nav symptom). Requires regression testing of the header chip + Jake + homepage personalization
because their active vehicle will now follow the URL on vehicle pages.

### Option 3 — Consolidate to one context (HIGH RISK, not recommended now)
Collapse VehicleMemoryContext into GarageContext (or vice versa) so there is one store.
Large blast radius (every reader/writer above), high regression surface. Defer.

## Recommended sequencing
1. Ship Option 1 first (stops the loop + undefined corruption; smallest diff).
2. Then evaluate Option 2 for the deterministic-source behavior + the Ram wheel-size symptom.
3. Re-test Ram 2500 / Avalanche wheel-size selectors after each step.

## What this could affect / break (regression checklist)
- Header vehicle chip (VehicleIndicator): correct vehicle shown, "remove" still works.
- Homepage personalization (PersonalizedVehicleSection): right vehicle, no flicker.
- Jake (JakeChat/JakeHomepageSection): reads active vehicle for context; ensure no reset mid-chat.
- Quick view / Search modal: vehicle prefilled correctly.
- VehicleEntryGate + VisualFitmentLauncher: explicit picks still persist and navigate.
- Wheel-size selectors (WheelDiameterSelector / WheelSizeGateSelector): click navigates with
  wheelDia, no swallowed navigation (re-test Ram 2500 + Avalanche specifically).
- Cart "Fits your" banner (Issue B, already shipped): unaffected — it reads cart items, not
  active vehicle. Confirm it stays correct.
- Analytics: `vehicle_changed`/`vehicle_saved` events should drop to sane counts (no flood).

## Verification plan
- Add temporary instrumentation: count `vehicle_changed` events on mount for
  F-150 / Ram 2500 / Avalanche 1500; expect ~1, not hundreds.
- Live click test of wheel-size selectors on all three vehicles → URL gains wheelDia, page
  re-renders with matching tires, no redirect loop.
- Smoke the readers above on a vehicle page and on the homepage.
- tsc clean; prod build; deploy to preview before production.
