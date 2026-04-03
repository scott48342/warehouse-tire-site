const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get a variety of popular wheels with pricing data
  const wheels = await prisma.$queryRaw`
    SELECT 
      sku, 
      brand, 
      model, 
      finish,
      diameter,
      width,
      cost,
      map,
      msrp
    FROM wheels 
    WHERE (cost IS NOT NULL OR map IS NOT NULL)
      AND diameter IN (17, 18, 20, 22)
      AND brand IN ('Fuel', 'American Racing', 'KMC', 'Moto Metal', 'XD', 'Hostile', 'Vision')
    ORDER BY brand, model
    LIMIT 20
  `;
  
  // Calculate our sell price using 30% markup
  const results = wheels.map(w => {
    const cost = w.cost ? parseFloat(w.cost) : null;
    const map = w.map ? parseFloat(w.map) : null;
    const msrp = w.msrp ? parseFloat(w.msrp) : null;
    
    let sellPrice, method;
    if (cost && cost > 1) {
      sellPrice = Math.round(cost * 1.30 * 100) / 100;
      method = 'cost×1.30';
    } else if (map && map > 1) {
      sellPrice = Math.round(map * 1.30 * 100) / 100;
      method = 'map×1.30';
    } else if (msrp && msrp > 1) {
      sellPrice = Math.round(msrp * 0.85 * 100) / 100;
      method = 'msrp×0.85';
    } else {
      sellPrice = null;
      method = 'none';
    }
    
    return {
      sku: w.sku,
      brand: w.brand,
      model: w.model,
      size: `${w.diameter}x${w.width}`,
      cost: cost,
      map: map,
      msrp: msrp,
      ourPrice: sellPrice,
      method: method
    };
  });
  
  console.log(JSON.stringify(results, null, 2));
}

main().finally(() => prisma.$disconnect());
