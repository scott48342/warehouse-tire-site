/**
 * Generate favicon files from source logo
 * Run: node scripts/generate-favicons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE = 'C:\\Users\\Scott-Pc\\clawd\\wtdicon.png';
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'app');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function generateFavicons() {
  console.log('Reading source image...');
  const source = sharp(SOURCE);
  const metadata = await source.metadata();
  console.log(`Source: ${metadata.width}x${metadata.height}`);

  // Ensure output directories exist
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // Generate favicon.ico (will be 32x32 PNG, browsers handle it)
  // For true .ico we'd need a different tool, but modern browsers prefer PNG
  console.log('Generating favicon.ico (32x32)...');
  await sharp(SOURCE)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'favicon.ico'));

  // Generate icon.png for Next.js App Router (this is the main one)
  console.log('Generating icon.png (32x32)...');
  await sharp(SOURCE)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'icon.png'));

  // Generate apple-icon.png (180x180 for iOS)
  console.log('Generating apple-icon.png (180x180)...');
  await sharp(SOURCE)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'apple-icon.png'));

  // Generate various sizes for public directory
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    console.log(`Generating ${name} (${size}x${size})...`);
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(path.join(PUBLIC_DIR, name));
  }

  console.log('\n✅ All favicons generated!');
  console.log('\nFiles created:');
  console.log('  src/app/favicon.ico (32x32)');
  console.log('  src/app/icon.png (32x32)');
  console.log('  src/app/apple-icon.png (180x180)');
  console.log('  public/favicon-16x16.png');
  console.log('  public/favicon-32x32.png');
  console.log('  public/apple-touch-icon.png');
  console.log('  public/android-chrome-192x192.png');
  console.log('  public/android-chrome-512x512.png');
}

generateFavicons().catch(console.error);
