/**
 * Test USAF branch-aware freight origin resolution
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { resolveOriginForItems } = await import("../src/lib/shipping/fedexRates");

  // Case 1: Pure USAF cart -> Austin, TX
  const usafCart = [
    { type: "tire" as const, quantity: 4, weightLbs: 55, source: "usautoforce", sizeLabel: "285/70R17", partNumber: "355530" },
  ];
  console.log("=== Case 1: 4x Toyo A/T III (USAF) -> Austin 78701 ===");
  console.log(await resolveOriginForItems(usafCart, "78701"));

  // Case 2: Same cart -> Detroit-area customer
  console.log("\n=== Case 2: same cart -> Royal Oak MI 48067 ===");
  console.log(await resolveOriginForItems(usafCart, "48067"));

  // Case 3: Mixed cart (USAF tire + WheelPros wheel) -> should stay Pontiac
  const mixedCart = [
    ...usafCart,
    { type: "wheel" as const, quantity: 4, weightLbs: 30, source: "wheelpros", partNumber: "D67920908450" },
  ];
  console.log("\n=== Case 3: mixed USAF+WheelPros -> Austin 78701 (expect Pontiac) ===");
  console.log(await resolveOriginForItems(mixedCart, "78701"));

  // Case 4: USAF item missing partNumber -> fallback Pontiac
  const noPartCart = [
    { type: "tire" as const, quantity: 4, weightLbs: 55, source: "usautoforce", sizeLabel: "285/70R17" },
  ];
  console.log("\n=== Case 4: USAF w/o partNumber (expect Pontiac fallback) ===");
  console.log(await resolveOriginForItems(noPartCart, "78701"));
}

main().catch(err => { console.error(err); process.exit(1); });
