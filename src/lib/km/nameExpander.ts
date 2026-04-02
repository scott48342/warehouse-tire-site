/**
 * K&M Tire Name Expander
 * 
 * Cleans up abbreviated brand/model names from K&M API responses.
 * Removes redundant brand prefixes and expands common abbreviations.
 */

// Brand prefix codes used by K&M (2-letter codes at start of description)
const BRAND_PREFIXES: Record<string, string> = {
  'BF': 'BFGoodrich',
  'BR': 'Bridgestone',
  'CO': 'Continental',
  'CP': 'Cooper',
  'DU': 'Dunlop',
  'FA': 'Falken',
  'FI': 'Fuzion',
  'FR': 'Firestone',
  'GE': 'General',
  'GY': 'Goodyear',
  'GT': 'GT Radial',
  'HA': 'Hankook',
  'HK': 'Hankook',
  'IH': 'Ironhead',
  'KU': 'Kumho',
  'LX': 'Lexani',
  'MA': 'Mastercraft',
  'MI': 'Michelin',
  'NI': 'Nitto',
  'NO': 'Nokian',
  'NX': 'Nexen',
  'PI': 'Pirelli',
  'SU': 'Sumitomo',
  'TH': 'Thunderer',
  'TO': 'Toyo',
  'UN': 'Uniroyal',
  'YO': 'Yokohama',
};

// Words that should NOT be expanded (protect before applying expansions)
const PROTECTED_WORDS = [
  'THRASHER', 'THRASHR', 'THRASH',  // Don't expand AS in THRASHER
  'TRASHER',
  'MASSIV', 'MASSIVE',
  'BEAST', 'BASHER',
  'MASTER', 'DISASTER',
  'COASTAL', 'ASTRO',
];

