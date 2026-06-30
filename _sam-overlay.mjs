import sharp from "sharp";
import fs from "node:fs";
const W = 1392, H = 752;
const ring = (cx, cy, r, col) => Buffer.from(`<svg width="${W}" height="${H}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="5"/></svg>`);
const out = await sharp("g:/clawd/_lp_render_truck.png").composite([
  { input: ring(302, 476, 98, "lime"), left: 0, top: 0 },
  { input: ring(1062, 476, 97, "lime"), left: 0, top: 0 },
]).png().toBuffer();
fs.writeFileSync("g:/clawd/_sam_overlay_truck.png", out);
console.log("written");
