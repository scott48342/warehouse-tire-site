import fs from "node:fs";
const e = fs.readFileSync(".env.local", "utf8");
for (const k of ["FAL_KEY", "OPENAI_API_KEY"]) {
  const re = new RegExp("^\\s*" + k + "\\s*=\\s*\"?([^\"\\r\\n]+)", "m");
  const m = e.match(re);
  console.log(k + ":", m ? m[1].slice(0, 6) + "..." + m[1].length + "ch" : "MISSING");
}