// Common model abbreviations → full names
const MODEL_EXPANSIONS: Record<string, string> = {
  // Goodyear
  'ASSUR WTHRDY': 'Assurance WeatherReady',
  'ASSUR WTHRRDY2': 'Assurance WeatherReady 2',
  'ASSUR AS': 'Assurance All-Season',
  'ASSUR MXLF': 'Assurance MaxLife',
  'ASSUR MXLIFE 2': 'Assurance MaxLife 2',
  'ASSUR CSTOUR': 'Assurance ComfortDrive',
  'COMFORTDRIVE': 'Assurance ComfortDrive',
  'EGL F1 ASYM': 'Eagle F1 Asymmetric',
  'EGL SPRT AS': 'Eagle Sport All-Season',
  'WRNGLR AT': 'Wrangler All-Terrain',
  'WRNGLR DRTK': 'Wrangler DuraTrac',
  'WRNGLR TRRN': 'Wrangler Workhorse',
  'WRG STEADFAST': 'Wrangler Steadfast',
  'WRG WKHRS': 'Wrangler Workhorse',
  'WGR FORT': 'Wrangler Fortitude',
  'CS FUEL MAX': 'CrossClimate Fuel Max',
  
  // Michelin
  'DEF LTX MS': 'Defender LTX M/S',
  'DEF T+H': 'Defender T+H',
  'DEF 2': 'Defender 2',
  'PRMCY TOUR': 'Primacy Tour A/S',
  'PRMCY MXV4': 'Primacy MXV4',
  'PLT SPT 4S': 'Pilot Sport 4S',
  'PLT SPT AS': 'Pilot Sport All Season',
  'XICE SNOW': 'X-Ice Snow',
  'CRSCLMT 2': 'CrossClimate 2',
  
  // Bridgestone
  'ECOPIA EP': 'Ecopia EP',
  'DUELER HL': 'Dueler H/L',
  'DUELER AT': 'Dueler A/T',
  'POTENZA RE': 'Potenza RE',
  'TURANZA QS': 'Turanza QuietTrack',
  'WTHRPEAK': 'WeatherPeak',
  'BLZZK WS90': 'Blizzak WS90',
  
  // Cooper
  'DISC AT3 4S': 'Discoverer AT3 4S',
  'DISC AT3 XL': 'Discoverer AT3 XLT',
  'DISC RTX': 'Discoverer Rugged Trek',
  'EVO WINTER': 'Evolution Winter',
  
  // Continental
  'TRCTCT TOUR': 'TrueContact Tour',
  'EXTRM CNTCT': 'ExtremeContact',
  'CRSCNTCT LX': 'CrossContact LX',
  'VKNGCNTCT 7': 'VikingContact 7',
  
  // Pirelli
  'SCRP AT+': 'Scorpion All Terrain Plus',
  'SCRP ATR': 'Scorpion ATR',
  'SCRP VERDE': 'Scorpion Verde',
  'P ZERO': 'P Zero',
  'CINT P7': 'Cinturato P7',
  
  // Falken
  'SNC SN250': 'Sincera SN250',
  'WLDPK AT3W': 'Wildpeak A/T3W',
  'WLDPK AT4W': 'Wildpeak A/T4W',
  'AZNS FK510': 'Azenis FK510',
  
  // Hankook
  'KNRGY ST': 'Kinergy ST',
  'KNRGY GT': 'Kinergy GT',
  'KNRGY PT': 'Kinergy PT',
  'DYNAPR AT2': 'Dynapro AT2',
  'DYNAPR HT': 'Dynapro HT',
  'VNTUS S1': 'Ventus S1',
  
  // Toyo
  'OPCNTRY AT': 'Open Country A/T',
  'OPCNTRY QT': 'Open Country Q/T',
  'OPCNTRY RT': 'Open Country R/T',
  'EXTENSA AS': 'Extensa A/S',
  'PRXS SPRT': 'Proxes Sport',
  
  // Yokohama
  'GEOLNDR AT': 'Geolandar A/T',
  'GEOLNDR HT': 'Geolandar H/T',
  'GEOLNDR MT': 'Geolandar M/T',
  'AVID ASCND': 'Avid Ascend',
  'ADVAN SPRT': 'Advan Sport',
  
  // BFGoodrich
  'ALTRN TA KO': 'All-Terrain T/A KO2',
  'MUDTRN TA': 'Mud-Terrain T/A',
  'ADVNTG TA': 'Advantage T/A',
  
  // Nexen
  'N PRIZ AH5': "N'Priz AH5",
  'N PRIZ AH8': "N'Priz AH8",
  'RDN HTX2': 'Roadian HTX2',
  'RDN HTX': 'Roadian HTX',
  'RDN AT PRO': 'Roadian AT Pro',
  'ARIA AH7': 'Aria AH7',
  
  // General
  'ALTMX RT43': 'AltiMAX RT43',
  'ALTMX RT45': 'AltiMAX RT45',
  'GRAB AT3': 'Grabber AT3',
  'GRAB ATX': 'Grabber ATX',
  
  // Firestone
  'DEST LE3': 'Destination LE3',
  'DEST AT2': 'Destination A/T2',
  'WTHRGP AS': 'WeatherGrip A/S',
  'ALL SEASN': 'All Season',
  
  // Kumho
  'CRUGEN HP': 'Crugen HP',
  'SOLUS TA': 'Solus TA',
  'RD VNTR AT': 'Road Venture AT',
  
  // Nitto
  'RDGE GRPLR': 'Ridge Grappler',
  'TRRA GRPLR': 'Terra Grappler',
  'NT421Q': 'NT421Q',
  
  // Ironhead / Thunderer
  'THRASHR': 'Thrasher',
  'RNGR': 'Ranger',
  'TRAC GRP': 'Trac Grip',
  
  // RBP
  'RPLSR': 'Repulsor',
  'RPLSR XT': 'Repulsor XT',
  'RPLSR RT': 'Repulsor R/T',
  
  // Milestar
  'PTGN': 'Patagonia',
  'PTGN XT': 'Patagonia XT',
  
  // Kenda
  'KLEV': 'Klever',
  'KLEV RT': 'Klever R/T',
  
  // Kumho
  'RD VNT': 'Road Venture',
  'RD VNTR': 'Road Venture',
  
  // Venom / Generic Off-Road
  'TERRA HNTER': 'Terra Hunter',
  'TERRA HNTR': 'Terra Hunter',
  'TRAIL HNTR': 'Trail Hunter',
  'TRAIL HNTER': 'Trail Hunter',
  'HNTER': 'Hunter',
  'HNTR': 'Hunter',
  'SWAMPTHING': 'Swamp Thing',
  
  // Mastercraft
  'COURS': 'Courser',
  'COURS TRL': 'Courser Trail',
  'COURS QUEST': 'Courser Quest',
  'SRT TOURING': 'SRT Touring',
  'STRATUS': 'Stratus',
  
  // More Goodyear
  'INTEGRITY': 'Integrity',
  
  // Starfire
  'SOLARUS': 'Solarus',
  
  // More Firestone  
  'FZN TOURING': 'Fuzion Touring',
  'AFFINITY': 'Affinity',
  'WEATHERGRIP': 'WeatherGrip',
  
  // Continental
  'PROCONT': 'ProContact',
  'PROCONT TX': 'ProContact TX',
  'TRUECNT': 'TrueContact',
  'VIKINGCNT': 'VikingContact',
  'SECURCNT': 'SecuriContact',
  'CRSCNT': 'CrossContact',
  'CRSCNT ATR': 'CrossContact ATR',
  'CRSCNT LX': 'CrossContact LX',
  'CRSCNT LX25': 'CrossContact LX25',
  
  // Bridgestone
  'ALZ': 'Alenza',
  'ALZ AS': 'Alenza AS',
  'ALZ PRESTGE': 'Alenza Prestige',
  'TRZ EVRDRVE': 'Turanza EverDrive',
  'ECOPIA': 'Ecopia',
  'DRVGRD': 'DriveGuard',
  'DLR': 'Dueler',
  'DLR HP SPT': 'Dueler H/P Sport',
  'DLR AT': 'Dueler A/T',
  
  // More Hankook
  'DYN': 'Dynapro',
  'DYN AT2X': 'Dynapro AT2 Xtreme',
  'DYN HT': 'Dynapro HT',
  'DYN HT2': 'Dynapro HT2',
  'DYN HPX': 'Dynapro HPX',
  'WTHRFLX': 'Weatherflex',
  'IPIKE': 'i*Pike',
  
  // More General
  'ALTMX': 'AltiMAX',
  'ALTMX 365AW': 'AltiMAX 365 AW',
  'GRAB APT': 'Grabber APT',
  
  // More Nexen
  'RDN': 'Roadian',
  'RDN GTX': 'Roadian GTX',
  'RDN ATX': 'Roadian ATX',
  'NBLU': 'N-Blue',
  'N-PRIZ': "N'Priz",
  
  // More Toyo
  'OPCNTRY': 'Open Country',
  'OPCNTRY HT2': 'Open Country H/T II',
  'OPCNTRY AT3': 'Open Country A/T III',
  'EXTENSA': 'Extensa',
  'CELSUS': 'Celsius',
  
  // More Yokohama
  'GEO': 'Geolandar',
  'GEO CV': 'Geolandar CV',
  'GEO HT': 'Geolandar H/T',
  'AVID': 'AVID',
  'ASCEND': 'Ascend',
  
  // More Falken
  'WDPK': 'Wildpeak',
  'WDPK AT TRL': 'Wildpeak A/T Trail',
  'WDPK AT4W': 'Wildpeak A/T4W',
  'SNC': 'Sincera',
  'ZX': 'Ziex',
  'AKLIMATE': 'aKlimate',
  
  // More Cooper
  'DSC': 'Discoverer',
  'DSC RD TRL': 'Discoverer Road+Trail',
  'TRACTCOMAND': 'Traction Command',
  'ENDEAVOR': 'Endeavor',
  
  // Lexani
  'LXHT': 'LX-HT',
  
  // Kelly/Goodyear
  'EDGE TOUR': 'Edge Touring',
  'SAFARI': 'Safari',
  
  // NOTE: Single-letter/short expansions at END to avoid breaking longer matches
  // These should only apply as standalone words, handled specially
};

