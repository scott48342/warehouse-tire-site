import fs from "node:fs";
import sharp from "sharp";

const env = fs.readFileSync(".env.local", "utf8");
const getKey = (k) => (env.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"?([^\"\\r\\n]+)", "m")) || [])[1];
const FAL = getKey("FAL_KEY");

async function falUpload(buf) {
  const init = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST", headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: "image/png", file_name: "x.png" }),
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
  return Buffer.from(await (await fetch((await res.json()).images[0].url)).arrayBuffer());
}
async function maskToCircle(maskBuf) {
  const { data, info } = await sharp(maskBuf).raw().toBuffer({ resolveWithObject: true });
  const c = info.channels; let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * c; const on = c === 4 ? data[i + 3] > 128 : data[i] > 128;
    if (on) { n++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  if (n < 200 || maxx < 0) return null;
  return { cx: Math.round((minx + maxx) / 2), cy: Math.round((miny + maxy) / 2), r: Math.round((maxx - minx + maxy - miny) / 4) };
}
async function detectSAM(buf) {
  const url = await falUpload(buf);
  const res = await fetch("https://fal.run/fal-ai/sam-3/image", {
    method: "POST", headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: url, prompt: "wheel", apply_mask: false, return_multiple_masks: true, max_masks: 6, output_format: "png" }),
  });
  const data = await res.json();
  const meta = await sharp(buf).metadata(); const W = meta.width, H = meta.height;
  const minR = W * 0.025, maxR = W * 0.18;
  const circles = [];
  for (const m of (data.masks || [])) {
    const mb = Buffer.from(await (await fetch(m.url)).arrayBuffer());
    const c = await maskToCircle(mb);
    if (c && c.r >= minR && c.r <= maxR) circles.push(c);
  }
  circles.sort((a, b) => b.r - a.r);
  const top = circles.slice(0, 2).sort((a, b) => a.cx - b.cx);
  return { rear: top[0], front: top[1], all: circles };
}
async function circularMask(srcBuf) {
  const meta = await sharp(srcBuf).metadata();
  const side = Math.min(meta.width, meta.height);
  const left = Math.floor((meta.width - side) / 2), top = Math.floor((meta.height - side) / 2);
  const sq = await sharp(srcBuf).ensureAlpha().extract({ left, top, width: side, height: side }).png().toBuffer();
  const r = side / 2;
  const mask = Buffer.from(`<svg width="${side}" height="${side}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="white"/></svg>`);
  return sharp(sq).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}
function lockedPrompt(v) {
  return `Create a photorealistic automotive photograph of a ${v} fitted with the wheels from the reference image on all four corners. Reproduce the reference wheel faithfully (exact spoke count/shape, finish/color, lip ring, bolts, center cap). Do not restyle or substitute a different wheel.

STRICT FIXED COMPOSITION — orthographic side elevation (blueprint-style), must be identical every time:
- TRUE 90-degree broadside side profile. Driver side faces camera. Vehicle points to the RIGHT. Zero three-quarter angle, zero perspective, flat orthographic side view.
- Camera dead level at wheel-hub height, perfectly perpendicular to the vehicle's side.
- The entire vehicle is centered and fills the frame horizontally with a small even margin on each side. Both wheels fully visible and the SAME size (perfect circles, no foreshortening).
- Plain flat neutral light-grey seamless background. Even soft studio lighting. No props, people, text, or shadows on the background.

These are 17-inch wheels with all-terrain tires. Sharp focus on the wheels. Photorealistic.`;
}

const wheelBuf = fs.readFileSync("g:/clawd/_w_xd852.png");
const wheelUrl = await falUpload(wheelBuf);
for (const [cls, desc] of [["truck", "white 2024 Ford F-150 pickup truck"], ["sedan", "white 2023 Honda Accord sedan"]]) {
  console.log(`\n=== ${cls} ===`);
  const render = await flux(lockedPrompt(desc), wheelUrl);
  fs.writeFileSync(`g:/clawd/_sam_render_${cls}.png`, render);
  const det = await detectSAM(render);
  console.log(`  SAM detected ${det.all.length}: front=${JSON.stringify(det.front)} rear=${JSON.stringify(det.rear)}`);
  const masked = await circularMask(wheelBuf);
  const layers = [];
  for (const c of [det.front, det.rear]) {
    if (!c) continue;
    const d = c.r * 2;
    layers.push({ input: await sharp(masked).resize(d, d, { fit: "fill" }).png().toBuffer(), left: c.cx - c.r, top: c.cy - c.r });
  }
  const out = await sharp(render).composite(layers).png().toBuffer();
  fs.writeFileSync(`g:/clawd/_sam_final_${cls}.png`, out);
  console.log(`  done -> _sam_final_${cls}.png`);
}
console.log("\nDONE");
