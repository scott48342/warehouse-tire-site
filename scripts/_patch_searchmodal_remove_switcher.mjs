import fs from "node:fs";

const p = new URL("../src/components/SearchModal.tsx", import.meta.url);
let s = fs.readFileSync(p, "utf8");

// Remove tireStyle state line
s = s.replace(/\n\s*const \[tireStyle,[^\n]*\n/, "\n");

// In reset effect, remove setTireStyle("metric"); if present
s = s.replace(/\n\s*setTireStyle\(\"metric\"\);\s*\n/, "\n");

// Remove the top metric/flotation switcher buttons block (the two example buttons)
// We keep the rest of the UI and will show flotation as an additional section.
s = s.replace(
  /\n\s*<div className=\"flex items-start justify-between gap-3\">[\s\S]*?<\/div>\n\n\s*<div className=\"mt-3 rounded-2xl/,
  "\n                    <div className=\"mt-3 rounded-2xl"
);

fs.writeFileSync(p, s);
console.log("patched", p.pathname);
