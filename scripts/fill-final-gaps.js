const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Helper to convert comma-separated sizes to JSON array
const toJson = (str) => JSON.stringify(str.split(', ').map(s => s.trim()));

// Final gap fill - High volume + Missing popular vehicles
const records = [
  // ============================================
  // SILVERADO 1500 - Fill 2009, 2013-14, 2016-18
  // ============================================
  { year: 2009, make: 'chevrolet', model: 'silverado-1500', display_trim: 'WT, LS, LT', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 25, offset_max_mm: 45, oem_wheel_sizes: '17x7.5, 18x8', oem_tire_sizes: '245/70R17, 265/65R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2013, make: 'chevrolet', model: 'silverado-1500', display_trim: 'WT, LS, LT', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5', oem_tire_sizes: '245/70R17, 265/65R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2014, make: 'chevrolet', model: 'silverado-1500', display_trim: 'WT, LS, LT', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5, 20x9', oem_tire_sizes: '245/70R17, 265/65R18, 275/55R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2016, make: 'chevrolet', model: 'silverado-1500', display_trim: 'WT, LS, LT', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5, 20x9', oem_tire_sizes: '245/70R17, 265/65R18, 275/55R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2017, make: 'chevrolet', model: 'silverado-1500', display_trim: 'WT, LS, LT', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5, 20x9', oem_tire_sizes: '245/70R17, 265/65R18, 275/55R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2018, make: 'chevrolet', model: 'silverado-1500', display_trim: 'WT, LS, LT', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5, 20x9', oem_tire_sizes: '245/70R17, 265/65R18, 275/55R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2016, make: 'chevrolet', model: 'silverado-1500', display_trim: 'LTZ, High Country', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '20x9, 22x9', oem_tire_sizes: '275/55R20, 285/45R22', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2017, make: 'chevrolet', model: 'silverado-1500', display_trim: 'LTZ, High Country', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '20x9, 22x9', oem_tire_sizes: '275/55R20, 285/45R22', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2018, make: 'chevrolet', model: 'silverado-1500', display_trim: 'LTZ, High Country', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '20x9, 22x9', oem_tire_sizes: '275/55R20, 285/45R22', thread_size: 'M14x1.5', seat_type: 'conical' },

  // ============================================
  // GMC SIERRA 1500 - Fill 2014-15, 2019-20, 2022
  // ============================================
  { year: 2014, make: 'gmc', model: 'sierra-1500', display_trim: 'Base, SLE', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5', oem_tire_sizes: '245/70R17, 265/65R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2015, make: 'gmc', model: 'sierra-1500', display_trim: 'Base, SLE', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5', oem_tire_sizes: '245/70R17, 265/65R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2014, make: 'gmc', model: 'sierra-1500', display_trim: 'SLT, Denali', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '20x9, 22x9', oem_tire_sizes: '275/55R20, 285/45R22', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2015, make: 'gmc', model: 'sierra-1500', display_trim: 'SLT, Denali', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '20x9, 22x9', oem_tire_sizes: '275/55R20, 285/45R22', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2019, make: 'gmc', model: 'sierra-1500', display_trim: 'Base, SLE, Elevation', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5, 20x9', oem_tire_sizes: '255/70R17, 265/65R18, 275/60R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2020, make: 'gmc', model: 'sierra-1500', display_trim: 'Base, SLE, Elevation', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5, 20x9', oem_tire_sizes: '255/70R17, 265/65R18, 275/60R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2022, make: 'gmc', model: 'sierra-1500', display_trim: 'Base, SLE, Elevation', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '17x8, 18x8.5, 20x9', oem_tire_sizes: '255/70R17, 265/65R18, 275/60R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2019, make: 'gmc', model: 'sierra-1500', display_trim: 'SLT, AT4, Denali', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '20x9, 22x9', oem_tire_sizes: '275/60R20, 285/45R22', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2020, make: 'gmc', model: 'sierra-1500', display_trim: 'SLT, AT4, Denali', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '20x9, 22x9', oem_tire_sizes: '275/60R20, 285/45R22', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2022, make: 'gmc', model: 'sierra-1500', display_trim: 'SLT, AT4, Denali', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 24, offset_max_mm: 44, oem_wheel_sizes: '20x9, 22x9', oem_tire_sizes: '275/60R20, 285/45R22', thread_size: 'M14x1.5', seat_type: 'conical' },

  // ============================================
  // JEEP GRAND CHEROKEE - Fill 1999-2001, 2003-2009
  // ============================================
  // WJ (1999-2004)
  { year: 1999, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7.5', oem_tire_sizes: '225/75R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2000, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7.5', oem_tire_sizes: '225/75R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2001, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7.5', oem_tire_sizes: '225/75R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2003, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited, Overland', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7.5', oem_tire_sizes: '225/75R16, 245/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2004, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited, Overland', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7.5', oem_tire_sizes: '225/75R16, 245/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  // WK (2005-2010)
  { year: 2005, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7.5, 18x8', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2006, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7.5, 18x8', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2007, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7.5, 18x8', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2008, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7.5, 18x8', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2009, make: 'jeep', model: 'grand-cherokee', display_trim: 'Laredo, Limited', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7.5, 18x8', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2005, make: 'jeep', model: 'grand-cherokee', display_trim: 'Overland, SRT8', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '18x8, 20x9', oem_tire_sizes: '255/55R18, 265/50R20', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2006, make: 'jeep', model: 'grand-cherokee', display_trim: 'Overland, SRT8', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '18x8, 20x9', oem_tire_sizes: '255/55R18, 265/50R20', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2007, make: 'jeep', model: 'grand-cherokee', display_trim: 'Overland, SRT8', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '18x8, 20x9', oem_tire_sizes: '255/55R18, 265/50R20', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2008, make: 'jeep', model: 'grand-cherokee', display_trim: 'Overland, SRT8', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '18x8, 20x9', oem_tire_sizes: '255/55R18, 265/50R20', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2009, make: 'jeep', model: 'grand-cherokee', display_trim: 'Overland, SRT8', bolt_pattern: '5x127', center_bore_mm: 71.5, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '18x8, 20x9', oem_tire_sizes: '255/55R18, 265/50R20', thread_size: '1/2-20', seat_type: 'conical' },

  // ============================================
  // CADILLAC ESCALADE - Fill 2000-2001
  // ============================================
  { year: 2000, make: 'cadillac', model: 'escalade', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 25, offset_max_mm: 45, oem_wheel_sizes: '16x7', oem_tire_sizes: '265/70R16', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2001, make: 'cadillac', model: 'escalade', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 78.1, offset_min_mm: 25, offset_max_mm: 45, oem_wheel_sizes: '17x7.5', oem_tire_sizes: '255/70R17', thread_size: 'M14x1.5', seat_type: 'conical' },

  // ============================================
  // JEEP LIBERTY - Fill 2002-2012 (only has 2003)
  // ============================================
  // KJ (2002-2007)
  { year: 2002, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '215/75R16, 225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2004, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '215/75R16, 225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2005, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '215/75R16, 225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2006, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '215/75R16, 225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2007, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '215/75R16, 225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2005, make: 'jeep', model: 'liberty', display_trim: 'Renegade', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2006, make: 'jeep', model: 'liberty', display_trim: 'Renegade', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2007, make: 'jeep', model: 'liberty', display_trim: 'Renegade', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 35, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  // KK (2008-2012)
  { year: 2008, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2009, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2010, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2011, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2012, make: 'jeep', model: 'liberty', display_trim: 'Sport, Limited, Latitude', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '225/75R16, 235/70R16, 235/65R17', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2008, make: 'jeep', model: 'liberty', display_trim: 'Jet, Renegade', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2009, make: 'jeep', model: 'liberty', display_trim: 'Jet, Renegade', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2010, make: 'jeep', model: 'liberty', display_trim: 'Jet, Renegade', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2011, make: 'jeep', model: 'liberty', display_trim: 'Jet, Renegade', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },
  { year: 2012, make: 'jeep', model: 'liberty', display_trim: 'Jet, Renegade', bolt_pattern: '5x114.3', center_bore_mm: 71.5, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7', oem_tire_sizes: '235/65R17, 245/60R18', thread_size: '1/2-20', seat_type: 'conical' },

  // ============================================
  // TOYOTA LAND CRUISER - Fill gaps (has 2016, 2017, 2020, 2021, 2023)
  // ============================================
  // 100 Series (2000-2007)
  { year: 2000, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '16x8, 17x8, 18x8', oem_tire_sizes: '275/70R16, 275/65R17, 275/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2001, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '16x8, 17x8, 18x8', oem_tire_sizes: '275/70R16, 275/65R17, 275/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2002, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '16x8, 17x8, 18x8', oem_tire_sizes: '275/70R16, 275/65R17, 275/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2003, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '16x8, 17x8, 18x8', oem_tire_sizes: '275/70R16, 275/65R17, 275/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2004, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '16x8, 17x8, 18x8', oem_tire_sizes: '275/70R16, 275/65R17, 275/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2005, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '16x8, 17x8, 18x8', oem_tire_sizes: '275/70R16, 275/65R17, 275/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2006, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '16x8, 17x8, 18x8', oem_tire_sizes: '275/70R16, 275/65R17, 275/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2007, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '16x8, 17x8, 18x8', oem_tire_sizes: '275/70R16, 275/65R17, 275/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  // 200 Series (2008-2021)
  { year: 2008, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '17x8, 18x8', oem_tire_sizes: '275/65R17, 285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2009, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '17x8, 18x8', oem_tire_sizes: '275/65R17, 285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2010, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '17x8, 18x8', oem_tire_sizes: '275/65R17, 285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2011, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '17x8, 18x8', oem_tire_sizes: '275/65R17, 285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2012, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '17x8, 18x8', oem_tire_sizes: '275/65R17, 285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2013, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '17x8, 18x8', oem_tire_sizes: '275/65R17, 285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2014, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '17x8, 18x8', oem_tire_sizes: '275/65R17, 285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2015, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '17x8, 18x8', oem_tire_sizes: '275/65R17, 285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2018, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '18x8', oem_tire_sizes: '285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2019, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '18x8', oem_tire_sizes: '285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2022, make: 'toyota', model: 'land-cruiser', display_trim: 'Base', bolt_pattern: '5x150', center_bore_mm: 110.1, offset_min_mm: 50, offset_max_mm: 60, oem_wheel_sizes: '18x8', oem_tire_sizes: '285/60R18', thread_size: 'M14x1.5', seat_type: 'conical' },

  // ============================================
  // TOYOTA FJ CRUISER - 2007-2014 (missing entirely)
  // ============================================
  { year: 2007, make: 'toyota', model: 'fj-cruiser', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 106.1, offset_min_mm: 15, offset_max_mm: 30, oem_wheel_sizes: '16x7.5, 17x7.5', oem_tire_sizes: '245/75R16, 265/70R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2008, make: 'toyota', model: 'fj-cruiser', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 106.1, offset_min_mm: 15, offset_max_mm: 30, oem_wheel_sizes: '16x7.5, 17x7.5', oem_tire_sizes: '245/75R16, 265/70R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2009, make: 'toyota', model: 'fj-cruiser', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 106.1, offset_min_mm: 15, offset_max_mm: 30, oem_wheel_sizes: '16x7.5, 17x7.5', oem_tire_sizes: '245/75R16, 265/70R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2010, make: 'toyota', model: 'fj-cruiser', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 106.1, offset_min_mm: 15, offset_max_mm: 30, oem_wheel_sizes: '16x7.5, 17x7.5', oem_tire_sizes: '245/75R16, 265/70R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2011, make: 'toyota', model: 'fj-cruiser', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 106.1, offset_min_mm: 15, offset_max_mm: 30, oem_wheel_sizes: '16x7.5, 17x7.5', oem_tire_sizes: '245/75R16, 265/70R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2012, make: 'toyota', model: 'fj-cruiser', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 106.1, offset_min_mm: 15, offset_max_mm: 30, oem_wheel_sizes: '16x7.5, 17x7.5', oem_tire_sizes: '245/75R16, 265/70R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2013, make: 'toyota', model: 'fj-cruiser', display_trim: 'Base', bolt_pattern: '6x139.7', center_bore_mm: 106.1, offset_min_mm: 15, offset_max_mm: 30, oem_wheel_sizes: '16x7.5, 17x7.5', oem_tire_sizes: '245/75R16, 265/70R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2014, make: 'toyota', model: 'fj-cruiser', display_trim: 'Base, Trail Teams', bolt_pattern: '6x139.7', center_bore_mm: 106.1, offset_min_mm: 15, offset_max_mm: 30, oem_wheel_sizes: '16x7.5, 17x7.5', oem_tire_sizes: '265/70R17, 285/70R17', thread_size: 'M12x1.5', seat_type: 'conical' },

  // ============================================
  // FORD FIESTA - 2011-2019 (US market)
  // ============================================
  { year: 2011, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2012, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2013, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2014, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2015, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2016, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2017, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2018, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2019, make: 'ford', model: 'fiesta', display_trim: 'S, SE', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '185/60R15, 195/50R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2011, make: 'ford', model: 'fiesta', display_trim: 'Titanium', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '16x6.5, 17x7', oem_tire_sizes: '195/50R16, 205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2012, make: 'ford', model: 'fiesta', display_trim: 'Titanium', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '16x6.5, 17x7', oem_tire_sizes: '195/50R16, 205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2013, make: 'ford', model: 'fiesta', display_trim: 'Titanium', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 52, oem_wheel_sizes: '16x6.5, 17x7', oem_tire_sizes: '195/50R16, 205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2014, make: 'ford', model: 'fiesta', display_trim: 'Titanium, ST', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2015, make: 'ford', model: 'fiesta', display_trim: 'Titanium, ST', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2016, make: 'ford', model: 'fiesta', display_trim: 'Titanium, ST', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2017, make: 'ford', model: 'fiesta', display_trim: 'Titanium, ST', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2018, make: 'ford', model: 'fiesta', display_trim: 'Titanium, ST', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2019, make: 'ford', model: 'fiesta', display_trim: 'Titanium, ST', bolt_pattern: '4x108', center_bore_mm: 63.4, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7', oem_tire_sizes: '205/40R17', thread_size: 'M12x1.5', seat_type: 'conical' },

  // ============================================
  // HONDA INSIGHT - 2000-2006, 2010-2014, 2019-2022
  // ============================================
  // Gen 1 (2000-2006)
  { year: 2000, make: 'honda', model: 'insight', display_trim: 'Base', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '14x5', oem_tire_sizes: '165/65R14', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2001, make: 'honda', model: 'insight', display_trim: 'Base', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '14x5', oem_tire_sizes: '165/65R14', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2002, make: 'honda', model: 'insight', display_trim: 'Base', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '14x5', oem_tire_sizes: '165/65R14', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2003, make: 'honda', model: 'insight', display_trim: 'Base', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '14x5', oem_tire_sizes: '165/65R14', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2004, make: 'honda', model: 'insight', display_trim: 'Base', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '14x5', oem_tire_sizes: '165/65R14', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2005, make: 'honda', model: 'insight', display_trim: 'Base', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '14x5', oem_tire_sizes: '165/65R14', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2006, make: 'honda', model: 'insight', display_trim: 'Base', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '14x5', oem_tire_sizes: '165/65R14', thread_size: 'M12x1.5', seat_type: 'ball' },
  // Gen 2 (2010-2014)
  { year: 2010, make: 'honda', model: 'insight', display_trim: 'LX, EX', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 42, offset_max_mm: 50, oem_wheel_sizes: '15x6, 16x6', oem_tire_sizes: '175/65R15, 185/55R16', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2011, make: 'honda', model: 'insight', display_trim: 'LX, EX', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 42, offset_max_mm: 50, oem_wheel_sizes: '15x6, 16x6', oem_tire_sizes: '175/65R15, 185/55R16', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2012, make: 'honda', model: 'insight', display_trim: 'LX, EX', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 42, offset_max_mm: 50, oem_wheel_sizes: '15x6, 16x6', oem_tire_sizes: '175/65R15, 185/55R16', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2013, make: 'honda', model: 'insight', display_trim: 'LX, EX', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 42, offset_max_mm: 50, oem_wheel_sizes: '15x6, 16x6', oem_tire_sizes: '175/65R15, 185/55R16', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2014, make: 'honda', model: 'insight', display_trim: 'LX, EX', bolt_pattern: '4x100', center_bore_mm: 56.1, offset_min_mm: 42, offset_max_mm: 50, oem_wheel_sizes: '15x6, 16x6', oem_tire_sizes: '175/65R15, 185/55R16', thread_size: 'M12x1.5', seat_type: 'ball' },
  // Gen 3 (2019-2022)
  { year: 2019, make: 'honda', model: 'insight', display_trim: 'LX, EX, Touring', bolt_pattern: '5x114.3', center_bore_mm: 64.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '215/55R16, 215/50R17', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2021, make: 'honda', model: 'insight', display_trim: 'LX, EX, Touring', bolt_pattern: '5x114.3', center_bore_mm: 64.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '215/55R16, 215/50R17', thread_size: 'M12x1.5', seat_type: 'ball' },
  { year: 2022, make: 'honda', model: 'insight', display_trim: 'LX, EX, Touring', bolt_pattern: '5x114.3', center_bore_mm: 64.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '16x7, 17x7', oem_tire_sizes: '215/55R16, 215/50R17', thread_size: 'M12x1.5', seat_type: 'ball' },

  // ============================================
  // HYUNDAI IONIQ - 2017-2022
  // ============================================
  { year: 2017, make: 'hyundai', model: 'ioniq', display_trim: 'Blue, SE, SEL', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '195/65R15, 205/55R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2018, make: 'hyundai', model: 'ioniq', display_trim: 'Blue, SE, SEL', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '195/65R15, 205/55R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2019, make: 'hyundai', model: 'ioniq', display_trim: 'Blue, SE, SEL', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '195/65R15, 205/55R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2020, make: 'hyundai', model: 'ioniq', display_trim: 'Blue, SE, SEL', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '195/65R15, 205/55R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2021, make: 'hyundai', model: 'ioniq', display_trim: 'Blue, SE, SEL', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '195/65R15, 205/55R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2022, make: 'hyundai', model: 'ioniq', display_trim: 'Blue, SE, SEL', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '15x6, 16x6.5', oem_tire_sizes: '195/65R15, 205/55R16', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2017, make: 'hyundai', model: 'ioniq', display_trim: 'Limited', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7', oem_tire_sizes: '225/45R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2018, make: 'hyundai', model: 'ioniq', display_trim: 'Limited', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7', oem_tire_sizes: '225/45R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2019, make: 'hyundai', model: 'ioniq', display_trim: 'Limited', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7', oem_tire_sizes: '225/45R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2020, make: 'hyundai', model: 'ioniq', display_trim: 'Limited', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7', oem_tire_sizes: '225/45R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2021, make: 'hyundai', model: 'ioniq', display_trim: 'Limited', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7', oem_tire_sizes: '225/45R17', thread_size: 'M12x1.5', seat_type: 'conical' },
  { year: 2022, make: 'hyundai', model: 'ioniq', display_trim: 'Limited', bolt_pattern: '5x114.3', center_bore_mm: 67.1, offset_min_mm: 45, offset_max_mm: 55, oem_wheel_sizes: '17x7', oem_tire_sizes: '225/45R17', thread_size: 'M12x1.5', seat_type: 'conical' },

  // ============================================
  // CHEVROLET BLAZER - Fill 2019-2024 (new crossover)
  // ============================================
  { year: 2019, make: 'chevrolet', model: 'blazer', display_trim: 'L, 1LT, 2LT', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x8, 20x8.5', oem_tire_sizes: '235/55R18, 255/45R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2020, make: 'chevrolet', model: 'blazer', display_trim: 'L, 1LT, 2LT', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x8, 20x8.5', oem_tire_sizes: '235/55R18, 255/45R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2021, make: 'chevrolet', model: 'blazer', display_trim: 'L, 1LT, 2LT', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x8, 20x8.5', oem_tire_sizes: '235/55R18, 255/45R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2022, make: 'chevrolet', model: 'blazer', display_trim: 'L, 1LT, 2LT', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x8, 20x8.5', oem_tire_sizes: '235/55R18, 255/45R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2023, make: 'chevrolet', model: 'blazer', display_trim: 'L, 1LT, 2LT', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x8, 20x8.5', oem_tire_sizes: '235/55R18, 255/45R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2024, make: 'chevrolet', model: 'blazer', display_trim: 'L, 1LT, 2LT', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x8, 20x8.5', oem_tire_sizes: '235/55R18, 255/45R20', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2019, make: 'chevrolet', model: 'blazer', display_trim: 'RS, Premier', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '21x8.5', oem_tire_sizes: '265/40R21', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2020, make: 'chevrolet', model: 'blazer', display_trim: 'RS, Premier', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '21x8.5', oem_tire_sizes: '265/40R21', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2021, make: 'chevrolet', model: 'blazer', display_trim: 'RS, Premier', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '21x8.5', oem_tire_sizes: '265/40R21', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2022, make: 'chevrolet', model: 'blazer', display_trim: 'RS, Premier', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '21x8.5', oem_tire_sizes: '265/40R21', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2023, make: 'chevrolet', model: 'blazer', display_trim: 'RS, Premier', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '21x8.5', oem_tire_sizes: '265/40R21', thread_size: 'M14x1.5', seat_type: 'conical' },
  { year: 2024, make: 'chevrolet', model: 'blazer', display_trim: 'RS, Premier', bolt_pattern: '5x120', center_bore_mm: 67.1, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '21x8.5', oem_tire_sizes: '265/40R21', thread_size: 'M14x1.5', seat_type: 'conical' },

  // ============================================
  // CHEVROLET TRAILBLAZER - Fill 2021-2026 (new subcompact)
  // ============================================
  { year: 2021, make: 'chevrolet', model: 'trailblazer', display_trim: 'L, LS, LT', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7.5', oem_tire_sizes: '215/55R17, 225/55R18', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2022, make: 'chevrolet', model: 'trailblazer', display_trim: 'L, LS, LT', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7.5', oem_tire_sizes: '215/55R17, 225/55R18', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2023, make: 'chevrolet', model: 'trailblazer', display_trim: 'L, LS, LT', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7.5', oem_tire_sizes: '215/55R17, 225/55R18', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2024, make: 'chevrolet', model: 'trailblazer', display_trim: 'L, LS, LT', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7.5', oem_tire_sizes: '215/55R17, 225/55R18', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2025, make: 'chevrolet', model: 'trailblazer', display_trim: 'L, LS, LT', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7.5', oem_tire_sizes: '215/55R17, 225/55R18', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2026, make: 'chevrolet', model: 'trailblazer', display_trim: 'L, LS, LT', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '17x7, 18x7.5', oem_tire_sizes: '215/55R17, 225/55R18', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2021, make: 'chevrolet', model: 'trailblazer', display_trim: 'Activ, RS', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x7.5, 19x7.5', oem_tire_sizes: '225/55R18, 225/45R19', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2022, make: 'chevrolet', model: 'trailblazer', display_trim: 'Activ, RS', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x7.5, 19x7.5', oem_tire_sizes: '225/55R18, 225/45R19', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2023, make: 'chevrolet', model: 'trailblazer', display_trim: 'Activ, RS', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x7.5, 19x7.5', oem_tire_sizes: '225/55R18, 225/45R19', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2024, make: 'chevrolet', model: 'trailblazer', display_trim: 'Activ, RS', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x7.5, 19x7.5', oem_tire_sizes: '225/55R18, 225/45R19', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2025, make: 'chevrolet', model: 'trailblazer', display_trim: 'Activ, RS', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x7.5, 19x7.5', oem_tire_sizes: '225/55R18, 225/45R19', thread_size: 'M12x1.25', seat_type: 'conical' },
  { year: 2026, make: 'chevrolet', model: 'trailblazer', display_trim: 'Activ, RS', bolt_pattern: '5x100', center_bore_mm: 56.6, offset_min_mm: 40, offset_max_mm: 50, oem_wheel_sizes: '18x7.5, 19x7.5', oem_tire_sizes: '225/55R18, 225/45R19', thread_size: 'M12x1.25', seat_type: 'conical' },
];

const crypto = require('crypto');

function genModId() {
  return 'manual_' + crypto.randomBytes(6).toString('hex');
}

async function insertRecords() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  let added = 0, skipped = 0;
  const counts = {};
  
  for (const rec of records) {
    // Check if exists
    const exists = await pool.query(
      `SELECT id FROM vehicle_fitments WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4`,
      [rec.year, rec.make, rec.model, rec.display_trim]
    );
    
    if (exists.rows.length > 0) {
      skipped++;
      continue;
    }
    
    // Convert sizes to JSON arrays
    const wheelSizes = JSON.stringify(rec.oem_wheel_sizes.split(', '));
    const tireSizes = JSON.stringify(rec.oem_tire_sizes.split(', '));
    const modId = genModId();
    
    await pool.query(`
      INSERT INTO vehicle_fitments (
        year, make, model, display_trim, bolt_pattern, center_bore_mm,
        offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
        thread_size, seat_type, modification_id, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      rec.year, rec.make, rec.model, rec.display_trim, rec.bolt_pattern,
      rec.center_bore_mm, rec.offset_min_mm, rec.offset_max_mm, wheelSizes,
      tireSizes, rec.thread_size, rec.seat_type, modId, 'final-gap-fill'
    ]);
    
    added++;
    const key = `${rec.make} ${rec.model}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  
  console.log(`✅ Added: ${added}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log('\n📊 Records by vehicle:');
  for (const [k, v] of Object.entries(counts).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log(`\n📈 Total records: ${total.rows[0].count}`);
  
  await pool.end();
}

insertRecords();
