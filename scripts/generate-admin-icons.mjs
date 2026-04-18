/**
 * Generate admin PWA icons using sharp
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const sizes = [192, 512];

for (const size of sizes) {
  // Create SVG with red background and white "WT" text
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#dc2626"/>
          <stop offset="100%" style="stop-color:#991b1b"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#bg)"/>
      <text 
        x="50%" 
        y="54%" 
        font-family="Arial, sans-serif" 
        font-size="${size * 0.4}" 
        font-weight="bold" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >WT</text>
    </svg>
  `;

  const outPath = path.join(publicDir, `admin-icon-${size}.png`);
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outPath);
  
  console.log(`Created: admin-icon-${size}.png`);
}

console.log('Done!');
