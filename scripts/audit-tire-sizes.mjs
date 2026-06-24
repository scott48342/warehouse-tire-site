/**
 * audit-tire-sizes.mjs
 * 
 * Generates a comprehensive tire size list and audits coverage against the current
 * tire-sizes.json. Outputs a detailed report plus updates the JSON file.
 * 
 * Usage:
 *   node scripts/audit-tire-sizes.mjs [--write] [--report-only]
 *   --write        Write the updated tire-sizes.json
 *   --report-only  Just print coverage report, no writes
 * 
 * Re-run anytime to check coverage. Zero external calls needed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/data/tire-sizes.json');

const args = process.argv.slice(2);
const doWrite = args.includes('--write') || (!args.includes('--report-only'));
const reportOnly = args.includes('--report-only');

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE COMPREHENSIVE METRIC SIZE LIST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All valid metric tire sizes based on ETRTO/TRA industry standards + 
 * supplier verification from TireWeb / US AutoForce / WheelPros data.
 *
 * Rule: Only include combinations that actually exist in the market.
 * Organization: widths 125-395, aspects 25-95, rims 10-30.
 */

// Comprehensive mapping: for each width, list valid {aspect, rims[]} combos.
// Based on ETRTO standards + real market coverage.
// Format: [aspect, [valid rim sizes]]

