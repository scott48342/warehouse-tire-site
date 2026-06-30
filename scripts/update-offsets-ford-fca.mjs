/**
 * Offset Update Script - Ford/FCA/Jeep/Lincoln/Mercury/Plymouth/RAM
 * Applies OEM-based offset_min_mm / offset_max_mm to vehicles missing these values.
 *
 * Rules (from task):
 *   Passenger cars:     min = OEM-15 (floor -20),  max = OEM+20 (cap 55)
 *   SUV 5-lug:          min = OEM-20 (floor -25),  max = OEM+25 (cap 55)
 *   Trucks 6-lug:       min = OEM-30 (floor -44),  max = OEM+25 (cap 44)
 *   Heavy trucks 8-lug: min = OEM-38 (floor -51),  max = OEM+25 (cap 44)
 *
 * OEM offsets sourced from:
 *   - oem_wheel_sizes data already in DB
 *   - Known OEM specs from manufacturer tech docs / community knowledge
 *
 * NOTE: Only updates rows where offset_min_mm IS NULL OR offset_max_mm IS NULL.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function calcRange(oem, type) {
  if (type === 'car') {
    return [Math.max(oem - 15, -20), Math.min(oem + 20, 55)];
  } else if (type === 'suv5') {
    return [Math.max(oem - 20, -25), Math.min(oem + 25, 55)];
  } else if (type === 'truck6') {
    return [Math.max(oem - 30, -44), Math.min(oem + 25, 44)];
  } else if (type === 'truck8') {
    return [Math.max(oem - 38, -51), Math.min(oem + 25, 44)];
  }
  throw new Error('Unknown type: ' + type);
}

// Vehicle update definitions
// Each entry: { make, model, yearFrom, yearTo, oem, type, thread }
// make/model must match EXACTLY what's in DB (case-sensitive)
// yearFrom/yearTo are inclusive; use wide ranges to catch all nulls

const VEHICLES = [
  // ─── CHRYSLER ────────────────────────────────────────────────────────────────
  // Chrysler 200 (2012) - 5x114.3, OEM ET40 from DB
  { make: 'Chrysler', model: '200', yearFrom: 2011, yearTo: 2017, oem: 40, type: 'car', thread: 'M12x1.5' },
  // 300M - 5x114.3, OEM ET42 from DB
  { make: 'Chrysler', model: '300M', yearFrom: 1999, yearTo: 1999, oem: 42, type: 'car', thread: 'M12x1.5' },
  // Cirrus - 5x100, OEM ET40 from DB
  { make: 'Chrysler', model: 'Cirrus', yearFrom: 1995, yearTo: 2000, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Concorde - 5x114.3, OEM ET42 from DB
  { make: 'Chrysler', model: 'Concorde', yearFrom: 1993, yearTo: 2004, oem: 42, type: 'car', thread: 'M12x1.5' },
  // Dynasty - 5x100, OEM ET40 from DB
  { make: 'Chrysler', model: 'Dynasty', yearFrom: 1988, yearTo: 1993, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Fifth Avenue 1980-1989 - RWD M-body, ET~19 (3.75" BS on 6" rim)
  { make: 'Chrysler', model: 'Fifth Avenue', yearFrom: 1980, yearTo: 1989, oem: 19, type: 'car', thread: '1/2-20' },
  // Fifth Avenue 1990-1993 - FWD, ET40
  { make: 'Chrysler', model: 'Fifth Avenue', yearFrom: 1990, yearTo: 1993, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Grand Voyager - minivan/SUV, OEM ET40 from DB
  { make: 'Chrysler', model: 'Grand Voyager', yearFrom: 1984, yearTo: 2000, oem: 40, type: 'suv5', thread: 'M12x1.5' },
  // Imperial - FWD, OEM ET40 from DB
  { make: 'Chrysler', model: 'Imperial', yearFrom: 1990, yearTo: 1993, oem: 40, type: 'car', thread: 'M12x1.5' },
  // LHS - FWD car, OEM ET42
  { make: 'Chrysler', model: 'LHS', yearFrom: 1994, yearTo: 2001, oem: 42, type: 'car', thread: 'M12x1.5' },
  // LeBaron 1980-1981 - RWD, ET19
  { make: 'Chrysler', model: 'LeBaron', yearFrom: 1980, yearTo: 1981, oem: 19, type: 'car', thread: '1/2-20' },
  // LeBaron 1982-1995 - FWD K-car based, ET40
  { make: 'Chrysler', model: 'LeBaron', yearFrom: 1982, yearTo: 1995, oem: 40, type: 'car', thread: 'M12x1.5' },
  // New Yorker 1980-1983 RWD (5x114.3 = M-body), ET19
  { make: 'Chrysler', model: 'New Yorker', yearFrom: 1980, yearTo: 1983, oem: 19, type: 'car', thread: '1/2-20' },
  // New Yorker 1984-1993 FWD/E-body (5x100), ET40
  { make: 'Chrysler', model: 'New Yorker', yearFrom: 1984, yearTo: 1996, oem: 40, type: 'car', thread: 'M12x1.5' },
  // PT Cruiser - FWD, OEM ET40 from DB
  { make: 'Chrysler', model: 'PT Cruiser', yearFrom: 2001, yearTo: 2010, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Sebring - FWD coupe/cab, OEM ET40 (avg of DB offsets 37-45)
  { make: 'Chrysler', model: 'Sebring', yearFrom: 1995, yearTo: 2010, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Town & Country - minivan, OEM ET40
  { make: 'Chrysler', model: 'Town & Country', yearFrom: 1984, yearTo: 2016, oem: 40, type: 'suv5', thread: 'M12x1.5' },
  // Voyager - minivan, OEM ET40
  { make: 'Chrysler', model: 'Voyager', yearFrom: 1984, yearTo: 2000, oem: 40, type: 'suv5', thread: 'M12x1.5' },

  // ─── DODGE ───────────────────────────────────────────────────────────────────
  // Aries - FWD K-car, ET40 (3.75" BS on 5.5" wide)
  { make: 'Dodge', model: 'Aries', yearFrom: 1981, yearTo: 1989, oem: 40, type: 'car', thread: '1/2-20' },
  // Avenger - FWD, OEM ET46 from DB
  { make: 'Dodge', model: 'Avenger', yearFrom: 1995, yearTo: 2014, oem: 46, type: 'car', thread: 'M12x1.5' },
  // Caravan - minivan, OEM ET40
  { make: 'Dodge', model: 'Caravan', yearFrom: 1984, yearTo: 2007, oem: 40, type: 'suv5', thread: 'M12x1.5' },
  // Challenger 2019-2023 - staggered (F21/R18), use front=21 as base, car
  { make: 'Dodge', model: 'Challenger', yearFrom: 2019, yearTo: 2023, oem: 20, type: 'car', thread: 'M14x1.5' },
  // Colt - Mitsubishi-based FWD, OEM ET45
  { make: 'Dodge', model: 'Colt', yearFrom: 1990, yearTo: 1994, oem: 45, type: 'car', thread: 'M12x1.5' },
  // Coronet - RWD B-body muscle, ET0 flat steel wheels
  { make: 'Dodge', model: 'Coronet', yearFrom: 1966, yearTo: 1970, oem: 0, type: 'car', thread: '1/2-20' },
  // Dakota 5x139.7 (1987-1989) - 5-lug compact truck, OEM ET25
  { make: 'Dodge', model: 'Dakota', yearFrom: 1987, yearTo: 1990, oem: 25, type: 'suv5', thread: '1/2-20' },
  // Dakota 6x114.3 (1991+) - 6-lug truck, OEM ET25
  { make: 'Dodge', model: 'Dakota', yearFrom: 1991, yearTo: 2011, oem: 25, type: 'truck6', thread: 'M14x1.5' },
  // Dart - compact A-body, 5x110, ET~0-12 (use ET5)
  { make: 'Dodge', model: 'Dart', yearFrom: 1964, yearTo: 1976, oem: 5, type: 'car', thread: '1/2-20' },
  // Daytona - FWD sports car, ET40-45
  { make: 'Dodge', model: 'Daytona', yearFrom: 1984, yearTo: 1993, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Demon (1971-72) - RWD A-body muscle, ET0
  { make: 'Dodge', model: 'Demon', yearFrom: 1971, yearTo: 1972, oem: 0, type: 'car', thread: '1/2-20' },
  // Diplomat - RWD M-body, ET19 (3.75" BS on 6")
  { make: 'Dodge', model: 'Diplomat', yearFrom: 1980, yearTo: 1989, oem: 19, type: 'car', thread: '1/2-20' },
  // Dynasty - FWD, ET40 from DB
  { make: 'Dodge', model: 'Dynasty', yearFrom: 1988, yearTo: 1993, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Intrepid - FWD LH car, OEM ET40 from DB
  { make: 'Dodge', model: 'Intrepid', yearFrom: 1993, yearTo: 2004, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Monaco - FWD (Eagle Monaco/Renault-based), OEM ET35 from DB
  { make: 'Dodge', model: 'Monaco', yearFrom: 1990, yearTo: 1992, oem: 35, type: 'car', thread: 'M12x1.5' },
  // Neon - FWD compact, OEM ET40 from DB
  { make: 'Dodge', model: 'Neon', yearFrom: 1995, yearTo: 2005, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Omni - FWD hatchback (Horizon twin), ET40
  { make: 'Dodge', model: 'Omni', yearFrom: 1978, yearTo: 1990, oem: 40, type: 'car', thread: '1/2-20' },
  // Ram (pre-Ram 1500 era, 5x139.7) - full-size truck, ET~0 (near flat steel)
  { make: 'Dodge', model: 'Ram', yearFrom: 1981, yearTo: 1993, oem: 0, type: 'suv5', thread: '1/2-20' },
  // Ram 1500 (1994-1999) - 5x139.7 half-ton, OEM ET12 from DB; use truck6 rules
  { make: 'Dodge', model: 'Ram 1500', yearFrom: 1994, yearTo: 1999, oem: 12, type: 'truck6', thread: 'M14x1.5' },
  // Ram 2500 (8x165.1) - heavy truck, OEM ET25 from DB
  { make: 'Dodge', model: 'Ram 2500', yearFrom: 1994, yearTo: 1999, oem: 25, type: 'truck8', thread: 'M14x1.5' },
  // Ram 3500 (8x165.1) - heavy truck, OEM ET15 from DB
  { make: 'Dodge', model: 'Ram 3500', yearFrom: 1994, yearTo: 1999, oem: 15, type: 'truck8', thread: 'M14x1.5' },
  // Ram Van B150 - full-size van 5-lug, OEM ET0 from DB
  { make: 'Dodge', model: 'Ram Van B150', yearFrom: 1985, yearTo: 1995, oem: 0, type: 'suv5', thread: '1/2-20' },
  // Ram Van B1500 - OEM ET0 from DB
  { make: 'Dodge', model: 'Ram Van B1500', yearFrom: 1994, yearTo: 2003, oem: 0, type: 'suv5', thread: 'M14x1.5' },
  // Ram Van B250 - OEM ET2 from DB
  { make: 'Dodge', model: 'Ram Van B250', yearFrom: 1985, yearTo: 1995, oem: 2, type: 'suv5', thread: '1/2-20' },
  // Ram Van B2500 - OEM ET2 from DB
  { make: 'Dodge', model: 'Ram Van B2500', yearFrom: 1994, yearTo: 2003, oem: 2, type: 'suv5', thread: 'M14x1.5' },
  // Ram Van B350 - OEM ET2 from DB
  { make: 'Dodge', model: 'Ram Van B350', yearFrom: 1985, yearTo: 1993, oem: 2, type: 'suv5', thread: '1/2-20' },
  // Ram Van B3500 (8x165.1) - heavy van, OEM ET0 from DB
  { make: 'Dodge', model: 'Ram Van B3500', yearFrom: 1994, yearTo: 2003, oem: 0, type: 'truck8', thread: 'M14x1.5' },
  // Ramcharger (5x139.7) - SUV/truck, OEM~ET6 (similar to older Bronco)
  { make: 'Dodge', model: 'Ramcharger', yearFrom: 1974, yearTo: 1993, oem: 6, type: 'suv5', thread: '1/2-20' },
  // Spirit - FWD K-car based, OEM ET40 from DB
  { make: 'Dodge', model: 'Spirit', yearFrom: 1989, yearTo: 1995, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Stealth - Mitsubishi-based AWD/FWD sports, OEM ET46 from DB
  { make: 'Dodge', model: 'Stealth', yearFrom: 1991, yearTo: 1996, oem: 46, type: 'car', thread: 'M12x1.5' },
  // Stratus - FWD, OEM ET40 from DB
  { make: 'Dodge', model: 'Stratus', yearFrom: 1995, yearTo: 2006, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Super Bee - RWD B-body muscle, ET0
  { make: 'Dodge', model: 'Super Bee', yearFrom: 1968, yearTo: 1971, oem: 0, type: 'car', thread: '1/2-20' },
  // Viper (1992-1999, 6x114.3) - staggered supercar, front ET50
  { make: 'Dodge', model: 'Viper', yearFrom: 1992, yearTo: 1999, oem: 50, type: 'car', thread: 'M12x1.5' },
  // Viper (2003-2017, 5x115) - staggered supercar, front ET50
  { make: 'Dodge', model: 'Viper', yearFrom: 2003, yearTo: 2017, oem: 50, type: 'car', thread: 'M14x1.5' },

  // ─── FORD ────────────────────────────────────────────────────────────────────
  // Aerostar - van/SUV, OEM ET20 from DB
  { make: 'Ford', model: 'Aerostar', yearFrom: 1986, yearTo: 1997, oem: 20, type: 'suv5', thread: 'M12x1.5' },
  // Bronco (1966-1991) - classic 4x4 SUV, OEM ET6 (7" wide wheel, 3.5" BS)
  { make: 'Ford', model: 'Bronco', yearFrom: 1966, yearTo: 1991, oem: 6, type: 'suv5', thread: '1/2-20' },
  // Bronco II - compact 4x4, OEM~ET0 (same axles as Ranger 4WD)
  { make: 'Ford', model: 'Bronco II', yearFrom: 1984, yearTo: 1990, oem: 0, type: 'suv5', thread: '1/2-20' },
  // Bronco Sport (2025) - crossover SUV, OEM ET46 from DB
  { make: 'Ford', model: 'Bronco Sport', yearFrom: 2021, yearTo: 2025, oem: 46, type: 'suv5', thread: 'M14x1.5' },
  // Club Wagon E-150 - full-size van 5-lug, OEM ET6 from DB
  { make: 'Ford', model: 'Club Wagon E-150', yearFrom: 1990, yearTo: 2001, oem: 6, type: 'suv5', thread: 'M14x1.5' },
  // Contour - FWD compact, OEM ET43 from DB
  { make: 'Ford', model: 'Contour', yearFrom: 1995, yearTo: 2000, oem: 43, type: 'car', thread: 'M12x1.5' },
  // Crown Victoria (1980-2001, 5x114.3, 70.6 bore) - Panther RWD, ET44 (1992+ gen)
  { make: 'Ford', model: 'Crown Victoria', yearFrom: 1980, yearTo: 2001, oem: 44, type: 'car', thread: 'M12x1.5' },
  // Crown Victoria (1990-1999, 5x114.3, 70.5 bore) - similar, ET44
  { make: 'Ford', model: 'Crown Victoria', yearFrom: 1990, yearTo: 1999, oem: 44, type: 'car', thread: 'M12x1.5' },
  // Crown Victoria (2002-2007) - P71 CVPI, ET44
  { make: 'Ford', model: 'Crown Victoria', yearFrom: 2002, yearTo: 2011, oem: 44, type: 'car', thread: 'M12x1.5' },
  // E-150 (1980-1989, 5x139.7) - classic Econoline van, ET6
  { make: 'Ford', model: 'E-150', yearFrom: 1980, yearTo: 1989, oem: 6, type: 'suv5', thread: '1/2-20' },
  // E-150 Econoline (1990-2001, 5x139.7) - ET6 from DB
  { make: 'Ford', model: 'E-150 Econoline', yearFrom: 1990, yearTo: 2001, oem: 6, type: 'suv5', thread: 'M14x1.5' },
  // E-150 Econoline (2002-2014, 8x165.1) - ET6 from DB; heavy van 8-lug
  { make: 'Ford', model: 'E-150 Econoline', yearFrom: 2002, yearTo: 2014, oem: 6, type: 'truck8', thread: 'M14x1.5' },
  // E-250 Econoline (8x165.1) - heavy van, ET6 from DB
  { make: 'Ford', model: 'E-250 Econoline', yearFrom: 1990, yearTo: 2014, oem: 6, type: 'truck8', thread: 'M14x1.5' },
  // E-350 Econoline (8x165.1) - heavy van, ET6 from DB
  { make: 'Ford', model: 'E-350 Econoline', yearFrom: 1990, yearTo: 2014, oem: 6, type: 'truck8', thread: 'M14x1.5' },
  // Edge 2019 (5x108) - crossover SUV, OEM ET44 from DB
  { make: 'Ford', model: 'Edge', yearFrom: 2019, yearTo: 2024, oem: 44, type: 'suv5', thread: 'M14x1.5' },
  // Escort (1990, 4x108) - compact FWD, ET40 from DB
  { make: 'Ford', model: 'Escort', yearFrom: 1990, yearTo: 1990, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Escort (1991-1999, 4x100) - ET40 from DB
  { make: 'Ford', model: 'Escort', yearFrom: 1991, yearTo: 1999, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Escort ZX2 (4x108) - ET43 from DB
  { make: 'Ford', model: 'Escort ZX2', yearFrom: 2000, yearTo: 2003, oem: 43, type: 'car', thread: 'M12x1.5' },
  // Explorer Sport Trac - SUV/truck, OEM ET44 from DB (primary)
  { make: 'Ford', model: 'Explorer Sport Trac', yearFrom: 2001, yearTo: 2010, oem: 44, type: 'suv5', thread: 'M14x1.5' },
  // F-100 (1953-1976) - vintage truck, OEM~ET12 (3.5" BS on 5.5" rim)
  { make: 'Ford', model: 'F-100', yearFrom: 1948, yearTo: 1983, oem: 12, type: 'suv5', thread: '1/2-20' },
  // F-150 (1977-1991, 5x139.7) - 5-lug half-ton, OEM~ET12 (estimate from backspacing data)
  { make: 'Ford', model: 'F-150', yearFrom: 1977, yearTo: 1996, oem: 12, type: 'truck6', thread: '1/2-20' },
  // F-250 (1980-1987, 8x165.1) - heavy truck, OEM ET40 from DB (unusual but trust DB)
  // Note: 8-lug rule applies even though ET40 stored. Using stored value.
  { make: 'Ford', model: 'F-250', yearFrom: 1980, yearTo: 1987, oem: 40, type: 'truck8', thread: '1/2-20' },
  // F-350 (1980-1987, 8x165.1) - heavy truck, OEM ET40 from DB
  { make: 'Ford', model: 'F-350', yearFrom: 1980, yearTo: 1987, oem: 40, type: 'truck8', thread: '1/2-20' },
  // F-350 Super Duty (2018, 8x200 SRW) - ET44 typical for SRW
  { make: 'Ford', model: 'F-350 Super Duty', yearFrom: 2017, yearTo: 2019, oem: 44, type: 'truck8', thread: 'M14x2.0' },
  // F-450 Super Duty (8x170 / 8x200) - SRW ET44 typical
  { make: 'Ford', model: 'F-450 Super Duty', yearFrom: 1999, yearTo: 2026, oem: 44, type: 'truck8', thread: 'M14x2.0' },
  // Fairlane - mid-size RWD, ET~0 flat steel wheels
  { make: 'Ford', model: 'Fairlane', yearFrom: 1955, yearTo: 1970, oem: 0, type: 'car', thread: '1/2-20' },
  // Falcon - compact RWD, OEM ET0 from DB
  { make: 'Ford', model: 'Falcon', yearFrom: 1960, yearTo: 1970, oem: 0, type: 'car', thread: '1/2-20' },
  // Fiesta (2011-2013) - compact FWD, OEM ET48 from DB
  { make: 'Ford', model: 'Fiesta', yearFrom: 2011, yearTo: 2019, oem: 48, type: 'car', thread: 'M12x1.5' },
  // Galaxie - full-size RWD, ET~0 flat steel
  { make: 'Ford', model: 'Galaxie', yearFrom: 1959, yearTo: 1974, oem: 0, type: 'car', thread: '1/2-20' },
  // LTD - full-size RWD (Panther or Fox platform), ET~19 (backspacing ~3.75" on 6")
  { make: 'Ford', model: 'LTD', yearFrom: 1980, yearTo: 1986, oem: 19, type: 'car', thread: '1/2-20' },
  // Maverick (1970-1977) - compact RWD, ET~0 flat steel
  { make: 'Ford', model: 'Maverick', yearFrom: 1970, yearTo: 1977, oem: 0, type: 'car', thread: '1/2-20' },
  // Mustang 2018 (staggered widebody) - performance car, front ET~35
  { make: 'Ford', model: 'Mustang', yearFrom: 2018, yearTo: 2018, oem: 35, type: 'car', thread: 'M14x1.5' },
  // Mustang 2020-2024 - similar staggered spec, front ET35
  { make: 'Ford', model: 'Mustang', yearFrom: 2020, yearTo: 2024, oem: 35, type: 'car', thread: 'M14x1.5' },
  // Mustang Mach 1 - staggered, front ET45 from DB
  { make: 'Ford', model: 'Mustang Mach 1', yearFrom: 2003, yearTo: 2023, oem: 45, type: 'car', thread: 'M14x1.5' },
  // Mustang Shelby GT350 - staggered, front ET24 from DB
  { make: 'Ford', model: 'Mustang Shelby GT350', yearFrom: 2015, yearTo: 2020, oem: 24, type: 'car', thread: 'M14x1.5' },
  // Mustang Shelby GT500 - staggered, front ET32 from DB
  { make: 'Ford', model: 'Mustang Shelby GT500', yearFrom: 2007, yearTo: 2023, oem: 32, type: 'car', thread: 'M14x1.5' },
  // Probe - FWD sports, OEM ET40 from DB
  { make: 'Ford', model: 'Probe', yearFrom: 1989, yearTo: 1997, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Ranger (1983-1992, 5x114.3) - compact 4WD truck, OEM ET12 (4WD spec, most limiting)
  { make: 'Ford', model: 'Ranger', yearFrom: 1983, yearTo: 2010, oem: 12, type: 'truck6', thread: 'M12x1.5' },
  // Taurus - FWD, OEM ET42 from DB
  { make: 'Ford', model: 'Taurus', yearFrom: 1986, yearTo: 2019, oem: 42, type: 'car', thread: 'M12x1.5' },
  // Taurus SHO - FWD perf, OEM ET38 from DB
  { make: 'Ford', model: 'Taurus SHO', yearFrom: 1989, yearTo: 1999, oem: 38, type: 'car', thread: 'M12x1.5' },
  // Thunderbird (1955-1989, 5x114.3) - personal luxury RWD, OEM ET39 from DB
  { make: 'Ford', model: 'Thunderbird', yearFrom: 1955, yearTo: 1989, oem: 39, type: 'car', thread: '1/2-20' },
  // Thunderbird (1990-1997, 5x108) - FWD-based, OEM ET39 from DB
  { make: 'Ford', model: 'Thunderbird', yearFrom: 1990, yearTo: 1997, oem: 39, type: 'car', thread: 'M12x1.5' },
  // Torino - mid-size RWD, OEM ET0 from DB
  { make: 'Ford', model: 'Torino', yearFrom: 1968, yearTo: 1976, oem: 0, type: 'car', thread: '1/2-20' },
  // Windstar - minivan FWD, OEM ET42 from DB
  { make: 'Ford', model: 'Windstar', yearFrom: 1995, yearTo: 2003, oem: 42, type: 'suv5', thread: 'M12x1.5' },

  // ─── JEEP ────────────────────────────────────────────────────────────────────
  // CJ-5 - classic 4x4, OEM~ET12 (15x7 with 4" BS)
  { make: 'Jeep', model: 'CJ-5', yearFrom: 1978, yearTo: 1983, oem: 12, type: 'suv5', thread: '1/2-20' },
  // CJ-7 - classic 4x4, OEM~ET12
  { make: 'Jeep', model: 'CJ-7', yearFrom: 1978, yearTo: 1986, oem: 12, type: 'suv5', thread: '1/2-20' },
  // Cherokee (XJ) - OEM ET25 from DB
  { make: 'Jeep', model: 'Cherokee', yearFrom: 1984, yearTo: 2001, oem: 25, type: 'suv5', thread: 'M12x1.5' },
  // Comanche (MJ pickup) - based on XJ, OEM~ET25
  { make: 'Jeep', model: 'Comanche', yearFrom: 1986, yearTo: 1992, oem: 25, type: 'truck6', thread: 'M12x1.5' },
  // Grand Cherokee ZJ (1993-1998, 5x114.3) - OEM ET44 (known spec)
  { make: 'Jeep', model: 'Grand Cherokee', yearFrom: 1993, yearTo: 1998, oem: 44, type: 'suv5', thread: 'M12x1.5' },
  // Grand Cherokee WJ/WK/WK2 (1999-2026, 5x127) - OEM ET45 (task hint: ET45.7-50)
  { make: 'Jeep', model: 'Grand Cherokee', yearFrom: 1999, yearTo: 2026, oem: 45, type: 'suv5', thread: 'M14x1.5' },
  // Grand Wagoneer (1980-1989, 5x139.7) - body-on-frame SUV, ET~19
  { make: 'Jeep', model: 'Grand Wagoneer', yearFrom: 1980, yearTo: 1991, oem: 19, type: 'suv5', thread: '1/2-20' },
  // Grand Wagoneer (2022-2025, 5x127) - modern full-size SUV, OEM ET44
  { make: 'Jeep', model: 'Grand Wagoneer', yearFrom: 2022, yearTo: 2026, oem: 44, type: 'suv5', thread: 'M14x1.5' },
  // J10 - Jeep pickup truck, OEM~ET12 (7" wide wheel 4" BS)
  { make: 'Jeep', model: 'J10', yearFrom: 1978, yearTo: 1988, oem: 12, type: 'truck6', thread: '1/2-20' },
  // Liberty (KJ) - OEM ET44 from DB
  { make: 'Jeep', model: 'Liberty', yearFrom: 2002, yearTo: 2012, oem: 44, type: 'suv5', thread: 'M12x1.5' },
  // Wrangler YJ/TJ (1996 in DB, 5x114.3) - OEM ET25 front/rear (TJ 1997-2006)
  { make: 'Jeep', model: 'Wrangler', yearFrom: 1996, yearTo: 2006, oem: 25, type: 'suv5', thread: 'M12x1.5' },
  // jeep gladiator (lowercase, JT 2024, 5x127) - 5-lug truck, OEM ET25
  { make: 'jeep', model: 'gladiator', yearFrom: 2020, yearTo: 2026, oem: 25, type: 'suv5', thread: 'M14x1.5' },
  // jeep wrangler (lowercase, JL 2021-2022, 5x127) - OEM ET6 (stock 17" steel 4" BS on 7.5")
  { make: 'jeep', model: 'wrangler', yearFrom: 2018, yearTo: 2025, oem: 6, type: 'suv5', thread: 'M14x1.5' },

  // ─── LINCOLN ─────────────────────────────────────────────────────────────────
  // Continental (1980-1981, 5x127) - large RWD, ET~19 (Panther/Mark platform)
  { make: 'Lincoln', model: 'Continental', yearFrom: 1980, yearTo: 1983, oem: 19, type: 'car', thread: '1/2-20' },
  // Mark VII (1984-1992, 5x114.3) - OEM ET24 from DB
  { make: 'Lincoln', model: 'Mark VII', yearFrom: 1984, yearTo: 1992, oem: 24, type: 'car', thread: 'M12x1.5' },
  // Mark VIII (1993-1998, 5x108) - OEM ET44 from DB
  { make: 'Lincoln', model: 'Mark VIII', yearFrom: 1993, yearTo: 1998, oem: 44, type: 'car', thread: 'M12x1.5' },
  // Town Car (1980-1989, 5x114.3) - RWD Panther, ET~24
  { make: 'Lincoln', model: 'Town Car', yearFrom: 1980, yearTo: 2011, oem: 24, type: 'car', thread: 'M12x1.5' },
  // lincoln navigator (lowercase, 2024, 6x135) - full-size SUV, OEM ET44
  { make: 'lincoln', model: 'navigator', yearFrom: 2022, yearTo: 2026, oem: 44, type: 'truck6', thread: 'M14x1.5' },

  // ─── MERCURY ─────────────────────────────────────────────────────────────────
  // Capri (1980-1986, 4x108) - Fox-body based, ET~19 (backspacing 3.5" on 6")
  { make: 'Mercury', model: 'Capri', yearFrom: 1980, yearTo: 1986, oem: 19, type: 'car', thread: '1/2-20' },
  // Comet (1964-1965, 4x114.3) - compact RWD, ET0 from DB
  { make: 'Mercury', model: 'Comet', yearFrom: 1964, yearTo: 1967, oem: 0, type: 'car', thread: '1/2-20' },
  // Cougar (1980-1982, 5x114.3) - Panther-based personal luxury, ET~19
  { make: 'Mercury', model: 'Cougar', yearFrom: 1980, yearTo: 1982, oem: 19, type: 'car', thread: '1/2-20' },
  // Cougar (1983-1988, 4x108) - Fox platform, ET~19
  { make: 'Mercury', model: 'Cougar', yearFrom: 1983, yearTo: 1997, oem: 19, type: 'car', thread: 'M12x1.5' },
  // Cyclone (1968-1971, 5x114.3) - RWD muscle, ET0 from DB
  { make: 'Mercury', model: 'Cyclone', yearFrom: 1968, yearTo: 1971, oem: 0, type: 'car', thread: '1/2-20' },

  // ─── PLYMOUTH ────────────────────────────────────────────────────────────────
  // Acclaim - FWD, OEM ET40 from DB
  { make: 'Plymouth', model: 'Acclaim', yearFrom: 1989, yearTo: 1995, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Belvedere - RWD B-body, OEM ET5 from DB (5.5" wide 14", 0" BS = ET0; or ET5 from wheel offset=5 in DB)
  { make: 'Plymouth', model: 'Belvedere', yearFrom: 1962, yearTo: 1970, oem: 5, type: 'car', thread: '1/2-20' },
  // Breeze - FWD, OEM ET37-40 from DB
  { make: 'Plymouth', model: 'Breeze', yearFrom: 1996, yearTo: 2000, oem: 38, type: 'car', thread: 'M12x1.5' },
  // Cuda - RWD E-body muscle, OEM ET0 from DB
  { make: 'Plymouth', model: 'Cuda', yearFrom: 1970, yearTo: 1974, oem: 0, type: 'car', thread: '1/2-20' },
  // Fury - RWD C-body, ET~0 vintage
  { make: 'Plymouth', model: 'Fury', yearFrom: 1955, yearTo: 1978, oem: 0, type: 'car', thread: '1/2-20' },
  // GTX - RWD B-body muscle, ET0 from DB
  { make: 'Plymouth', model: 'GTX', yearFrom: 1967, yearTo: 1971, oem: 0, type: 'car', thread: '1/2-20' },
  // Gran Fury - RWD M-body, ET~19 (15x6, 3.75" BS)
  { make: 'Plymouth', model: 'Gran Fury', yearFrom: 1980, yearTo: 1989, oem: 19, type: 'car', thread: '1/2-20' },
  // Grand Voyager - minivan, OEM ET40
  { make: 'Plymouth', model: 'Grand Voyager', yearFrom: 1984, yearTo: 2000, oem: 40, type: 'suv5', thread: 'M12x1.5' },
  // Horizon - FWD Omni twin, ET40
  { make: 'Plymouth', model: 'Horizon', yearFrom: 1978, yearTo: 1990, oem: 40, type: 'car', thread: '1/2-20' },
  // Laser - Mitsubishi Eclipse twin, OEM ET38-40 from DB
  { make: 'Plymouth', model: 'Laser', yearFrom: 1990, yearTo: 1994, oem: 38, type: 'car', thread: 'M12x1.5' },
  // Neon - FWD compact, OEM ET40 from DB
  { make: 'Plymouth', model: 'Neon', yearFrom: 1994, yearTo: 1999, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Reliant - FWD K-car, ET40
  { make: 'Plymouth', model: 'Reliant', yearFrom: 1981, yearTo: 1989, oem: 40, type: 'car', thread: '1/2-20' },
  // Road Runner - RWD B-body muscle, ET0
  { make: 'Plymouth', model: 'Road Runner', yearFrom: 1968, yearTo: 1975, oem: 0, type: 'car', thread: '1/2-20' },
  // Satellite - RWD B-body, OEM ET5 from DB
  { make: 'Plymouth', model: 'Satellite', yearFrom: 1965, yearTo: 1974, oem: 5, type: 'car', thread: '1/2-20' },
  // Sundance - FWD, ET40
  { make: 'Plymouth', model: 'Sundance', yearFrom: 1987, yearTo: 1994, oem: 40, type: 'car', thread: 'M12x1.5' },
  // Valiant - compact RWD (A-body), ET0 from DB
  { make: 'Plymouth', model: 'Valiant', yearFrom: 1960, yearTo: 1976, oem: 0, type: 'car', thread: '1/2-20' },

  // ─── RAM (uppercase) ─────────────────────────────────────────────────────────
  // ProMaster - Fiat Ducato based cargo van, OEM ET66 (5x130, 16")
  // Per Ducato/ProMaster tech specs, front wheel offset is about ET66
  { make: 'RAM', model: 'ProMaster', yearFrom: 2013, yearTo: 2026, oem: 66, type: 'suv5', thread: 'M18x1.5' },
  // Ram Ram 3500 (2018, 8x165.1) - heavy truck, OEM ET-13 (steel 18", 3.5" BS on 8" rim)
  { make: 'Ram', model: 'Ram 3500', yearFrom: 2018, yearTo: 2018, oem: -13, type: 'truck8', thread: 'M14x1.5' },

  // ─── ford/jeep/lincoln (lowercase) ───────────────────────────────────────────
  // ford e-series (lowercase) - E-450/350 cutaway, 8x165.1, ET~0
  { make: 'ford', model: 'e-series', yearFrom: 2013, yearTo: 2026, oem: 0, type: 'truck8', thread: 'M14x2.0' },
  // ford f-150 lightning (lowercase) - 6x135 ET40 from DB
  { make: 'ford', model: 'f-150 lightning', yearFrom: 2022, yearTo: 2026, oem: 40, type: 'truck6', thread: 'M14x1.5' },
];

let updated = 0;
let skipped = 0;
const log = [];

for (const v of VEHICLES) {
  const [min, max] = calcRange(v.oem, v.type);
  
  const res = await pool.query(`
    UPDATE vehicle_fitments
    SET offset_min_mm = $1,
        offset_max_mm = $2,
        thread_size = COALESCE(thread_size, $3),
        updated_at = NOW()
    WHERE make = $4
      AND model = $5
      AND year BETWEEN $6 AND $7
      AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
  `, [min, max, v.thread, v.make, v.model, v.yearFrom, v.yearTo]);
  
  const count = parseInt(res.rowCount ?? 0);
  if (count > 0) {
    updated += count;
    log.push({ make: v.make, model: v.model, years: `${v.yearFrom}-${v.yearTo}`, oem: v.oem, min, max, thread: v.thread, rows: count });
    console.log(`  ? ${v.make} ${v.model} (${v.yearFrom}-${v.yearTo}): OEM=${v.oem} ? [${min},${max}], updated ${count} rows`);
  } else {
    skipped++;
  }
}

console.log(`\nDone. Updated: ${updated} rows across ${log.length} vehicle groups. Skipped (no nulls or no match): ${skipped}`);

// Write summary
import { writeFileSync } from 'fs';
const summary = { 
  updated, 
  skipped, 
  groups: log.length,
  timestamp: new Date().toISOString(),
  details: log 
};
writeFileSync('scripts/offset-research-fca-ford.json', JSON.stringify(summary, null, 2));
console.log('Summary written to scripts/offset-research-fca-ford.json');

await pool.end();
