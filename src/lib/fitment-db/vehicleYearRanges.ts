/**
 * Vehicle Year Ranges - Actual production years for US market
 * 
 * Used to filter out phantom years from coverage calculations.
 * Only includes vehicles in our target tiers.
 * 
 * Format: 'Make:Model' -> { start: YYYY, end?: YYYY }
 * If no end year, vehicle is still in production through 2025.
 * 
 * @created 2026-06-12
 */

export type YearRange = {
  start: number;
  end?: number; // undefined = still in production
};

export const VEHICLE_YEAR_RANGES: Record<string, YearRange> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1 - Trucks & Top SUVs
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Full-size trucks (continuous production)
  'Ford:F-150': { start: 2004 },
  'Chevrolet:Silverado 1500': { start: 1999 },
  'RAM:Ram 1500': { start: 2009 }, // Split from Dodge in 2009
  'GMC:Sierra 1500': { start: 1999 },
  'Toyota:Tundra': { start: 2000 },
  'Nissan:Titan': { start: 2004 },
  
  // Mid-size trucks
  'Toyota:Tacoma': { start: 1995 },
  'Ford:Ranger': { start: 1983 }, // Gap 2012-2018 in US, returned 2019
  'Chevrolet:Colorado': { start: 2004 }, // Gap 2012-2014, returned 2015
  'GMC:Canyon': { start: 2004 }, // Gap 2012-2014, returned 2015
  'Nissan:Frontier': { start: 1998 },
  'Honda:Ridgeline': { start: 2006 }, // Gap 2014-2016, returned 2017
  'Jeep:Gladiator': { start: 2020 },
  'Ford:Maverick': { start: 2022 },
  
  // Heavy-duty trucks
  'Ford:F-250': { start: 1999 },
  'Ford:F-350': { start: 1999 },
  'Chevrolet:Silverado 2500 HD': { start: 2001 },
  'Chevrolet:Silverado 3500 HD': { start: 2001 },
  'RAM:Ram 2500': { start: 2009 },
  'RAM:Ram 3500': { start: 2009 },
  'GMC:Sierra 2500 HD': { start: 2001 },
  'GMC:Sierra 3500 HD': { start: 2001 },
  
  // Top compact SUVs
  'Toyota:RAV4': { start: 1996 },
  'Honda:CR-V': { start: 1997 },
  'Mazda:CX-5': { start: 2013 },
  'Subaru:Crosstrek': { start: 2013 }, // Was XV Crosstrek 2013-2015
  'Subaru:Forester': { start: 1998 },
  'Hyundai:Tucson': { start: 2005 },
  'Kia:Sportage': { start: 1995 },
  'Nissan:Rogue': { start: 2008 },
  'Ford:Escape': { start: 2001 },
  'Chevrolet:Equinox': { start: 2005 },
  
  // Top mid-size SUVs
  'Toyota:Highlander': { start: 2001 },
  'Honda:Pilot': { start: 2003 },
  'Ford:Explorer': { start: 1991 },
  'Chevrolet:Traverse': { start: 2009 },
  'Hyundai:Santa Fe': { start: 2001 },
  'Kia:Sorento': { start: 2003 },
  'Subaru:Outback': { start: 1995 },
  'Mazda:CX-9': { start: 2007 },
  
  // Top full-size SUVs
  'Chevrolet:Tahoe': { start: 1995 },
  'Chevrolet:Suburban': { start: 1935 },
  'GMC:Yukon': { start: 1992 },
  'GMC:Yukon XL': { start: 2000 },
  'Ford:Expedition': { start: 1997 },
  'Toyota:Sequoia': { start: 2001 },
  'Nissan:Armada': { start: 2004 },
  
  // Iconic off-road
  'Jeep:Wrangler': { start: 1987 },
  'Jeep:Grand Cherokee': { start: 1993 },
  'Toyota:4Runner': { start: 1984 },
  'Ford:Bronco': { start: 2021 }, // New gen; old was 1966-1996
  'Land Rover:Defender': { start: 2020 }, // New gen for US
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2 - Additional SUVs, Sedans, EVs, Sports
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Additional SUVs
  'Jeep:Cherokee': { start: 2014 }, // New gen; old was 1974-2001
  'Jeep:Compass': { start: 2007 },
  'Jeep:Renegade': { start: 2015 },
  'Ford:Bronco Sport': { start: 2021 },
  'Ford:Edge': { start: 2007 },
  'Chevrolet:Blazer': { start: 2019 }, // New gen; old was 1969-2005
  'Chevrolet:Trailblazer': { start: 2021 }, // New gen; old was 2002-2009
  'Chevrolet:Trax': { start: 2013 },
  'Honda:Passport': { start: 2019 }, // New gen; old was 1994-2002
  'Honda:HR-V': { start: 2016 },
  'Toyota:Venza': { start: 2009, end: 2015 }, // Returned 2021 as hybrid-only
  'Toyota:Venza': { start: 2021 }, // New gen
  'Nissan:Pathfinder': { start: 1987 },
  'Nissan:Murano': { start: 2003 },
  'Nissan:Kicks': { start: 2018 },
  'Subaru:Ascent': { start: 2019 },
  'Mazda:CX-30': { start: 2020 },
  'Mazda:CX-50': { start: 2023 },
  'Kia:Telluride': { start: 2020 },
  'Kia:Seltos': { start: 2021 },
  'Hyundai:Palisade': { start: 2020 },
  'Hyundai:Kona': { start: 2018 },
  'Volkswagen:Atlas': { start: 2018 },
  'Volkswagen:Tiguan': { start: 2009 },
  'Volkswagen:Taos': { start: 2022 },
  'GMC:Acadia': { start: 2007 },
  'GMC:Terrain': { start: 2010 },
  'Buick:Enclave': { start: 2008 },
  'Buick:Envision': { start: 2016 },
  'Dodge:Durango': { start: 1998 },
  
  // Top sedans
  'Toyota:Camry': { start: 1983 },
  'Honda:Civic': { start: 1973 },
  'Honda:Accord': { start: 1976 },
  'Toyota:Corolla': { start: 1966 },
  'Nissan:Altima': { start: 1993 },
  'Nissan:Sentra': { start: 1982 },
  'Hyundai:Elantra': { start: 1991 },
  'Hyundai:Sonata': { start: 1989 },
  'Kia:Forte': { start: 2010 },
  'Kia:K5': { start: 2021 }, // Replaced Optima
  'Mazda:Mazda3': { start: 2004 },
  'Mazda:Mazda6': { start: 2003, end: 2021 }, // Discontinued
  'Subaru:Impreza': { start: 1993 },
  'Subaru:Legacy': { start: 1990 },
  'Volkswagen:Jetta': { start: 1980 },
  'Volkswagen:Passat': { start: 1990, end: 2022 }, // Discontinued in US
  'Chevrolet:Malibu': { start: 1964 },
  
  // EVs
  'Tesla:Model Y': { start: 2020 },
  'Tesla:Model 3': { start: 2017 },
  'Tesla:Model X': { start: 2016 },
  'Tesla:Model S': { start: 2012 },
  'Ford:Mustang Mach-E': { start: 2021 },
  'Chevrolet:Bolt EV': { start: 2017 },
  'Chevrolet:Bolt EUV': { start: 2022 },
  'Hyundai:Ioniq 5': { start: 2022 },
  'Hyundai:Ioniq 6': { start: 2023 },
  'Kia:EV6': { start: 2022 },
  'Volkswagen:ID.4': { start: 2021 },
  'Rivian:R1T': { start: 2022 },
  'Rivian:R1S': { start: 2022 },
  'Tesla:Cybertruck': { start: 2024 },
  
  // Sports/Performance
  'Ford:Mustang': { start: 1964 },
  'Chevrolet:Camaro': { start: 1967, end: 2024 }, // Discontinued
  'Chevrolet:Corvette': { start: 1953 },
  'Dodge:Challenger': { start: 2008 }, // New gen
  'Dodge:Charger': { start: 2006 }, // New gen
  'Subaru:WRX': { start: 2002 },
  
  // Minivans
  'Toyota:Sienna': { start: 1998 },
  'Honda:Odyssey': { start: 1995 },
  'Chrysler:Pacifica': { start: 2017 }, // New gen; old was 2004-2008
  'Kia:Carnival': { start: 2022 }, // Replaced Sedona
  
  // Luxury SUVs
  'Lexus:RX': { start: 1999 },
  'Lexus:NX': { start: 2015 },
  'Lexus:GX': { start: 2003 },
  'Acura:MDX': { start: 2001 },
  'Acura:RDX': { start: 2007 },
  'BMW:X3': { start: 2004 },
  'BMW:X5': { start: 2000 },
  'Mercedes-Benz:GLE': { start: 2016 }, // Was ML-Class before
  'Mercedes-Benz:GLC': { start: 2016 }, // Was GLK before
  'Audi:Q5': { start: 2009 },
  'Audi:Q7': { start: 2007 },
  'Volvo:XC90': { start: 2003 },
  'Volvo:XC60': { start: 2010 },
  'Cadillac:Escalade': { start: 1999 },
  'Lincoln:Navigator': { start: 1998 },
  'Lincoln:Aviator': { start: 2020 }, // New gen; old was 2003-2005
  'Porsche:Cayenne': { start: 2003 },
  'Porsche:Macan': { start: 2015 },
  'Land Rover:Range Rover': { start: 1970 },
  'Land Rover:Range Rover Sport': { start: 2006 },
  'Genesis:GV80': { start: 2021 },
  'Genesis:GV70': { start: 2022 },
  'Infiniti:QX60': { start: 2013 }, // Was JX35 in 2013
  'Infiniti:QX80': { start: 2011 }, // Was QX56 before 2014
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3 - Luxury Sedans, Additional SUVs, Specialty
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Luxury sedans
  'BMW:3 Series': { start: 1977 },
  'BMW:5 Series': { start: 1972 },
  'Mercedes-Benz:C-Class': { start: 1994 },
  'Mercedes-Benz:E-Class': { start: 1994 },
  'Audi:A4': { start: 1996 },
  'Audi:A6': { start: 1995 },
  'Lexus:ES': { start: 1990 },
  'Lexus:IS': { start: 2001 },
  'Acura:TLX': { start: 2015 },
  'Acura:Integra': { start: 2023 }, // New gen; old was 1986-2001
  'Genesis:G70': { start: 2019 },
  'Genesis:G80': { start: 2017 }, // Was Hyundai Genesis before
  'Infiniti:Q50': { start: 2014 }, // Was G37 before
  'Volvo:S60': { start: 2001 },
  'Cadillac:CT5': { start: 2020 },
  
  // Additional SUVs
  'BMW:X1': { start: 2013 },
  'BMW:X7': { start: 2019 },
  'Mercedes-Benz:GLA': { start: 2015 },
  'Mercedes-Benz:GLB': { start: 2020 },
  'Mercedes-Benz:GLS': { start: 2017 }, // Was GL-Class before
  'Audi:Q3': { start: 2015 },
  'Audi:Q8': { start: 2019 },
  'Lexus:UX': { start: 2019 },
  'Lexus:LX': { start: 1996 },
  'Volvo:XC40': { start: 2019 },
  'Cadillac:XT4': { start: 2019 },
  'Cadillac:XT5': { start: 2017 },
  'Cadillac:XT6': { start: 2020 },
  'Lincoln:Corsair': { start: 2020 },
  'Lincoln:Nautilus': { start: 2019 }, // Was MKX before
  
  // Wagoneer
  'Jeep:Wagoneer': { start: 2022 },
  'Jeep:Grand Wagoneer': { start: 2022 },
  
  // Compact/specialty
  'Toyota:Prius': { start: 2001 },
  'Hyundai:Venue': { start: 2020 },
  'Kia:Soul': { start: 2010 },
  'Kia:Niro': { start: 2017 },
  'Nissan:Versa': { start: 2007 },
  'Nissan:Leaf': { start: 2011 },
  'Dodge:Journey': { start: 2009, end: 2020 }, // Discontinued
  
  // Sports
  'Toyota:GR86': { start: 2022 }, // Was 86/GT86 before
  'Subaru:BRZ': { start: 2013 },
  'Mazda:MX-5 Miata': { start: 1990 },
  'Porsche:911': { start: 1965 },
  'Nissan:Z': { start: 2023 }, // New gen; was 370Z before
  'Kia:Stinger': { start: 2018, end: 2023 }, // Discontinued
  'Toyota:Supra': { start: 2020 }, // New gen; old was 1978-2002
  
  // Trucks
  'Hyundai:Santa Cruz': { start: 2022 },
  
  // Land Rover
  'Land Rover:Discovery': { start: 1994 },
  'Land Rover:Discovery Sport': { start: 2015 },
  
  // Alfa Romeo
  'Alfa Romeo:Giulia': { start: 2017 },
  'Alfa Romeo:Stelvio': { start: 2018 },
  
  // MINI
  'MINI:Cooper': { start: 2002 },
  'MINI:Countryman': { start: 2011 },
  
  // EVs
  'GMC:Hummer EV': { start: 2022 },
  'Cadillac:Lyriq': { start: 2023 },
  
  // Commercial Vans
  'Chevrolet:Express 2500': { start: 2003 },
  'Chevrolet:Express 3500': { start: 2003 },
  'GMC:Savana 2500': { start: 2003 },
  'GMC:Savana 3500': { start: 2003 },
  'Ford:Transit': { start: 2015 },
  'Ford:E-Series': { start: 1961 },
  'RAM:ProMaster': { start: 2014 },
  'Mercedes-Benz:Sprinter': { start: 2001 },
};

