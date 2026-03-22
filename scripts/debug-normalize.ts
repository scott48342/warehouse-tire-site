import { normalizeModel, normalizeModelForApi, normalizeMake } from '../src/lib/fitment-db/keys';

const tests = [
  { make: 'BMW', model: 'M340i' },
  { make: 'Mercedes-Benz', model: 'GLE 350' },
  { make: 'Mercedes-Benz', model: 'CLA 250' },
  { make: 'Tesla', model: 'Model 3 Long Range' },
];

console.log('Model normalization:');
for (const t of tests) {
  console.log(`  ${t.model}:`);
  console.log(`    normalizeModel      → ${normalizeModel(t.model)}`);
  console.log(`    normalizeModelForApi → ${normalizeModelForApi(t.model)}`);
  console.log(`    normalizeMake(${t.make}) → ${normalizeMake(t.make)}`);
}
