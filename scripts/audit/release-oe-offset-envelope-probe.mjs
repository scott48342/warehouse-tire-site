const base = "http://localhost:3002";
async function probe(label, qs) {
  const r = await fetch(base + "/api/wheels/fitment-search?" + qs + "&loadAll=true&pageSize=500&page=1"); const j = await r.json();
  const f = j.fitment || {};
  console.log(`\n== ${label} == total ${j.totalCount} returned ${(j.results||[]).length}`);
  console.log("envelope:", JSON.stringify(f.envelope?.oem), JSON.stringify(f.envelope?.allowed), "oemOffset:", JSON.stringify(f.oemOffset), "staggered:", !!f.staggered?.isStaggered);
  const off = it => Number(it.pair ? (it.pair.role==="rear" ? it.pair.rear.offset : it.pair.front.offset) : it.properties?.offset);
  const cls={}; for (const i of j.results||[]) { const c=i.fitmentValidation.fitmentClass; cls[c]=(cls[c]||0)+1; }
  const cert=(j.results||[]).filter(i=>i.fitmentValidation.certified);
  const co=cert.map(off).filter(Number.isFinite);
  console.log("classes:", JSON.stringify(cls), "certified:", cert.length, co.length? `ET ${Math.min(...co)}..${Math.max(...co)}`:"");
  const ext=(j.results||[]).filter(i=>i.fitmentValidation.fitmentClass==="extended").map(off).filter(Number.isFinite);
  if (ext.length) console.log("extended ET range:", Math.min(...ext), "..", Math.max(...ext), "n", ext.length);
  return j;
}
const m = await probe("2020 Mustang GT Performance Pack (staggered, DB range only)", "year=2020&make=Ford&model=Mustang&trim=GT%20Performance%20Pack");
for (const sku of ["RC719855114MG15","RC719955114MG40","652-2865GBD","652-2165GBD"]) { const it=(m.results||[]).find(i=>i.sku===sku); console.log(sku, it? JSON.stringify({cls:it.fitmentValidation.fitmentClass, cert:it.fitmentValidation.certified, pairET:[it.pair?.front?.offset,it.pair?.rear?.offset]}) : "NOT IN RESULTS (excluded by geometry gate or absent)"); }
await probe("2016 Hyundai Santa Fe Base (non-staggered, DB range 35..55 only)", "year=2016&make=Hyundai&model=Santa%20Fe&trim=Base");
await probe("2020 Ford Mustang Shelby GT350 (inline per-axle offsets 35/52)", "year=2020&make=Ford&model=Mustang&trim=Shelby%20GT350");