const METRIC_MATRIX = {
  // ─── 125 (space savers, compacts) ────────────────────────────────
  125: [
    [70, [15, 16, 17, 18]],
    [80, [15]],
  ],
  // ─── 135 ─────────────────────────────────────────────────────────
  135: [
    [45, [18]],
    [50, [17]],
    [60, [15, 17]],
    [70, [14, 15, 16, 17]],
    [80, [12, 13, 14, 15]],
  ],
  // ─── 145 ─────────────────────────────────────────────────────────
  145: [
    [50, [17]],
    [60, [14, 15]],
    [65, [15]],
    [70, [13, 14, 15, 16]],
    [80, [10, 12, 13]],
  ],
  // ─── 155 ─────────────────────────────────────────────────────────
  155: [
    [45, [18]],
    [55, [15]],
    [60, [15, 18, 20]],
    [65, [13, 14, 15]],
    [70, [12, 13, 14, 15]],
    [80, [12, 13]],
  ],
  // ─── 165 ─────────────────────────────────────────────────────────
  165: [
    [40, [17, 18]],
    [45, [16, 17]],
    [50, [14, 15, 16]],
    [55, [14, 15]],
    [60, [14, 15]],
    [65, [13, 14, 15]],
    [70, [13, 14]],
    [75, [13, 14, 15]],
    [80, [13, 14, 15]],
  ],
  // ─── 175 ─────────────────────────────────────────────────────────
  175: [
    [40, [17]],
    [45, [16, 17]],
    [50, [15, 16]],
    [55, [17, 20]],
    [60, [13, 14, 15, 16, 18]],
    [65, [13, 14, 15]],
    [70, [13, 14]],
    [75, [14, 15, 16]],
    [80, [14, 15, 16]],
  ],
  // ─── 185 ─────────────────────────────────────────────────────────
  185: [
    [30, [20]],
    [35, [19, 20]],
    [40, [16, 17]],
    [45, [16, 17]],
    [50, [15, 16]],
    [55, [14, 15, 16]],
    [60, [13, 14, 15, 16]],
    [65, [13, 14, 15]],
    [70, [13, 14, 15]],
    [75, [14, 15, 16]],
    [80, [14, 15]],
    [85, [16]],
  ],
  // ─── 195 ─────────────────────────────────────────────────────────
  195: [
    [25, [20]],
    [35, [18, 19, 20]],
    [40, [16, 17]],
    [45, [16, 17, 18]],
    [50, [15, 16, 17, 18]],
    [55, [15, 16, 17, 18]],
    [60, [14, 15, 16, 17, 18]],
    [65, [14, 15, 16]],
    [70, [14, 15]],
    [75, [14, 15, 16]],
  ],
  // ─── 205 ─────────────────────────────────────────────────────────
  205: [
    [30, [19, 20]],
    [35, [18, 19]],
    [40, [16, 17, 18]],
    [45, [16, 17, 18]],
    [50, [15, 16, 17]],
    [55, [15, 16, 17]],
    [60, [13, 14, 15, 16, 17, 18]],
    [65, [14, 15, 16, 17]],
    [70, [14, 15, 16, 17]],
    [75, [14, 15, 16, 17]],
    [80, [16]],
  ],
  // ─── 215 ─────────────────────────────────────────────────────────
  215: [
    [30, [20]],
    [35, [18, 19, 20]],
    [40, [16, 17, 18, 19]],
    [45, [16, 17, 18, 19, 20]],
    [50, [15, 16, 17, 18]],
    [55, [16, 17, 18]],
    [60, [15, 16, 17, 18]],
    [65, [15, 16, 17]],
    [70, [14, 15, 16, 17]],
    [75, [14, 15, 16, 17]],
    [80, [14, 15, 16]],
    [85, [16]],
  ],
  // ─── 225 ─────────────────────────────────────────────────────────
  225: [
    [25, [19, 20]],
    [30, [19, 20, 21, 22]],
    [35, [18, 19, 20]],
    [40, [17, 18, 19]],
    [45, [16, 17, 18, 19]],
    [50, [15, 16, 17, 18]],
    [55, [16, 17, 18]],
    [60, [15, 16, 17, 18]],
    [65, [16, 17]],
    [70, [14, 15, 16, 17]],
    [75, [14, 15, 16, 17]],
    [80, [17]],
    [95, [16]],
  ],
  // ─── 235 ─────────────────────────────────────────────────────────
  235: [
    [25, [20]],
    [30, [19, 20, 22]],
    [35, [18, 19, 20, 22]],
    [40, [17, 18, 19]],
    [45, [17, 18, 19, 20]],
    [50, [16, 17, 18]],
    [55, [16, 17, 18, 19, 20]],
    [60, [15, 16, 17, 18, 20]],
    [65, [16, 17, 18]],
    [70, [15, 16, 17]],
    [75, [15, 16, 17]],
    [80, [16, 17]],
    [85, [16]],
  ],
  // ─── 245 ─────────────────────────────────────────────────────────
  245: [
    [25, [20]],
    [30, [19, 20, 22]],
    [35, [18, 19, 20, 21, 22]],
    [40, [17, 18, 19, 20]],
    [45, [17, 18, 19, 20]],
    [50, [16, 17, 18, 20]],
    [55, [16, 17, 18, 19]],
    [60, [16, 17, 18, 20]],
    [65, [17]],
    [70, [16, 17, 18]],
    [75, [16, 17]],
    [85, [16]],
  ],
  // ─── 255 ─────────────────────────────────────────────────────────
  255: [
    [25, [19, 20, 21]],
    [30, [18, 20, 22]],
    [35, [18, 19, 20, 22]],
    [40, [17, 18, 19, 20, 22]],
    [45, [17, 18, 19, 20]],
    [50, [16, 17, 18, 19, 20]],
    [55, [16, 17, 18, 19, 20]],
    [60, [15, 16, 17, 18, 20]],
    [65, [16, 17, 18]],
    [70, [15, 16, 17, 18]],
    [75, [15, 16, 17]],
    [85, [16]],
  ],
  // ─── 265 ─────────────────────────────────────────────────────────
  265: [
    [25, [19, 20, 22]],
    [30, [18, 20, 22]],
    [35, [18, 19, 20, 22]],
    [40, [17, 18, 19, 20, 22]],
    [45, [18, 19, 20, 22]],
    [50, [18, 19, 20, 22]],
    [55, [17, 18, 19, 20]],
    [60, [16, 17, 18, 20, 22]],
    [65, [16, 17, 18, 22]],
    [70, [15, 16, 17, 18]],
    [75, [15, 16]],
  ],
  // ─── 275 ─────────────────────────────────────────────────────────
  275: [
    [25, [19, 20, 22]],
    [30, [19, 20, 22]],
    [35, [18, 19, 20, 22]],
    [40, [17, 18, 19, 20, 22]],
    [45, [18, 19, 20, 22]],
    [50, [18, 19, 20, 22, 24]],
    [55, [17, 18, 19, 20, 22]],
    [60, [15, 16, 17, 18, 20, 22]],
    [65, [17, 18, 20, 22]],
    [70, [16, 17, 18, 20]],
    [75, [16, 17, 18]],
  ],
  // ─── 285 ─────────────────────────────────────────────────────────
  285: [
    [25, [19, 20, 22]],
    [30, [18, 19, 20, 22, 24]],
    [35, [18, 19, 20, 22, 24]],
    [40, [17, 18, 19, 20, 22, 24]],
    [45, [18, 19, 20, 22, 24]],
    [50, [18, 19, 20, 22, 24]],
    [55, [18, 19, 20, 22]],
    [60, [17, 18, 20, 22]],
    [65, [17, 18, 20, 22]],
    [70, [16, 17, 18]],
    [75, [16, 17, 18]],
  ],
  // ─── 295 ─────────────────────────────────────────────────────────
  295: [
    [25, [21, 22]],
    [30, [18, 19, 20, 22, 24]],
    [35, [18, 19, 20, 22, 24]],
    [40, [18, 19, 20, 22, 24]],
    [45, [18, 19, 20, 22]],
    [50, [18, 19, 20, 22]],
    [55, [18, 19, 20, 22]],
    [60, [18, 20, 22]],
    [65, [18, 20, 22]],
    [70, [17, 18]],
    [75, [16, 17]],
  ],
  // ─── 305 ─────────────────────────────────────────────────────────
  305: [
    [25, [20, 22]],
    [30, [19, 20, 22, 24]],
    [35, [18, 19, 20, 22, 24]],
    [40, [18, 19, 20, 22, 24]],
    [45, [18, 19, 20, 22, 24]],
    [50, [18, 20, 22]],
    [55, [18, 20, 22]],
    [60, [18, 20, 22]],
    [65, [17, 18, 20, 22]],
    [70, [16, 17, 18]],
    [75, [16, 17]],
  ],
  // ─── 315 ─────────────────────────────────────────────────────────
  315: [
    [25, [20]],
    [30, [19, 20, 22]],
    [35, [19, 20, 22, 24]],
    [40, [18, 19, 20, 22, 24]],
    [45, [18, 19, 20, 22]],
    [50, [18, 20, 22]],
    [55, [18, 20]],
    [60, [18, 20]],
    [65, [17, 18, 20]],
    [70, [16, 17, 18]],
    [75, [16]],
  ],
  // ─── 325 ─────────────────────────────────────────────────────────
  325: [
    [25, [20]],
    [30, [19, 20, 22]],
    [35, [20, 22, 24]],
    [40, [19, 20, 22]],
    [45, [22, 24]],
    [50, [18, 20, 22]],
    [55, [18, 20, 22]],
    [60, [18, 20, 22]],
    [65, [18, 20, 22]],
    [70, [17, 18]],
  ],
  // ─── 335 ─────────────────────────────────────────────────────────
  335: [
    [25, [20, 22]],
    [30, [20, 22]],
    [35, [20, 22]],
    [45, [20, 22]],
    [55, [20, 22]],
    [60, [20, 22]],
  ],
  // ─── 345 ─────────────────────────────────────────────────────────
  345: [
    [25, [20]],
    [30, [20]],
    [35, [19, 21]],
  ],
  // ─── 355 ─────────────────────────────────────────────────────────
  355: [
    [25, [21]],
    [30, [19, 20]],
    [35, [19]],
  ],
  // ─── 365 ─────────────────────────────────────────────────────────
  365: [
    [70, [22.5]],  // commercial
  ],
  // ─── 375 ─────────────────────────────────────────────────────────
  375: [
    [45, [22]],
  ],
  // ─── 385 ─────────────────────────────────────────────────────────
  385: [
    [35, [22]],
  ],
  // ─── 395 ─────────────────────────────────────────────────────────
  395: [
    [35, [19]],
  ],
};

