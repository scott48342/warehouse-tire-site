const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Display trim updates - ONLY changes display_trim field, nothing else
// Format: [make, model, oldTrim, newTrim]
const updates = [
  // HONDA
  ['honda', 'accord', 'Base', 'LX, Sport, EX, EX-L, Touring'],
  ['honda', 'civic', 'Base', 'LX, Sport, EX, EX-L, Touring, Si'],
  ['honda', 'cr-v', 'Base', 'LX, EX, EX-L, Touring'],
  ['honda', 'pilot', 'Base', 'LX, EX, EX-L, Touring, Elite, TrailSport'],
  ['honda', 'hr-v', 'Base', 'LX, Sport, EX, EX-L'],
  ['honda', 'ridgeline', 'Base', 'Sport, RTL, RTL-E, Black Edition, TrailSport'],
  
  // TOYOTA
  ['toyota', 'camry', 'Base', 'LE, SE, XLE, XSE, TRD'],
  ['toyota', 'corolla', 'Base', 'L, LE, SE, XLE, XSE'],
  ['toyota', 'rav4', 'Base', 'LE, XLE, XLE Premium, Adventure, TRD Off-Road, Limited'],
  ['toyota', 'highlander', 'Base', 'L, LE, XLE, Limited, Platinum'],
  ['toyota', '4runner', 'Base', 'SR5, TRD Off-Road, TRD Pro, Limited, Nightshade'],
  ['toyota', 'tacoma', 'Base', 'SR, SR5, TRD Sport, TRD Off-Road, TRD Pro, Limited'],
  ['toyota', 'tundra', 'Base', 'SR, SR5, Limited, Platinum, 1794, TRD Pro'],
  ['toyota', 'prius', 'Base', 'L Eco, LE, XLE, Limited'],
  ['toyota', 'avalon', 'Base', 'XLE, XSE, Touring, Limited, TRD'],
  
  // NISSAN
  ['nissan', 'altima', 'Base', 'S, SV, SL, SR, Platinum'],
  ['nissan', 'sentra', 'Base', 'S, SV, SR'],
  ['nissan', 'maxima', 'Base', 'S, SV, SL, SR, Platinum'],
  ['nissan', 'rogue', 'Base', 'S, SV, SL, Platinum'],
  ['nissan', 'pathfinder', 'Base', 'S, SV, SL, Platinum'],
  ['nissan', 'murano', 'Base', 'S, SV, SL, Platinum'],
  ['nissan', 'armada', 'Base', 'S, SV, SL, Platinum'],
  ['nissan', 'frontier', 'Base', 'S, SV, PRO-4X, PRO-X'],
  ['nissan', 'titan', 'Base', 'S, SV, SL, Platinum Reserve, PRO-4X'],
  ['nissan', 'versa', 'Base', 'S, SV, SR'],
  ['nissan', 'leaf', 'Base', 'S, SV, SL Plus'],
  ['nissan', 'z', 'Base', 'Sport, Performance, NISMO'],
  ['nissan', 'xterra', 'Base', 'X, S, SE, Off-Road, PRO-4X'],
  
  // HYUNDAI
  ['hyundai', 'elantra', 'Base', 'SE, SEL, N Line, Limited'],
  ['hyundai', 'sonata', 'Base', 'SE, SEL, SEL Plus, Limited, N Line'],
  ['hyundai', 'tucson', 'Base', 'SE, SEL, XRT, Limited, N Line'],
  ['hyundai', 'santa-fe', 'Base', 'SE, SEL, XRT, Limited, Calligraphy'],
  ['hyundai', 'palisade', 'Base', 'SE, SEL, XRT, Limited, Calligraphy'],
  ['hyundai', 'kona', 'Base', 'SE, SEL, N Line, Limited'],
  ['hyundai', 'venue', 'Base', 'SE, SEL, Limited'],
  
  // KIA  
  ['kia', 'optima', 'Base', 'LX, S, EX, SX, SX Turbo'],
  ['kia', 'k5', 'Base', 'LX, LXS, GT-Line, EX, GT'],
  ['kia', 'sorento', 'Base', 'LX, S, EX, SX, SX Prestige, X-Line'],
  ['kia', 'sportage', 'Base', 'LX, EX, SX, SX Turbo, X-Line, X-Pro'],
  ['kia', 'telluride', 'Base', 'LX, S, EX, SX, SX Prestige, X-Line, X-Pro'],
  ['kia', 'forte', 'Base', 'FE, LXS, GT-Line, GT'],
  ['kia', 'soul', 'Base', 'LX, S, GT-Line, EX, Turbo'],
  ['kia', 'niro', 'Base', 'LX, EX, EX Premium, SX Touring'],
  ['kia', 'ev6', 'Base', 'Light, Standard, Wind, GT-Line, GT'],
  
  // FORD
  ['ford', 'explorer', 'Base', 'Base, XLT, Limited, ST, Platinum, King Ranch, Timberline'],
  ['ford', 'expedition', 'Base', 'XL, XLT, Limited, King Ranch, Platinum, Timberline'],
  ['ford', 'edge', 'Base', 'SE, SEL, ST-Line, Titanium, ST'],
  ['ford', 'escape', 'Base', 'S, SE, SEL, ST-Line, Titanium, Plug-In Hybrid'],
  ['ford', 'bronco-sport', 'Base', 'Base, Big Bend, Outer Banks, Badlands, Heritage'],
  ['ford', 'ranger', 'Base', 'XL, XLT, Lariat, Tremor, Raptor'],
  ['ford', 'maverick', 'Base', 'XL, XLT, Lariat, Tremor'],
  
  // CHEVROLET
  ['chevrolet', 'equinox', 'Base', 'LS, LT, RS, Premier'],
  ['chevrolet', 'traverse', 'Base', 'LS, LT, RS, Premier, High Country'],
  ['chevrolet', 'tahoe', 'Base', 'LS, LT, RST, Z71, Premier, High Country'],
  ['chevrolet', 'suburban', 'Base', 'LS, LT, RST, Z71, Premier, High Country'],
  ['chevrolet', 'malibu', 'Base', 'LS, RS, LT, Premier'],
  ['chevrolet', 'impala', 'Base', 'LS, LT, Premier'],
  ['chevrolet', 'cruze', 'Base', 'LS, LT, Premier'],
  ['chevrolet', 'cobalt', 'Base', 'LS, LT, SS'],
  ['chevrolet', 'cavalier', 'Base', 'LS, LS Sport'],
  ['chevrolet', 'colorado', 'Base', 'WT, LT, Z71, ZR2, Trail Boss'],
  
  // GMC
  ['gmc', 'terrain', 'Base', 'SL, SLE, SLT, AT4, Denali'],
  ['gmc', 'acadia', 'Base', 'SL, SLE, SLT, AT4, Denali'],
  ['gmc', 'yukon', 'Base', 'SLE, SLT, AT4, Denali, Denali Ultimate'],
  ['gmc', 'yukon-xl', 'Base', 'SLE, SLT, AT4, Denali, Denali Ultimate'],
  ['gmc', 'canyon', 'Base', 'Elevation, AT4, AT4X, Denali'],
  ['gmc', 'sierra-hd', 'Base', 'Pro, SLE, SLT, AT4, AT4X, Denali'],
  
  // SUBARU
  ['subaru', 'outback', 'Base', 'Base, Premium, Limited, Touring, Onyx Edition XT, Wilderness'],
  ['subaru', 'forester', 'Base', 'Base, Premium, Sport, Limited, Touring, Wilderness'],
  ['subaru', 'crosstrek', 'Base', 'Base, Premium, Sport, Limited, Wilderness'],
  ['subaru', 'impreza', 'Base', 'Base, Premium, Sport, Limited'],
  ['subaru', 'legacy', 'Base', 'Base, Premium, Sport, Limited, Touring XT'],
  ['subaru', 'ascent', 'Base', 'Base, Premium, Onyx Edition, Limited, Touring'],
  ['subaru', 'wrx', 'Base', 'Base, Premium, Limited, GT'],
  
  // VOLKSWAGEN
  ['volkswagen', 'jetta', 'Base', 'S, Sport, SE, SEL, GLI'],
  ['volkswagen', 'passat', 'Base', 'S, SE, R-Line, SEL Premium'],
  ['volkswagen', 'tiguan', 'Base', 'S, SE, SE R-Line, SEL, SEL R-Line'],
  ['volkswagen', 'atlas', 'Base', 'S, SE, SE w/Tech, SEL, SEL Premium, Cross Sport'],
  ['volkswagen', 'golf', 'Base', 'S, SE, SEL'],
  ['volkswagen', 'gti', 'Base', 'S, SE, Autobahn'],
  ['volkswagen', 'golf-gti', 'Base', 'S, SE, Autobahn'],
  ['volkswagen', 'golf-r', 'Base', 'Base'],
  ['volkswagen', 'id.4', 'Base', 'Standard, Pro, Pro S, AWD Pro, AWD Pro S'],
  
  // MAZDA
  ['mazda', 'mazda3', 'Base', 'Base, Select, Preferred, Premium, Carbon Edition, Turbo'],
  ['mazda', 'mazda6', 'Base', 'Sport, Touring, Grand Touring, Signature, Carbon Edition'],
  ['mazda', 'cx-5', 'Base', 'S, Select, Preferred, Carbon Edition, Premium, Premium Plus, Turbo, Signature'],
  ['mazda', 'cx-9', 'Base', 'Sport, Touring, Carbon Edition, Grand Touring, Signature'],
  ['mazda', 'cx-30', 'Base', 'Base, Select, Preferred, Carbon Edition, Premium, Turbo'],
  ['mazda', 'cx-50', 'Base', 'Select, Preferred, Premium, Premium Plus, Turbo, Meridian Edition'],
  
  // LEXUS
  ['lexus', 'es', 'Base', 'ES 250, ES 300h, ES 350, F Sport'],
  ['lexus', 'is', 'Base', 'IS 300, IS 350, IS 500, F Sport'],
  ['lexus', 'ls', 'Base', 'LS 500, LS 500h, F Sport'],
  ['lexus', 'gs', 'Base', 'GS 300, GS 350, GS F, F Sport'],
  ['lexus', 'rx', 'Base', 'RX 350, RX 350L, RX 450h, RX 500h, F Sport'],
  ['lexus', 'nx', 'Base', 'NX 250, NX 350, NX 350h, NX 450h+, F Sport'],
  ['lexus', 'gx', 'Base', 'GX 460, GX 550, Premium, Luxury, Overtrail'],
  ['lexus', 'lx', 'Base', 'LX 570, LX 600, F Sport, Ultra Luxury'],
  
  // ACURA
  ['acura', 'tlx', 'Base', 'Base, Technology, A-Spec, Advance, Type S'],
  ['acura', 'mdx', 'Base', 'Base, Technology, A-Spec, Advance, Type S'],
  ['acura', 'rdx', 'Base', 'Base, Technology, A-Spec, Advance'],
  ['acura', 'ilx', 'Base', 'Base, Premium, Technology, A-Spec'],
  ['acura', 'tl', 'Base', 'Base, Technology, SH-AWD, Advance'],
  ['acura', 'tsx', 'Base', 'Base, Technology, Special Edition'],
  
  // INFINITI
  ['infiniti', 'q50', 'Base', 'Pure, Luxe, Sensory, Red Sport 400'],
  ['infiniti', 'q60', 'Base', 'Pure, Luxe, Sensory, Red Sport 400'],
  ['infiniti', 'qx50', 'Base', 'Pure, Luxe, Essential, Sensory, Autograph'],
  ['infiniti', 'qx60', 'Base', 'Pure, Luxe, Sensory, Autograph'],
  ['infiniti', 'qx80', 'Base', 'Luxe, Premium Select, Sensory'],
  ['infiniti', 'g35', 'Base', 'Base, Sport, x AWD'],
  ['infiniti', 'g37', 'Base', 'Base, Journey, x AWD, IPL, Sport'],
  ['infiniti', 'fx35', 'Base', 'Base, Sport'],
  
  // CADILLAC
  ['cadillac', 'escalade', 'Base', 'Luxury, Premium Luxury, Sport, Platinum, V'],
  ['cadillac', 'escalade-esv', 'Base', 'Luxury, Premium Luxury, Sport, Platinum, V'],
  ['cadillac', 'cts', 'Base', 'Base, Luxury, Premium Luxury, V-Sport, V'],
  ['cadillac', 'xt5', 'Base', 'Luxury, Premium Luxury, Sport'],
  ['cadillac', 'xt6', 'Base', 'Luxury, Premium Luxury, Sport'],
  
  // LINCOLN
  ['lincoln', 'navigator', 'Base', 'Standard, Reserve, Black Label'],
  ['lincoln', 'aviator', 'Base', 'Standard, Reserve, Grand Touring, Black Label'],
  ['lincoln', 'nautilus', 'Base', 'Standard, Reserve, Black Label'],
  ['lincoln', 'mkz', 'Base', 'Premiere, Select, Reserve, Black Label'],
  ['lincoln', 'mkx', 'Base', 'Premiere, Select, Reserve, Black Label'],
  ['lincoln', 'continental', 'Base', 'Premiere, Select, Reserve, Black Label'],
  ['lincoln', 'town-car', 'Base', 'Executive, Signature, Signature Limited, Cartier'],
  
  // VOLVO
  ['volvo', 's60', 'Base', 'Momentum, R-Design, Inscription, Polestar Engineered'],
  ['volvo', 's90', 'Base', 'Momentum, R-Design, Inscription'],
  ['volvo', 'xc60', 'Base', 'Momentum, R-Design, Inscription, Polestar Engineered'],
  ['volvo', 'xc90', 'Base', 'Momentum, R-Design, Inscription, Polestar Engineered'],
  
  // LAND ROVER
  ['land-rover', 'range-rover', 'Base', 'SE, HSE, Autobiography, SV Autobiography, SVAutobiography Dynamic'],
  ['land-rover', 'range-rover-sport', 'Base', 'SE, HSE, HST, Autobiography, SVR'],
  ['land-rover', 'range-rover-evoque', 'Base', 'S, SE, Dynamic SE, Autobiography'],
  ['land-rover', 'discovery', 'Base', 'S, SE, HSE, HSE Luxury'],
  ['land-rover', 'defender', 'Base', '90, 110, 130, S, SE, X, V8'],
  
  // JAGUAR
  ['jaguar', 'xf', 'Base', 'Premium, Prestige, R-Dynamic, S'],
  ['jaguar', 'xe', 'Base', 'Premium, Prestige, R-Dynamic, S'],
  ['jaguar', 'xj', 'Base', 'XJ, XJL, XJR, Supersport'],
  ['jaguar', 'f-pace', 'Base', 'Premium, Prestige, R-Dynamic, S, SVR'],
  
  // PORSCHE
  ['porsche', '911', 'Base', 'Carrera, Carrera S, Carrera 4S, Turbo, Turbo S, GT3, GT3 RS'],
  ['porsche', 'boxster', 'Base', 'Base, S, GTS, Spyder'],
  ['porsche', 'cayman', 'Base', 'Base, S, GTS, GT4'],
  ['porsche', 'cayenne', 'Base', 'Base, S, E-Hybrid, GTS, Turbo, Turbo S'],
  ['porsche', 'macan', 'Base', 'Base, S, GTS, Turbo'],
  ['porsche', 'panamera', 'Base', 'Base, 4, 4S, GTS, Turbo, Turbo S'],
  
  // GENESIS
  ['genesis', 'g70', 'Base', '2.0T, 3.3T, Sport'],
  ['genesis', 'g80', 'Base', '2.5T, 3.5T, Sport, Electrified'],
  ['genesis', 'g90', 'Base', '3.3T, 5.0, Ultimate'],
  ['genesis', 'gv70', 'Base', '2.5T, 3.5T, Sport Prestige, Electrified'],
  ['genesis', 'gv80', 'Base', '2.5T, 3.5T'],
  
  // MINI
  ['mini', 'cooper', 'Base', 'Classic, Signature, Iconic, S, John Cooper Works'],
  ['mini', 'countryman', 'Base', 'Classic, Signature, Iconic, S, John Cooper Works'],
  ['mini', 'clubman', 'Base', 'Classic, Signature, Iconic, S, John Cooper Works'],
  
  // MITSUBISHI
  ['mitsubishi', 'outlander', 'Base', 'ES, SE, SEL, GT'],
  ['mitsubishi', 'outlander-sport', 'Base', 'ES, SE, LE, GT'],
  ['mitsubishi', 'eclipse', 'Base', 'GS, GT, Spyder GS, Spyder GT'],
  ['mitsubishi', 'eclipse-cross', 'Base', 'ES, LE, SE, SEL'],
  ['mitsubishi', 'lancer', 'Base', 'DE, ES, SE, GT, GTS, Ralliart'],
  ['mitsubishi', 'lancer-evolution', 'Base', 'GSR, MR, Final Edition'],
  ['mitsubishi', 'galant', 'Base', 'DE, ES, SE, GT, GTS, Ralliart'],
  
  // BUICK
  ['buick', 'enclave', 'Base', 'Preferred, Essence, Avenir'],
  ['buick', 'envision', 'Base', 'Preferred, Essence, Avenir'],
  ['buick', 'encore', 'Base', 'Base, Preferred, Sport Touring, Essence'],
  ['buick', 'encore-gx', 'Base', 'Preferred, Select, Essence, Avenir'],
  ['buick', 'regal', 'Base', 'Sportback, TourX, GS'],
  ['buick', 'lacrosse', 'Base', 'Base, Preferred, Essence, Avenir'],
  ['buick', 'lesabre', 'Base', 'Custom, Limited'],
  ['buick', 'century', 'Base', 'Custom, Limited'],
  
  // JEEP
  ['jeep', 'compass', 'Base', 'Sport, Latitude, Trailhawk, Limited, High Altitude'],
  ['jeep', 'renegade', 'Base', 'Sport, Latitude, Trailhawk, Limited'],
  
  // ALFA ROMEO
  ['alfa-romeo', 'giulia', 'Base', 'Sprint, Ti, Ti Sport, Veloce, Quadrifoglio'],
  ['alfa-romeo', 'stelvio', 'Base', 'Sprint, Ti, Ti Sport, Veloce, Quadrifoglio'],
  ['alfa-romeo', '4c', 'Base', 'Base, Spider'],
  
  // OTHER
  ['chevrolet', 'silverado-hd', 'Base', 'WT, Custom, LT, LTZ, High Country'],
  ['gmc', 'sierra-2500-hd', 'Base', 'Pro, SLE, SLT, AT4, Denali'],
  ['ram', '2500', 'Base', 'Tradesman, Big Horn, Power Wagon, Laramie, Limited, Longhorn'],
  ['ram', '3500', 'Base', 'Tradesman, Big Horn, Laramie, Limited, Longhorn'],
];

