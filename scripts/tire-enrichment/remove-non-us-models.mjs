/**
 * Remove region-specific (non-US market) vehicles from fitment database
 */

import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Non-US market models to remove (model names, case-insensitive)
const NON_US_MODELS = [
  // Acura - Canada/Asia only
  "cdx", "csx", "el", "integra-dc5", "tsx-sport-wagon",
  
  // Honda - Asia/Europe only
  "amaze", "br-v", "brio", "city", "civic-ferio", "capa", "concerto",
  "crossroad", "crider", "cr-z", "elysion", "fit-aria", "fit-shuttle",
  "freed", "grace", "greiz", "hrv", "inspire", "jade", "jazz", "jazz-crosstar",
  "legend", "life", "mobilio", "n-box", "n-one", "n-van", "n-wgn", "s660",
  "shuttle", "spike", "spirior", "step-wgn", "stepwgn", "stream", "that's",
  "torneo", "vezel", "wr-v", "zest", "zr-v", "e-ns2", "e-ny1", "s7",
  
  // Toyota - Japan/Asia only
  "alphard", "aqua", "aygo", "aygo-x", "belta", "bz3x", "bz5", "camry-hybrid",
  "carina", "century", "copen", "corolla-axio", "corolla-fielder", "corolla-rumion",
  "corolla-sport", "corolla-x", "crown-signia", "esquire", "etios", "fortuner",
  "glanza", "granvia", "harrier", "hiace", "hilux", "innova", "ist", "kluger",
  "land-cruiser-prado", "levin", "lite-ace", "mark-ii", "mark-x", "noah", "passo",
  "pixis", "porte", "premio", "proace", "probox", "raize", "raum", "reiz",
  "roomy", "rush", "sienna-le", "sienta", "spade", "starlet", "succeed",
  "tank", "urban-cruiser", "vellfire", "vios", "vitz", "voxy", "wish", "yaris-cross",
  
  // Nissan - Japan/Asia only  
  "ad", "almera", "aura", "bluebird", "caravan", "cima", "civilian", "clipper",
  "cube", "dayz", "elgrand", "expert", "fuga", "gloria", "juke", "kait", "kicks-play",
  "lafesta", "latio", "laurel", "livina", "march", "micra", "moco", "n6", "navara",
  "note", "np300", "otti", "patrol", "pino", "pixo", "presage", "primera", "pulsar",
  "qashqai", "roox", "safari", "serena", "skyline", "stagea", "sunny", "sylphy",
  "teana", "terrano", "tiida", "townstar", "wingroad", "x-trail",
  
  // Hyundai - Korea/Europe only
  "accent", "alcazar", "aura", "avante", "avante-n", "azera", "bayon", "casper",
  "casper-electric", "creta", "creta-grand", "custin", "elantra-n", "exter",
  "grand-creta", "grand-i10", "grandeur", "i10", "i20", "i30", "i40", "ix20",
  "ix35", "kona-n", "matrix", "solaris", "starex", "staria", "trajet", "veloster-n",
  "venue", "verna", "xcent",
  
  // Kia - Korea/Europe only
  "carens", "carens-clavis", "carnival", "ceed", "cerato", "clavis", "ev3", "ev4",
  "ev5", "k3", "k3-cross", "k4", "k5", "k7", "k8", "k9", "lotze", "mohave",
  "morning", "niro-ev", "opirus", "optima-hybrid", "pegas", "picanto", "pride",
  "pro-ceed", "pv5", "ray", "rio", "shuma", "sonet", "spectra", "stinger-gt",
  "stonic", "venga", "xceed",
  
  // Subaru - Japan only
  "chiffon", "chiffon-custom", "chiffon-try", "dex", "dias", "domingo", "evoltis",
  "exiga", "justy", "levorg", "levorg-layback", "lucra", "pleo", "r1", "r2",
  "rex", "sambar", "stella", "trailseeker", "trezia", "uncharted", "wrx-s4",
  "e-outback",
  
  // Mazda - Japan/Europe only
  "6e", "atenza", "axela", "biante", "bongo", "bongo-brawny", "bongo-brawny-van",
  "bongo-truck", "bongo-van", "capella", "carol", "cx-3", "cx-60", "cx-80", "demio",
  "ez-6", "flair", "mazda2", "mazda6", "mpv", "premacy", "proceed", "scrum",
  "sentia", "tribute", "verisa",
  
  // Volkswagen - Europe only
  "amarok", "arteon-shooting-brake", "bora", "caddy", "california", "caravelle",
  "cc", "cross-sport", "crafter", "eos", "fox", "gol", "golf-alltrack", 
  "golf-gti", "golf-r", "golf-r-variant", "golf-sportsvan", "golf-variant",
  "grand-california", "id-3", "id-4-x", "id-5", "id-6", "id-7", "id-buzz", "lamando",
  "lavida", "lupo", "multivan", "new-beetle", "passat-alltrack", "passat-cc",
  "passat-variant", "phideon", "phaeton", "polo", "polo-gti", "sagitar", "santana",
  "saveiro", "scirocco", "sharan", "t-cross", "t-roc", "tayron", "tharu", "touran",
  "transporter", "up", "variant", "vento", "voyage",
  
  // Ford - International only
  "b-max", "c-max", "capri-ev", "ecosport", "edge", "endura", "equator",
  "equator-sport", "escort", "everest", "figo", "fiesta-st", "focus-rs",
  "focus-st", "fusion-hybrid", "galaxy", "ka", "kuga", "lobo", "mondeo",
  "mondeo-sport", "puma", "s-max", "territory", "tourneo", "tourneo-connect",
  "tourneo-courier", "tourneo-custom", "transit-connect", "transit-courier",
  "transit-custom",
  
  // Chevrolet - International only
  "agile", "aveo", "captiva", "celta", "cheyenne", "cobalt", "corsa", "cruze",
  "enjoy", "epica", "groove", "joy", "kalos", "lacetti", "lanos", "lova",
  "matiz", "meriva", "montana", "n300", "n400", "nubira", "onix", "onix-plus",
  "optra", "orlando", "prisma", "rezzo", "s10", "sail", "sonic", "spin",
  "tavera", "tornado", "tracker", "vectra", "vivant", "zafira",
  
  // GMC - Commercial/non-passenger
  "savana-2500", "savana-3500", "express-max",
  
  // Dodge - International/discontinued
  "attitude", "forza", "i10", "journey", "neon", "stratus",
  
  // Ram - International
  "1200", "4000", "700", "rampage", "promaster-city",
  
  // Jeep - International
  "avenger", "commander", "jt", "meridian",
  
  // Mitsubishi - Asia only
  "adventure", "asx", "attrage", "cedia", "colt", "delica", "dignity", "ek",
  "ek-cross", "ek-space", "ek-wagon", "ek-x", "freeca", "galant-fortis", "grandis",
  "i-miev", "jolie", "l200", "lancer-cargo", "lancer-evo", "lancer-fortis",
  "libero", "minica", "minicab", "montero-sport", "nativa", "pajero", "pajero-io",
  "pajero-mini", "pajero-pinin", "pajero-sport", "proud", "raider", "rvr",
  "savrin", "space-gear", "space-star", "space-wagon", "strada", "toppo",
  "town-box", "triton", "xpander", "zinger",
  
  // Infiniti - Non-US naming
  "esq", "ex25", "ex30d", "ex35", "ex37", "fx30d", "fx35", "fx37", "fx45",
  "fx50", "g20", "g25", "g35", "g37", "i30", "i35", "j30", "jx35", "m25",
  "m30", "m35", "m37", "m45", "m56", "q40", "q50l", "q60-red-sport", "q70l",
  "qx30",
  
  // Genesis - Korea only naming
  "g70-shooting-brake", "gv60", "gv70-electrified", "x",
  
  // Lexus - Japan only
  "ct", "hs", "lfa", "lm", "ls-hybrid", "nx-hybrid", "rx-hybrid", "sc",
  
  // BMW - Non-US specific
  "1-series", "2-series-active-tourer", "2-series-gran-coupe", "2-series-gran-tourer",
  "3-series-gran-turismo", "5-series-gran-turismo", "6-series-gran-turismo",
  "active-hybrid", "gran-coupe", "i3", "ix1",
  
  // Audi - Non-US specific  
  "a1", "a2", "a3-limousine", "a6-allroad", "q2", "q4", "rs-q3", "s1", "sq2",
  
  // Mercedes - Non-US specific
  "a-class", "b-class", "citan", "r-class", "v-class", "viano", "vito", "x-class",
];

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("Removing non-US market models from fitment database");
  console.log("Dry run:", dryRun);
  console.log("");
  
  // First, count what we'll delete
  let totalToDelete = 0;
  const deleteCounts = {};
  
  for (const model of NON_US_MODELS) {
    const countResult = await pool.query(
      "SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(model) = LOWER($1)",
      [model]
    );
    const count = parseInt(countResult.rows[0].cnt, 10);
    if (count > 0) {
      deleteCounts[model] = count;
      totalToDelete += count;
    }
  }
  
  console.log("Models to delete:", Object.keys(deleteCounts).length);
  console.log("Total records to delete:", totalToDelete);
  console.log("");
  
  // Show top models by count
  const sortedModels = Object.entries(deleteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  
  console.log("Top 30 models by record count:");
  for (const [model, count] of sortedModels) {
    console.log("  " + model + ": " + count);
  }
  console.log("");
  
  if (dryRun) {
    console.log("[DRY RUN] Would delete " + totalToDelete + " records");
    await pool.end();
    return;
  }
  
  // Actually delete
  console.log("Deleting records...");
  let deleted = 0;
  
  for (const model of NON_US_MODELS) {
    const result = await pool.query(
      "DELETE FROM vehicle_fitments WHERE LOWER(model) = LOWER($1)",
      [model]
    );
    if (result.rowCount > 0) {
      deleted += result.rowCount;
      process.stdout.write(".");
    }
  }
  
  console.log("\n");
  console.log("Deleted " + deleted + " records");
  
  // Final count
  const remaining = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments");
  const missingTires = await pool.query(
    "SELECT COUNT(*) as cnt FROM vehicle_fitments " +
    "WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]'"
  );
  
  console.log("");
  console.log("Final state:");
  console.log("  Total fitments: " + remaining.rows[0].cnt);
  console.log("  Missing tire sizes: " + missingTires.rows[0].cnt);
  console.log("  Coverage: " + ((1 - missingTires.rows[0].cnt / remaining.rows[0].cnt) * 100).toFixed(1) + "%");
  
  await pool.end();
}

main().catch(console.error);
