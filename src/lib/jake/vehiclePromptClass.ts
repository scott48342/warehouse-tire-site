/**
 * Vehicle class used ONLY to pick Jake's suggested-prompt chips.
 *
 * 2026-09-19 (audit J3): "Mustang Mach-E" matched the muscle-car regex via
 * /mustang/ and got "staggered" / "deep dish muscle look" chips. An EV
 * crossover is not a muscle car. EV check runs first and wins; muscle
 * requires the model to NOT be an EV/crossover variant.
 *
 * This is a UI heuristic for chip copy. It never feeds fitment, pricing,
 * or certification.
 */
export type PromptVehicleClass = "ev" | "truck" | "muscle" | "suv" | "default";

const EV_RE = /mach-?e|model\s?[3sxy]\b|tesla|ioniq|ev6|ev9|bolt|leaf|lightning|lyriq|blazer ev|equinox ev|silverado ev|r1[ts]\b|rivian|lucid|polestar|taycan|e-tron|i[3-7x]\b|id\.?4|ariya|solterra|bz4x|niro ev|kona electric|mustang mach/i;
const TRUCK_RE = /f-?150|f-?250|f-?350|silverado|sierra|\bram\b|tundra|titan|tacoma|colorado|canyon|ranger|gladiator|frontier|ridgeline|maverick/i;
const MUSCLE_RE = /mustang|camaro|challenger|charger|corvette|firebird|trans am/i;
const SUV_RE = /tahoe|suburban|escalade|yukon|4runner|explorer|expedition|durango|grand cherokee|highlander|sequoia|armada|pilot|telluride/i;

export function classifyVehicleForPrompts(make: string | undefined, model: string | undefined): PromptVehicleClass {
  const text = `${make ?? ""} ${model ?? ""}`.trim();
  if (!text) return "default";
  if (EV_RE.test(text)) return "ev";
  if (TRUCK_RE.test(text)) return "truck";
  if (MUSCLE_RE.test(text)) return "muscle";
  if (SUV_RE.test(text)) return "suv";
  return "default";
}
