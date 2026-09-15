// Pass 0 — create audit_pass0_flags (+ helper table audit_pass0_rows with per-row normalized derivations).
// Idempotent. Never touches vehicle_fitments.
//   node --env-file=.env.local scripts/audit/pass0/00-create-flags-table.mjs
import { pool } from "./_lib.mjs";
const p = pool();
await p.query(`
  CREATE TABLE IF NOT EXISTS audit_pass0_flags (
    id           serial PRIMARY KEY,
    fitment_id   uuid,
    year         int,
    make         text,
    model        text,
    display_trim text,
    check_name   text NOT NULL,
    severity     text NOT NULL CHECK (severity IN ('error','warn','info')),
    detail       jsonb,
    created_at   timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS audit_pass0_flags_check_idx   ON audit_pass0_flags (check_name);
  CREATE INDEX IF NOT EXISTS audit_pass0_flags_fitment_idx ON audit_pass0_flags (fitment_id);
  CREATE INDEX IF NOT EXISTS audit_pass0_flags_sev_idx     ON audit_pass0_flags (severity);

  -- Derived, normalized view of every ACTIVE vehicle_fitments row (filled by 01-run-checks.mjs).
  -- Exists so every check can be plain SQL and re-run alone.
  CREATE TABLE IF NOT EXISTS audit_pass0_rows (
    fitment_id        uuid PRIMARY KEY,
    year              int,
    make              text,
    model             text,
    display_trim      text,
    raw_trim          text,
    source            text,
    certification_status text,
    bolt_pattern      text,
    center_bore_mm    numeric,
    thread_size       text,
    seat_type         text,
    offset_min_mm     numeric,
    offset_max_mm     numeric,
    wheel_shape       text,      -- shape census label of the RAW oem_wheel_sizes
    wheel_inner_shape text,      -- for double-encoded strings: shape of the decoded array
    tire_shape        text,
    wheels_norm       jsonb,     -- canonical entries produced by _lib.normalizeWheels
    wheel_diams       numeric[],
    wheel_has_front_rear boolean,
    wheel_width_first int,
    wheel_mixed       boolean,
    wheel_issues      text[],
    wheel_unparsed    jsonb,
    wheel_dropped     jsonb,
    tires_flat        text[],
    tire_rims         numeric[],
    tire_unparsed     text[],
    tire_axle_suffix  int,
    tire_double_encoded int,
    tire_staggered_obj boolean,
    spec_sig          text       -- bolt|cb|thread|wheels|tires signature for duplicate detection
  );
  CREATE INDEX IF NOT EXISTS audit_pass0_rows_ymm_idx ON audit_pass0_rows (make, model, year);
`);
const t = (await p.query(`select table_name from information_schema.tables where table_name in ('audit_pass0_flags','audit_pass0_rows') order by 1`)).rows.map((r) => r.table_name);
console.log("ready:", t.join(", "));
await p.end();
