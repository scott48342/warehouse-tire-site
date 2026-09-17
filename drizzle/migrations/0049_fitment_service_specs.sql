-- Service specs carried by Tire Guide Pro prints (audit Pass 3 tireguide reconcile, 2026-09-17).
-- Customer-facing on PDP/install: lug torque on the wheel page, recommended pressure on the tire page.
-- All nullable, additive; safe to apply against running code.
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS lug_torque_ftlb integer;          -- wheel lug nut torque, ft-lb
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS tire_pressure_front_psi integer;  -- OE placard cold inflation, front
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS tire_pressure_rear_psi integer;   -- OE placard cold inflation, rear
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS oem_load_index integer;           -- OE tire load index (front/primary size)
