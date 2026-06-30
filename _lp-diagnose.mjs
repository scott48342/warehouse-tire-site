import fs from "node:fs";
import OpenAI from "openai";
import sharp from "sharp";

const env = fs.readFileSync(".env.local", "utf8");
const getKey = (k) => (env.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"?([^\"\\r\\n]+)", "m")) || [])[1];
const openai = new OpenAI({ apiKey: getKey("OPENAI_API_KEY") });

const TEMPLATES = {
  sedan: { front: { cx: 0.2356, cy: 0.7394, r: 0.0776 }, rear: { cx: 0.7256, cy: 0.7394, r: 0.0776 } },
  truck: { front: { cx: 0.2364, cy: 0.7062, r: 0.0661 }, rear: { cx: 0.7278, cy: 0.7062, r: 0.0661 } },
};

async function detect(buf, W, H) {
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  const prompt = `${W}x${H} side-profile vehicle photo (origin top-left). Give CENTER pixel of FRONT and REAR wheel hubs + radius. ONLY JSON: {"front":{"cx":n,"cy":n,"r":n},"rear":{"cx":n,"cy":n,"r":n}}`;
  const res = await openai.chat.completions.create({
    model: "gpt-4o", messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
    max_tokens: 200, temperature: 0,
  });
  return JSON.parse(res.choices[0].message.content.match(/\{[\s\S]*\}/)[0]);
}

for (const cls of ["truck", "sedan"]) {
  const p = `g:/clawd/_lp_render_${cls}.png`;
  const buf = fs.readFileSync(p);
  const meta = await sharp(buf).metadata();
  const W = meta.width, H = meta.height;
  const t = TEMPLATES[cls];
  const tpx = { front: { cx: Math.round(t.front.cx * W), cy: Math.round(t.front.cy * H), r: Math.round(t.front.r * W) }, rear: { cx: Math.round(t.rear.cx * W), cy: Math.round(t.rear.cy * H), r: Math.round(t.rear.r * W) } };
  const det = await detect(buf, W, H);
  console.log(`\n=== ${cls} (${W}x${H}) ===`);
  console.log(`TEMPLATE: front cx=${tpx.front.cx} cy=${tpx.front.cy} r=${tpx.front.r} | rear cx=${tpx.rear.cx} cy=${tpx.rear.cy} r=${tpx.rear.r}`);
  console.log(`ACTUAL:   front cx=${det.front.cx} cy=${det.front.cy} r=${det.front.r} | rear cx=${det.rear.cx} cy=${det.rear.cy} r=${det.rear.r}`);
  console.log(`DELTA:    front dcx=${det.front.cx-tpx.front.cx} dcy=${det.front.cy-tpx.front.cy} dr=${det.front.r-tpx.front.r} | rear dcx=${det.rear.cx-tpx.rear.cx} dcy=${det.rear.cy-tpx.rear.cy} dr=${det.rear.r-tpx.rear.r}`);
  // draw both: red=template, lime=actual
  const ring = (c, color) => Buffer.from(`<svg width="${W}" height="${H}"><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="${color}" stroke-width="5"/></svg>`);
  const out = await sharp(buf).composite([
    { input: ring(tpx.front, "red"), left: 0, top: 0 }, { input: ring(tpx.rear, "red"), left: 0, top: 0 },
    { input: ring(det.front, "lime"), left: 0, top: 0 }, { input: ring(det.rear, "lime"), left: 0, top: 0 },
  ]).png().toBuffer();
  fs.writeFileSync(`g:/clawd/_lp_diag_${cls}.png`, out);
}
console.log("\ndiag images written (red=template lime=detected-actual)");
