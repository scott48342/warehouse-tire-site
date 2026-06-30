/**
 * European Vehicle Offset Updater
 * Updates offset_min_mm / offset_max_mm for European makes
 * using embedded oem_wheel_sizes offset data or a lookup table.
 */

import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const pool = new pg.Pool({ connectionString: env.POSTGRES_URL });

// ───────────────────────────────────────────────
// CATEGORY CONSTANTS
// ───────────────────────────────────────────────
const CAR = 'car';       // Passenger car – 5-lug
const SUV = 'suv';       // SUV / crossover
const PERF = 'perf';     // European performance car

function calcRange(oemMin, oemMax, category) {
  let minOff, maxOff;
  if (category === PERF) {
    minOff = Math.max(oemMin - 10, -20);
    maxOff = Math.min(oemMax + 15, 55);
  } else if (category === SUV) {
    minOff = Math.max(oemMin - 20, -25);
    maxOff = Math.min(oemMax + 25, 55);
  } else { // CAR
    minOff = Math.max(oemMin - 15, -20);
    maxOff = Math.min(oemMax + 20, 55);
  }
  return { offsetMin: minOff, offsetMax: maxOff };
}

// ───────────────────────────────────────────────
// LOOKUP TABLE  {make_lower} -> {model_lower} -> { oem, category, thread }
// oem: single value or [frontET, rearET] for staggered
// ───────────────────────────────────────────────
const LOOKUP = {
  // ── Alfa Romeo ────────────────────────────────
  'alfa romeo': {
    '4c':      { oem: 40,  category: PERF, thread: 'M12x1.25' },
    'giulia':  { oem: 33,  category: PERF, thread: 'M12x1.25' },
    'stelvio': { oem: 45,  category: SUV,  thread: 'M12x1.25' },
  },

  // ── Aston Martin ─────────────────────────────
  'aston martin': {
    'db11':    { oem: 20, category: PERF, thread: 'M14x1.5' },
    'rapide':  { oem: 20, category: PERF, thread: 'M14x1.5' },
    'vanquish':{ oem: 20, category: PERF, thread: 'M14x1.5' },
  },

  // ── Audi ─────────────────────────────────────
  'audi': {
    'rs3':        { oem: 43,  category: PERF, thread: 'M14x1.5' },
    'a6 e-tron':  { oem: 33,  category: CAR,  thread: 'M14x1.5' },
    's6 e-tron':  { oem: 33,  category: CAR,  thread: 'M14x1.5' },
    'sq6 e-tron': { oem: 33,  category: SUV,  thread: 'M14x1.5' },
    'q7':         { oem: 37,  category: SUV,  thread: 'M14x1.5' },
  },

  // ── BMW ──────────────────────────────────────
  'bmw': {
    // 2 Series
    '230i':           { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '230i xdrive':    { oem: 35, category: CAR,  thread: 'M14x1.25' },
    'm240i':          { oem: 35, category: CAR,  thread: 'M14x1.25' },
    'm240i xdrive':   { oem: 35, category: CAR,  thread: 'M14x1.25' },
    // 3 Series
    '3 series':       { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '320i':           { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '320i xdrive':    { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '328d':           { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '328d xdrive':    { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '330e':           { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '330i':           { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '330i gt xdrive': { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '330i xdrive':    { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '340i':           { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '340i gt xdrive': { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '340i xdrive':    { oem: 35, category: CAR,  thread: 'M14x1.25' },
    // 4 Series
    '430i':                     { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '430i gran coupe':          { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '430i xdrive':              { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '430i xdrive gran coupe':   { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '440i':                     { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '440i gran coupe':          { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '440i xdrive':              { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '440i xdrive gran coupe':   { oem: 35, category: CAR,  thread: 'M14x1.25' },
    // 5 Series (G30 gen)
    '530e':           { oem: 30, category: CAR,  thread: 'M14x1.25' },
    '530e xdrive':    { oem: 30, category: CAR,  thread: 'M14x1.25' },
    '530i':           { oem: 30, category: CAR,  thread: 'M14x1.25' },
    '530i xdrive':    { oem: 30, category: CAR,  thread: 'M14x1.25' },
    '540d xdrive':    { oem: 30, category: CAR,  thread: 'M14x1.25' },
    '540i':           { oem: 30, category: CAR,  thread: 'M14x1.25' },
    '540i xdrive':    { oem: 30, category: CAR,  thread: 'M14x1.25' },
    'm550i xdrive':   { oem: 35, category: PERF, thread: 'M14x1.25' },
    // 6 Series (F12/F13)
    '640i':                       { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '640i gran coupe':            { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '640i xdrive':                { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '640i xdrive gran coupe':     { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '640i xdrive gran turismo':   { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '650i':                       { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '650i gran coupe':            { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '650i xdrive':                { oem: 35, category: CAR,  thread: 'M14x1.25' },
    '650i xdrive gran coupe':     { oem: 35, category: CAR,  thread: 'M14x1.25' },
    // 7 Series (G11 gen)
    '740e xdrive':    { oem: 32, category: CAR,  thread: 'M14x1.25' },
    '740i':           { oem: 32, category: CAR,  thread: 'M14x1.25' },
    '740i xdrive':    { oem: 32, category: CAR,  thread: 'M14x1.25' },
    '750i':           { oem: 32, category: CAR,  thread: 'M14x1.25' },
    '750i xdrive':    { oem: 32, category: CAR,  thread: 'M14x1.25' },
    // Alpina
    'alpina b6 xdrive gran coupe': { oem: 35, category: PERF, thread: 'M14x1.25' },
    'alpina b7':                   { oem: 38, category: CAR,  thread: 'M14x1.25' },
    // M Series
    'm2':             { oem: 35, category: PERF, thread: 'M14x1.25' },
    'm3':             { oem: 35, category: PERF, thread: 'M14x1.25' },
    'm5':             { oem: 35, category: PERF, thread: 'M14x1.25' },
    'm6':             { oem: 35, category: PERF, thread: 'M14x1.25' },
    'm6 gran coupe':  { oem: 35, category: PERF, thread: 'M14x1.25' },
    'm760i xdrive':   { oem: 38, category: PERF, thread: 'M14x1.25' },
    // X Series
    'x3':     { oem: 43, category: SUV,  thread: 'M14x1.25' },
    'x4':     { oem: 40, category: SUV,  thread: 'M14x1.25' },
    'x5':     { oem: 40, category: SUV,  thread: 'M14x1.25' },
    'x6':     { oem: 40, category: SUV,  thread: 'M14x1.25' },
    // Z / i
    'z3':     { oem: 35, category: PERF, thread: 'M12x1.5' },
    'i3':     { oem: 40, category: CAR,  thread: 'M14x1.25' },
    'i3s':    { oem: 40, category: CAR,  thread: 'M14x1.25' },
  },

  // ── Ferrari ──────────────────────────────────
  'ferrari': {
    '488 gtb':      { oem: 37, category: PERF, thread: 'M14x1.5' },
    '488 spider':   { oem: 37, category: PERF, thread: 'M14x1.5' },
    '812 superfast':{ oem: 32, category: PERF, thread: 'M14x1.5' },
    'california t': { oem: 35, category: PERF, thread: 'M14x1.5' },
    'gtc4lusso':    { oem: 32, category: PERF, thread: 'M14x1.5' },
    'gtc4lusso t':  { oem: 32, category: PERF, thread: 'M14x1.5' },
    'portofino':    { oem: 32, category: PERF, thread: 'M14x1.5' },
  },

  // ── Fiat ─────────────────────────────────────
  'fiat': {
    '500': { oem: 35, category: CAR, thread: 'M12x1.25' },
  },

  // ── Jaguar ───────────────────────────────────
  'jaguar': {
    'e-pace':  { oem: 45, category: SUV,  thread: 'M14x1.5' },
    'f-type':  { oem: 40, category: PERF, thread: 'M14x1.5' },
    'xe':      { oem: 45, category: CAR,  thread: 'M14x1.5' },
    'xj':      { oem: 40, category: CAR,  thread: 'M14x1.5' },
    'xjr575':  { oem: 40, category: PERF, thread: 'M14x1.5' },
  },

  // ── Land Rover ───────────────────────────────
  'land rover': {
    'defender 90':         { oem: 30,  category: SUV, thread: 'M16x1.5' },
    'discovery':           { oem: 53,  category: SUV, thread: 'M14x1.5' },
    'discovery sport':     { oem: 45,  category: SUV, thread: 'M14x1.5' },
    'range rover':         { oem: 53,  category: SUV, thread: 'M14x1.5' },
    'range rover sport':   { oem: 45,  category: SUV, thread: 'M14x1.5' },
    'range rover velar':   { oem: 42,  category: SUV, thread: 'M14x1.5' },
    'range rover evoque':  { oem: 45,  category: SUV, thread: 'M14x1.5' },
  },

  // ── Lotus ────────────────────────────────────
  'lotus': {
    'evora': { oem: 40, category: PERF, thread: 'M12x1.5' },
  },

  // ── Maserati ─────────────────────────────────
  'maserati': {
    'ghibli':        { oem: 40, category: PERF, thread: 'M14x1.5' },
    'granturismo':   { oem: 37, category: PERF, thread: 'M14x1.5' },
    'levante':       { oem: 33, category: SUV,  thread: 'M14x1.5' },
    'quattroporte':  { oem: 35, category: PERF, thread: 'M14x1.5' },
  },

  // ── McLaren ──────────────────────────────────
  'mclaren': {
    '570gt':  { oem: 33, category: PERF, thread: 'M14x1.5' },
    '570s':   { oem: 33, category: PERF, thread: 'M14x1.5' },
    '720s':   { oem: 33, category: PERF, thread: 'M14x1.5' },
  },

  // ── Mercedes (make="Mercedes") ───────────────
  'mercedes': {
    'a-class amg': { oem: 52, category: PERF, thread: 'M12x1.5' },
    'c-class amg': { oem: 42, category: PERF, thread: 'M12x1.5' },
  },

  // ── Mercedes-Benz ────────────────────────────
  'mercedes-benz': {
    // AMG GT sports car family
    'amg gt':      { oem: 40, category: PERF, thread: 'M14x1.5' },
    'amg gt c':    { oem: 47, category: PERF, thread: 'M14x1.5' },
    'amg gt r':    { oem: 40, category: PERF, thread: 'M14x1.5' },
    'amg gt s':    { oem: 47, category: PERF, thread: 'M14x1.5' },
    // C-Class
    'c300':        { oem: 40, category: CAR,  thread: 'M12x1.5' },
    'c350e':       { oem: 35, category: CAR,  thread: 'M12x1.5' },
    'c43 amg':     { oem: 42, category: PERF, thread: 'M12x1.5' },
    'c63 amg':     { oem: 40, category: PERF, thread: 'M12x1.5' },
    'c63 amg s':   { oem: 40, category: PERF, thread: 'M12x1.5' },
    // CLS
    'cls550':      { oem: 42, category: CAR,  thread: 'M12x1.5' },
    'cls63 amg s': { oem: 42, category: PERF, thread: 'M12x1.5' },
    // E-Class
    'e400':        { oem: 35, category: CAR,  thread: 'M12x1.5' },
    'e43 amg':     { oem: 40, category: PERF, thread: 'M12x1.5' },
    'e63 amg s':   { oem: 40, category: PERF, thread: 'M12x1.5' },
    // GLC
    'glc300':      { oem: 42, category: SUV,  thread: 'M12x1.5' },
    'glc43 amg':   { oem: 42, category: SUV,  thread: 'M12x1.5' },
    'glc63 amg':   { oem: 42, category: SUV,  thread: 'M12x1.5' },
    'glc63 amg s': { oem: 42, category: SUV,  thread: 'M12x1.5' },
    // GLE
    'gle43 amg':   { oem: 38, category: SUV,  thread: 'M12x1.5' },
    'gle63 amg':   { oem: 38, category: SUV,  thread: 'M12x1.5' },
    'gle63 amg s': { oem: 38, category: SUV,  thread: 'M12x1.5' },
    // Maybach
    'maybach s560': { oem: 40, category: CAR, thread: 'M14x1.5' },
    'maybach s650': { oem: 40, category: CAR, thread: 'M14x1.5' },
    // S-Class
    's450':   { oem: 40, category: CAR,  thread: 'M14x1.5' },
    's560':   { oem: 40, category: CAR,  thread: 'M14x1.5' },
    's63 amg':{ oem: 40, category: PERF, thread: 'M14x1.5' },
    's65 amg':{ oem: 40, category: PERF, thread: 'M14x1.5' },
    // SL/SLC
    'sl450':    { oem: 32, category: PERF, thread: 'M14x1.5' },
    'sl550':    { oem: 32, category: PERF, thread: 'M14x1.5' },
    'sl63 amg': { oem: 40, category: PERF, thread: 'M14x1.5' },
    'sl65 amg': { oem: 40, category: PERF, thread: 'M14x1.5' },
    'slc300':   { oem: 35, category: PERF, thread: 'M14x1.5' },
    'slc43 amg':{ oem: 35, category: PERF, thread: 'M14x1.5' },
  },

  // ── Mercedes-Benz Vans ───────────────────────
  'mercedes-benz vans': {
    'sprinter 3500':    { oem: 0,  category: SUV, thread: 'M14x1.5' },
    'sprinter 3500xd':  { oem: 0,  category: SUV, thread: 'M14x1.5' },
  },

  // ── Porsche ──────────────────────────────────
  'porsche': {
    '718 boxster': { oem: [57, 47], category: PERF, thread: 'M14x1.5' }, // [front, rear]
    '718 cayman':  { oem: [57, 47], category: PERF, thread: 'M14x1.5' },
    '911':         { oem: [57, 47], category: PERF, thread: 'M14x1.5' }, // general; 964/993 uses [52,27]
    'macan':       { oem: 21,       category: SUV,  thread: 'M14x1.5' },
    'panamera':    { oem: [69, 58], category: PERF, thread: 'M14x1.5' },
    'cayenne':     { oem: 50,       category: SUV,  thread: 'M14x1.5' },
  },

  // ── Rolls-Royce ──────────────────────────────
  'rolls-royce': {
    'dawn':    { oem: 52, category: CAR, thread: 'M14x1.5' },
    'ghost':   { oem: 52, category: CAR, thread: 'M14x1.5' },
    'phantom': { oem: 52, category: CAR, thread: 'M14x1.5' },
    'wraith':  { oem: 52, category: CAR, thread: 'M14x1.5' },
  },

  // ── Smart ────────────────────────────────────
  'smart': {
    'fortwo': { oem: 30, category: CAR, thread: 'M12x1.5' },
  },

  // ── Volkswagen (titlecase + lower) ───────────
  'volkswagen': {
    'atlas': { oem: 33, category: SUV, thread: 'M14x1.5' },
    'id.4':  { oem: 33, category: SUV, thread: 'M14x1.5' },
  },
};

// ───────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────
function lookupEntry(make, model) {
  const makeLow = make.toLowerCase();
  const modelLow = model.toLowerCase();
  const makeMap = LOOKUP[makeLow];
  if (!makeMap) return null;
  return makeMap[modelLow] ?? null;
}

function extractEmbeddedOffsets(wheelsJson) {
  if (!wheelsJson) return null;
  try {
    const wheels = typeof wheelsJson === 'string' ? JSON.parse(wheelsJson) : wheelsJson;
    if (!Array.isArray(wheels)) return null;
    const offsets = [];
    for (const w of wheels) {
      if (typeof w === 'object' && w !== null && typeof w.offset === 'number') {
        offsets.push(w.offset);
        // Also check nested front/rear
        if (typeof w.front?.offset === 'number') offsets.push(w.front.offset);
        if (typeof w.rear?.offset  === 'number') offsets.push(w.rear.offset);
      }
    }
    return offsets.length > 0 ? offsets : null;
  } catch { return null; }
}

// Determine category from bolt pattern + model name hints
function guessCategoryFromContext(make, model, boltPattern) {
  const m = model.toLowerCase();
  const isPerf = /amg|m2|m3|m4|m5|m6|rs|gts|gtb|spider|superfast|lusso|portofino|type|quattroporte|granturismo|gt\b|boxster|cayman|911|718|mclaren|lotus|aston martin|vanquish|rapide|dawn|wraith|ghost|phantom/.test(m + ' ' + make.toLowerCase());
  const isSuv = /x3|x4|x5|x6|suv|sport|macan|cayenne|atlas|id\.4|q7|stelvio|levante|e-pace|discovery|range rover|defender|evoque|velar|gle|glc|glb|gla|eqb/.test(m);
  if (isPerf && !isSuv) return PERF;
  if (isSuv) return SUV;
  return CAR;
}

// ───────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────
const rows = JSON.parse(readFileSync(resolve(__dirname, 'european-vehicles-raw.json'), 'utf8'));

const result = { updated: [], skipped: [], errors: [] };
let totalRecordsUpdated = 0;

for (const row of rows) {
  const { make, model, year_from, year_to, cnt, bolt_pattern } = row;
  const yearsStr = `${year_from}-${year_to}`;

  // 1. Try embedded offsets first
  let embeddedOffsets = extractEmbeddedOffsets(row.wheels);

  if (embeddedOffsets) {
    const oemMin = Math.min(...embeddedOffsets);
    const oemMax = Math.max(...embeddedOffsets);
    const category = guessCategoryFromContext(make, model, bolt_pattern);
    const { offsetMin, offsetMax } = calcRange(oemMin, oemMax, category);
    const entry = lookupEntry(make, model);
    const thread = entry?.thread ?? null;

    try {
      const res = await pool.query(`
        UPDATE vehicle_fitments
        SET offset_min_mm = $1, offset_max_mm = $2,
            thread_size = COALESCE(thread_size, $3),
            updated_at = NOW()
        WHERE LOWER(make) = LOWER($4) AND LOWER(model) = LOWER($5)
          AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
          AND year BETWEEN $6 AND $7
      `, [offsetMin, offsetMax, thread, make, model, year_from, year_to]);

      const updated = res.rowCount;
      totalRecordsUpdated += updated;
      result.updated.push({
        make, model, years: yearsStr,
        source: 'embedded_oem_data',
        oem_offsets: embeddedOffsets,
        oem_range: `${oemMin}–${oemMax}`,
        aftermarket_range: `${offsetMin}–${offsetMax}`,
        category,
        records: updated,
      });
      process.stdout.write(`✅ ${make} ${model} ${yearsStr}: offsets=${embeddedOffsets} → [${offsetMin}, ${offsetMax}] (${category}) — ${updated} rows\n`);
    } catch (err) {
      result.errors.push({ make, model, years: yearsStr, error: err.message });
      process.stderr.write(`❌ ${make} ${model}: ${err.message}\n`);
    }
    continue;
  }

  // 2. Try lookup table
  const entry = lookupEntry(make, model);
  if (!entry) {
    result.skipped.push({ make, model, years: yearsStr, reason: 'no lookup entry, no embedded data' });
    process.stdout.write(`⏭  ${make} ${model} ${yearsStr}: SKIPPED (no data)\n`);
    continue;
  }

  const oemArr = Array.isArray(entry.oem) ? entry.oem : [entry.oem];
  const oemMin = Math.min(...oemArr);
  const oemMax = Math.max(...oemArr);
  const { offsetMin, offsetMax } = calcRange(oemMin, oemMax, entry.category);

  try {
    const res = await pool.query(`
      UPDATE vehicle_fitments
      SET offset_min_mm = $1, offset_max_mm = $2,
          thread_size = COALESCE(thread_size, $3),
          updated_at = NOW()
      WHERE LOWER(make) = LOWER($4) AND LOWER(model) = LOWER($5)
        AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
        AND year BETWEEN $6 AND $7
    `, [offsetMin, offsetMax, entry.thread, make, model, year_from, year_to]);

    const updated = res.rowCount;
    totalRecordsUpdated += updated;
    result.updated.push({
      make, model, years: yearsStr,
      source: 'lookup_table',
      oem_offset: Array.isArray(entry.oem) ? `${entry.oem[0]}F/${entry.oem[1]}R` : entry.oem,
      aftermarket_range: `${offsetMin}–${offsetMax}`,
      category: entry.category,
      records: updated,
    });
    process.stdout.write(`✅ ${make} ${model} ${yearsStr}: OEM=${Array.isArray(entry.oem) ? entry.oem.join('/') : entry.oem} → [${offsetMin}, ${offsetMax}] (${entry.category}) — ${updated} rows\n`);
  } catch (err) {
    result.errors.push({ make, model, years: yearsStr, error: err.message });
    process.stderr.write(`❌ ${make} ${model}: ${err.message}\n`);
  }
}

// Summary
process.stdout.write(`\n════════════════════════════════\n`);
process.stdout.write(`Groups processed: ${rows.length}\n`);
process.stdout.write(`Groups updated:   ${result.updated.length}\n`);
process.stdout.write(`Groups skipped:   ${result.skipped.length}\n`);
process.stdout.write(`Errors:           ${result.errors.length}\n`);
process.stdout.write(`Total DB rows:    ${totalRecordsUpdated}\n`);
process.stdout.write(`════════════════════════════════\n`);

result.summary = {
  total_groups: rows.length,
  groups_updated: result.updated.length,
  groups_skipped: result.skipped.length,
  errors: result.errors.length,
  total_db_rows_updated: totalRecordsUpdated,
  run_at: new Date().toISOString(),
};

writeFileSync(
  resolve(__dirname, 'offset-research-european.json'),
  JSON.stringify(result, null, 2)
);
process.stdout.write('Results written to scripts/offset-research-european.json\n');

await pool.end();
