import fs from "node:fs";
import sharp from "sharp";

const env = fs.readFileSync(".env.local", "utf8");
const getKey = (k) => (env.match(new RegExp("^\\s*" + k + "\\s*=\\s*\"?([^\"\\r\\n]+)", "m")) || [])[1];
const FAL = getKey("FAL_KEY");

async function falUpload(buf) {
  const init = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST", headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: "image/png", file_name: "render.png" }),
  });
  const { upload_url, file_url } = await init.json();
  await fetch(upload_url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(buf) });
  return file_url;
}

const buf = fs.readFileSync("g:/clawd/_lp_render_truck.png");
const meta = await sharp(buf).metadata();
console.log("render", meta.width, "x", meta.height);
const url = await falUpload(buf);
console.log("uploaded:", url);

const res = await fetch("https://fal.run/fal-ai/sam-3/image", {
  method: "POST",
  headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    image_url: url,
    prompt: "wheel",
    apply_mask: false,
    return_multiple_masks: true,
    max_masks: 4,
    output_format: "png",
  }),
});
console.log("status", res.status);
const data = await res.json();
// Print the shape (keys + small sample) so we learn the output schema.
console.log("TOP KEYS:", Object.keys(data));
console.log(JSON.stringify(data, null, 2).slice(0, 3000));
fs.writeFileSync("g:/clawd/_sam-response.json", JSON.stringify(data, null, 2));
