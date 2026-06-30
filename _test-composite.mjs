import fs from "node:fs";
import sharp from "sharp";
import OpenAI from "openai";

// load OPENAI key
let OKEY = "";
for (const ln of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)/);
  if (m) OKEY = m[+"1"];
}
const openai = new OpenAI({ apiKey: OKEY });

// import the actual production module via tsx-style: we replicate detect inline
const buf = fs.readFileSync("g:/clawd/_v18_base.png");
const meta = await sharp(buf).metadata();
const W = meta.width, H = meta.height;
console.log("base", W, "x", H, "key set:", OKEY.length > 0);

const buf2 = fs.readFileSync("g:/clawd/_clean_base.png");
const dataUrl = `data:image/png;base64,${buf2.toString("base64")}`;
const prompt = `This is a ${W}x${H} pixel photo of a vehicle at a three-quarter angle (origin top-left). For each clearly visible WHEEL, locate the CENTER of the wheel hub and the wheel radius in pixels (radius reaches the outer edge of the metal wheel, not the tire). Identify FRONT (nearest/largest) and REAR if clearly visible. Give horizontal radius rx and vertical radius ry separately. Respond ONLY strict JSON: {"front":{"cx":n,"cy":n,"rx":n,"ry":n},"rear":{...}}`;

const res = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
  max_tokens: 400, temperature: 0,
});
console.log("RAW:", res.choices?.[0]?.message?.content);