/**
 * Check if a vehicle existed in a given year
 */
export function vehicleExistsInYear(make: string, model: string, year: number): boolean {
  const key = `${make}:${model}`;
  const range = VEHICLE_YEAR_RANGES[key];
  
  if (!range) {
    // Unknown vehicle - assume it exists (conservative)
    return true;
  }
  
  const endYear = range.end ?? 2025;
  return year >= range.start && year <= endYear;
}

/**
 * Get valid years for a vehicle
 */
export function getValidYearsForVehicle(make: string, model: string, targetYears: number[]): number[] {
  const key = `${make}:${model}`;
  const range = VEHICLE_YEAR_RANGES[key];
  
  if (!range) {
    return targetYears; // Unknown vehicle - return all years
  }
  
  const endYear = range.end ?? 2025;
  return targetYears.filter(year => year >= range.start && year <= endYear);
}

/**
 * Count phantom years in a target list
 */
export function countPhantomYears(
  vehicles: Array<{ make: string; model: string }>,
  years: number[]
): { total: number; real: number; phantom: number } {
  let real = 0;
  let phantom = 0;
  
  for (const vehicle of vehicles) {
    for (const year of years) {
      if (vehicleExistsInYear(vehicle.make, vehicle.model, year)) {
        real++;
      } else {
        phantom++;
      }
    }
  }
  
  return { total: real + phantom, real, phantom };
}
