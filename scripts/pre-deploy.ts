/**
 * PRE-DEPLOY SAFEGUARD RUNNER
 * 
 * Runs all integrity and coverage checks before deployment.
 * Exits with code 1 if any check fails.
 * 
 * Usage: npx tsx scripts/pre-deploy.ts
 * Add to CI: npm run pre-deploy
 * 
 * Checks run:
 * 1. Database integrity check
 * 2. Selector coverage check
 * 3. Alias resolution tests
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { spawn } from "child_process";
import * as path from "path";

// ============================================================================
// Configuration
// ============================================================================

interface CheckConfig {
  name: string;
  command: string;
  args: string[];
  required: boolean;
}

const CHECKS: CheckConfig[] = [
  {
    name: "Database Integrity",
    command: "npx",
    args: ["tsx", "scripts/integrity-check.ts"],
    required: true,
  },
  {
    name: "Selector Coverage",
    command: "npx",
    args: ["tsx", "scripts/selector-coverage-check.ts"],
    required: true,
  },
  {
    name: "Alias Resolution Tests",
    command: "npm",
    args: ["test", "--", "--testPathPattern=alias-resolution", "--passWithNoTests"],
    required: true,
  },
];

// ============================================================================
// Runner
// ============================================================================

function runCheck(config: CheckConfig): Promise<{ passed: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(config.command, config.args, {
      cwd: process.cwd(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        passed: code === 0,
        output,
      });
    });

    proc.on("error", (err) => {
      resolve({
        passed: false,
        output: `Error spawning process: ${err.message}`,
      });
    });
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PRE-DEPLOY SAFEGUARD CHECKS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  Checks to run: ${CHECKS.length}\n`);

  const results: Array<{ name: string; passed: boolean; required: boolean; output: string }> = [];

  for (const check of CHECKS) {
    console.log(`Running: ${check.name}...`);
    const start = Date.now();
    const result = await runCheck(check);
    const duration = Date.now() - start;

    results.push({
      name: check.name,
      passed: result.passed,
      required: check.required,
      output: result.output,
    });

    const status = result.passed ? "✅ PASSED" : "❌ FAILED";
    console.log(`  ${status} (${duration}ms)\n`);
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  let failed = false;

  for (const result of results) {
    const status = result.passed ? "✅" : "❌";
    const req = result.required ? "(required)" : "(optional)";
    console.log(`  ${status} ${result.name} ${req}`);

    if (!result.passed && result.required) {
      failed = true;
    }
  }

  console.log();

  if (failed) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  ❌ PRE-DEPLOY CHECKS FAILED");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Show details of failures
    for (const result of results.filter((r) => !r.passed && r.required)) {
      console.log(`\n─── ${result.name} ───`);
      console.log(result.output.slice(-2000)); // Last 2000 chars
    }

    console.log("\n⛔ Deployment blocked. Fix issues before deploying.");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  ✅ ALL PRE-DEPLOY CHECKS PASSED");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n✓ Safe to deploy.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("Pre-deploy runner error:", e);
  process.exit(1);
});
