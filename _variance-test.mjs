import fs from "node:fs";
import OpenAI from "openai";
import sharp from "sharp";

const env = fs.readFileSync(".env.local", "utf8");
const getKey = (k) => (env.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"?([^\"\\r\\n]+)", "m")) || [])[1];
const FAL = getKey("FAL_KEY");
const openai = new OpenAI({ apiKey: getKey("OPENAI_API_KEY") });

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
  if (!res.ok) throw new Error(`flux ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const url = (await res.json())?.images?.[0]?.url;
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}
async function detect(buf, W, H) {
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  const prompt = `This is a ${W}x${H} pixel photo of a vehicle in side profile (origin top-left). Locate the CENTER pixel of the FRONT wheel hub and the REAR wheel hub, plus each wheel's radius in pixels. Respond ONLY strict JSON: {"front":{"cx":n,"cy":n,"r":n},"rear":{"cx":n,"cy":n,"r":n}}`;
  const res = await openai.chat.completions.create({
    model: "gpt-4o", messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
    max_tokens: 200, temperature: 0,
  });
  return JSON.parse(res.choices[0].message.content.match(/\{[\s\S]*\}/)[0]);
}

function rigid(desc) {
  return `Create a photorealistic automotive photograph of a ${desc} fitted with the wheels from the reference image on all four corners. Reproduce the reference wheel faithfully (exact spokes, finish, lip, cap).

STRICT FIXED COMPOSITION — orthographic side elevation (blueprint-style), must be identical every time:
- TRUE 90-degree broadside side profile. Driver side faces camera. Vehicle points to the RIGHT. Zero three-quarter angle, zero perspective, flat orthographic side view.
- Camera dead level at wheel-hub height, perfectly perpendicular to the vehicle's side.
- The entire vehicle is centered and fills the frame horizontally with a small even margin on each side. Both wheels fully visible and the SAME size (perfect circles, no foreshortening).
- Plain flat neutral light-grey seamless background. Even soft studio lighting. No props, people, text, or shadows on the background.

These are 17-inch wheels with all-terrain tires. Sharp focus on the wheels. Photorealistic.`;
}

const VEHICLES = [
  { id: "sedan", desc: "white 2023 Honda Accord sedan" },
  { id: "lifted", desc: "white 2024 Ford F-250 pickup truck with a 6-inch lift kit and oversized off-road tires" },
  { id: "suv", desc: "black 2023 Jeep Grand Cherokee SUV" },
];

const wheelBuf = fs.readFileSync("g:/clawd/_w_xd852.png");
const imageUrl = await falUpload(wheelBuf);
console.log("wheel uploaded\n");

const out = [];
for (const v of VEHICLES) {
  console.log(`=== ${v.id}: ${v.desc} ===`);
  const buf = await flux(rigid(v.desc), imageUrl);
  fs.writeFileSync(`g:/clawd/_var_${v.id}.png`, buf);
  const meta = await sharp(buf).metadata();
  const det = await detect(buf, meta.width, meta.height);
  console.log(`  ${meta.width}x${meta.height} ->`, JSON.stringify(det));
  // normalized fractions
  const nf = (d) => ({ cx: +(d.cx / meta.width).toFixed(4), cy: +(d.cy / meta.height).toFixed(4), r: +(d.r / meta.width).toFixed(4) });
  out.push({ id: v.id, W: meta.width, H: meta.height, det, normFront: nf(det.front), normRear: nf(det.rear) });
}

console.log("\n===== CROSS-BODY VARIANCE =====");
console.log("Truck baseline (XD852): front cx~329 cy~531 r~92, rear cx~1013 cy~531 r~92 @ 1392x752");
console.log("Truck normalized: front cx=0.236 cy=0.706 r=0.066, rear cx=0.728 cy=0.706 r=0.066\n");
for (const r of out) {
  console.log(`${r.id} (${r.W}x${r.H}):`);
  console.log(`  px:   front cx=${r.det.front.cx} cy=${r.det.front.cy} r=${r.det.front.r} | rear cx=${r.det.rear.cx} cy=${r.det.rear.cy} r=${r.det.rear.r}`);
  console.log(`  norm: front ${JSON.stringify(r.normFront)} | rear ${JSON.stringify(r.normRear)}`);
}
fs.writeFileSync("g:/clawd/_variance-results.json", JSON.stringify(out, null, 2));
console.log("\nsaved _variance-results.json");
