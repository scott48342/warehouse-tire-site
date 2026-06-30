/**
 * GM + Remaining Makes Offset Update Script
 * Assigns offset_min_mm / offset_max_mm based on OEM research
 */
import pg from 'pg';
import { readFileSync } from 'fs';

const envContent = readFileSync('C:\\Users\\Scott-Pc\\backup clawd\\warehouse-tire-site\\.env.local', 'utf8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match[1];
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

let totalUpdated = 0;
const log = [];

async function updateOffset(make, model, yearFrom, yearTo, offsetMin, offsetMax, threadSize, notes) {
  const res = await pool.query(`
    UPDATE vehicle_fitments
    SET offset_min_mm = $1, offset_max_mm = $2,
        thread_size = COALESCE(thread_size, $3),
        updated_at = NOW()
    WHERE LOWER(make) = LOWER($4) AND LOWER(model) = LOWER($5)
      AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
      AND year BETWEEN $6 AND $7
  `, [offsetMin, offsetMax, threadSize, make, model, yearFrom, yearTo]);
  totalUpdated += res.rowCount;
  if (res.rowCount > 0) {
    log.push({ make, model, yearFrom, yearTo, offsetMin, offsetMax, threadSize, notes, rowsUpdated: res.rowCount });
    console.log(`✓ ${make} ${model} ${yearFrom}-${yearTo}: ET${offsetMin} to ET${offsetMax} (${res.rowCount} rows)`);
  }
  return res.rowCount;
}

// Helper: compute range from OEM offset
// type: 'car', 'suv5', 'truck6', 'truck8', 'classic', 'van'
function range(oemOffset, type) {
  switch (type) {
    case 'car':    return [Math.max(oemOffset - 15, -20), Math.min(oemOffset + 20, 55)];
    case 'suv5':   return [Math.max(oemOffset - 20, -25), Math.min(oemOffset + 25, 55)];
    case 'truck6': return [Math.max(oemOffset - 30, -44), Math.min(oemOffset + 25, 44)];
    case 'truck8': return [Math.max(oemOffset - 38, -51), Math.min(oemOffset + 25, 44)];
    case 'classic':return [-13, 25];
    case 'van':    return [Math.max(oemOffset - 20, -25), Math.min(oemOffset + 20, 44)];
    default:       return [Math.max(oemOffset - 15, -20), Math.min(oemOffset + 20, 55)];
  }
}

// ============================================================
// AMC (1966-1987) - All vintage, 5x114.3, lug 1/2-20
// OEM offset typically 0-12mm on narrow steel wheels
// ============================================================
const amcModels = [
  ['AMX', 1968, 1974],
  ['Concord', 1980, 1983],
  ['Eagle', 1980, 1987],
  ['Gremlin', 1972, 1974],
  ['Hornet', 1970, 1974],
  ['Hornet SC/360', 1971, 1971],
  ['Javelin', 1968, 1974],
  ['Rebel', 1967, 1970],
  ['Rebel Machine', 1970, 1970],
  ['SC/Rambler', 1969, 1969],
  ['Spirit', 1980, 1983],
];
for (const [model, yf, yt] of amcModels) {
  await updateOffset('AMC', model, yf, yt, -13, 25, '1/2-20', 'AMC classic 1/2-20 lug, ET~0-12');
}

// ============================================================
// ALFA ROMEO (2018 entries only)
// 4C: 5x98, ET~45; Giulia: 5x110, ET~35-40; Stelvio: 5x110, ET~42
// ============================================================
await updateOffset('Alfa Romeo', '4C', 2018, 2018, ...range(45, 'car'), 'M14x1.25', 'Alfa 4C ET45 OEM');
await updateOffset('Alfa Romeo', 'Giulia', 2018, 2018, ...range(38, 'car'), 'M14x1.25', 'Alfa Giulia ET38 OEM');
await updateOffset('Alfa Romeo', 'Stelvio', 2018, 2018, ...range(42, 'suv5'), 'M14x1.25', 'Alfa Stelvio ET42 OEM');

// ============================================================
// ASTON MARTIN (2018 entries, 5x128)
// DB11/Rapide/Vanquish: ET~30-35
// ============================================================
await updateOffset('Aston Martin', 'DB11', 2018, 2018, ...range(32, 'car'), 'M14x1.5', 'Aston Martin DB11 ET32 OEM');
await updateOffset('Aston Martin', 'Rapide', 2018, 2018, ...range(32, 'car'), 'M14x1.5', 'Aston Martin Rapide ET32 OEM');
await updateOffset('Aston Martin', 'Vanquish', 2018, 2018, ...range(32, 'car'), 'M14x1.5', 'Aston Martin Vanquish ET32 OEM');

// ============================================================
// BUICK
// ============================================================

// Buick Century (1982-1999) - FWD A-body, ET42-44, 5x115 or 5x100
await updateOffset('Buick', 'Century', 1982, 1999, ...range(43, 'car'), 'M12x1.5', 'Buick Century FWD ET43 OEM');

// Buick Enclave (2008-2026) - 6x120 SUV, OEM ET50 from data
await updateOffset('Buick', 'Enclave', 2008, 2026, ...range(50, 'suv5'), 'M14x1.5', 'Buick Enclave 6x120 ET50 OEM');

// Buick Encore GX (2020-2026) - 5x115, ET~40
await updateOffset('Buick', 'Encore GX', 2020, 2026, ...range(40, 'car'), 'M12x1.5', 'Buick Encore GX 5x115 ET40 OEM');

// Buick Envision (2016-2020) - 5x115, OEM ET39 from data
await updateOffset('Buick', 'Envision', 2016, 2020, ...range(39, 'suv5'), 'M12x1.5', 'Buick Envision ET39 OEM from data');

// Buick GS / GSX / Gran Sport (classic muscle, 5x120.65)
await updateOffset('Buick', 'GS', 1968, 1972, -13, 25, '1/2-20', 'Buick GS classic muscle 5x120.65');
await updateOffset('Buick', 'GSX', 1970, 1971, -13, 25, '1/2-20', 'Buick GSX classic muscle 5x120.65');
await updateOffset('Buick', 'Gran Sport', 1965, 1967, -13, 25, '1/2-20', 'Buick Gran Sport classic 5x120.65');

// Buick Grand National (1982-1987) - 5x120.65, 15" steel, ET~15-20
await updateOffset('Buick', 'Grand National', 1982, 1987, ...range(18, 'car'), 'M12x1.5', 'Buick Grand National 5x120.65 ET18 OEM');

// Buick LaCrosse (2005-2019) - 5x120, ET40
await updateOffset('Buick', 'LaCrosse', 2005, 2019, ...range(40, 'car'), 'M12x1.5', 'Buick LaCrosse 5x120 ET40 OEM');

// Buick LeSabre (1980-1985) - 5x115, 15", ET~42
await updateOffset('Buick', 'LeSabre', 1980, 1985, ...range(42, 'car'), 'M12x1.5', 'Buick LeSabre 5x115 ET42 OEM');

// Buick Park Avenue (1991-1999) - 5x115, OEM ET40-41 from data
await updateOffset('Buick', 'Park Avenue', 1991, 1999, ...range(41, 'car'), 'M12x1.5', 'Buick Park Avenue ET41 OEM from data');

// Buick Regal (2011-2017) - 5x115/5x120, ET42 from data
await updateOffset('Buick', 'Regal', 2011, 2017, ...range(42, 'car'), 'M12x1.5', 'Buick Regal ET42 OEM from data');

// Buick Regal Sportback (2019-2020) - 5x115, ET49 from data
await updateOffset('Buick', 'Regal Sportback', 2019, 2020, ...range(49, 'car'), 'M12x1.5', 'Buick Regal Sportback ET49 OEM from data');

// Buick Riviera (1966-1999) - FWD/RWD, 5x115, ET41 from data
await updateOffset('Buick', 'Riviera', 1966, 1999, ...range(41, 'car'), 'M12x1.5', 'Buick Riviera ET41 OEM from data');

// Buick Roadmaster (1991-1996) - 5x127 RWD B-body, ET~0 (conservative)
await updateOffset('Buick', 'Roadmaster', 1991, 1996, ...range(0, 'car'), 'M12x1.5', 'Buick Roadmaster 5x127 RWD ET0 OEM');

// Buick Skylark (1965-1998) - 5x100 mostly, ET~42
await updateOffset('Buick', 'Skylark', 1965, 1998, ...range(42, 'car'), 'M12x1.5', 'Buick Skylark ET42 OEM');

// ============================================================
// CADILLAC
// ============================================================

// Cadillac ATS (2018) - 5x115/5x120, ET~38
await updateOffset('Cadillac', 'ATS', 2018, 2018, ...range(38, 'car'), 'M14x1.5', 'Cadillac ATS ET38 OEM');

// Cadillac Allante (1990-1993) - 5x115 FWD, ET40 from data
await updateOffset('Cadillac', 'Allante', 1990, 1993, ...range(40, 'car'), 'M12x1.5', 'Cadillac Allante ET40 OEM from data');

// Cadillac Brougham (1990-1992) - 5x127 RWD B-body, ET~0
await updateOffset('Cadillac', 'Brougham', 1990, 1992, ...range(0, 'car'), 'M12x1.5', 'Cadillac Brougham 5x127 RWD ET0 OEM');

// Cadillac CT6 (2018) - 5x120, ET~40
await updateOffset('Cadillac', 'CT6', 2018, 2018, ...range(40, 'car'), 'M14x1.5', 'Cadillac CT6 ET40 OEM');

// Cadillac CTS (2018) - 5x120, ET~42
await updateOffset('Cadillac', 'CTS', 2018, 2018, ...range(42, 'car'), 'M14x1.5', 'Cadillac CTS ET42 OEM');

// Cadillac Catera (1997-1999) - 5x110, ET43 from data
await updateOffset('Cadillac', 'Catera', 1997, 1999, ...range(43, 'car'), 'M12x1.5', 'Cadillac Catera ET43 OEM from data');

// Cadillac DeVille (all years) - 5x115 era, ET41 from data
await updateOffset('Cadillac', 'DeVille', 1955, 1999, ...range(41, 'car'), 'M12x1.5', 'Cadillac DeVille ET41 OEM from data');

// Cadillac Eldorado (all years) - 5x115 era, ET41 from data
await updateOffset('Cadillac', 'Eldorado', 1955, 1999, ...range(41, 'car'), 'M12x1.5', 'Cadillac Eldorado ET41 OEM from data');

// Cadillac Fleetwood (1955-1989) - 5x127 RWD B-body, ET~0-12
await updateOffset('Cadillac', 'Fleetwood', 1955, 1989, -13, 25, 'M12x1.5', 'Cadillac Fleetwood 5x127 RWD classic');

// Cadillac Fleetwood (1990-1992) - 5x115 era, ET~42
await updateOffset('Cadillac', 'Fleetwood', 1990, 1992, ...range(42, 'car'), 'M12x1.5', 'Cadillac Fleetwood 1990-92 5x115 ET42');

// Cadillac Fleetwood (1993-1996) - 5x127 RWD, ET~0
await updateOffset('Cadillac', 'Fleetwood', 1993, 1996, ...range(0, 'car'), 'M12x1.5', 'Cadillac Fleetwood 5x127 RWD ET0 OEM');

// Cadillac Seville (1980-1999) - 5x115, ET41 from data
await updateOffset('Cadillac', 'Seville', 1980, 1999, ...range(41, 'car'), 'M12x1.5', 'Cadillac Seville ET41 OEM from data');

// Cadillac Escalade lowercase (2024) - 6x139.7, ET24-31
await updateOffset('cadillac', 'escalade', 2024, 2024, ...range(27, 'suv5'), 'M14x1.5', 'Cadillac Escalade 2024 6x139.7 ET27 OEM');
await updateOffset('cadillac', 'escalade esv', 2024, 2024, ...range(27, 'suv5'), 'M14x1.5', 'Cadillac Escalade ESV 2024 6x139.7 ET27 OEM');

// ============================================================
// CHEVROLET
// ============================================================

// Chevy 150/210/Bel Air/Nomad/Deluxe - vintage 5x120.65, ET~0-12
for (const [model, yf, yt] of [['150', 1953, 1957], ['210', 1953, 1957], ['Bel Air', 1953, 1957], ['Nomad', 1955, 1957], ['Deluxe', 1950, 1952]]) {
  await updateOffset('Chevrolet', model, yf, yt, -13, 25, '1/2-20', `Chevy ${model} vintage 5x120.65 classic`);
}

// Chevy Astro (1990-1999) - 5x127 van/AWD, OEM ET28 from data
await updateOffset('Chevrolet', 'Astro', 1990, 1999, ...range(28, 'van'), 'M12x1.5', 'Chevy Astro 5x127 van ET28 OEM');

// Chevy Avalanche 1500 (2002-2006) - 6x139.7, ET~18
await updateOffset('Chevrolet', 'Avalanche 1500', 2002, 2006, ...range(18, 'truck6'), 'M14x1.5', 'Chevy Avalanche 1500 6x139.7 ET18 OEM');

// Chevy Avalanche 2500 (2002-2006) - 8x165.1, ET~12
await updateOffset('Chevrolet', 'Avalanche 2500', 2002, 2006, ...range(12, 'truck8'), 'M14x1.5', 'Chevy Avalanche 2500 8x165.1 ET12 OEM');

// Chevy Beretta (1990-1996) - 5x100 FWD, ET42 from data
await updateOffset('Chevrolet', 'Beretta', 1990, 1996, ...range(42, 'car'), 'M12x1.5', 'Chevy Beretta 5x100 ET42 OEM');

// Chevy Blazer (1980-1989) - 6x139.7, K5 Blazer, ET~3
await updateOffset('Chevrolet', 'Blazer', 1980, 1989, ...range(3, 'suv5'), 'M12x1.5', 'Chevy K5 Blazer 6x139.7 ET3 OEM');

// Chevy Blazer (1990-1999) - 5x120.65, S-10 based, ET~25
await updateOffset('Chevrolet', 'Blazer', 1990, 1999, ...range(25, 'suv5'), 'M12x1.5', 'Chevy Blazer 1990-99 5x120.65 ET25 OEM');

// Chevy Blazer (2019-2026) - 5x120 crossover, ET~40
await updateOffset('Chevrolet', 'Blazer', 2019, 2026, ...range(40, 'suv5'), 'M14x1.5', 'Chevy Blazer 2019+ 5x120 ET40 OEM');

// Chevy Bolt EUV (2021-2023) - 5x105, ET~40
await updateOffset('Chevrolet', 'Bolt EUV', 2021, 2023, ...range(40, 'car'), 'M12x1.5', 'Chevy Bolt EUV 5x105 ET40 OEM');

// Chevy C10 (1960-1987) - 5x127 light truck, ET~0-12
await updateOffset('Chevrolet', 'C10', 1960, 1987, ...range(6, 'truck6'), 'M12x1.5', 'Chevy C10 5x127 light truck ET6 OEM');

// Chevy C1500 (1988-1999) - 6x139.7, OEM ET6-31. Use ET12.
await updateOffset('Chevrolet', 'C1500', 1988, 1999, ...range(12, 'truck6'), 'M14x1.5', 'Chevy C1500 6x139.7 ET12 OEM');

// Chevy C20 (1967-1987) - 8x165.1 heavy truck, ET~12-18
await updateOffset('Chevrolet', 'C20', 1967, 1987, ...range(12, 'truck8'), 'M14x1.5', 'Chevy C20 8x165.1 ET12 OEM');

// Chevy C2500 (1988-1989) - 6x139.7, ET28
await updateOffset('Chevrolet', 'C2500', 1988, 1989, ...range(28, 'truck6'), 'M14x1.5', 'Chevy C2500 6x139.7 ET28 OEM');

// Chevy C2500 (1990-1999) - 8x165.1, ET28
await updateOffset('Chevrolet', 'C2500', 1990, 1999, ...range(28, 'truck8'), 'M14x1.5', 'Chevy C2500 8x165.1 ET28 OEM');

// Chevy C3500 (1990-1999) - 8x165.1, ET~12 (offset=127 in data is wrong - backspacing)
await updateOffset('Chevrolet', 'C3500', 1990, 1999, ...range(12, 'truck8'), 'M14x1.5', 'Chevy C3500 8x165.1 ET12 OEM');

// Chevy Camaro (2016-2024) - 5x120, ET22-26 (staggered)
await updateOffset('Chevrolet', 'Camaro', 2016, 2024, ...range(24, 'car'), 'M14x1.5', 'Chevy Camaro 5th/6th gen 5x120 ET24 OEM');

// Chevy Caprice (1965-1976) - 5x127, classic RWD
await updateOffset('Chevrolet', 'Caprice', 1965, 1976, -13, 25, '1/2-20', 'Chevy Caprice classic 5x127 RWD');

// Chevy Cavalier (1982-1999) - 5x100 FWD, ET38
await updateOffset('Chevrolet', 'Cavalier', 1982, 1999, ...range(38, 'car'), 'M12x1.5', 'Chevy Cavalier 5x100 ET38 OEM');

// Chevy Celebrity (1982-1989) - 5x115 FWD, ET~42
await updateOffset('Chevrolet', 'Celebrity', 1982, 1989, ...range(42, 'car'), 'M12x1.5', 'Chevy Celebrity 5x115 FWD ET42 OEM');

// Chevy Corsica (1990-1996) - 5x100 FWD, ET42 from data
await updateOffset('Chevrolet', 'Corsica', 1990, 1996, ...range(42, 'car'), 'M12x1.5', 'Chevy Corsica 5x100 ET42 OEM');

// Chevy Corvette (2018) - 5x120.7, front ET35 / rear ET40 from data
await updateOffset('Chevrolet', 'Corvette', 2018, 2018, ...range(37, 'car'), 'M14x1.5', 'Chevy Corvette C7 5x120 ET35-40 OEM');

// Chevy Corvette (2020-2026) - 5x120, ET35 front / ET40 rear from data  
await updateOffset('Chevrolet', 'Corvette', 2020, 2026, ...range(37, 'car'), 'M14x1.5', 'Chevy Corvette C8 5x120 ET35-40 OEM');

// Chevy corvette lowercase (2023) - 5x120
await updateOffset('Chevrolet', 'corvette', 2023, 2023, ...range(37, 'car'), 'M14x1.5', 'Chevy Corvette C8 2023 5x120 ET37 OEM');

// Chevy El Camino (1964-1987) - 5x120.65, classic truck-based car
await updateOffset('Chevrolet', 'El Camino', 1964, 1987, -13, 25, '1/2-20', 'Chevy El Camino classic 5x120.65');

// Chevy Express 1500 (all) - 6x139.7, OEM ET12 from data
await updateOffset('Chevrolet', 'Express 1500', 1996, 2014, ...range(12, 'truck6'), 'M14x1.5', 'Chevy Express 1500 6x139.7 ET12 OEM');

// Chevy Express 2500 (1996-1999) - 8x165.1, ET28 from data
await updateOffset('Chevrolet', 'Express 2500', 1996, 1999, ...range(28, 'truck8'), 'M14x1.5', 'Chevy Express 2500 8x165.1 ET28 OEM');

// Chevy Express 3500 (1996-1999) - 8x165.1, ET12
await updateOffset('Chevrolet', 'Express 3500', 1996, 1999, ...range(12, 'truck8'), 'M14x1.5', 'Chevy Express 3500 8x165.1 ET12 OEM');

// Chevy G10/G20 Van (1990-1995) - 5x127, ET0 from data
await updateOffset('Chevrolet', 'G10 Van', 1990, 1995, ...range(0, 'van'), 'M12x1.5', 'Chevy G10 Van 5x127 ET0 OEM');
await updateOffset('Chevrolet', 'G20 Van', 1990, 1995, ...range(0, 'van'), 'M12x1.5', 'Chevy G20 Van 5x127 ET0 OEM');

// Chevy G30 Van (1990-1995) - 8x165.1, ET28 from data
await updateOffset('Chevrolet', 'G30 Van', 1990, 1995, ...range(28, 'truck8'), 'M14x1.5', 'Chevy G30 Van 8x165.1 ET28 OEM');

// Chevy Impala (1964-1985) - 5x120 classic, RWD
await updateOffset('Chevrolet', 'Impala', 1964, 1985, -13, 25, '1/2-20', 'Chevy Impala classic 5x120 RWD');

// Chevy K10 (1980-1987) - 6x139.7, ET~0-6
await updateOffset('Chevrolet', 'K10', 1980, 1987, ...range(3, 'truck6'), 'M12x1.5', 'Chevy K10 4x4 6x139.7 ET3 OEM');

// Chevy K1500 (1988-1999) - 6x139.7, ET31 from data
await updateOffset('Chevrolet', 'K1500', 1988, 1999, ...range(31, 'truck6'), 'M14x1.5', 'Chevy K1500 6x139.7 ET31 OEM');

// Chevy K2500 (1990-1999) - 8x165.1, ET28 from data
await updateOffset('Chevrolet', 'K2500', 1990, 1999, ...range(28, 'truck8'), 'M14x1.5', 'Chevy K2500 8x165.1 ET28 OEM');

// Chevy K3500 (1990-1999) - 8x165.1, ET~12
await updateOffset('Chevrolet', 'K3500', 1990, 1999, ...range(12, 'truck8'), 'M14x1.5', 'Chevy K3500 8x165.1 ET12 OEM');

// Chevy Lumina APV (1990-1996) - 5x115 minivan, ET40 from data
await updateOffset('Chevrolet', 'Lumina APV', 1990, 1996, ...range(40, 'car'), 'M12x1.5', 'Chevy Lumina APV 5x115 ET40 OEM');

// Chevy Malibu (1964-1972) - 5x115 classic, ET~0-12
await updateOffset('Chevrolet', 'Malibu', 1964, 1972, -13, 25, '1/2-20', 'Chevy Malibu classic 5x115 RWD');

// Chevy Monte Carlo (1980-1999) - 5x115, ET43 from data
await updateOffset('Chevrolet', 'Monte Carlo', 1980, 1999, ...range(43, 'car'), 'M12x1.5', 'Chevy Monte Carlo 5x115 ET43 OEM');

// Chevy S-10 (1990-1999) - 5x120.65, ET32 from data
await updateOffset('Chevrolet', 'S-10', 1990, 1999, ...range(32, 'truck6'), 'M12x1.5', 'Chevy S-10 5x120.65 ET32 OEM');

// Chevy S10 (1982-1999) - 5x120.65, OEM ET≈6-32 (early ET6, later ET32)
await updateOffset('Chevrolet', 'S10', 1982, 1989, ...range(6, 'truck6'), 'M12x1.5', 'Chevy S10 early 5x120.65 ET6 OEM');
await updateOffset('Chevrolet', 'S10', 1990, 1999, ...range(32, 'truck6'), 'M12x1.5', 'Chevy S10 late 5x120.65 ET32 OEM');

// Chevy S10 Blazer (1983-1999) - 5x120.65, ET6 early, ET32 later
await updateOffset('Chevrolet', 'S10 Blazer', 1983, 1989, ...range(6, 'suv5'), 'M12x1.5', 'Chevy S10 Blazer early ET6 OEM');
await updateOffset('Chevrolet', 'S10 Blazer', 1990, 1999, ...range(32, 'suv5'), 'M12x1.5', 'Chevy S10 Blazer late ET32 OEM');

// Chevy Silverado (1999) - 6x139.7, ET12-18
await updateOffset('Chevrolet', 'Silverado', 1999, 1999, ...range(15, 'truck6'), 'M14x1.5', 'Chevy Silverado 1999 6x139.7 ET15 OEM');

// Chevy Silverado 1500 (2009-2025) - 6x139.7, ET24 OEM
await updateOffset('Chevrolet', 'Silverado 1500', 2009, 2025, ...range(24, 'truck6'), 'M14x1.5', 'Chevy Silverado 1500 6x139.7 ET24 OEM');

// Chevy Silverado 2500 (2000-2006) - 8x165.1, ET12-18
await updateOffset('Chevrolet', 'Silverado 2500', 2000, 2006, ...range(12, 'truck8'), 'M14x1.5', 'Chevy Silverado 2500 8x165.1 ET12 OEM');

// Chevy Silverado 3500 (2001-2004) - 8x165.1, ET12
await updateOffset('Chevrolet', 'Silverado 3500', 2001, 2004, ...range(12, 'truck8'), 'M14x1.5', 'Chevy Silverado 3500 8x165.1 ET12 OEM');

// Chevy Suburban (1980-1991) - 6x139.7, ET~0-6
await updateOffset('Chevrolet', 'Suburban', 1980, 1991, ...range(3, 'truck6'), 'M12x1.5', 'Chevy Suburban old 6x139.7 ET3 OEM');

// Chevy Suburban 1500 (2000-2014) - 6x139.7, ET31 from data
await updateOffset('Chevrolet', 'Suburban 1500', 2000, 2014, ...range(31, 'truck6'), 'M14x1.5', 'Chevy Suburban 1500 6x139.7 ET31 OEM');

// Chevy Suburban 2500 (2000-2013) - 8x165.1, ET~12
await updateOffset('Chevrolet', 'Suburban 2500', 2000, 2013, ...range(12, 'truck8'), 'M14x1.5', 'Chevy Suburban 2500 8x165.1 ET12 OEM');

// Chevy Tracker (1998-1999) - 5x139.7, ET5-22 from data
await updateOffset('Chevrolet', 'Tracker', 1998, 1999, ...range(15, 'suv5'), 'M12x1.5', 'Chevy Tracker 5x139.7 ET15 OEM');

// Chevy suburban lowercase (1992-1999)
await updateOffset('Chevrolet', 'suburban', 1992, 1999, ...range(15, 'truck6'), 'M14x1.5', 'Chevy suburban 1992-99 6x139.7 ET15 OEM');

// Chevy EV models (lowercase)
await updateOffset('chevrolet', 'blazer ev', 2024, 2024, ...range(45, 'suv5'), 'M14x1.5', 'Chevy Blazer EV 2024 6x132 ET45 OEM');
await updateOffset('chevrolet', 'equinox ev', 2024, 2024, ...range(40, 'suv5'), 'M14x1.5', 'Chevy Equinox EV 2024 6x120 ET40 OEM');

// Chevy Express 3500 lowercase (2003-2025) - 8x165.1
await updateOffset('chevrolet', 'express-3500', 2003, 2025, ...range(12, 'truck8'), 'M14x1.5', 'Chevy Express 3500 8x165.1 ET12 OEM');

// ============================================================
// DAEWOO
// ============================================================
// Daewoo Lanos (1999) - 4x100, ET49 from data
await updateOffset('Daewoo', 'Lanos', 1999, 1999, ...range(49, 'car'), 'M12x1.5', 'Daewoo Lanos ET49 OEM');

// Daewoo Nubira (1999) - 4x114.3, ET45 from data
await updateOffset('Daewoo', 'Nubira', 1999, 1999, ...range(45, 'car'), 'M12x1.5', 'Daewoo Nubira ET45 OEM');

// ============================================================
// FERRARI (2018 entries)
// ============================================================
// Ferrari 488 GTB/Spider (5x114.3) - ET35 OEM typically
await updateOffset('Ferrari', '488 GTB', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'Ferrari 488 GTB ET35 OEM');
await updateOffset('Ferrari', '488 Spider', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'Ferrari 488 Spider ET35 OEM');

// Ferrari 812 Superfast (5x114.3) - ET35
await updateOffset('Ferrari', '812 Superfast', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'Ferrari 812 Superfast ET35 OEM');

// Ferrari California T - ET35
await updateOffset('Ferrari', 'California T', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'Ferrari California T ET35 OEM');

// Ferrari GTC4Lusso / GTC4Lusso T - ET35
await updateOffset('Ferrari', 'GTC4Lusso', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'Ferrari GTC4Lusso ET35 OEM');
await updateOffset('Ferrari', 'GTC4Lusso T', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'Ferrari GTC4Lusso T ET35 OEM');

// Ferrari Portofino - ET35
await updateOffset('Ferrari', 'Portofino', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'Ferrari Portofino ET35 OEM');

// ============================================================
// FIAT
// ============================================================
// Fiat 500 (2018) - 4x98, ET~40
await updateOffset('Fiat', '500', 2018, 2018, ...range(40, 'car'), 'M12x1.25', 'Fiat 500 4x98 ET40 OEM');

// ============================================================
// GMC
// ============================================================

// GMC Jimmy (1983-1999) - 5x120.65, ET35 from data
await updateOffset('GMC', 'Jimmy', 1983, 1999, ...range(35, 'suv5'), 'M12x1.5', 'GMC Jimmy 5x120.65 ET35 OEM');

// GMC S15 (1982-1989) - 5x120.65 compact truck, ET~25-35
await updateOffset('GMC', 'S15', 1982, 1989, ...range(25, 'truck6'), 'M12x1.5', 'GMC S15 5x120.65 ET25 OEM');

// GMC Sierra (1980-1999) - 6x139.7, ET~12-15
await updateOffset('GMC', 'Sierra', 1980, 1999, ...range(12, 'truck6'), 'M12x1.5', 'GMC Sierra old 6x139.7 ET12 OEM');

// GMC Sierra 1500 (2014-2024) - 6x139.7, ET24 OEM
await updateOffset('GMC', 'Sierra 1500', 2014, 2024, ...range(24, 'truck6'), 'M14x1.5', 'GMC Sierra 1500 6x139.7 ET24 OEM');

// GMC Sierra 2500HD (2008) - 8x180, ET28 from data
await updateOffset('GMC', 'Sierra 2500HD', 2008, 2008, ...range(28, 'truck8'), 'M14x1.5', 'GMC Sierra 2500HD 8x180 ET28 OEM');

// GMC Sonoma (1990-1999) - 5x120.65, ET35 from data
await updateOffset('GMC', 'Sonoma', 1990, 1999, ...range(35, 'truck6'), 'M12x1.5', 'GMC Sonoma 5x120.65 ET35 OEM');

// GMC Suburban (1990-1999) - 6x139.7, ET6 from data
await updateOffset('GMC', 'Suburban', 1990, 1999, ...range(6, 'truck6'), 'M12x1.5', 'GMC Suburban 6x139.7 ET6 OEM');

// GMC Hummer EV SUV (2022-2024) - 8x165.1, ET~0-12
await updateOffset('GMC', 'hummer-ev-suv', 2022, 2024, ...range(6, 'truck8'), 'M14x1.5', 'GMC Hummer EV SUV 8x165.1 ET6 OEM');

// GMC savana-3500 lowercase
await updateOffset('gmc', 'savana-3500', 2003, 2025, ...range(12, 'truck8'), 'M14x1.5', 'GMC Savana 3500 8x165.1 ET12 OEM');

// ============================================================
// INTERNATIONAL
// ============================================================
// Scout (1961-1970) - 5x139.7, ET~25
await updateOffset('International', 'Scout', 1961, 1970, ...range(25, 'suv5'), '1/2-20', 'International Scout 5x139.7 ET25 OEM');

// Scout II (1971-1979) - 5x139.7, ET~25
await updateOffset('International', 'Scout II', 1971, 1979, ...range(25, 'suv5'), '1/2-20', 'International Scout II 5x139.7 ET25 OEM');

// ============================================================
// ISUZU
// ============================================================
// Amigo (1990-1999) - 6x139.7, ET35 from data
await updateOffset('Isuzu', 'Amigo', 1990, 1999, ...range(35, 'suv5'), 'M12x1.5', 'Isuzu Amigo 6x139.7 ET35 OEM');

// Oasis (1996-1999) - 5x114.3, ET45 from data
await updateOffset('Isuzu', 'Oasis', 1996, 1999, ...range(45, 'car'), 'M12x1.5', 'Isuzu Oasis 5x114.3 ET45 OEM');

// VehiCROSS (1999) - 6x139.7, ET38 from data
await updateOffset('Isuzu', 'VehiCROSS', 1999, 1999, ...range(38, 'suv5'), 'M12x1.5', 'Isuzu VehiCROSS 6x139.7 ET38 OEM');

// ============================================================
// KARMA
// ============================================================
// Revero (2018) - 5x130, ET~50
await updateOffset('Karma', 'Revero', 2018, 2018, ...range(50, 'car'), 'M14x1.5', 'Karma Revero 5x130 ET50 OEM');

// ============================================================
// LOTUS
// ============================================================
// Evora (2018) - 5x114.3, ET~35
await updateOffset('Lotus', 'Evora', 2018, 2018, ...range(35, 'car'), 'M12x1.5', 'Lotus Evora 5x114.3 ET35 OEM');

// ============================================================
// LUCID
// ============================================================
// Lucid Air (2023-2024) - 5x120, ET~45
await updateOffset('Lucid', 'air', 2023, 2024, ...range(45, 'car'), 'M14x1.5', 'Lucid Air 5x120 ET45 OEM');

// Lucid Gravity (2024) - 5x120, ET~42
await updateOffset('Lucid', 'gravity', 2024, 2024, ...range(42, 'suv5'), 'M14x1.5', 'Lucid Gravity 5x120 ET42 OEM');

// ============================================================
// McLAREN (2018 entries, 5x112)
// ============================================================
await updateOffset('McLaren', '570GT', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'McLaren 570GT 5x112 ET35 OEM');
await updateOffset('McLaren', '570S', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'McLaren 570S 5x112 ET35 OEM');
await updateOffset('McLaren', '720S', 2018, 2018, ...range(35, 'car'), 'M14x1.5', 'McLaren 720S 5x112 ET35 OEM');

// ============================================================
// MITSUBISHI
// ============================================================
// Galant (1990-1993) - 4x114.3, ET46 from data
await updateOffset('Mitsubishi', 'Galant', 1990, 1993, ...range(46, 'car'), 'M12x1.5', 'Mitsubishi Galant 4x114.3 ET46 OEM');

// Montero (1990-1991) - 6x139.7, ET22 from data (outer range)
await updateOffset('Mitsubishi', 'Montero', 1990, 1991, ...range(15, 'suv5'), 'M12x1.5', 'Mitsubishi Montero 6x139.7 ET15 OEM');

// ============================================================
// OLDSMOBILE
// ============================================================

// Olds 88 (1980-1985) - 5x127, ET41 from data
await updateOffset('Oldsmobile', '88', 1980, 1985, ...range(41, 'car'), 'M12x1.5', 'Olds 88 5x127 ET41 OEM');

// Olds 88 (1986-1999) - 5x115, ET41-42 from data
await updateOffset('Oldsmobile', '88', 1986, 1999, ...range(42, 'car'), 'M12x1.5', 'Olds 88 5x115 ET42 OEM');

// Olds 98 (1980-1984) - 5x127, 15x6, ET~41
await updateOffset('Oldsmobile', '98', 1980, 1984, ...range(41, 'car'), 'M12x1.5', 'Olds 98 5x127 ET41 OEM');

// Olds 98 (1985-1996) - 5x115, ET41
await updateOffset('Oldsmobile', '98', 1985, 1996, ...range(41, 'car'), 'M12x1.5', 'Olds 98 5x115 ET41 OEM');

// Olds Aurora (1995-1999) - 5x115, ET40 from data
await updateOffset('Oldsmobile', 'Aurora', 1995, 1999, ...range(40, 'car'), 'M12x1.5', 'Olds Aurora 5x115 ET40 OEM');

// Olds Bravada (1995) - 5x120.65, ET31 from data
await updateOffset('Oldsmobile', 'Bravada', 1995, 1995, ...range(31, 'suv5'), 'M12x1.5', 'Olds Bravada 5x120.65 ET31 OEM');

// Olds Ciera (1982-1989) - 5x115, ET~42
await updateOffset('Oldsmobile', 'Ciera', 1982, 1989, ...range(42, 'car'), 'M12x1.5', 'Olds Ciera 5x115 ET42 OEM');

// Olds Cutlass (1964-1972) - 5x120.65, classic, ET0
await updateOffset('Oldsmobile', 'Cutlass', 1964, 1972, -13, 25, '1/2-20', 'Olds Cutlass classic 5x120.65');

// Olds Cutlass Ciera (1990-1996) - 5x100 FWD, ET42 from data
await updateOffset('Oldsmobile', 'Cutlass Ciera', 1990, 1996, ...range(42, 'car'), 'M12x1.5', 'Olds Cutlass Ciera 5x100 ET42 OEM');

// Olds Cutlass Supreme (1980-1987) - 5x120.65, ET42 from data
await updateOffset('Oldsmobile', 'Cutlass Supreme', 1980, 1987, ...range(42, 'car'), 'M12x1.5', 'Olds Cutlass Supreme 5x120.65 ET42 OEM');

// Olds Cutlass Supreme (1988-1997) - 5x115, ET42 from data
await updateOffset('Oldsmobile', 'Cutlass Supreme', 1988, 1997, ...range(42, 'car'), 'M12x1.5', 'Olds Cutlass Supreme 5x115 ET42 OEM');

// Olds Silhouette (1990-1999) - 5x115 minivan, ET42 from data
await updateOffset('Oldsmobile', 'Silhouette', 1990, 1999, ...range(42, 'car'), 'M12x1.5', 'Olds Silhouette 5x115 ET42 OEM');

// Olds Toronado (1966-1970) - 5x127 FWD, ET~25
await updateOffset('Oldsmobile', 'Toronado', 1966, 1970, ...range(25, 'car'), '1/2-20', 'Olds Toronado 5x127 FWD ET25 OEM');

// Olds Toronado (1980-1985) - 5x120.65, ET25
await updateOffset('Oldsmobile', 'Toronado', 1980, 1985, ...range(25, 'car'), 'M12x1.5', 'Olds Toronado 5x120.65 ET25 OEM');

// Olds Toronado (1986-1989) - 5x115, ET25
await updateOffset('Oldsmobile', 'Toronado', 1986, 1989, ...range(25, 'car'), 'M12x1.5', 'Olds Toronado 5x115 ET25 OEM');

// ============================================================
// PONTIAC
// ============================================================

// Pontiac 6000 (1982-1989) - 5x115 FWD, ET~42
await updateOffset('Pontiac', '6000', 1982, 1989, ...range(42, 'car'), 'M12x1.5', 'Pontiac 6000 5x115 FWD ET42 OEM');

// Pontiac Bonneville (1980-1981) - 5x127 RWD B-body, ET~25
await updateOffset('Pontiac', 'Bonneville', 1980, 1981, ...range(25, 'car'), 'M12x1.5', 'Pontiac Bonneville 5x127 ET25 OEM');

// Pontiac Bonneville (1982-1986) - 5x120.65 RWD, ET~38
await updateOffset('Pontiac', 'Bonneville', 1982, 1986, ...range(38, 'car'), 'M12x1.5', 'Pontiac Bonneville 5x120.65 ET38 OEM');

// Pontiac Catalina (1959-1976) - 5x127 classic RWD
await updateOffset('Pontiac', 'Catalina', 1959, 1976, -13, 25, '1/2-20', 'Pontiac Catalina classic 5x127 RWD');

// Pontiac Catalina (1977-1981) - 5x120.65
await updateOffset('Pontiac', 'Catalina', 1977, 1981, -13, 25, '1/2-20', 'Pontiac Catalina 1977-81 5x120.65');

// Pontiac Fiero (1984-1988) - 5x100, ET~42
await updateOffset('Pontiac', 'Fiero', 1984, 1988, ...range(42, 'car'), 'M12x1.5', 'Pontiac Fiero 5x100 ET42 OEM');

// Pontiac Grand Prix (1968-1987) - 5x120.65, classic muscle/luxury
await updateOffset('Pontiac', 'Grand Prix', 1968, 1987, -13, 25, '1/2-20', 'Pontiac Grand Prix classic 5x120.65');

// Pontiac LeMans (1964-1972) - 5x120.65, classic, ET8 from data
await updateOffset('Pontiac', 'LeMans', 1964, 1972, -13, 25, '1/2-20', 'Pontiac LeMans classic 5x120.65 ET8');

// Pontiac Trans Am (1969-1979) - 5x120.65, ET0 from data
await updateOffset('Pontiac', 'Trans Am', 1969, 1979, -13, 25, '1/2-20', 'Pontiac Trans Am classic ET0');

// ============================================================
// RIVIAN (if any lowercase in results)
// ============================================================
// (Not in result set - skip)

// ============================================================
// ROLLS-ROYCE
// ============================================================
// Dawn/Ghost/Wraith: 5x120, ET~32-40
await updateOffset('Rolls-Royce', 'Dawn', 2018, 2018, ...range(32, 'car'), 'M14x1.5', 'Rolls-Royce Dawn 5x120 ET32 OEM');
await updateOffset('Rolls-Royce', 'Ghost', 2018, 2018, ...range(32, 'car'), 'M14x1.5', 'Rolls-Royce Ghost 5x120 ET32 OEM');
await updateOffset('Rolls-Royce', 'Wraith', 2018, 2018, ...range(32, 'car'), 'M14x1.5', 'Rolls-Royce Wraith 5x120 ET32 OEM');

// Phantom: 5x112, ET~40
await updateOffset('Rolls-Royce', 'Phantom', 2018, 2018, ...range(40, 'car'), 'M14x1.5', 'Rolls-Royce Phantom 5x112 ET40 OEM');

// ============================================================
// SAAB
// ============================================================
// Saab 900 (1990-1993) - 4x108, ET40 from data
await updateOffset('Saab', '900', 1990, 1993, ...range(40, 'car'), 'M12x1.5', 'Saab 900 4x108 ET40 OEM');

// Saab 900 (1994-1998) - 5x110, ET40
await updateOffset('Saab', '900', 1994, 1998, ...range(40, 'car'), 'M12x1.5', 'Saab 900 NG 5x110 ET40 OEM');

// Saab 9000 (1990-1998) - 4x108, ET44 from data
await updateOffset('Saab', '9000', 1990, 1998, ...range(44, 'car'), 'M12x1.5', 'Saab 9000 4x108 ET44 OEM');

// ============================================================
// SATURN
// ============================================================
// Saturn SC/SL/SW (1991-1999) - 4x100, ET46 from data
await updateOffset('Saturn', 'SC', 1993, 1999, ...range(46, 'car'), 'M12x1.5', 'Saturn SC 4x100 ET46 OEM');
await updateOffset('Saturn', 'SL', 1991, 1999, ...range(46, 'car'), 'M12x1.5', 'Saturn SL 4x100 ET46 OEM');
await updateOffset('Saturn', 'SW', 1993, 1999, ...range(46, 'car'), 'M12x1.5', 'Saturn SW 4x100 ET46 OEM');

// ============================================================
// SMART
// ============================================================
// Smart Fortwo (2018) - 4x100, ET40
await updateOffset('Smart', 'Fortwo', 2018, 2018, ...range(40, 'car'), 'M12x1.5', 'Smart Fortwo 4x100 ET40 OEM');

// ============================================================
// SUZUKI
// ============================================================
// Grand Vitara (1999) - 5x139.7, ET35 from data
await updateOffset('Suzuki', 'Grand Vitara', 1999, 1999, ...range(35, 'suv5'), 'M12x1.5', 'Suzuki Grand Vitara 5x139.7 ET35 OEM');

// Sidekick (1990-1998) - 5x139.7, ET25 from data
await updateOffset('Suzuki', 'Sidekick', 1990, 1998, ...range(25, 'suv5'), 'M12x1.5', 'Suzuki Sidekick 5x139.7 ET25 OEM');

// Swift (1990-1999) - 4x114.3, ET40 from data
await updateOffset('Suzuki', 'Swift', 1990, 1999, ...range(40, 'car'), 'M12x1.5', 'Suzuki Swift 4x114.3 ET40 OEM');

// Vitara (1999) - 5x139.7, ET30 from data
await updateOffset('Suzuki', 'Vitara', 1999, 1999, ...range(30, 'suv5'), 'M12x1.5', 'Suzuki Vitara 5x139.7 ET30 OEM');

// X-90 (1996-1997) - 5x139.7, ET25 from data
await updateOffset('Suzuki', 'X-90', 1996, 1997, ...range(25, 'suv5'), 'M12x1.5', 'Suzuki X-90 5x139.7 ET25 OEM');

// ============================================================
// VOLVO (1990-1999 era, 5x108)
// ============================================================
// 850: ET35 from data
await updateOffset('Volvo', '850', 1993, 1997, ...range(35, 'car'), 'M12x1.5', 'Volvo 850 5x108 ET35 OEM');

// 940: ET30 from data
await updateOffset('Volvo', '940', 1991, 1995, ...range(30, 'car'), 'M12x1.5', 'Volvo 940 5x108 ET30 OEM');

// 960: ET30 from data
await updateOffset('Volvo', '960', 1992, 1997, ...range(30, 'car'), 'M12x1.5', 'Volvo 960 5x108 ET30 OEM');

// S70: ET38 from data
await updateOffset('Volvo', 'S70', 1998, 1999, ...range(38, 'car'), 'M12x1.5', 'Volvo S70 5x108 ET38 OEM');

// S80: ET42 from data
await updateOffset('Volvo', 'S80', 1999, 1999, ...range(42, 'car'), 'M12x1.5', 'Volvo S80 5x108 ET42 OEM');

// V70: ET38 from data
await updateOffset('Volvo', 'V70', 1998, 1999, ...range(38, 'car'), 'M12x1.5', 'Volvo V70 5x108 ET38 OEM');

// ============================================================
// SUMMARY
// ============================================================
await pool.end();

console.log('\n========================================');
console.log(`TOTAL ROWS UPDATED: ${totalUpdated}`);
console.log(`UNIQUE MAKE/MODEL/YEAR GROUPS: ${log.length}`);
console.log('========================================');

import { writeFileSync } from 'fs';
writeFileSync('scripts/offset-research-gm.json', JSON.stringify({
  completedAt: new Date().toISOString(),
  totalRowsUpdated: totalUpdated,
  groupsUpdated: log.length,
  details: log
}, null, 2));

console.log('\nResults saved to scripts/offset-research-gm.json');
