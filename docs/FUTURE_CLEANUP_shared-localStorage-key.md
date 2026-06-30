# Future Cleanup — Shared `wt_active_vehicle` localStorage key

Status: KNOWN ISSUE, intentionally NOT fixed yet (separate follow-up). Surfaced during the
Issue A Part 1 work (2026-06-22). Do not bundle this with small fixes — it touches two
contexts and needs its own review + regression pass.

## The problem
`GarageContext` and `VehicleMemoryContext` both persist to the **same** localStorage key:

- `src/contexts/GarageContext.tsx`        — `ACTIVE_KEY = "wt_active_vehicle"`, stores an **id string** (e.g. `"v_tac_1"`).
- `src/contexts/VehicleMemoryContext.tsx` — `STORAGE_KEY = "wt_active_vehicle"`, stores a **vehicle object** (e.g. `{year,make,model,...}`).

Because they share one key with two different shapes, whichever context writes last
clobbers the other's value. On a vehicle/shopping page, VehicleMemory can end up holding the
garage's id string (or `null` after a failed parse) instead of the URL vehicle object.

## Why it's currently harmless (after Issue A Part 1)
- Issue A Part 1 made `GarageVehicleMemorySync` URL-aware, so the garage no longer overwrites
  VehicleMemory with the WRONG vehicle on shopping pages, and there is no `vehicle_changed`
  flood / oscillation (validated on production 2026-06-22).
- Net effect of the shared key today: on vehicle pages VehicleMemory is effectively empty
  rather than wrong. Consumers that read it (Jake, header personalization) get nothing and
  degrade gracefully — they do not show a mismatched vehicle.

## Long-term fix options (pick one)
1. **Separate storage keys** (lowest risk): give GarageContext its own key
   (e.g. `wt_garage_active_id`) distinct from VehicleMemory's `wt_active_vehicle`. Smallest
   change; removes the clobber so VehicleMemory can hold the URL vehicle object on shopping
   pages again.
2. **Consolidate state** (cleaner, bigger): make one store the single source of truth
   (see `docs/ISSUE_A_ACTIVE_VEHICLE_SYNC_PLAN.md`, Option 2/3) so there's only one writer
   and one persisted shape.

## Verification when fixed
- On `/tires/v/<vehicle>`, VehicleMemory active vehicle == the URL vehicle object.
- Garage active id persists independently; switching garage vehicles still works.
- No `vehicle_changed` flood; header/Jake show the correct (URL) vehicle on shopping pages.
- Garage seeding on neutral pages still works.

## Pointers
- Issue A Part 1 fix: `src/components/garage/GarageVehicleMemorySync.tsx`
  (env flag `NEXT_PUBLIC_GARAGE_SYNC_URL_AWARE`, default on; `off` reverts).
- Related plan/eval: `docs/ISSUE_A_ACTIVE_VEHICLE_SYNC_PLAN.md`,
  `docs/ISSUE_A_GARAGE_DISABLE_EVAL.md`.
