import { NextResponse } from "next/server";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { getPool, ensureRebatesTable, REBATE_SOURCE_TIRERACK } from "@/lib/rebates";

export const runtime = "nodejs";

function normBrand(headline: string): string | null {
  const h = String(headline || "").trim();
  if (!h) return null;

  const candidates = [
    "Bridgestone",
    "Firestone",
    "Pirelli",
    "Goodyear",
    "Cooper",
    "General",
    "Kumho",
    "Nitto",
    "Toyo",
    "Falken",
    "Dunlop",
    "Vredestein",
    "Mickey Thompson",
  ];

  const upper = h.toUpperCase();
  for (const c of candidates) {
    if (upper.includes(c.toUpperCase())) return c;
  }

  const colon = h.split(":")[0]?.trim();
  if (colon && colon.length >= 3 && colon.length <= 30) {
    if (/^[A-Za-z][A-Za-z\s.&-]+$/.test(colon)) return colon;
  }

  return null;
}

function makeId(parts: Record<string, any>) {
  const raw = JSON.stringify(parts);
  return crypto.createHash("sha1").update(raw).digest("hex");
}

export async function POST() {
  try {
    const res = await fetch("https://www.tirerack.com/specialoffers/specialoffers.jsp", {
      cache: "no-store",
      headers: {
        "user-agent": "warehouse-tire-site/1.0 (rebate sync)",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Fetch failed (${res.status})` }, { status: 500 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const offers: Array<{
      id: string;
      source: string;
      brand: string | null;
      headline: string;
      learnMoreUrl: string | null;
      formUrl: string | null;
      endsText: string | null;
    }> = [];

    $("a").each((_, el) => {
      const a = $(el);
      const txt = a.text().trim();
      if (txt !== "Learn More") return;

      const box = a.closest("li, .specialOffer, .offer, .promo, .deal, div");
      const links = box
        .find("a")
        .toArray()
        .map((x) => {
          const $x = $(x);
          return { text: $x.text().trim(), href: $x.attr("href") || "" };
        });

      const headlineLink = links.find((l) => l.text && l.text !== "Learn More" && !/Form$/i.test(l.text));
      if (!headlineLink?.text) return;

      const learnMore = links.find((l) => l.text === "Learn More")?.href || "";
      const form = links.find((l) => /Form$/i.test(l.text))?.href || "";

      const endsText = box.text().includes("Ends")
        ? (box.text().match(/Ends[^\n\r]+/i)?.[0]?.trim() || null)
        : null;

      const abs = (u: string) => {
        if (!u) return null;
        if (u.startsWith("http")) return u;
        return `https://www.tirerack.com${u.startsWith("/") ? "" : "/"}${u}`;
      };

      const headline = headlineLink.text;
      const brand = normBrand(headline);

      const id = makeId({ source: REBATE_SOURCE_TIRERACK, headline, learnMore: abs(learnMore), form: abs(form) });
      offers.push({
        id,
        source: REBATE_SOURCE_TIRERACK,
        brand,
        headline,
        learnMoreUrl: abs(learnMore),
        formUrl: abs(form),
        endsText,
      });
    });

    const uniq = new Map<string, (typeof offers)[number]>();
    for (const o of offers) {
      if (!uniq.has(o.id)) uniq.set(o.id, o);
    }

    const db = getPool();
    await ensureRebatesTable(db);

    const upserts = Array.from(uniq.values());

    for (const o of upserts) {
      await db.query({
        text: `
          insert into site_rebates (id, source, brand, headline, learn_more_url, form_url, ends_text, enabled)
          values ($1,$2,$3,$4,$5,$6,$7,false)
          on conflict (id) do update set
            source = excluded.source,
            brand = excluded.brand,
            headline = excluded.headline,
            learn_more_url = excluded.learn_more_url,
            form_url = excluded.form_url,
            ends_text = excluded.ends_text,
            updated_at = now()
        `,
        values: [o.id, o.source, o.brand, o.headline, o.learnMoreUrl, o.formUrl, o.endsText],
      });
    }

    return NextResponse.json({ ok: true, count: upserts.length }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
