/**
 * Test the USAF branch selector end-to-end
 * Usage: npx tsx scripts/test-branch-selector.ts <destZip> <partNumber> <size> [qty]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { selectUsafBranch, getNearestWarehouses } = await import("../src/lib/usautoforce/branchSelector");

  const destZip = process.argv[2] || "78701"; // Austin TX
  const partNumber = process.argv[3] || "355530"; // Toyo Open Country A/T III 285/70R17
  const size = process.argv[4] || "285/70R17";
  const qty = parseInt(process.argv[5] || "4", 10);

  console.log(`\n=== Nearest USAF warehouses to ${destZip} ===`);
  const nearest = getNearestWarehouses(destZip, 8);
  for (const r of nearest) {
    console.log(`  ${r.warehouse.code} ${r.warehouse.metroArea} (${r.warehouse.city}, ${r.warehouse.state}) - ${r.distanceMiles} mi`);
  }

  console.log(`\n=== Selecting branch for ${qty}x ${partNumber} (${size}) -> ${destZip} ===`);
  const start = Date.now();
  const selection = await selectUsafBranch(
    [{ partNumber, quantity: qty, size }],
    destZip
  );
  console.log(`Took ${Date.now() - start}ms`);

  if (!selection) {
    console.log("No selection returned (geocode failure or no stock anywhere)");
    return;
  }

  console.log(`\nSelected: ${selection.branchCode} - ${selection.warehouse.city}, ${selection.warehouse.state} (${selection.distanceMiles} mi)`);
  console.log(`Method: ${selection.method}`);
  console.log(`Complete: ${selection.complete}`);
  console.log(`Availability:`, selection.availability);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
