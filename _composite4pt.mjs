import fs from "node:fs";
import KEY from "./_falkey.mjs";
import { warpToQuad } from "./_warp.mjs";
const sharp = (await import("sharp")).default;

// args: mock wheel label  top right bottom left (each "x,y")  [blendStrength] [desc]
const [MOCK, WHEEL, LABEL, TOP, RIGHT, BOTTOM, LEFT] = process.argv.slice(2);
const BLEND = Number(process.argv[9] || "0.25");
const DESC = process.argv[10] || "the wheel shown";
const p = s => s.split(",").map(Number);
const top = p(TOP), right = p(RIGHT), bottom = p(BOTTOM), left = p(LEFT);

const meta = await sharp(MOCK).metadata();
const W = meta.width, H = meta.height;

// Build the destination quad (TL,TR,BR,BL) from the 4 ellipse extreme points.
// The source wheel image corners map to the diagonals between extremes:
//   TL ~ between left & top, TR ~ between top & right, BR ~ between right & bottom, BL ~ between bottom & left
// The 4 extreme points define the ellipse. Build a quad whose EDGE MIDPOINTS
// sit on these extremes, so the full source-image square maps to the full
// ellipse extent (a circle inscribed in the quad touches all 4 extremes).
//   TL = top + left - center,  TR = top + right - center, etc.
const cx = (left[0]+right[0])/2;
const cy = (top[1]+bottom[1])/2;
const corner = (a,b) => [a[0]+b[0]-cx, a[1]+b[1]-cy];
let TL = corner(top, left);
let TR = corner(top, right);
let BR = corner(bottom, right);
let BL = corner(bottom, left);
// Scale the quad outward from its center to fully cover the wheel (kill the
// residual ring of the underlying wheel). SCALE tunable via arg.
const SCALE = Number(process.argv[11] || "1.12");
const qcx = (TL[0]+TR[0]+BR[0]+BL[0])/4, qcy = (TL[1]+TR[1]+BR[1]+BL[1])/4;
const grow = pt => [qcx + (pt[0]-qcx)*SCALE, qcy + (pt[1]-qcy)*SCALE];
TL = grow(TL); TR = grow(TR); BR = grow(BR); BL = grow(BL);
const quad = [TL, TR, BR, BL];
console.log("quad", JSON.stringify(quad.map(q=>q.map(Math.round))));

// 1) Warp the real wheel image onto the quad.
const warped = await warpToQuad(WHEEL, quad, W, H);
fs.writeFileSync(`g:/clawd/_warped_${LABEL}.png`, warped);

// 2) Composite warped wheel over the mockup.
const composed = await sharp(MOCK).composite([{ input: warped, left: 0, top: 0 }]).png().toBuffer();
fs.writeFileSync(`g:/clawd/_composed_${LABEL}.png`, composed);
console.log("composed written");

// 3) Light blend pass (lighting/shadow only) via low-strength inpaint over the wheel ellipse.
async function up(buf,name){const init=await fetch("https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",{method:"POST",headers:{Authorization:`Key ${KEY}`,"Content-Type":"application/json"},body:JSON.stringify({content_type:"image/png",file_name:name})});const{upload_url,file_url}=await init.json();await fetch(upload_url,{method:"PUT",headers:{"Content-Type":"image/png"},body:new Uint8Array(buf)});return file_url;}

const exs=[top[0],right[0],bottom[0],left[0]], eys=[top[1],right[1],bottom[1],left[1]];
const ecx=(Math.min(...exs)+Math.max(...exs))/2, ecy=(Math.min(...eys)+Math.max(...eys))/2;
const erx=(Math.max(...exs)-Math.min(...exs))/2+10, ery=(Math.max(...eys)-Math.min(...eys))/2+10;
const maskSVG=Buffer.from(`<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/><ellipse cx="${ecx}" cy="${ecy}" rx="${erx}" ry="${ery}" fill="white"/></svg>`);
const mask=await sharp(maskSVG).png().toBuffer();

const imageUrl=await up(composed,"composed.png");
const maskUrl=await up(mask,"mask.png");
const prompt=`The exact wheel shown (${DESC}) already in place. Only adjust lighting, shadows and contact with the fender so it looks naturally photographed. Keep the spoke pattern, finish, colors, lip and center cap identical. Do not redesign or recolor the wheel.`;
const res=await fetch("https://fal.run/fal-ai/flux-general/inpainting",{method:"POST",headers:{Authorization:`Key ${KEY}`,"Content-Type":"application/json"},body:JSON.stringify({prompt,image_url:imageUrl,mask_url:maskUrl,strength:BLEND,num_images:1,output_format:"png",num_inference_steps:30,real_cfg_scale:3})});
const txt=await res.text();
if(!res.ok){console.error("blend ERR",res.status,txt.slice(0,300));process.exit(1);}
const outUrl=JSON.parse(txt)?.images?.[0]?.url;
const out=Buffer.from(await (await fetch(outUrl)).arrayBuffer());
fs.writeFileSync(`g:/clawd/_final4pt_${LABEL}.png`,out);
console.log(`done blend=${BLEND} -> g:/clawd/_final4pt_${LABEL}.png`);
