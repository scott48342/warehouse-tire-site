import * as fs from "fs";

const list = JSON.parse(fs.readFileSync("scripts/research-list.json", "utf-8"));

const byMake: Record<string, {count: number, records: number}> = {};

for (const item of list) {
  if (!byMake[item.make]) byMake[item.make] = { count: 0, records: 0 };
  byMake[item.make].count++;
  byMake[item.make].records += item.recordCount;
}

const sorted = Object.entries(byMake).sort((a, b) => b[1].records - a[1].records);

console.log("Make | Models | Records");
console.log("-----|--------|--------");
let totalModels = 0;
let totalRecords = 0;
for (const [make, data] of sorted) {
  console.log(`${make} | ${data.count} | ${data.records}`);
  totalModels += data.count;
  totalRecords += data.records;
}
console.log("-----|--------|--------");
console.log(`TOTAL | ${totalModels} | ${totalRecords}`);
