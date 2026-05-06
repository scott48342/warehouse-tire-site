# QA Infrastructure Implementation Plan

**Phase:** Stabilization + QA + Data Enrichment (NO REGRESSION)  
**Date:** 2025-07-21  
**Status:** Planning → Implementation

---

## Executive Summary

This plan builds permanent automated QA infrastructure for Warehouse Tire Direct. The goal is to catch regressions before they hit production and maintain high fitment quality across all vehicle categories.

**Key Deliverables:**
1. Nightly QA sweep system (100-500 vehicles)
2. Regression dashboard (`/admin/qa`)
3. Fitment anomaly detection service
4. OEM data enrichment pipeline
5. Data confidence scoring system

---

## Phase 1: Nightly QA Framework

### 1.1 Database Schema Additions

```sql
-- scripts/migrations/0031_qa_infrastructure.sql

-- QA Run Summary Table
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
  
  -- Environment
  commit_hash TEXT,
  deployment_version TEXT,
  environment TEXT DEFAULT 'production',
  base_url TEXT,
  
  -- Summary
  pass_rate DECIMAL(5,2),
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual QA Results
CREATE TABLE IF NOT EXISTS qa_results (
  id SERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES qa_runs(run_id) ON DELETE CASCADE,
  
  -- Vehicle identification
  year INT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  category TEXT NOT NULL, -- half-ton, hd, midsize, jeep, bronco, staggered, car, suv, ev
  
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
  
  -- Staggered detection
  staggered_detected BOOLEAN,
  staggered_expected BOOLEAN,
  staggered_mismatch BOOLEAN,
  front_wheel_width TEXT,
  rear_wheel_width TEXT,
  
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
  
  -- Lifted build results (if applicable)
  lifted_test_passed BOOLEAN,
  lift_inches INT,
  lifted_wheel_count INT,
  lifted_tire_count INT,
  lifted_tire_diameter DECIMAL(4,1),
  lifted_diameter_band_valid BOOLEAN,
  
  -- Package flow results
  package_test_passed BOOLEAN,
  package_viable BOOLEAN,
  package_wheel_count INT,
  package_tire_count INT,
  
  -- Supplier breakdown
  wheelpros_count INT DEFAULT 0,
  tireweb_atd_count INT DEFAULT 0,
  tireweb_ntw_count INT DEFAULT 0,
  tireweb_usaf_count INT DEFAULT 0,
  tireweb_km_count INT DEFAULT 0,
  
  -- Error details
  error_message TEXT,
  error_stack TEXT,
  api_responses JSONB, -- Store raw API responses for debugging
  
  -- Timing
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT qa_results_unique UNIQUE (run_id, year, make, model, trim, lift_inches)
);

-- Anomaly Detection Table
CREATE TABLE IF NOT EXISTS qa_anomalies (
  id SERIAL PRIMARY KEY,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anomaly_type TEXT NOT NULL, -- wheel_drop, tire_drop, bolt_mismatch, staggered_flip, diameter_violation, zero_results, supplier_outage
  severity TEXT NOT NULL, -- critical, warning, info
  
  -- What changed
  vehicle_year INT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_trim TEXT,
  
  -- Metrics
  metric_name TEXT NOT NULL,
  previous_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  change_percent DECIMAL(5,2),
  
  -- Context
  run_id UUID REFERENCES qa_runs(run_id),
  previous_run_id UUID,
  description TEXT,
  suspected_cause TEXT,
  
  -- Resolution
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baseline metrics for anomaly detection
CREATE TABLE IF NOT EXISTS qa_baselines (
  id SERIAL PRIMARY KEY,
  
  -- Vehicle (can be specific or aggregate)
  vehicle_year INT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_trim TEXT,
  category TEXT,
  
  -- Baseline metrics (averaged over recent runs)
  baseline_wheel_count DECIMAL(10,2),
  baseline_tire_count DECIMAL(10,2),
  baseline_pass_rate DECIMAL(5,2),
  
  -- Thresholds
  wheel_count_threshold_pct DECIMAL(5,2) DEFAULT 20.0, -- Alert if drops >20%
  tire_count_threshold_pct DECIMAL(5,2) DEFAULT 20.0,
  
  -- Calculation metadata
  sample_count INT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_baselines_unique UNIQUE (vehicle_year, vehicle_make, vehicle_model, vehicle_trim)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qa_runs_started_at ON qa_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_results_run_id ON qa_results(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_results_category ON qa_results(category);
CREATE INDEX IF NOT EXISTS idx_qa_results_status ON qa_results(status);
CREATE INDEX IF NOT EXISTS idx_qa_results_failure_type ON qa_results(failure_type);
CREATE INDEX IF NOT EXISTS idx_qa_anomalies_detected_at ON qa_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_anomalies_type ON qa_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_qa_anomalies_severity ON qa_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_qa_anomalies_unresolved ON qa_anomalies(resolved) WHERE resolved = FALSE;
```

