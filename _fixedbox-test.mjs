import fs from "node:fs";
import sharp from "sharp";

// FIXED boxes derived from the 3-render cluster (broadside lock):
// front cx~329 r~92, rear cx~1013 r~92, cy~531. Draw red circles to verify hit.
const FRONT = { cx: 329, cy: 531, r: 92 };
const REAR = { cx: 1013, cy: 531, r: 92 };

function ring(W, H, c, color) {
  // SVG ring overlay
  return Buffer.from(
    `<svg width="${W}" height="${H}"><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="${color}" stroke-width="5"/><line x1="${c.cx - 10}" y1="${c.cy}" x2="${c.cx + 10}" y2="${c.cy}" stroke="${color}" stroke-width="3"/><line x1="${c.cx}" y1="${c.cy - 10}" x2="${c.cx}" y2="${c.cy + 10}" stroke="${color}" stroke-width="3"/></svg>`
  );
}

for (let i = 1; i <= 3; i++) {
  const p = `g:/clawd/_pose${i}.png`;
  if (!fs.existsSync(p)) continue;
  const meta = await sharp(p).metadata();
  const W = meta.width, H = meta.height;
  const overlay = [
    { input: ring(W, H, FRONT, "red"), left: 0, top: 0 },
    { input: ring(W, H, REAR, "lime"), left: 0, top: 0 },
  ];
  const out = await sharp(p).composite(overlay).png().toBuffer();
  fs.writeFileSync(`g:/clawd/_boxcheck${i}.png`, out);
  console.log(`_boxcheck${i}.png written (front=red rear=green at fixed coords)`);
}
