import fs from "node:fs";
import OpenAI from "openai";

// ── keys ──
const env = fs.readFileSync(".env.local", "utf8");
const getKey = (k) => (env.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"?([^\"\\r\\n]+)", "m")) || [])[1];
const FAL = getKey("FAL_KEY");
const openai = new OpenAI({ apiKey: getKey("OPENAI_API_KEY") });

// ── fal upload ──
async function falUpload(buf) {
  const init = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: "image/png", file_name: "wheel.png" }),
  });
  const { upload_url, file_url } = await init.json();
  await fetch(upload_url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(buf) });
  return file_url;
}

async function flux(prompt, imageUrl) {
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext/max", {
    method: "POST",
    headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_url: imageUrl, num_images: 1, aspect_ratio: "16:9", output_format: "png", safety_tolerance: "6" }),
  });
  if (!res.ok) throw new Error(`flux ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return buf;
}

// ── vision: wheel centers + radius ──
async function detect(buf, W, H) {
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  const prompt = `This is a ${W}x${H} pixel photo of a vehicle (origin top-left). Locate the CENTER pixel of the FRONT wheel hub and the REAR wheel hub, plus each wheel's radius in pixels (radius = outer edge of the metal wheel). Respond ONLY strict JSON: {"front":{"cx":n,"cy":n,"r":n},"rear":{"cx":n,"cy":n,"r":n}}`;
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
    max_tokens: 200, temperature: 0,
  });
  const m = res.choices[0].message.content.match(/\{[\s\S]*\}/);
  return JSON.parse(m[0]);
}

// ── RIGID POSE PROMPT ──
// Lock everything about composition so wheel positions are repeatable.
const RIGID = `A photorealistic studio product photograph of a white 2024 Ford F-150 pickup truck, shown in PERFECT LEFT-SIDE PROFILE (broadside). The truck's front (grille and headlights) is on the RIGHT side of the frame and the truck bed is on the LEFT side. The truck faces to the right.

This is a flat orthographic side elevation, like a vehicle blueprint or a car-configurator side view:
- ZERO perspective, ZERO three-quarter angle, ZERO yaw. The camera is exactly perpendicular to the truck's left flank.
- Both wheels appear as PERFECT CIRCLES (not ellipses), identical size, hub centers on one horizontal line.
- Camera at wheel-hub height, perfectly level.
- The truck is centered and fills ~90% of the frame width. Both wheels fully visible.
- Plain seamless light-grey studio background. Even soft lighting. No props, no people, no text.

Fit the wheels from the reference image on the truck (exact spokes, finish, lip, cap), 17-inch with all-terrain tires. Sharp focus on the wheels. Photorealistic.`;

// ── run ──
const wheelBuf = fs.readFileSync("g:/clawd/_w_xd852.png");
const sharp = (await import("sharp")).default;
console.log("uploading wheel...");
const imageUrl = await falUpload(wheelBuf);
console.log("wheel url ok");

const results = [];
for (let i = 1; i <= 3; i++) {
  console.log(`\n=== render ${i} ===`);
  const buf = await flux(RIGID, imageUrl);
  const path = `g:/clawd/_pose${i}.png`;
  fs.writeFileSync(path, buf);
  const meta = await sharp(buf).metadata();
  const det = await detect(buf, meta.width, meta.height);
  console.log(`size ${meta.width}x${meta.height} ->`, JSON.stringify(det));
  results.push({ i, W: meta.width, H: meta.height, det });
}

// ── analyze spread ──
function stats(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
  return { mean: Math.round(mean), sd: Math.round(sd), min: Math.min(...arr), max: Math.max(...arr), range: Math.max(...arr) - Math.min(...arr) };
}
console.log("\n\n===== SPREAD ANALYSIS (lower range = more repeatable) =====");
for (const wheel of ["front", "rear"]) {
  for (const ax of ["cx", "cy", "r"]) {
    const vals = results.map((r) => r.det[wheel][ax]);
    console.log(`${wheel}.${ax}:`, JSON.stringify(stats(vals)), "raw:", JSON.stringify(vals));
  }
}
fs.writeFileSync("g:/clawd/_pose-results.json", JSON.stringify(results, null, 2));
console.log("\nsaved g:/clawd/_pose-results.json");
