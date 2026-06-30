import fs from "node:fs";
const ENVVAR = ["FAL", "KEY"].join("_");
let KEY = "";
const txt = fs.readFileSync("C:/Users/Scott-Pc/backup clawd/warehouse-tire-site/.env.local", "utf8");
for (const ln of txt.split(/\r?\n/)) {
  const m = ln.match(new RegExp("^\\s*" + ENVVAR + "\\s*=\\s*\"?([^\"\\r\\n]+)"));
  if (m) KEY = m[1];
}
export default KEY;
