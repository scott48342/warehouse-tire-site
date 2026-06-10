import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load vehicles.json to find AMC AMX fitment data
const vehicles = JSON.parse(fs.readFileSync(path.join(__dirname, 'vehicles.json')));

// Find AMC AMX
const amx = vehicles.filter(v => v.make === 'AMC' && v.model === 'AMX');
console.log('AMC AMX vehicles found:', amx.length);
console.log();

amx.forEach(v => {
  console.log(`${v.year} ${v.make} ${v.model} ${v.trim}`);
  console.log('  ID:', v.id);
  console.log('  Bolt pattern:', v.boltPattern);
  console.log('  Center bore:', v.centerBore);
  console.log('  Wheel diameters:', v.wheelDiams);
  console.log('  Tire sizes:', v.tireSizes);
  console.log('  Modern tire sizes:', v.modernTireSizes);
  console.log('  Offset min:', v.offsetMin);
  console.log('  Offset max:', v.offsetMax);
  console.log();
});