/**
 * Generate all metric sizes from the matrix above.
 * Returns sorted string array: "225/45R17" etc.
 */
function generateMetricSizes() {
  const sizes = new Set();
  
  for (const [widthStr, combos] of Object.entries(METRIC_MATRIX)) {
    const width = parseInt(widthStr);
    for (const [aspect, rims] of combos) {
      for (const rim of rims) {
        // Skip non-integer rims (e.g. 22.5 commercial - not in our dropdown)
        if (!Number.isInteger(rim)) continue;
        sizes.add(`${width}/${aspect}R${rim}`);
      }
    }
  }
  
  return Array.from(sizes).sort((a, b) => {
    const pa = parseMetric(a);
    const pb = parseMetric(b);
    if (pa.width !== pb.width) return pa.width - pb.width;
    if (pa.aspect !== pb.aspect) return pa.aspect - pb.aspect;
    return pa.rim - pb.rim;
  });
}

function parseMetric(s) {
  const m = s.match(/^(\d+)\/(\d+)R(\d+)$/);
  if (!m) return { width: 0, aspect: 0, rim: 0 };
  return { width: parseInt(m[1]), aspect: parseInt(m[2]), rim: parseInt(m[3]) };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE FLOTATION SIZE LIST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All valid flotation sizes based on TRA standards + supplier coverage.
 * Format: { dia: string, width: string, rim: string }
 * Example: 35x12.50R17 → { dia: "35", width: "12.5", rim: "17" }
 */
const FLOTATION_SIZES = [
  // ─── 27" ─────────────────────────────────────────────────────────
  { dia: "27", width: "8.5", rim: "12" },
  { dia: "27", width: "9", rim: "12" },
  // ─── 28" ─────────────────────────────────────────────────────────
  { dia: "28", width: "9", rim: "15" },
  // ─── 29" ─────────────────────────────────────────────────────────
  { dia: "29", width: "9", rim: "14" },
  { dia: "29", width: "9.5", rim: "15" },
  { dia: "29", width: "10.5", rim: "15" },
  // ─── 30" ─────────────────────────────────────────────────────────
  { dia: "30", width: "9", rim: "14" },
  { dia: "30", width: "9.5", rim: "15" },
  { dia: "30", width: "10", rim: "14" },
  { dia: "30", width: "10", rim: "15" },
  { dia: "30", width: "10.5", rim: "15" },
  { dia: "30", width: "11.5", rim: "15" },
  // ─── 31" ─────────────────────────────────────────────────────────
  { dia: "31", width: "10.5", rim: "15" },
  { dia: "31", width: "10.5", rim: "16" },
  { dia: "31", width: "11.5", rim: "15" },
  { dia: "31", width: "12.5", rim: "15" },
  { dia: "31", width: "12.5", rim: "16" },
  // ─── 32" ─────────────────────────────────────────────────────────
  { dia: "32", width: "10", rim: "15" },
  { dia: "32", width: "11.5", rim: "15" },
  { dia: "32", width: "11.5", rim: "16" },
  { dia: "32", width: "12.5", rim: "15" },
  // ─── 33" ─────────────────────────────────────────────────────────
  { dia: "33", width: "10.5", rim: "15" },
  { dia: "33", width: "11.5", rim: "15" },
  { dia: "33", width: "12.5", rim: "15" },
  { dia: "33", width: "12.5", rim: "16" },
  { dia: "33", width: "12.5", rim: "17" },
  { dia: "33", width: "12.5", rim: "18" },
  { dia: "33", width: "12.5", rim: "20" },
  { dia: "33", width: "12.5", rim: "22" },
  // ─── 34" ─────────────────────────────────────────────────────────
  { dia: "34", width: "10.5", rim: "17" },
  { dia: "34", width: "12.5", rim: "17" },
  { dia: "34", width: "12.5", rim: "18" },
  // ─── 35" ─────────────────────────────────────────────────────────
  { dia: "35", width: "12.5", rim: "15" },
  { dia: "35", width: "12.5", rim: "16" },
  { dia: "35", width: "12.5", rim: "17" },
  { dia: "35", width: "12.5", rim: "18" },
  { dia: "35", width: "12.5", rim: "20" },
  { dia: "35", width: "12.5", rim: "22" },
  { dia: "35", width: "13.5", rim: "18" },
  { dia: "35", width: "13.5", rim: "20" },
  { dia: "35", width: "13.5", rim: "22" },
  { dia: "35", width: "14", rim: "22" },
  { dia: "35", width: "15.5", rim: "20" },
  { dia: "35", width: "15.5", rim: "22" },
  // ─── 36" ─────────────────────────────────────────────────────────
  { dia: "36", width: "12.5", rim: "17" },
  { dia: "36", width: "12.5", rim: "20" },
  { dia: "36", width: "13.5", rim: "20" },
  { dia: "36", width: "15.5", rim: "20" },
  // ─── 37" ─────────────────────────────────────────────────────────
  { dia: "37", width: "12.5", rim: "16.5" },
  { dia: "37", width: "12.5", rim: "17" },
  { dia: "37", width: "12.5", rim: "17.5" },
  { dia: "37", width: "12.5", rim: "18" },
  { dia: "37", width: "12.5", rim: "20" },
  { dia: "37", width: "12.5", rim: "22" },
  { dia: "37", width: "13", rim: "19" },
  { dia: "37", width: "13", rim: "22" },
  { dia: "37", width: "13.5", rim: "17" },
  { dia: "37", width: "13.5", rim: "18" },
  { dia: "37", width: "13.5", rim: "20" },
  { dia: "37", width: "13.5", rim: "22" },
  { dia: "37", width: "14.5", rim: "22" },
  { dia: "37", width: "15.5", rim: "20" },
  { dia: "37", width: "15.5", rim: "22" },
  // ─── 38" ─────────────────────────────────────────────────────────
  { dia: "38", width: "13.5", rim: "18" },
  { dia: "38", width: "13.5", rim: "19" },
  { dia: "38", width: "13.5", rim: "20" },
  { dia: "38", width: "13.5", rim: "22" },
  { dia: "38", width: "14", rim: "20" },
  { dia: "38", width: "14", rim: "22" },
  { dia: "38", width: "15.5", rim: "20" },
  { dia: "38", width: "15.5", rim: "22" },
  // ─── 39" ─────────────────────────────────────────────────────────
  { dia: "39", width: "13.5", rim: "20" },
  // ─── 40" ─────────────────────────────────────────────────────────
  { dia: "40", width: "13.5", rim: "20" },
  { dia: "40", width: "13.5", rim: "22" },
  { dia: "40", width: "15.5", rim: "20" },
  { dia: "40", width: "15.5", rim: "22" },
  // ─── 42" ─────────────────────────────────────────────────────────
  { dia: "42", width: "15.5", rim: "20" },
  { dia: "42", width: "15.5", rim: "22" },
];

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN-REQUIRED SIZES (must be present; checked explicitly)
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_METRIC = [
  // Customer-reported missing
  '295/65R20', '305/65R20', '295/55R20', '295/65R18', '305/70R17', '325/60R20',
  // Full truck/SUV required set (from task spec)
  '315/65R20', '295/60R20', '305/60R20', '275/65R20', '285/65R20',
  '265/70R17', '275/70R17', '285/70R17', '295/70R17', '305/70R17',
  '265/70R18', '275/70R18', '285/70R18',
  '265/75R16', '275/75R16', '285/75R16', '295/75R16', '305/75R16',
  '235/85R16', '245/85R16',
  '295/65R18', '305/65R18', '315/65R18',
  '275/55R20', '285/55R20', '295/55R20', '305/55R20',
  '295/45R20', '305/45R22', '325/45R24',
];

const REQUIRED_FLOTATION = [
  '33x12.5R15', '33x12.5R17', '33x12.5R18', '33x12.5R20', '33x12.5R22',
  '35x12.5R15', '35x12.5R17', '35x12.5R18', '35x12.5R20', '35x12.5R22',
  '37x12.5R17', '37x12.5R18', '37x12.5R20', '37x12.5R22',
  '37x13.5R17', '37x13.5R20', '37x13.5R22',
  '40x15.5R20', '40x15.5R22',
  '38x15.5R20', '38x15.5R22',
  '35x12.5R20', '37x13.5R20',
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function flotationToString(f) {
  return `${f.dia}x${f.width}R${f.rim}`;
}

function parseFlotationString(s) {
  // e.g. "35x12.5R17"
  const m = s.match(/^([\d.]+)x([\d.]+)R([\d.]+)$/);
  if (!m) return null;
  return { dia: m[1], width: m[2], rim: m[3] };
}

function main() {
  // Read current file
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const current = JSON.parse(raw);
  const oldMetric = new Set(current.metric);
  const oldFlotation = new Set(current.flotation.map(flotationToString));

  // Generate new comprehensive metric list
  const generated = generateMetricSizes();

  // Merge: start with generated, then union with existing to preserve anything
  // already present (even unusual sizes) and add all new ones
  const allMetric = new Set([...generated, ...oldMetric]);

  // Add any required sizes that aren't generated yet
  for (const s of REQUIRED_METRIC) {
    allMetric.add(s);
  }

  // Sort final metric list
  const finalMetric = Array.from(allMetric).sort((a, b) => {
    const pa = parseMetric(a);
    const pb = parseMetric(b);
    if (pa.width !== pb.width) return pa.width - pb.width;
    if (pa.aspect !== pb.aspect) return pa.aspect - pb.aspect;
    return pa.rim - pb.rim;
  });

  // Merge flotation
  const allFlotation = new Set([...oldFlotation]);
  for (const f of FLOTATION_SIZES) {
    allFlotation.add(flotationToString(f));
  }
  for (const s of REQUIRED_FLOTATION) {
    allFlotation.add(s);
  }

  // Convert back to objects, sort
  const finalFlotation = Array.from(allFlotation)
    .map(s => parseFlotationString(s))
    .filter(Boolean)
    .sort((a, b) => {
      const da = parseFloat(a.dia), db = parseFloat(b.dia);
      if (da !== db) return da - db;
      const wa = parseFloat(a.width), wb = parseFloat(b.width);
      if (wa !== wb) return wa - wb;
      return parseFloat(a.rim) - parseFloat(b.rim);
    });

  // ─── AUDIT REPORT ──────────────────────────────────────────────
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('  TIRE SIZE AUDIT REPORT');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
  console.log(`OLD: ${current.metric.length} metric sizes, ${current.flotation.length} flotation sizes`);
  console.log(`NEW: ${finalMetric.length} metric sizes, ${finalFlotation.length} flotation sizes`);
  console.log('');

  const addedMetric = finalMetric.filter(s => !oldMetric.has(s));
  const addedFlotation = finalFlotation.filter(f => !oldFlotation.has(flotationToString(f)));

  console.log(`Metric added: +${addedMetric.length}`);
  console.log(`Flotation added: +${addedFlotation.length}`);
  console.log('');

  // Breakdown by rim
  console.log('── Metric breakdown by rim (NEW) ──');
  const rimBuckets = {};
  for (const s of finalMetric) {
    const p = parseMetric(s);
    rimBuckets[p.rim] = (rimBuckets[p.rim] || 0) + 1;
  }
  for (const rim of Object.keys(rimBuckets).sort((a, b) => parseInt(a) - parseInt(b))) {
    const wasCount = Array.from(oldMetric).filter(s => parseMetric(s).rim === parseInt(rim)).length;
    const nowCount = rimBuckets[rim];
    const diff = nowCount - wasCount;
    const indicator = diff > 0 ? ` (+${diff})` : '';
    console.log(`  R${rim}: ${nowCount}${indicator}`);
  }

  console.log('');
  console.log('── Required size check ──');
  let allPresent = true;
  for (const s of REQUIRED_METRIC) {
    const present = finalMetric.includes(s);
    if (!present) {
      console.log(`  ❌ STILL MISSING: ${s}`);
      allPresent = false;
    } else {
      const wasAlready = oldMetric.has(s);
      console.log(`  ✅ ${s}${wasAlready ? '' : ' (NEWLY ADDED)'}`);
    }
  }

  console.log('');
  console.log('── Required flotation check ──');
  for (const s of REQUIRED_FLOTATION) {
    const present = allFlotation.has(s);
    if (!present) {
      console.log(`  ❌ STILL MISSING: ${s}`);
      allPresent = false;
    } else {
      const wasAlready = oldFlotation.has(s);
      console.log(`  ✅ ${s}${wasAlready ? '' : ' (NEWLY ADDED)'}`);
    }
  }

  if (allPresent) {
    console.log('');
    console.log('✅ All required sizes present in new list');
  }

  console.log('');
  console.log('── Sample of newly added metric sizes (first 40) ──');
  addedMetric.slice(0, 40).forEach(s => console.log(`  + ${s}`));
  if (addedMetric.length > 40) {
    console.log(`  ... and ${addedMetric.length - 40} more`);
  }

  if (!reportOnly && doWrite) {
    // Build new JSON
    const output = {
      metric: finalMetric,
      flotation: finalFlotation,
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(output, null, 2), 'utf-8');
    console.log('');
    console.log(`✅ Written: ${DATA_PATH}`);
    console.log(`   ${finalMetric.length} metric + ${finalFlotation.length} flotation sizes`);
  } else {
    console.log('');
    console.log('(dry run — pass --write to update tire-sizes.json)');
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
}

main();
