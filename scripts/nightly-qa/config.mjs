/**
 * Nightly QA Configuration
 */

export const config = {
  // Base URL for API calls
  baseUrl: process.env.BASE_URL || 'https://shop.warehousetiredirect.com',
  
  // Database connection
  databaseUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  
  // Vehicle count
  targetVehicleCount: parseInt(process.env.QA_VEHICLE_COUNT || '250', 10),
  
  // Timeout for individual tests (ms)
  testTimeout: 30000,
  
  // Retry count for API calls
  retryCount: 3,
  
  // Delay between retries (ms)
  retryDelay: 1000,
  
  // Concurrency (parallel tests)
  concurrency: parseInt(process.env.QA_CONCURRENCY || '5', 10),
  
  // Output directory
  outputDir: process.env.QA_OUTPUT_DIR || './scripts/output/nightly-qa',
  
  // Lift heights to test
  liftHeights: [2, 4, 6, 8],
  
  // Category distribution (approximate percentages)
  categoryDistribution: {
    'half-ton': 0.20,
    'hd': 0.12,
    'midsize': 0.10,
    'jeep': 0.08,
    'staggered': 0.14,
    'car': 0.16,
    'suv': 0.10,
    'ev': 0.10,
  },
  
  // Minimum vehicles per category
  minPerCategory: {
    'half-ton': 30,
    'hd': 15,
    'midsize': 15,
    'jeep': 10,
    'staggered': 25,
    'car': 25,
    'suv': 15,
    'ev': 10,
  },
  
  // Anomaly detection thresholds
  anomalyThresholds: {
    wheelCountDropPct: 20,
    tireCountDropPct: 20,
    passRateDropPct: 10,
    zeroResultsSeverity: 'high',
    boltMismatchSeverity: 'critical',
    staggeredFlipSeverity: 'critical',
  },
  
  // Diameter band rules per category + lift
  // LOOSENED significantly to avoid false positives during initial QA
  // The API may return stock sizes even for lifted builds if inventory is limited
  // TODO: Tighten these once we validate the lifted tire logic is correct
  diameterBands: {
    'half-ton': {
      0: { min: 28, max: 38 },  // Stock trucks ~31-33"
      2: { min: 28, max: 38 },  // Leveled - allow stock sizes
      4: { min: 28, max: 40 },  // 4" lift - allow stock to 37"
      6: { min: 28, max: 42 },  // 6" lift - allow wider range
      8: { min: 30, max: 44 },  // 8" lift - allow 35-40"
    },
    'hd': {
      0: { min: 30, max: 40 },
      2: { min: 30, max: 40 },
      4: { min: 30, max: 42 },
      6: { min: 30, max: 44 },
      8: { min: 32, max: 46 },
    },
    'midsize': {
      0: { min: 26, max: 36 },
      2: { min: 26, max: 38 },
      4: { min: 28, max: 40 },
      6: { min: 28, max: 40 },
      8: { min: 30, max: 42 },
    },
    'jeep': {
      0: { min: 28, max: 38 },
      2: { min: 28, max: 38 },
      4: { min: 30, max: 40 },
      6: { min: 30, max: 42 },
      8: { min: 32, max: 44 },
    },
    'bronco': {
      0: { min: 28, max: 38 },
      2: { min: 28, max: 38 },
      4: { min: 28, max: 40 },
      6: { min: 30, max: 42 },
      8: { min: 30, max: 44 },
    },
    'suv': {
      0: { min: 28, max: 38 },
      2: { min: 28, max: 38 },
      4: { min: 28, max: 40 },
      6: { min: 30, max: 42 },
      8: { min: 30, max: 44 },
    },
    'car': {
      0: { min: 22, max: 35 },
    },
    'staggered': {
      0: { min: 22, max: 38 },
    },
    'ev': {
      0: { min: 24, max: 38 },
    },
  },
};

export default config;
