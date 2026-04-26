import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const dodgeRamcharger = {
  make: 'Dodge',
  models: ['Ramcharger'],
  boltPattern: '5x139.7',
  centerBore: 108,
  fitments: [
    { trims: ['Base', 'SE', 'LE', 'AW150', 'AD150', 'Royal SE', 'Prospector'], yearStart: 1974, yearEnd: 1993, wheelDiameter: 15, wheelWidth: 8, tireSize: 'P235/75R15' },
  ]
};

function testMatch(year, displayTrim) {
  const config = dodgeRamcharger;
  console.log(`Testing year ${year}, trim "${displayTrim}"`);
  console.log(`  Config fitments:`, config.fitments.length);
  
  const yearMatches = config.fitments.filter(tf => {
    const match = year >= tf.yearStart && year <= tf.yearEnd;
    console.log(`  Checking: ${tf.yearStart}-${tf.yearEnd}, year ${year} >= ${tf.yearStart}? ${year >= tf.yearStart}, year ${year} <= ${tf.yearEnd}? ${year <= tf.yearEnd}, match: ${match}`);
    return match;
  });
  
  console.log(`  Year matches: ${yearMatches.length}`);
  return yearMatches.length > 0;
}

// Test the problematic years
[1980, 1981, 1982, 1988, 1989].forEach(year => {
  const result = testMatch(year, 'Base');
  console.log(`  Result: ${result ? 'MATCH' : 'NO MATCH'}\n`);
});
