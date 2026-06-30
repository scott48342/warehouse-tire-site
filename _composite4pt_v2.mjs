import fs from "node:fs";
import { warpToQuad } from "./_warp.mjs";
const sharp = (await import("sharp")).default;

// args: mock wheel label  top right bottom left  [scale] [squeeze]
const [MOCK, WHEEL, LABEL, TOP, RIGHT, BOTTOM, LEFT] = process.argv.slice(2);
const SCALE = Number(process.argv[9] || "1.13");
const SQUEEZE = Number(process.argv[10] || "1.0"); // horizontal foreshorten of source before warp
const p = s => s.split(",").map(Number);
const top = p(TOP), right = p(RIGHT), bottom = p(BOTTOM), left = p(LEFT);
const meta = await sharp(MOCK).metadata();
const W = meta.width, H = meta.height;

// Optionally pre-squeeze the source wheel horizontally to simulate 3/4 foreshortening.
let wheelSrc = WHEEL;
if (SQUEEZE !== 1.0) {
  const wm = await sharp(WHEEL).metadata();
  const sq = await sharp(WHEEL).resize(Math.round(wm.width * SQUEEZE), wm.height, { fit: "fill" }).png().toBuffer();
  wheelSrc = `g:/clawd/_sq_${LABEL}.png`;
  fs.writeFileSync(wheelSrc, sq);
}

const cx = (left[0]+right[0])/2, cy = (top[1]+bottom[1])/2;
const corner = (a,b) => [a[0]+b[0]-cx, a[1]+b[1]-cy];
let TL = corner(top,left), TR = corner(top,right), BR = corner(bottom,right), BL = corner(bottom,left);
const qcx=(TL[0]+TR[0]+BR[0]+BL[0])/4, qcy=(TL[1]+TR[1]+BR[1]+BL[1])/4;
const grow = pt => [qcx+(pt[0]-qcx)*SCALE, qcy+(pt[1]-qcy)*SCALE];
TL=grow(TL);TR=grow(TR);BR=grow(BR);BL=grow(BL);
const quad=[TL,TR,BR,BL];
console.log("quad", JSON.stringify(quad.map(q=>q.map(Math.round))));

const warped = await warpToQuad(wheelSrc, quad, W, H);

// Feather the warped wheel's alpha edge slightly so the composite seam is soft (no AI redraw).
const feathered = await sharp(warped)
  .ensureAlpha()
  .blur(0.6)
  .png().toBuffer();

const composed = await sharp(MOCK).composite([{ input: feathered, left: 0, top: 0 }]).png().toBuffer();
fs.writeFileSync(`g:/clawd/_pure_${LABEL}.png`, composed);
console.log("done -> g:/clawd/_pure_" + LABEL + ".png");
