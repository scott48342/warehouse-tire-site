// Pure-JS 4-point perspective warp of a source image onto a destination quad.
// Returns an RGBA buffer (canvasW x canvasH) with the warped image, transparent elsewhere.
import sharp from "sharp";

// Solve homography mapping unit source corners -> dest quad.
// Standard projective transform from (0,0),(1,0),(1,1),(0,1) to 4 dest points.
function computeHomography(dst) {
  // dst = [ [x0,y0](TL), [x1,y1](TR), [x2,y2](BR), [x3,y3](BL) ]
  const [ [x0,y0],[x1,y1],[x2,y2],[x3,y3] ] = dst;
  // map square (0,0)-(1,1) to quad. Using formulas for projective mapping.
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a13, a23;
  if (dx3 === 0 && dy3 === 0) {
    a13 = 0; a23 = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    a13 = (dx3 * dy2 - dx2 * dy3) / den;
    a23 = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a11 = x1 - x0 + a13 * x1;
  const a21 = x3 - x0 + a23 * x3;
  const a31 = x0;
  const a12 = y1 - y0 + a13 * y1;
  const a22 = y3 - y0 + a23 * y3;
  const a32 = y0;
  // forward matrix maps (u,v) in [0,1] -> (x,y). We need inverse for sampling.
  const H = [ [a11,a21,a31],[a12,a22,a32],[a13,a23,1] ];
  return invert3(H);
}

function invert3(m) {
  const [a,b,c] = m[0], [d,e,f] = m[1], [g,h,i] = m[2];
  const A =  (e*i - f*h), B = -(b*i - c*h), C =  (b*f - c*e);
  const D = -(d*i - f*g), E =  (a*i - c*g), F = -(a*f - c*d);
  const G =  (d*h - e*g), Hh= -(a*h - b*g), I =  (a*e - b*d);
  const det = a*A + b*D + c*G;
  return [[A/det,B/det,C/det],[D/det,E/det,F/det],[G/det,Hh/det,I/det]];
}

export async function warpToQuad(srcPath, dstQuad, canvasW, canvasH) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sw = info.width, sh = info.height, sc = info.channels;
  const Hinv = computeHomography(dstQuad);

  // bounding box of dst quad
  const xs = dstQuad.map(p=>p[0]), ys = dstQuad.map(p=>p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs))), maxX = Math.min(canvasW, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(canvasH, Math.ceil(Math.max(...ys)));

  const out = Buffer.alloc(canvasW * canvasH * 4, 0); // RGBA transparent

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      // map dest pixel -> unit square via inverse homography
      const w = Hinv[2][0]*x + Hinv[2][1]*y + Hinv[2][2];
      const u = (Hinv[0][0]*x + Hinv[0][1]*y + Hinv[0][2]) / w;
      const v = (Hinv[1][0]*x + Hinv[1][1]*y + Hinv[1][2]) / w;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      // bilinear sample source
      const fx = u * (sw - 1), fy = v * (sh - 1);
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(x0+1, sw-1), y1 = Math.min(y0+1, sh-1);
      const dx = fx - x0, dy = fy - y0;
      const idx = (xx,yy) => (yy*sw + xx)*sc;
      const sample = (ch) => {
        const a = data[idx(x0,y0)+ch], b = data[idx(x1,y0)+ch];
        const c = data[idx(x0,y1)+ch], d = data[idx(x1,y1)+ch];
        return (a*(1-dx)+b*dx)*(1-dy) + (c*(1-dx)+d*dx)*dy;
      };
      const o = (y*canvasW + x)*4;
      out[o]   = sample(0);
      out[o+1] = sample(1);
      out[o+2] = sample(2);
      out[o+3] = sc === 4 ? sample(3) : 255;
    }
  }
  return sharp(out, { raw: { width: canvasW, height: canvasH, channels: 4 } }).png().toBuffer();
}
