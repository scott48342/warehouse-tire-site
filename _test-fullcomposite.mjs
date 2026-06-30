import fs from "node:fs";
import sharp from "sharp";

// circular mask
async function circularMaskWheel(srcBuf) {
  const meta = await sharp(srcBuf).metadata();
  const w = meta.width, h = meta.height, side = Math.min(w, h);
  const left = Math.floor((w - side) / 2), top = Math.floor((h - side) / 2);
  const squareBuf = await sharp(srcBuf).ensureAlpha().extract({ left, top, width: side, height: side }).png().toBuffer();
  const r = side / 2;
  const maskSvg = Buffer.from(`<svg width="${side}" height="${side}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="white"/></svg>`);
  return sharp(squareBuf).composite([{ input: maskSvg, blend: "dest-in" }]).png().toBuffer();
}

function computeInverseHomography(dst) {
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=dst;
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
  let a13,a23; if(dx3===0&&dy3===0){a13=0;a23=0;}else{const den=dx1*dy2-dx2*dy1;a13=(dx3*dy2-dx2*dy3)/den;a23=(dx1*dy3-dx3*dy1)/den;}
  const a11=x1-x0+a13*x1,a21=x3-x0+a23*x3,a31=x0,a12=y1-y0+a13*y1,a22=y3-y0+a23*y3,a32=y0;
  const H=[[a11,a21,a31],[a12,a22,a32],[a13,a23,1]];
  const [a,b,c]=H[0],[d,e,f]=H[1],[g,h,i]=H[2];
  const A=e*i-f*h,B=-(b*i-c*h),C=b*f-c*e,D=-(d*i-f*g),E=a*i-c*g,F=-(a*f-c*d),G=d*h-e*g,Hh=-(a*h-b*g),I=a*e-b*d;
  const det=a*A+b*D+c*G;
  return [[A/det,B/det,C/det],[D/det,E/det,F/det],[G/det,Hh/det,I/det]];
}
async function warpToQuad(srcBuf,dstQuad,cW,cH){
  const {data,info}=await sharp(srcBuf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const sw=info.width,sh=info.height,sc=info.channels,Hinv=computeInverseHomography(dstQuad);
  const xs=dstQuad.map(p=>p[0]),ys=dstQuad.map(p=>p[1]);
  const minX=Math.max(0,Math.floor(Math.min(...xs))),maxX=Math.min(cW,Math.ceil(Math.max(...xs)));
  const minY=Math.max(0,Math.floor(Math.min(...ys))),maxY=Math.min(cH,Math.ceil(Math.max(...ys)));
  const out=Buffer.alloc(cW*cH*4,0);
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
    const w=Hinv[2][0]*x+Hinv[2][1]*y+Hinv[2][2];
    const u=(Hinv[0][0]*x+Hinv[0][1]*y+Hinv[0][2])/w,v=(Hinv[1][0]*x+Hinv[1][1]*y+Hinv[1][2])/w;
    if(u<0||u>1||v<0||v>1)continue;
    const fx=u*(sw-1),fy=v*(sh-1),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(x0+1,sw-1),y1=Math.min(y0+1,sh-1),dx=fx-x0,dy=fy-y0;
    const idx=(xx,yy)=>(yy*sw+xx)*sc;
    const s=ch=>{const a=data[idx(x0,y0)+ch],b=data[idx(x1,y0)+ch],c=data[idx(x0,y1)+ch],d=data[idx(x1,y1)+ch];return (a*(1-dx)+b*dx)*(1-dy)+(c*(1-dx)+d*dx)*dy;};
    const o=(y*cW+x)*4;out[o]=s(0);out[o+1]=s(1);out[o+2]=s(2);out[o+3]=sc===4?s(3):255;
  }
  return sharp(out,{raw:{width:cW,height:cH,channels:4}}).png().toBuffer();
}
function quadFromDetection(d,scale=1.13){
  const cx=(d.left[0]+d.right[0])/2,cy=(d.top[1]+d.bottom[1])/2;
  const corner=(a,b)=>[a[0]+b[0]-cx,a[1]+b[1]-cy];
  let TL=corner(d.top,d.left),TR=corner(d.top,d.right),BR=corner(d.bottom,d.right),BL=corner(d.bottom,d.left);
  const qcx=(TL[0]+TR[0]+BR[0]+BL[0])/4,qcy=(TL[1]+TR[1]+BR[1]+BL[1])/4;
  const grow=pt=>[qcx+(pt[0]-qcx)*scale,qcy+(pt[1]-qcy)*scale];
  return [grow(TL),grow(TR),grow(BR),grow(BL)];
}

const base = fs.readFileSync("g:/clawd/_clean_base.png");
const wheel = fs.readFileSync("g:/clawd/_w_xd852.png");
const meta = await sharp(base).metadata();
const W=meta.width,H=meta.height;
// detection from gpt-4o run on the CLEAN v17 base:
const wheels = {
  front:{top:[742,455],right:[825,560],bottom:[720,665],left:[640,560]},
  rear:{top:[160,510],right:[245,560],bottom:[155,665],left:[80,600]},
};
const masked = await circularMaskWheel(wheel);
fs.writeFileSync("g:/clawd/_masked_wheel.png", masked);
const layers=[];
for(const det of [wheels.front,wheels.rear]){
  const quad=quadFromDetection(det,1.13);
  console.log("quad", JSON.stringify(quad.map(q=>q.map(Math.round))));
  const warped=await warpToQuad(masked,quad,W,H);
  layers.push({input:await sharp(warped).ensureAlpha().blur(0.6).png().toBuffer(),left:0,top:0});
}
const out=await sharp(base).composite(layers).png().toBuffer();
fs.writeFileSync("g:/clawd/_prodfix2_xd852.png", out);
console.log("done -> g:/clawd/_prodfix2_xd852.png");