### 1.2 Nightly QA Worker Architecture

```
scripts/nightly-qa/
├── index.mjs              # Main entry point
├── worker.mjs             # Single-vehicle test worker
├── vehicle-pool.mjs       # Vehicle selection (random + curated)
├── test-suites/
│   ├── wheel-test.mjs     # Wheel fitment tests
│   ├── tire-test.mjs      # Tire search tests
│   ├── staggered-test.mjs # Staggered detection tests
│   ├── lifted-test.mjs    # Lifted build tests (2,4,6,8")
│   └── package-test.mjs   # Package flow viability
├── classifiers/
│   ├── failure-classifier.mjs   # Categorize failures
│   └── anomaly-detector.mjs     # Detect anomalies vs baseline
├── reporters/
│   ├── json-reporter.mjs        # JSON output
│   ├── csv-reporter.mjs         # CSV output
│   ├── markdown-reporter.mjs   # Markdown summary
│   └── db-reporter.mjs          # Write to database
├── output/                       # Timestamped output files
│   └── nightly-qa/
└── config.mjs                    # Configuration
```

### 1.3 Vehicle Selection Pool

**Categories and Distribution:**

| Category | Min Vehicles | Target % |
|----------|-------------|----------|
| Half-ton trucks | 50 | 20% |
| HD trucks | 30 | 12% |
| Midsize trucks | 25 | 10% |
| Jeeps/off-road | 20 | 8% |
| Staggered/performance | 35 | 14% |
| Passenger cars | 40 | 16% |
| Luxury/performance SUVs | 25 | 10% |
| EVs | 25 | 10% |

**Selection Strategy:**
- 70% random selection from each category
- 30% curated "canary" vehicles (high-traffic, known edge cases)
- Always include Tier A staggered vehicles
- Always include recent regression failures

### 1.4 Cron Strategy

**Option A: Local Windows Task Scheduler** (for dev/testing)
```powershell
# Run nightly at 3 AM
schtasks /create /tn "WTD Nightly QA" /tr "node scripts/nightly-qa/index.mjs" /sc daily /st 03:00
```

**Option B: Vercel Cron** (for production)
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/nightly-qa",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Option C: GitHub Actions** (recommended - no runtime cost)
```yaml
# .github/workflows/nightly-qa.yml
name: Nightly QA Sweep
on:
  schedule:
    - cron: '0 7 * * *'  # 3 AM EST
  workflow_dispatch:  # Manual trigger

jobs:
  qa-sweep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: node scripts/nightly-qa/index.mjs
        env:
          BASE_URL: https://shop.warehousetiredirect.com
          POSTGRES_URL: ${{ secrets.POSTGRES_URL }}
      - uses: actions/upload-artifact@v4
        with:
          name: qa-results-${{ github.run_number }}
          path: scripts/output/nightly-qa/
```

---

## Phase 2: Regression Dashboard

### 2.1 Admin Routes

