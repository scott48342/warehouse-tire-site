import fs from "node:fs";
import sharp from "sharp";

const TEMPLATES = {
  sedan: { front: { cx: 0.2356, cy: 0.7394, r: 0.0776 }, rear: { cx: 0.7256, cy: 0.7394, r: 0.0776 } },
  truck: { front: { cx: 0.2364, cy: 0.7062, r: 0.0661 }, rear: { cx: 0.7278, cy: 0.7062, r: 0.0661 } },
};

async function circularMask(srcBuf) {
  const meta = await sharp(srcBuf).metadata();
  const side = Math.min(meta.width, meta.height);
  const left = Math.floor((meta.width - side) / 2), top = Math.floor((meta.height - side) / 2);
  const sq = await sharp(srcBuf).ensureAlpha().extract({ left, top, width: side, height: side }).png().toBuffer();
  const r = side / 2;
  const mask = Buffer.from(`<svg width="${side}" height="${side}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="white"/></svg>`);
  return sharp(sq).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function snapToWheel(rawData, W, H, channels, expect) {
  const pad = Math.round(expect.r * 1.8);
  const x0 = Math.max(0, expect.cx - pad), x1 = Math.min(W - 1, expect.cx + pad);
  const y0 = Math.max(0, expect.cy - pad), y1 = Math.min(H - 1, expect.cy + pad);
  const lum = (x, y) => { const i = (y * W + x) * channels; return 0.299 * rawData[i] + 0.587 * rawData[i + 1] + 0.114 * rawData[i + 2]; };
  const cs = [lum(x0, y0), lum(x1, y0), lum(x0, y1), lum(x1, y1), lum(x0, Math.round((y0 + y1) / 2)), lum(x1, Math.round((y0 + y1) / 2))];
  const bg = cs.reduce((a, b) => a + b, 0) / cs.length;
  const thresh = bg - 45;
  let sumX = 0, sumY = 0, count = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lum(x, y) < thresh) { sumX += x; sumY += y; count++; }
  const wa = (x1 - x0 + 1) * (y1 - y0 + 1);
  if (count < wa * 0.04) return { ...expect, snapped: false };
  const cx = Math.round(sumX / count), cy = Math.round(sumY / count);
  let varSum = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lum(x, y) < thresh) varSum += (x - cx) ** 2 + (y - cy) ** 2;
  const rms = Math.sqrt(varSum / count);
  let r = Math.round(rms * 1.35);
  r = Math.max(Math.round(expect.r * 0.7), Math.min(Math.round(expect.r * 1.4), r));
  const ms = expect.r * 1.5;
  const sx = Math.max(expect.cx - ms, Math.min(expect.cx + ms, cx));
  const sy = Math.max(expect.cy - ms, Math.min(expect.cy + ms, cy));
  return { cx: Math.round(sx), cy: Math.round(sy), r, snapped: true };
}

for (const cls of ["truck", "sedan"]) {
  const buf = fs.readFileSync(`g:/clawd/_lp_render_${cls}.png`);
  const wheelBuf = fs.readFileSync("g:/clawd/_w_xd852.png");
  const meta = await sharp(buf).metadata();
  const W = meta.width, H = meta.height;
  const t = TEMPLATES[cls];
  const px = (fw) => ({ cx: Math.round(fw.cx * W), cy: Math.round(fw.cy * H), r: Math.round(fw.r * W) });
  let front = px(t.front), rear = px(t.rear);
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const sf = snapToWheel(data, info.width, info.height, info.channels, front);
  const sr = snapToWheel(data, info.width, info.height, info.channels, rear);
  console.log(`${cls}: front template(${front.cx},${front.cy},r${front.r}) -> snap(${sf.cx},${sf.cy},r${sf.r}) snapped=${sf.snapped}`);
  console.log(`${cls}: rear  template(${rear.cx},${rear.cy},r${rear.r}) -> snap(${sr.cx},${sr.cy},r${sr.r}) snapped=${sr.snapped}`);
  const masked = await circularMask(wheelBuf);
  const layers = [];
  for (const c of [sf, sr]) {
    const d = c.r * 2;
    layers.push({ input: await sharp(masked).resize(d, d, { fit: "fill" }).png().toBuffer(), left: c.cx - c.r, top: c.cy - c.r });
  }
  const out = await sharp(buf).composite(layers).png().toBuffer();
  fs.writeFileSync(`g:/clawd/_lp_snapped_${cls}.png`, out);
  // diag overlay
  const ring = (c, color) => Buffer.from(`<svg width="${W}" height="${H}"><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="${color}" stroke-width="5"/></svg>`);
  const diag = await sharp(buf).composite([{ input: ring(px(t.front), "red"), left: 0, top: 0 }, { input: ring(px(t.rear), "red"), left: 0, top: 0 }, { input: ring(sf, "lime"), left: 0, top: 0 }, { input: ring(sr, "lime"), left: 0, top: 0 }]).png().toBuffer();
  fs.writeFileSync(`g:/clawd/_lp_snapdiag_${cls}.png`, diag);
}
console.log("done -> _lp_snapped_*.png, _lp_snapdiag_*.png");