async function updateTrims() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log('=== UPDATING DISPLAY TRIMS (UI only, no fitment changes) ===\n');
  
  let totalUpdated = 0;
  const updated = {};
  
  for (const [make, model, oldTrim, newTrim] of updates) {
    const result = await pool.query(
      `UPDATE vehicle_fitments 
       SET display_trim = $1, updated_at = NOW()
       WHERE make = $2 AND model = $3 AND display_trim = $4
       RETURNING id`,
      [newTrim, make, model, oldTrim]
    );
    
    if (result.rowCount > 0) {
      totalUpdated += result.rowCount;
      const key = `${make} ${model}`;
      updated[key] = result.rowCount;
    }
  }
  
  console.log('Updated vehicles:');
  for (const [k, v] of Object.entries(updated).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v} records`);
  }
  
  console.log(`\n✅ Total records updated: ${totalUpdated}`);
  console.log('(Only display_trim changed - fitment data untouched)');
  
  // Verify no fitment data was touched
  const sample = await pool.query(`
    SELECT make, model, display_trim, bolt_pattern, center_bore_mm, offset_min_mm
    FROM vehicle_fitments 
    WHERE make = 'honda' AND model = 'accord' 
    LIMIT 3
  `);
  console.log('\nSample verification (Honda Accord):');
  sample.rows.forEach(r => {
    console.log(`  ${r.display_trim.substring(0, 30)}... | ${r.bolt_pattern} | ${r.center_bore_mm}mm | ${r.offset_min_mm}mm offset`);
  });
  
  await pool.end();
}

updateTrims();
