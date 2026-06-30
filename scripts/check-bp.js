"use strict";
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const buf = fs.readFileSync(path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz"));
const json = zlib.gunzipSync(buf).toString("utf8");
const data = JSON.parse(json);
const wheels = Object.values(data.bySku || {});

// Show sample bolt patterns
const bpSample = new Set();
for (const w of wheels) {
  if (w.bolt_pattern_metric) bpSample.add(w.bolt_pattern_metric);
}
const bps = [...bpSample].sort();
console.log(`Total unique bolt patterns: ${bps.length}`);
console.log(`Sample BPs:`, bps.slice(0, 30).join(", "));
// Specifically look for 6x135 variants
const sixLug = bps.filter(bp => bp.startsWith("6"));
console.log(`6-lug patterns:`, sixLug.slice(0, 20).join(", "));
// Count 6x135
const cnt6135 = wheels.filter(w => w.bolt_pattern_metric === "6x135").length;
console.log(`6x135 exact count: ${cnt6135}`);
// Show first WheelPros wheel
const first = wheels[0];
console.log("\nFirst WP wheel keys:", Object.keys(first));
console.log("bolt_pattern_metric:", first.bolt_pattern_metric);
console.log("diameter:", first.diameter, "offset:", first.offset);
