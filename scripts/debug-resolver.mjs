import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

// Import the resolver
const { resolveVehicleFitment } = await import('../src/lib/fitment/canonicalResolver.js');

const result = await resolveVehicleFitment({
  year: 2024,
  make: 'BMW',
  model: 'M3',
  trim: 'M3 CS'
});

console.log('Resolver result for 2024 BMW M3 "M3 CS":');
console.log(JSON.stringify(result, null, 2));
