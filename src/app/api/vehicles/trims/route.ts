import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.PACKAGE_ENGINE_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Missing PACKAGE_ENGINE_URL" },
      { status: 500 }
    );
  }

  const upstream = new URL("/v1/vehicles/trims", base);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res: Response;
  try {
    res = await fetch(upstream, { cache: "no-store", signal: controller.signal });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200, headers: { "cache-control": "no-store" } });
  } finally {
    clearTimeout(timeout);
  }

  const ct = res.headers.get("content-type") || "";
  if (res.ok && ct.includes("application/json")) {
    const data = (await res.json()) as unknown;
    const raw = Array.isArray((data as { results?: unknown[] })?.results)
      ? ((data as { results?: unknown[] }).results as unknown[])
      : [];

    const results = raw
      .map((it) => {
        if (!it || typeof it !== "object") return null;
        const o = it as Record<string, unknown>;
        const mod = o.modification ? String(o.modification) : "";
        const baseLabel = o.trimLevel || o.trim || o.modification;
        const engineCodeRaw = o.engineCode ? String(o.engineCode) : "";
        const engineCode = engineCodeRaw
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        // Use a composite value so the dropdown has unique option values even when Wheel-Size returns
        // the same `modification` token for multiple trims (common when token represents engine).
        const value = mod
          ? `${mod}__${String(baseLabel).replace(/\s+/g, "-").toLowerCase()}__${engineCode}`
          : "";
        if (!value || !baseLabel) return null;
        // Add engine to reduce duplicates when trimLevel repeats, but drop fuel words like "Petrol".
        const engineRaw = o.engine ? String(o.engine) : "";
        const engine = engineRaw
          .replace(/\bPetrol\b/gi, "")
          .replace(/\bDiesel\b/gi, "")
          .replace(/\bGasoline\b/gi, "")
          .replace(/\bGas\b/gi, "")
          .replace(/\bHybrid\b/gi, "")
          .replace(/\bElectric\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        const label = String(baseLabel);
        return { value, label };
      })
      .filter(Boolean);

    return NextResponse.json({ results });
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": ct || "application/json",
    },
  });
}
