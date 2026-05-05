/**
 * Estimate international shipping costs for wheels + tires
 * 
 * Typical package specs for 20" wheels with 275/55R20 tires (mounted):
 * - Per wheel/tire: ~55 lbs, 32"x32"x12" box
 * - Set of 4: ~220 lbs actual, but DIM weight is killer
 * 
 * DIM weight formula: (L x W x H) / DIM factor
 * - DHL/FedEx/UPS international: DIM factor = 139 (inches) or 5000 (cm)
 */

// Package specs for mounted wheel + tire
const WHEEL_TIRE_SPECS = {
  small: { // 17-18" wheel with tire
    actualLbs: 45,
    lengthIn: 28,
    widthIn: 28,
    heightIn: 10,
    description: "17-18\" wheel + tire"
  },
  medium: { // 20" wheel with tire  
    actualLbs: 55,
    lengthIn: 32,
    widthIn: 32,
    heightIn: 12,
    description: "20\" wheel + tire"
  },
  large: { // 22-24" wheel with tire
    actualLbs: 70,
    lengthIn: 36,
    widthIn: 36,
    heightIn: 14,
    description: "22-24\" wheel + tire"
  }
};

// DIM factor for international (inches)
const DIM_FACTOR = 139;

function calculateDimWeight(l, w, h) {
  return Math.ceil((l * w * h) / DIM_FACTOR);
}

function getBillableWeight(actualLbs, dimWeight) {
  return Math.max(actualLbs, dimWeight);
}

// Rough rate estimates per lb for different carriers/destinations
// These are ballpark - actual rates vary by account, volume, etc.
const RATE_ESTIMATES = {
  canada: {
    ground: { perLb: 0.80, minCharge: 25, transitDays: "5-7" },
    express: { perLb: 2.50, minCharge: 75, transitDays: "2-3" },
  },
  australia: {
    economy: { perLb: 4.00, minCharge: 150, transitDays: "10-14" },
    express: { perLb: 8.00, minCharge: 250, transitDays: "3-5" },
  },
  uk: {
    economy: { perLb: 3.50, minCharge: 125, transitDays: "7-10" },
    express: { perLb: 7.00, minCharge: 200, transitDays: "2-4" },
  },
  germany: {
    economy: { perLb: 3.75, minCharge: 130, transitDays: "7-10" },
    express: { perLb: 7.50, minCharge: 220, transitDays: "2-4" },
  },
  mexico: {
    ground: { perLb: 1.20, minCharge: 35, transitDays: "5-8" },
    express: { perLb: 3.50, minCharge: 100, transitDays: "2-4" },
  }
};

console.log("═".repeat(70));
console.log("INTERNATIONAL SHIPPING ESTIMATES - WHEELS + TIRES (SET OF 4)");
console.log("═".repeat(70));
console.log("\n⚠️  These are ROUGH ESTIMATES based on typical freight rates.");
console.log("    Actual rates vary by carrier, account level, and current fuel surcharges.\n");

for (const [size, specs] of Object.entries(WHEEL_TIRE_SPECS)) {
  console.log("─".repeat(70));
  console.log(`📦 ${specs.description.toUpperCase()}`);
  console.log("─".repeat(70));
  
  // Per package
  const dimWeight = calculateDimWeight(specs.lengthIn, specs.widthIn, specs.heightIn);
  const billablePerPkg = getBillableWeight(specs.actualLbs, dimWeight);
  
  // Set of 4
  const totalActual = specs.actualLbs * 4;
  const totalBillable = billablePerPkg * 4;
  
  console.log(`\nPer wheel/tire package:`);
  console.log(`  Actual weight: ${specs.actualLbs} lbs`);
  console.log(`  Dimensions: ${specs.lengthIn}" x ${specs.widthIn}" x ${specs.heightIn}"`);
  console.log(`  DIM weight: ${dimWeight} lbs`);
  console.log(`  Billable weight: ${billablePerPkg} lbs (${billablePerPkg > specs.actualLbs ? 'DIM' : 'actual'})`);
  
  console.log(`\nSet of 4:`);
  console.log(`  Actual weight: ${totalActual} lbs`);
  console.log(`  Billable weight: ${totalBillable} lbs`);
  
  console.log(`\nEstimated shipping costs to:`);
  
  for (const [dest, rates] of Object.entries(RATE_ESTIMATES)) {
    const flag = { canada: '🇨🇦', australia: '🇦🇺', uk: '🇬🇧', germany: '🇩🇪', mexico: '🇲🇽' }[dest];
    console.log(`\n  ${flag} ${dest.toUpperCase()}:`);
    
    for (const [service, rate] of Object.entries(rates)) {
      const cost = Math.max(totalBillable * rate.perLb, rate.minCharge);
      console.log(`     ${service.padEnd(8)}: $${cost.toFixed(0).padStart(4)} (${rate.transitDays} days)`);
    }
  }
  
  console.log("");
}

console.log("═".repeat(70));
console.log("KEY TAKEAWAYS:");
console.log("═".repeat(70));
console.log(`
1. DIM WEIGHT KILLS YOU
   - A 20" wheel+tire box is 32x32x12 = 8,847 cubic inches
   - DIM weight: 64 lbs vs actual 55 lbs
   - You're billed on the HIGHER number

2. CANADA IS REASONABLE
   - Ground shipping ~$200-300 for a set
   - Could add ~$50-75/set to cover shipping
   - Still competitive with local Canadian retailers

3. AUSTRALIA/UK ARE EXPENSIVE  
   - $500-1000+ per set for economy
   - Only viable for high-margin specialty items
   - Would need to charge $150-250 shipping

4. CONSIDER THESE OPTIONS:
   - Freight consolidator (LTL rates are better)
   - Pallet shipping vs individual boxes
   - Sea freight for Australia (2-4 weeks, much cheaper)
   - Partner with local distributors
`);