// Standalone terrain/type abbreviations (only expand as whole words)
const STANDALONE_EXPANSIONS: Record<string, string> = {
  'AS': 'All-Season',
  'AT': 'All-Terrain',
  'HT': 'Highway Terrain',
  'MT': 'Mud-Terrain',
  'RT': 'Rugged Terrain',
  'HP': 'High Performance',
  'UHP': 'Ultra High Performance',
};

/**
 * Clean up K&M tire description
 * Removes brand prefix and expands abbreviations
 */
export function expandKmDescription(
  description: string,
  brand: string | null
): string {
  if (!description) return description;
  
  let desc = description.trim();
  
  // Remove brand prefix if present (e.g., "GY 225/65R17..." → "225/65R17...")
  const prefixMatch = desc.match(/^([A-Z]{2})\s+/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    if (BRAND_PREFIXES[prefix]) {
      desc = desc.slice(prefixMatch[0].length);
    }
  }
  
  // Remove size from description (we show it separately)
  // Matches patterns like: 225/65R17, 225/65R17/SL, P225/65R17, LT265/70R17, 33/1250R20
  desc = desc.replace(/^[P|LT]?\d{2,3}\/?\d{2,4}[A-Z]*R\d{2}[\/\*>]?[A-Z0-9]*\s*/i, '');
  
  // Protect words that shouldn't be partially expanded
  const protectedPlaceholders: Record<string, string> = {};
  let protectedDesc = desc;
  PROTECTED_WORDS.forEach((word, idx) => {
    const regex = new RegExp(word, 'gi');
    const placeholder = `__PROTECTED_${idx}__`;
    if (regex.test(protectedDesc)) {
      protectedPlaceholders[placeholder] = word;
      protectedDesc = protectedDesc.replace(regex, placeholder);
    }
  });
  
  // Expand known model abbreviations (longer patterns first)
  let expanded = protectedDesc;
  
  // Sort by length descending to match longer patterns first
  const sortedExpansions = Object.entries(MODEL_EXPANSIONS)
    .sort((a, b) => b[0].length - a[0].length);
  
  for (const [abbrev, full] of sortedExpansions) {
    // Case-insensitive replacement, but only as word boundaries
    const escaped = abbrev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    expanded = expanded.replace(regex, full);
  }
  
  // Expand standalone terrain abbreviations (AS, AT, MT, etc.)
  // Only as whole words with word boundaries
  for (const [abbrev, full] of Object.entries(STANDALONE_EXPANSIONS)) {
    const regex = new RegExp(`\\b${abbrev}\\b`, 'g');
    expanded = expanded.replace(regex, full);
  }
  
  // Restore protected words
  for (const [placeholder, original] of Object.entries(protectedPlaceholders)) {
    expanded = expanded.replace(new RegExp(placeholder, 'g'), original);
  }
  
  // Clean up any remaining artifacts
  expanded = expanded
    .replace(/\s+/g, ' ')  // Multiple spaces → single space
    .replace(/^\s+|\s+$/g, '')  // Trim
    .replace(/^[>*]\s*/, '')  // Remove leading > or *
    .replace(/^NW\s+/i, '')  // Remove "NW" prefix (sometimes appears)
    .replace(/^NEW\s+/i, '')  // Remove "NEW" prefix
    .trim();
  
  // If we have a brand and the expanded name doesn't include it, prepend it
  if (brand && expanded && !expanded.toLowerCase().startsWith(brand.toLowerCase())) {
    // Only add brand if expanded name looks like a model name (not just size)
    if (expanded.length > 3 && !/^\d/.test(expanded)) {
      return `${brand} ${expanded}`;
    }
  }
  
  return expanded || description;
}

/**
 * Extract clean model name from K&M description
 */
export function extractModelName(description: string): string | null {
  if (!description) return null;
  
  let desc = description.trim();
  
  // Remove brand prefix
  desc = desc.replace(/^[A-Z]{2}\s+/, '');
  
  // Remove size
  desc = desc.replace(/^[P|LT]?\d{3}\/\d{2}[A-Z]*R\d{2}[\/\*>]?[A-Z0-9]*\s*/i, '');
  
  // Remove load/speed rating at end (e.g., "102H", "104T")
  desc = desc.replace(/\s+\d{2,3}[A-Z]?\s*$/, '');
  
  // Clean up
  desc = desc.replace(/^[>*]\s*/, '').trim();
  
  // Expand abbreviations
  for (const [abbrev, full] of Object.entries(MODEL_EXPANSIONS)) {
    const regex = new RegExp(abbrev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    desc = desc.replace(regex, full);
  }
  
  return desc || null;
}

/**
 * Get full brand name from K&M prefix code
 */
export function expandBrandPrefix(prefix: string): string | null {
  return BRAND_PREFIXES[prefix.toUpperCase()] || null;
}
