// Summarize _probe-out.txt: which USAF (make, model) names worked / failed, grouped by make.
import fs from "node:fs";
const buf = fs.readFileSync(new URL("./_probe-out.txt", import.meta.url));
const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le") : buf.toString("utf8");
const lines = text.split(/\r?\n/);
const ok = {}, no = {};
for (const x of lines) {
  const m = x.match(/^(\d{4}) \| ([^|]+) \| (.+?) -> (OK|no)/);
  if (!m) continue;
  const mk = m[2].trim(), md = `${m[3].trim()}(${m[1]})`;
  const t = m[4] === "OK" ? ok : no;
  (t[mk] ??= new Set()).add(md);
}
const which = process.argv[2] === "no" ? no : ok;
for (const k of Object.keys(which).sort()) console.log(`${k}: ${[...which[k]].join(", ")}`);
