-- QA Infrastructure Migration
-- Phase 1: Core tables for nightly QA sweeps and anomaly detection
-- Created: 2025-07-21

-- ═══════════════════════════════════════════════════════════════════════════
-- QA RUN SUMMARY TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS qa_runs (
  id SERIAL PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  
  -- Run metadata
  vehicle_count INT NOT NULL DEFAULT 0,
  passed_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  warning_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  
  -- Breakdown by severity
  critical_failures INT NOT NULL DEFAULT 0,
  high_failures INT NOT NULL DEFAULT 0,
  medium_failures INT NOT NULL DEFAULT 0,
  low_failures INT NOT NULL DEFAULT 0,
  
  -- Breakdown by failure type
  logic_failures INT NOT NULL DEFAULT 0,
  inventory_failures INT NOT NULL DEFAULT 0,
  supplier_failures INT NOT NULL DEFAULT 0,
  data_gap_failures INT NOT NULL DEFAULT 0,
  test_harness_failures INT NOT NULL DEFAULT 0,
  regression_failures INT NOT NULL DEFAULT 0,
  
  -- Breakdown by category
  category_stats JSONB, -- { "half-ton": { total, passed, failed, pass_rate }, ... }
  
  -- Environment
  commit_hash TEXT,
  deployment_version TEXT,
  environment TEXT DEFAULT 'production',
  base_url TEXT,
  trigger_source TEXT DEFAULT 'scheduled', -- scheduled, manual, deploy
  
  -- Summary
  pass_rate DECIMAL(5,2),
  duration_ms INT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDIVIDUAL QA RESULTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS qa_results (
  id SERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES qa_runs(run_id) ON DELETE CASCADE,
  
  -- Vehicle identification
  year INT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  category TEXT NOT NULL, -- half-ton, hd, midsize, jeep, bronco, staggered, car, suv, ev
  is_performance BOOLEAN DEFAULT FALSE,
  is_canary BOOLEAN DEFAULT FALSE, -- High-traffic vehicles always tested
  
  -- Test results
  status TEXT NOT NULL, -- pass, fail, warning, skip
  severity TEXT, -- critical, high, medium, low, info
  failure_type TEXT, -- logic, inventory, supplier, data_gap, test_harness, regression
  
  -- Wheel test results
  wheel_test_passed BOOLEAN,
  wheel_count INT,
  wheel_pre_filter_count INT,
  wheel_post_filter_count INT,
  bolt_pattern TEXT,
  bolt_pattern_expected TEXT,
  bolt_pattern_match BOOLEAN,
  center_bore DECIMAL(5,1),
  offset_min INT,
  offset_max INT,
  wheel_diameter_min INT,
  wheel_diameter_max INT,
  
  -- Staggered detection
  staggered_detected BOOLEAN,
  staggered_expected BOOLEAN,
  staggered_mismatch BOOLEAN DEFAULT FALSE,
  front_wheel_width TEXT,
  rear_wheel_width TEXT,
  front_offset INT,
  rear_offset INT,
  
  -- Tire test results
  tire_test_passed BOOLEAN,
  tire_count INT,
  tire_pre_filter_count INT,
  tire_post_filter_count INT,
  tire_diameter DECIMAL(4,1),
  tire_diameter_expected DECIMAL(4,1),
  tire_diameter_valid BOOLEAN,
  front_tire_size TEXT,
  rear_tire_size TEXT,
  
  -- Lifted build results (per lift height)
  lifted_tests JSONB, -- Array of { liftInches, passed, wheelCount, tireCount, tireDiameter, inBand }
  
  -- Package flow results
  package_test_passed BOOLEAN,
  package_viable BOOLEAN,
  package_wheel_count INT,
  package_tire_count INT,
  
  -- Supplier breakdown (wheels)
  wheel_suppliers JSONB, -- { "wheelpros": 150, "other": 20 }
  
  -- Supplier breakdown (tires)
  tire_suppliers JSONB, -- { "wheelpros": 50, "tireweb:atd": 30, "tireweb:usaf": 20 }
  
  -- Error details
  error_message TEXT,
  error_stack TEXT,
  api_responses JSONB, -- Store raw API responses for debugging
  
  -- Timing
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ANOMALY DETECTION TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS qa_anomalies (
  id SERIAL PRIMARY KEY,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anomaly_type TEXT NOT NULL, -- wheel_drop, tire_drop, bolt_mismatch, staggered_flip, diameter_violation, zero_results, supplier_outage, pass_rate_drop
  severity TEXT NOT NULL, -- critical, warning, info
  
  -- What changed
  vehicle_year INT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_trim TEXT,
  category TEXT,
  
  -- Metrics
  metric_name TEXT NOT NULL,
  previous_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  change_percent DECIMAL(6,2),
  threshold_percent DECIMAL(5,2),
  
  -- Context
  run_id UUID REFERENCES qa_runs(run_id) ON DELETE SET NULL,
  previous_run_id UUID REFERENCES qa_runs(run_id) ON DELETE SET NULL,
  result_id INT REFERENCES qa_results(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  suspected_cause TEXT,
  
  -- Resolution
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Notification
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- BASELINE METRICS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS qa_baselines (
  id SERIAL PRIMARY KEY,
  
  -- Scope (vehicle-specific or category-level)
  scope TEXT NOT NULL DEFAULT 'vehicle', -- vehicle, category, global
  vehicle_year INT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_trim TEXT,
  category TEXT,
  
  -- Baseline metrics (rolling average)
  baseline_wheel_count DECIMAL(10,2),
  baseline_tire_count DECIMAL(10,2),
  baseline_pass_rate DECIMAL(5,2),
  baseline_wheel_suppliers JSONB,
  baseline_tire_suppliers JSONB,
  
  -- Thresholds (trigger anomaly if exceeded)
  wheel_count_threshold_pct DECIMAL(5,2) DEFAULT 20.0,
  tire_count_threshold_pct DECIMAL(5,2) DEFAULT 20.0,
  pass_rate_threshold_pct DECIMAL(5,2) DEFAULT 10.0,
  
  -- Calculation metadata
  sample_count INT DEFAULT 0,
  last_run_id UUID REFERENCES qa_runs(run_id) ON DELETE SET NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT qa_baselines_scope_unique UNIQUE (scope, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, category)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- CANARY VEHICLES (High-traffic vehicles always tested)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS qa_canary_vehicles (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  category TEXT NOT NULL,
  
  -- Expected values for validation
  expected_bolt_pattern TEXT,
  expected_staggered BOOLEAN DEFAULT FALSE,
  is_performance BOOLEAN DEFAULT FALSE,
  
  -- Lift test configuration
  test_lifted BOOLEAN DEFAULT FALSE,
  lift_heights INT[], -- e.g., {2, 4, 6}
  
  priority INT DEFAULT 100, -- Higher = more important
  enabled BOOLEAN DEFAULT TRUE,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT qa_canary_unique UNIQUE (year, make, model, trim)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_qa_runs_started_at ON qa_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_runs_status ON qa_runs(status);
CREATE INDEX IF NOT EXISTS idx_qa_runs_environment ON qa_runs(environment);

CREATE INDEX IF NOT EXISTS idx_qa_results_run_id ON qa_results(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_results_category ON qa_results(category);
CREATE INDEX IF NOT EXISTS idx_qa_results_status ON qa_results(status);
CREATE INDEX IF NOT EXISTS idx_qa_results_failure_type ON qa_results(failure_type) WHERE failure_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qa_results_severity ON qa_results(severity) WHERE severity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qa_results_vehicle ON qa_results(year, make, model, trim);
CREATE INDEX IF NOT EXISTS idx_qa_results_staggered_mismatch ON qa_results(run_id) WHERE staggered_mismatch = TRUE;

CREATE INDEX IF NOT EXISTS idx_qa_anomalies_detected_at ON qa_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_anomalies_type ON qa_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_qa_anomalies_severity ON qa_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_qa_anomalies_unresolved ON qa_anomalies(resolved, acknowledged) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_qa_anomalies_run_id ON qa_anomalies(run_id);

CREATE INDEX IF NOT EXISTS idx_qa_baselines_scope ON qa_baselines(scope);
CREATE INDEX IF NOT EXISTS idx_qa_baselines_category ON qa_baselines(category) WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_canary_enabled ON qa_canary_vehicles(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_qa_canary_category ON qa_canary_vehicles(category);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED CANARY VEHICLES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO qa_canary_vehicles (year, make, model, trim, category, expected_bolt_pattern, expected_staggered, is_performance, test_lifted, lift_heights, priority) VALUES
-- Half-ton trucks (high traffic)
(2024, 'Ford', 'F-150', 'XLT', 'half-ton', '6x135', FALSE, FALSE, TRUE, '{2,4,6}', 100),
(2024, 'Chevrolet', 'Silverado 1500', 'LT', 'half-ton', '6x139.7', FALSE, FALSE, TRUE, '{2,4,6}', 100),
(2024, 'Ram', '1500', 'Big Horn', 'half-ton', '6x139.7', FALSE, FALSE, TRUE, '{2,4,6}', 100),
(2024, 'GMC', 'Sierra 1500', 'SLT', 'half-ton', '6x139.7', FALSE, FALSE, TRUE, '{2,4,6}', 100),
(2024, 'Toyota', 'Tundra', 'SR5', 'half-ton', '6x139.7', FALSE, FALSE, TRUE, '{2,4,6}', 90),

-- HD trucks
(2024, 'Ford', 'F-250', 'XLT', 'hd', '8x170', FALSE, FALSE, TRUE, '{2,4,6}', 95),
(2024, 'Chevrolet', 'Silverado 2500 HD', 'LT', 'hd', '8x180', FALSE, FALSE, TRUE, '{2,4,6}', 95),
(2024, 'Ram', '2500', 'Big Horn', 'hd', '8x165.1', FALSE, FALSE, TRUE, '{2,4,6}', 95),

-- Staggered (CRITICAL)
(2024, 'Ford', 'Mustang', 'GT', 'staggered', '5x114.3', TRUE, TRUE, FALSE, NULL, 100),
(2023, 'Ford', 'Mustang', 'GT Performance Pack', 'staggered', '5x114.3', TRUE, TRUE, FALSE, NULL, 100),
(2024, 'Chevrolet', 'Camaro', 'SS', 'staggered', '5x120', TRUE, TRUE, FALSE, NULL, 100),
(2023, 'Chevrolet', 'Camaro', 'ZL1', 'staggered', '5x120', TRUE, TRUE, FALSE, NULL, 100),
(2024, 'Dodge', 'Challenger', 'R/T', 'staggered', '5x115', TRUE, TRUE, FALSE, NULL, 100),
(2023, 'Chevrolet', 'Corvette', 'Stingray', 'staggered', '5x120', TRUE, TRUE, FALSE, NULL, 100),

-- Jeeps
(2024, 'Jeep', 'Wrangler', 'Rubicon', 'jeep', '5x127', FALSE, TRUE, TRUE, '{2,4,6}', 95),
(2024, 'Jeep', 'Gladiator', 'Rubicon', 'midsize', '5x127', FALSE, TRUE, TRUE, '{2,4,6}', 90),

-- Broncos (must NOT use Jeep rules)
(2024, 'Ford', 'Bronco', 'Wildtrak', 'bronco', '6x139.7', FALSE, FALSE, TRUE, '{2,4}', 90),

-- High-volume cars
(2024, 'Toyota', 'Camry', 'SE', 'car', '5x114.3', FALSE, FALSE, FALSE, NULL, 85),
(2024, 'Honda', 'Accord', 'Sport', 'car', '5x114.3', FALSE, FALSE, FALSE, NULL, 85),
(2024, 'Toyota', 'RAV4', 'XLE', 'car', '5x114.3', FALSE, FALSE, FALSE, NULL, 85),

-- SUVs
(2024, 'Chevrolet', 'Tahoe', 'LT', 'suv', '6x139.7', FALSE, FALSE, TRUE, '{2,4}', 85),

-- EVs
(2024, 'Tesla', 'Model Y', 'Long Range', 'ev', '5x114.3', FALSE, FALSE, FALSE, NULL, 80),
(2024, 'Ford', 'Mustang Mach-E', 'Premium', 'ev', '5x114.3', FALSE, FALSE, FALSE, NULL, 80)

ON CONFLICT (year, make, model, trim) DO UPDATE SET
  category = EXCLUDED.category,
  expected_bolt_pattern = EXCLUDED.expected_bolt_pattern,
  expected_staggered = EXCLUDED.expected_staggered,
  is_performance = EXCLUDED.is_performance,
  test_lifted = EXCLUDED.test_lifted,
  lift_heights = EXCLUDED.lift_heights,
  priority = EXCLUDED.priority,
  updated_at = NOW();
