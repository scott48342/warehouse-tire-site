/**
 * Preload Wheel-Size vehicles into local DB (batch import)
 * 
 * Does NOT attempt to import the full dataset.
 * 
 * Usage:
 *   # single model over year range
 *   npx tsx scripts/preload-vehicles.ts --make Ford --model "F-150" --startYear 2020 --endYear 2024
 * 
 *   # from a JSON config file
 *   npx tsx scripts/preload-vehicles.ts --config scripts/preload-targets.json
 */

import { importAllVehicleVariants, importVehicleFitment } from "../src/lib/fitmentImport";

type Target = {
  make: string;
  model: string;
  startYear: number;
  endYear: number;
  trims?: string[];
  allVariants?: boolean;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const delayMs = Number(args.delayMs || 250);
  const usMarketOnly = args.usMarketOnly !== "false";
  const debug = args.debug === "true";

  let targets: Target[] = [];

  if (args.config) {
    const fs = await import("node:fs");
    targets = JSON.parse(fs.readFileSync(args.config, "utf8"));
  } else {
    const make = args.make;
    const model = args.model;
    const startYear = Number(args.startYear);
    const endYear = Number(args.endYear);
    if (!make || !model || !startYear || !endYear) {
      throw new Error("Provide --config OR --make/--model/--startYear/--endYear");
    }
    targets = [{ make, model, startYear, endYear, allVariants: args.allVariants !== "false" }];
  }

  const report: any = {
    startedAt: new Date().toISOString(),
    delayMs,
    usMarketOnly,
    targets,
    results: [] as any[],
  };

  for (const t of targets) {
    for (let year = t.startYear; year <= t.endYear; year++) {
      const trims = t.trims?.length ? t.trims : [undefined];
      for (const desiredTrim of trims) {
        try {
          console.log(`\n[preload] ${year} ${t.make} ${t.model} trim=${desiredTrim || ""} allVariants=${t.allVariants !== false}`);

          if (t.allVariants !== false) {
            const res = await importAllVehicleVariants(year, t.make, t.model, { usMarketOnly, debug });
            report.results.push({ kind: "allVariants", year, ...t, desiredTrim, res });
          } else {
            const res = await importVehicleFitment(year, t.make, t.model, { desiredTrim, usMarketOnly, debug });
            report.results.push({ kind: "single", year, ...t, desiredTrim, res });
          }
        } catch (err: any) {
          console.error(`[preload] FAILED ${year} ${t.make} ${t.model}:`, err?.message || err);
          report.results.push({ kind: "error", year, ...t, desiredTrim, error: err?.message || String(err) });
        }

        await sleep(delayMs);
      }
    }
  }

  report.finishedAt = new Date().toISOString();

  const fs = await import("node:fs");
  const out = `preload-report-${Date.now()}.json`;
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\n[preload] Wrote report: ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
