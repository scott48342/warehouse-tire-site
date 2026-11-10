/** Matching Delinte model photos hosted with the storefront. */
const MODEL_IMAGES: Record<string, string> = {
  dst1: "/images/tires/delinte/dst1.png",
  centurion365: "/images/tires/delinte/centurion-365.jpg",
  centurionht: "/images/tires/delinte/centurion-ht.jpg",
};

export function getDelinteModelImage(brand: unknown, model: unknown): string | null {
  if (String(brand || "").trim().toLowerCase() !== "delinte") return null;
  const key = String(model || "")
    .trim()
    .toLowerCase()
    .replace(/^delinte\s+/, "")
    .replace(/[^a-z0-9]/g, "");
  if (key.startsWith("centurion365lmd")) return null;
  if (key.startsWith("centurion365")) return MODEL_IMAGES.centurion365;
  if (key.startsWith("centurionht")) return MODEL_IMAGES.centurionht;
  if (key.startsWith("dst1")) return MODEL_IMAGES.dst1;
  return null;
}
