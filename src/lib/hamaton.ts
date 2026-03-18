export type HamatonEnrichment = {
  sourceUrl: string;
  title?: string;
  bullets?: string[];
  nutTorque?: string;
  screwTorque?: string;
  imageUrl?: string;
};

function cleanText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function pickFirst(re: RegExp, html: string) {
  const m = html.match(re);
  return m?.[1] ? cleanText(m[1]) : undefined;
}

export async function fetchHamatonEnrichment(partNumber: string): Promise<HamatonEnrichment | null> {
  const pn = String(partNumber || "").trim();
  if (!pn) return null;

  const sourceUrl = `https://www.hamatonusa.com/product/${encodeURIComponent(pn)}`;

  const res = await fetch(sourceUrl, {
    // we don't need to hammer them; cache for 24h on the server
    next: { revalidate: 60 * 60 * 24 },
    headers: {
      "user-agent": "WarehouseTireDirectBot/1.0 (+https://shop.warehousetiredirect.com)",
      accept: "text/html,application/xhtml+xml",
    },
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const html = await res.text();

  // Title from <title>
  const titleRaw = pickFirst(/<title>([^<]+)<\/title>/i, html);
  const title = titleRaw ? titleRaw.replace(/^\s*[^-]+-\s*/g, "") : undefined;

  // Try og:image
  const imageUrl = pickFirst(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i, html);

  // Bullets: this page format is fairly consistent; grab list items in the summary section
  const bullets: string[] = [];
  const liRe = /<li[^>]*>(.*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(html))) {
    const raw = m[1]
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    const t = cleanText(raw);
    if (!t) continue;
    // Filter out huge vehicle list items (they include ':' year ranges often)
    if (/\b\d{4}\b\s*-\s*\b\d{4}\b/.test(t) && t.includes(":")) continue;
    if (t.length > 180) continue;
    if (!bullets.includes(t)) bullets.push(t);
    if (bullets.length >= 12) break;
  }

  // Torque values
  const nutTorque = pickFirst(/Nut\s*Torque:\s*<\/[^>]+>\s*([^<]+)</i, html) || pickFirst(/Nut\s*Torque:\s*([^<]+)</i, html);
  const screwTorque = pickFirst(/Screw\s*Torque:\s*<\/[^>]+>\s*([^<]+)</i, html) || pickFirst(/Screw\s*Torque:\s*([^<]+)</i, html);

  return {
    sourceUrl,
    title,
    bullets: bullets.length ? bullets : undefined,
    nutTorque,
    screwTorque,
    imageUrl,
  };
}
