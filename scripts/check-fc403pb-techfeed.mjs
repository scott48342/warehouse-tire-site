import fs from "fs";
import path from "path";
import zlib from "zlib";

const techfeedPath = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");

console.log("Loading techfeed from:", techfeedPath);

const buf = fs.readFileSync(techfeedPath);
const json = zlib.gunzipSync(buf).toString("utf8");
const data = JSON.parse(json);

console.log("Total SKUs:", Object.keys(data.bySku).length);
console.log("Generated at:", data.generatedAt);

// Check for FC403PB
const fc403pb = data.bySku["FC403PB20906301"];
console.log("\nFC403PB20906301 in techfeed:", !!fc403pb);

if (fc403pb) {
  console.log("  Bolt pattern metric:", fc403pb.bolt_pattern_metric);
  console.log("  Bolt pattern standard:", fc403pb.bolt_pattern_standard);
  console.log("  Product desc:", fc403pb.product_desc);
  console.log("  MSRP:", fc403pb.msrp);
}

// Count FC403 variants
const fc403Keys = Object.keys(data.bySku).filter(k => k.startsWith("FC403"));
console.log("\nAll FC403 SKUs:", fc403Keys.length);
fc403Keys.forEach(k => console.log(" -", k));

// Check bolt pattern index for 6x135
const bp = "6x135";
const matching = Object.values(data.bySku).filter(w => {
  const bp1 = (w.bolt_pattern_metric || "").toLowerCase().replace(/\s/g, "");
  const bp2 = (w.bolt_pattern_standard || "").toLowerCase().replace(/\s/g, "");
  return bp1.includes(bp) || bp2.includes(bp);
});
console.log("\nWheels with 6x135 bolt pattern:", matching.length);

// Check if FC403PB is among them
const fc403in6x135 = matching.filter(w => w.sku?.startsWith("FC403PB"));
console.log("FC403PB in 6x135 set:", fc403in6x135.length);
