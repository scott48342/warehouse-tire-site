// End-to-end verify of locked-pose composite: locked prompt -> Flux render ->
// compositeFixedWheels at calibrated positions. Tests truck + sedan.
import fs from "node:fs";
import sharp from "sharp";

const env = fs.readFileSync(".env.local", "utf8");
const getKey = (k) => (env.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"?([^\"\\r\\n]+)", "m")) || [])[1];
const FAL = getKey("FAL_KEY");

async function falUpload(buf) {
  const init = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST", headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: "image/png", file_name: "wheel.png" }),
  });
  const { upload_url, file_url } = await init.json();
  await fetch(upload_url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(buf) });
  return file_url;
}
async function flux(prompt, imageUrl) {
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext/max", {
    method: "POST", headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_url: imageUrl, num_images: 1, aspect_ratio: "16:9", output_format: "png", safety_tolerance: "6" }),
  });
  if (!res.ok) throw new Error(`flux ${res.status}`);
  const url = (await res.json())?.images?.[0]?.url;
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

// mirror of wheelComposite locked-pose logic
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
function snapToWheel(data, W, H, ch, expect) {
  const pad = Math.round(expect.r * 1.8);
  const x0 = Math.max(0, expect.cx - pad), x1 = Math.min(W - 1, expect.cx + pad);
  const y0 = Math.max(0, expect.cy - pad), y1 = Math.min(H - 1, expect.cy + pad);
  const lum = (x, y) => { const i = (y * W + x) * ch; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
  const cs = [lum(x0, y0), lum(x1, y0), lum(x0, y1), lum(x1, y1), lum(x0, Math.round((y0 + y1) / 2)), lum(x1, Math.round((y0 + y1) / 2))];
  const bg = cs.reduce((a, b) => a + b, 0) / cs.length;
  const th = bg - 45;
  let sx = 0, sy = 0, c = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lum(x, y) < th) { sx += x; sy += y; c++; }
  const wa = (x1 - x0 + 1) * (y1 - y0 + 1);
  if (c < wa * 0.04) return expect;
  const cx = Math.round(sx / c), cy = Math.round(sy / c);
  let v = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lum(x, y) < th) v += (x - cx) ** 2 + (y - cy) ** 2;
  let r = Math.round(Math.sqrt(v / c) * 1.05);
  r = Math.max(Math.round(expect.r * 0.7), Math.min(Math.round(expect.r * 1.4), r));
  const ms = expect.r * 1.5;
  return { cx: Math.round(Math.max(expect.cx - ms, Math.min(expect.cx + ms, cx))), cy: Math.round(Math.max(expect.cy - ms, Math.min(expect.cy + ms, cy))), r };
}
async function compositeFixed(mockupBuf, wheelBuf, cls) {
  const meta = await sharp(mockupBuf).metadata();
  const W = meta.width, H = meta.height;
  const t = TEMPLATES[cls];
  const px = (fw) => ({ cx: Math.round(fw.cx * W), cy: Math.round(fw.cy * H), r: Math.round(fw.r * W) });
  const { data, info } = await sharp(mockupBuf).raw().toBuffer({ resolveWithObject: true });
  const front = snapToWheel(data, info.width, info.height, info.channels, px(t.front));
  const rear = snapToWheel(data, info.width, info.height, info.channels, px(t.rear));
  console.log(`  snap front(${front.cx},${front.cy},r${front.r}) rear(${rear.cx},${rear.cy},r${rear.r})`);
  const masked = await circularMask(wheelBuf);
  const layers = [];
  for (const c of [front, rear]) {
    const d = c.r * 2;
    const resized = await sharp(masked).resize(d, d, { fit: "fill" }).png().toBuffer();
    layers.push({ input: resized, left: c.cx - c.r, top: c.cy - c.r });
  }
  return sharp(mockupBuf).composite(layers).png().toBuffer();
}

function lockedPrompt(vehDesc) {
  return `Create a photorealistic automotive photograph of a ${vehDesc} fitted with the wheels from the reference image on all four corners. Reproduce the reference wheel faithfully (exact spoke count/shape, finish/color, lip ring, bolts, center cap). Do not restyle or substitute a different wheel.

STRICT FIXED COMPOSITION — orthographic side elevation (blueprint-style), must be identical every time:
- TRUE 90-degree broadside side profile. Driver side faces camera. Vehicle points to the RIGHT. Zero three-quarter angle, zero perspective, flat orthographic side view.
- Camera dead level at wheel-hub height, perfectly perpendicular to the vehicle's side.
- The entire vehicle is centered and fills the frame horizontally with a small even margin on each side. Both wheels fully visible and the SAME size (perfect circles, no foreshortening).
- Plain flat neutral light-grey seamless background. Even soft studio lighting. No props, people, text, or shadows on the background.

These are 17-inch wheels with all-terrain tires. Sharp focus on the wheels. Photorealistic.`;
}

const wheelBuf = fs.readFileSync("g:/clawd/_w_xd852.png");
const imageUrl = await falUpload(wheelBuf);
console.log("wheel uploaded");

for (const [cls, desc] of [["truck", "white 2024 Ford F-150 pickup truck"], ["sedan", "white 2023 Honda Accord sedan"]]) {
  console.log(`\n=== ${cls}: ${desc} ===`);
  const render = await flux(lockedPrompt(desc), imageUrl);
  fs.writeFileSync(`g:/clawd/_lp_render_${cls}.png`, render);
  const out = await compositeFixed(render, wheelBuf, cls);
  fs.writeFileSync(`g:/clawd/_lp_final_${cls}.png`, out);
  console.log(`  done -> _lp_final_${cls}.png`);
}
console.log("\nDONE");
