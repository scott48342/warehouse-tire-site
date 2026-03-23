import { parseThreadSize, type LugNutSpec } from "@/lib/fitment/accessories";

export type LugThreadKey = "m12x1.50" | "m12x1.25" | "m14x1.50" | "m14x1.25" | "1/2-20" | "7/16-20";

export function threadKeyFromRaw(threadSizeRaw: string | null): LugThreadKey | null {
  const spec = parseThreadSize(threadSizeRaw);
  if (!spec) return null;
  return threadKeyFromSpec(spec);
}

export function threadKeyFromSpec(spec: LugNutSpec): LugThreadKey | null {
  if (spec.isMetric) {
    const dia = Number(spec.threadDiameter);
    const pitch = Number(spec.threadPitch);
    if (dia === 12 && Math.abs(pitch - 1.5) < 0.001) return "m12x1.50";
    if (dia === 12 && Math.abs(pitch - 1.25) < 0.001) return "m12x1.25";
    if (dia === 14 && Math.abs(pitch - 1.5) < 0.001) return "m14x1.50";
    if (dia === 14 && Math.abs(pitch - 1.25) < 0.001) return "m14x1.25";
    return null;
  }

  // imperial
  const tpi = Number(spec.threadPitch);
  const dia = Number(spec.threadDiameter);
  if (Math.abs(dia - 0.5) < 0.0001 && tpi === 20) return "1/2-20";
  if (Math.abs(dia - 0.4375) < 0.0001 && tpi === 20) return "7/16-20";
  return null;
}

export function titleNeedleForThread(key: LugThreadKey): string[] {
  switch (key) {
    case "m12x1.50":
      return ["12-1.50", "M12X1.50", "M12-1.50", "M12 1.50"];
    case "m12x1.25":
      return ["12-1.25", "M12X1.25", "M12-1.25", "M12 1.25"];
    case "m14x1.50":
      return ["14-1.50", "M14X1.50", "M14-1.50", "M14 1.50"];
    case "m14x1.25":
      return ["14-1.25", "M14X1.25", "M14-1.25", "M14 1.25"];
    case "1/2-20":
      return ["1/2", "1/2-20", "1/2- 20", "1/2-20UNF", "1/2 20"];
    case "7/16-20":
      return ["7/16", "7/16-20", "7/16- 20", "7/16 20"];
  }
}
