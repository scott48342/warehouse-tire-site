import { NextResponse } from "next/server";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { getPool, ensureRebatesTable, REBATE_SOURCE_DISCOUNTTIRE, REBATE_SOURCE_TIRERACK } from "@/lib/rebates";

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

export async function POST(req: Request) {
  try {
    // Preferred source: Discount Tire promotions (more dealer-aligned).
    // Fallback: Tire Rack specials.
    const urls = [
      { url: "https://www.discounttire.com/promotions", source: REBATE_SOURCE_DISCOUNTTIRE },
      { url: "https://www.tirerack.com/specialoffers/specialoffers.jsp", source: REBATE_SOURCE_TIRERACK },
    ];

    let html = "";
    let pickedSource = "";
    let res: Response | null = null;

    for (const u of urls) {
      res = await fetch(u.url, {
        cache: "no-store",
        headers: {
          "user-agent": "warehouse-tire-site/1.0 (rebate sync)",
        },
      });
      if (!res.ok) continue;
      html = await res.text();
      pickedSource = u.source;
      // accept the first successful fetch
      break;
    }

    if (!res || !res.ok) {
      return NextResponse.json({ ok: false, error: `Fetch failed` }, { status: 500 });
    }

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

    if (pickedSource === REBATE_SOURCE_DISCOUNTTIRE) {
      const abs = (u: string) => {
        if (!u) return null;
        if (u.startsWith("http")) return u;
        return `https://www.discounttire.com${u.startsWith("/") ? "" : "/"}${u}`;
      };

      $("h1,h2,h3").each((_, el) => {
        const h = $(el);
        const headline = h.text().trim();
        if (!headline || !/rebate/i.test(headline)) return;

        const box = h.closest("section, article, li, div");
        const linkEls = box.find("a").toArray();
        const links = linkEls
          .map((x) => {
            const a = $(x);
            return { text: a.text().trim(), href: a.attr("href") || "" };
          })
          .filter((l) => l.href);

        const learnMore = links.find((l) => /get details|see details|view offer details/i.test(l.text))?.href || "";
        const form = links.find((l) => /download form|rebate form|claim form/i.test(l.text))?.href || "";
        const submit = links.find((l) => /submit online/i.test(l.text))?.href || "";

        // Prefer the explicit form/submission links.
        const formUrl = abs(form || submit);
        const learnMoreUrl = abs(learnMore);

        const endsText = (() => {
          const t = box.text();
          const m = t.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s*\u2013\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i);
          return m ? m[0] : null;
        })();

        const imgAlt = box.find("img").first().attr("alt") || "";
        const brand = normBrand(headline) || normBrand(imgAlt) || null;

        const id = makeId({ source: pickedSource, headline, learnMore: learnMoreUrl, form: formUrl });
        offers.push({
          id,
          source: pickedSource,
          brand,
          headline,
          learnMoreUrl,
          formUrl,
          endsText,
        });
      });
    } else {
      // Tire Rack parser
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

        const id = makeId({ source: pickedSource, headline, learnMore: abs(learnMore), form: abs(form) });
        offers.push({
          id,
          source: pickedSource,
          brand,
          headline,
          learnMoreUrl: abs(learnMore),
          formUrl: abs(form),
          endsText,
        });
      });
    }

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

    // If this was triggered from the admin UI (HTML form), redirect back.
    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      const u = new URL("/admin/rebates", req.url);
      u.searchParams.set("refreshed", "1");
      u.searchParams.set("count", String(upserts.length));
      return NextResponse.redirect(u, { status: 303 });
    }

    return NextResponse.json({ ok: true, count: upserts.length }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