```
src/app/admin/qa/
├── page.tsx                    # Main dashboard
├── runs/
│   └── [runId]/
│       └── page.tsx            # Individual run details
├── vehicles/
│   └── [vehicle]/
│       └── page.tsx            # Vehicle history
├── anomalies/
│   └── page.tsx                # Anomaly list
└── components/
    ├── QASummaryCard.tsx       # Top-level metrics
    ├── PassRateChart.tsx       # Historical pass rate
    ├── FailureBreakdown.tsx    # Failure type distribution
    ├── CategoryHealth.tsx      # Health by category
    ├── RecentRuns.tsx          # Recent run list
    ├── CriticalFailures.tsx    # Critical failure list
    └── AnomalyAlert.tsx        # Active anomalies
```

### 2.2 API Routes

```
src/app/api/admin/qa/
├── runs/
│   ├── route.ts          # GET: List runs, POST: Start new run
│   └── [runId]/
│       └── route.ts      # GET: Run details
├── results/
│   └── route.ts          # GET: Query results (with filters)
├── anomalies/
│   ├── route.ts          # GET: List anomalies
│   └── [id]/
│       └── route.ts      # PATCH: Acknowledge/resolve
├── baselines/
│   └── route.ts          # GET/POST: Manage baselines
└── stats/
    └── route.ts          # GET: Aggregated stats
```

### 2.3 Dashboard Features

**Top-Level Metrics:**
- Latest run pass rate (with trend indicator)
- Total vehicles tested this week
- Critical failures count (red badge)
- Active anomalies count

**Historical Charts:**
- Pass rate over time (7/30/90 day views)
- Failure type distribution pie chart
- Category health heatmap

**Filters:**
- Date range
- Make
- Vehicle category
- Severity level
- Failure type
- Status (pass/fail/warning)

**Tables:**
- Recent runs with drill-down
- Critical failures requiring attention
- Staggered detection failures
- Lifted build failures
- Zero-result vehicles
- Supplier outage indicators

---

## Phase 3: Anomaly Detection Service

### 3.1 Anomaly Types

| Type | Detection Rule | Severity |
|------|---------------|----------|
| `wheel_drop` | Wheel count drops >20% vs baseline | critical |
| `tire_drop` | Tire count drops >20% vs baseline | critical |
| `bolt_mismatch` | Expected bolt pattern != actual | critical |
| `staggered_flip` | Staggered detection changed | critical |
| `diameter_violation` | Lifted tire outside band | high |
| `zero_results` | Vehicle returns 0 wheels or tires | high |
| `supplier_outage` | Supplier count drops to 0 | warning |
| `pass_rate_drop` | Category pass rate drops >10% | warning |

### 3.2 Detection Algorithm

```javascript
// classifiers/anomaly-detector.mjs

async function detectAnomalies(runId, results) {
  const anomalies = [];
  
  // Get baselines
  const baselines = await getBaselines();
  
  for (const result of results) {
    const baseline = findBaseline(baselines, result);
    if (!baseline) continue;
    
    // Check wheel count drop
    if (baseline.baseline_wheel_count > 0) {
      const dropPct = (1 - result.wheel_count / baseline.baseline_wheel_count) * 100;
      if (dropPct > baseline.wheel_count_threshold_pct) {
        anomalies.push({
          type: 'wheel_drop',
          severity: dropPct > 50 ? 'critical' : 'warning',
          vehicle: formatVehicle(result),
          previous_value: baseline.baseline_wheel_count,
          current_value: result.wheel_count,
          change_percent: -dropPct,
          description: `Wheel count dropped from ~${baseline.baseline_wheel_count} to ${result.wheel_count}`,
        });
      }
    }
    
    // Check bolt pattern mismatch
    if (result.bolt_pattern_expected && !result.bolt_pattern_match) {
      anomalies.push({
        type: 'bolt_mismatch',
        severity: 'critical',
        vehicle: formatVehicle(result),
        description: `Expected ${result.bolt_pattern_expected}, got ${result.bolt_pattern}`,
        suspected_cause: 'Fitment profile mapping or API logic error',
      });
    }
    
    // Check staggered flip
    if (result.staggered_mismatch) {
      anomalies.push({
        type: 'staggered_flip',
        severity: 'critical',
        vehicle: formatVehicle(result),
        description: `Staggered expected=${result.staggered_expected}, detected=${result.staggered_detected}`,
        suspected_cause: 'Staggered metadata or detection logic changed',
      });
    }
    
    // ... more checks
  }
  
  return anomalies;
}
```

