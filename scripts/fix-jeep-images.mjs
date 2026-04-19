import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

const jeepImage = 'https://www.morimotohid.com/images/Item%20Images/156524.JeepJL_2Banger_Light_Bar_System.010.jpg';

const skus = [
  'BAF081-2BKIT-HXB-W', 'BAF081-2BKIT-HXB-Y', 'BAF081-2BKIT-NCS-W', 'BAF081-2BKIT-NCS-Y',
  'BAF081-4BKIT-HXB-W', 'BAF081-4BKIT-HXB-Y', 'BAF081-4BKIT-NCS-W', 'BAF081-4BKIT-NCS-Y',
  'BAF081-BBKIT-HXB-W', 'BAF081-BBKIT-HXB-Y', 'BAF081-BBKIT-NCS-W', 'BAF081-BBKIT-NCS-Y',
];

for (const sku of skus) {
  await pool.query('UPDATE accessories SET image_url = $1 WHERE sku = $2', [jeepImage, sku]);
  console.log('Updated:', sku);
}

console.log('Done! Updated', skus.length, 'Jeep products');
await pool.end();
