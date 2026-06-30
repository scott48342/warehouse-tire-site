# Issue A — Temporary Garage Disable (Evaluation, NOT implemented)

Goal: kill the active-vehicle sync loop with the smallest customer-facing blast radius,
without deleting garage code. URL vehicle must win on vehicle/search/product pages.

## How the loop happens (recap)
- `VehicleMemorySync` (Header) writes active vehicle from the **URL**.
- `garage/GarageVehicleMemorySync` (layout) writes active vehicle from **GarageContext**.
- Garage's active vehicle is never updated from the URL, so on any page where URL != garage,
  the two fight every render → flood + corruption.

## Key mechanics discovered (matters for the choice)
- The ONLY bridge garage→VehicleMemory is the single `GarageVehicleMemorySync` component.
  Neutralizing it cuts the loop cleanly; GarageContext itself is untouched.
- Header `GarageSwitcher` dropdown switch calls **GarageContext.setActiveVehicle(id)** only.
  It does NOT navigate; it relies on `GarageVehicleMemorySync` to propagate the switch into
  VehicleMemory (so Jake/header/personalization update). => If we fully disable the bridge,
  switching a vehicle in the header dropdown stops updating Jake/active-vehicle.
- `/garage` page (GaragePageClient) DOES navigate on select (`router.push(/tires|wheels/for/...)`),
  so that flow sets a URL vehicle and works via `VehicleMemorySync` regardless of the bridge.
- VehicleIndicator (header chip) navigates via buildVehicleParams → /tires?... and reads
  active vehicle to display.

## Recommended approach (two-part, behind a flag)

### Part 1 (core fix): make the garage→memory bridge URL-aware (do not write over URL vehicle)
Edit ONLY `src/components/garage/GarageVehicleMemorySync.tsx`:
- Read the current pathname + search params.
- If the URL already carries a vehicle (year/make/model present) OR the route is a
  vehicle/search/product surface (`/tires`, `/tires/v`, `/tires/for`, `/wheels`, `/wheels/v`,
  `/wheels/for`, `/wheels/[sku]`, `/tires/[sku]`, `/packages...`), then DO NOT call
  `setActiveVehicle` from garage. URL wins.
- Otherwise (homepage / non-vehicle pages with no URL vehicle), keep current behavior so the
  garage still seeds Jake/personalization.
This removes the overwrite/loop on every shopping surface while preserving garage seeding on
neutral pages. GarageContext + VehicleMemoryContext are NOT modified.

### Part 2 (only if Part 1 leaves a visible inconsistency): hide the header Garage UI temporarily
If product wants zero ambiguity during the temporary period, also hide the header garage
switcher so users don't switch a garage vehicle that no longer propagates on shopping pages:
- Edit ONLY `src/components/Header.tsx`: gate `<GarageSwitcher />` (L430) and
  `<GarageSwitcherCompact />` (L238) behind an env flag (e.g. `NEXT_PUBLIC_GARAGE_HEADER=off`).
- Keep `/garage` page reachable (it navigates and works), or gate it too if desired.
- Garage code stays; only the header entry point is hidden.

Both parts should sit behind a single env flag so it's instantly reversible without a redeploy
of logic (flip the Vercel env var).

## Exact files affected
- Part 1: `src/components/garage/GarageVehicleMemorySync.tsx` (only).
- Part 2 (optional): `src/components/Header.tsx` (two lines gated).
- No changes to: VehicleMemoryContext, GarageContext, VehicleMemorySync, cart, checkout,
  YMM resolution, product pages, wheel-size selectors.

## Preserved flows (why they keep working)
- Hero tire/wheel search: builds a URL with year/make/model → VehicleMemorySync sets active
  from URL. Unaffected (bridge now defers to URL).
- Header tire/wheel search (launcher): same — navigates to a vehicle URL.
- Vehicle result URLs (/tires/v/[slug], /wheels/v/[slug]): URL wins.
- Product pages (/wheels/[sku], /tires/[sku]): read vehicle from URL params (already do).
- Cart/checkout: independent of active vehicle; mini-cart banner reads cart items (Issue B fix).

## Regression risk
- LOW for Part 1: one file, side-effect-only component, narrows when it writes. Worst case:
  on a neutral page the garage no longer seeds active vehicle — mitigated by keeping current
  behavior when no URL vehicle is present.
- The one intended behavior change: header GarageSwitcher dropdown switch won't update
  Jake/active-vehicle while on a shopping page (because URL now wins). Part 2 (hide the header
  switcher) removes that confusion entirely if desired.
- Jake: reads active vehicle; on shopping pages active vehicle = URL vehicle (correct). On
  neutral pages with a garage vehicle, still seeded. Should "still work or gracefully ignore."

## Validation matrix (2024 F-150 / 2024 Ram 2500 / 2002 Avalanche 1500)
- No `vehicle_changed` flood on mount (expect ~1).
- Wheel-size selector click → URL gains wheelDia, tires re-render, no swallow/loop.
- active vehicle == URL vehicle on every shopping surface.
- Mini-cart banner correct (Issue B unaffected).
- Cart/checkout unaffected → /checkout opens.
- Jake works or ignores garage gracefully.

## Reversibility
Single env flag controls Part 1 (and Part 2 if used). Flip to restore prior behavior with no
code redeploy. Garage code remains fully intact.