### 3.3 Baseline Management

- Baselines auto-update after each successful run
- Rolling average of last 5 runs
- Manual override capability in admin
- Separate baselines per category + vehicle

---

## Phase 4: File & Storage Strategy

### 4.1 Output Directory Structure

```
scripts/output/nightly-qa/
├── 2025-07-21/
│   ├── run-abc123.json           # Full results (vehicle-level)
│   ├── run-abc123-summary.json   # Summary metrics only
│   ├── run-abc123.csv            # CSV export
│   ├── run-abc123-failures.md    # Markdown failure report
│   └── run-abc123-anomalies.md   # Anomaly report
├── latest/                        # Symlink to most recent
│   ├── results.json
│   ├── summary.json
│   └── report.md
└── archive/                       # Compressed older runs
    └── 2025-07-week-29.tar.gz
```

### 4.2 JSON Output Schema

```typescript
interface QARunOutput {
  run_id: string;
  started_at: string;
  completed_at: string;
  environment: {
    base_url: string;
    commit_hash: string;
    deployment_version: string;
  };
  summary: {
    total_vehicles: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
    pass_rate: number;
    duration_ms: number;
  };
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  by_failure_type: {
    logic: number;
    inventory: number;
    supplier: number;
    data_gap: number;
    test_harness: number;
    regression: number;
  };
  by_category: {
    [category: string]: {
      total: number;
      passed: number;
      failed: number;
      pass_rate: number;
    };
  };
  anomalies: Anomaly[];
  results: QAResult[];
}
```

---

## Rollout Order

### Week 1: Foundation
1. ✅ Create migration `0031_qa_infrastructure.sql`
2. ✅ Create `scripts/nightly-qa/` structure
3. ✅ Migrate existing `qa-certification` tests to new framework
4. ✅ Test locally with 10 vehicles

### Week 2: Worker & Storage
1. Implement full test suites (wheel, tire, staggered, lifted, package)
2. Implement failure classifier
3. Implement JSON/CSV/Markdown reporters
4. Run full 100-vehicle sweep locally

### Week 3: Database & Dashboard
1. Run migration on production
2. Implement DB reporter
3. Create `/admin/qa` dashboard (basic)
4. Implement stats API

### Week 4: Anomaly Detection
1. Implement anomaly detector
2. Create baseline management
3. Create `/admin/fitment-anomalies` page
4. Set up GitHub Actions cron

### Week 5: Polish & Monitoring
1. Add Slack/Discord notifications for critical failures
2. Add email alerts for anomalies
3. Historical trend analysis
4. Documentation

---

## Expected Operational Flow

**Nightly (3 AM EST):**
1. GitHub Action triggers
2. Worker selects 250-500 vehicles
3. Each vehicle tested against 4 endpoints
4. Results written to DB + files
5. Anomalies detected vs baselines
6. Summary posted to Slack

**Morning Review:**
1. Open `/admin/qa`
2. Check pass rate trend
3. Review any critical failures
4. Acknowledge or investigate anomalies
5. File issues for genuine regressions

**After Deploy:**
1. Trigger manual QA run
2. Compare pre/post deploy metrics
3. Roll back if critical regressions

---

## No Regression Guarantees

1. All QA infrastructure is **additive** - no changes to existing fitment logic
2. New tables use separate namespace (`qa_*`)
3. New admin routes don't modify existing routes
4. Worker scripts are standalone - no imports into production code
5. All new APIs are read-only except anomaly acknowledgment

---

## Open Questions

1. **Alert channels:** Slack, Discord, email, or all three?
2. **Retention policy:** How long to keep detailed results? (default: 90 days)
3. **Public status page:** Should we expose pass rate externally?
4. **Customer-facing:** Show "Verified Fitment" badge based on QA?
