import Link from "next/link";
import { BRAND } from "@/lib/brand";

type Wheel = {
  sku?: string;
  brand?: string;
  model?: string;
  finish?: string;
  imageUrl?: string;
  price?: number;
};

async function fetchWheels(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }

  // NOTE: We intentionally call our own API route.
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/wheelpros/wheels/search?${sp.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  return res.json();
}

export default async function WheelsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";
  const trim = (Array.isArray(sp.trim) ? sp.trim[0] : sp.trim) || "";

  // Wheel Pros search params are vendor-specific.
  // We’ll start by passing these through; if WP expects different keys,
  // we’ll adapt once we confirm their schema.
  const data = await fetchWheels({
    year,
    make,
    model,
    trim,
    page: "1",
    pageSize: "24",
    fields: "inventory,price,images",
    priceType: "msrp",
    currencyCode: "USD",
  });

  const items: Wheel[] =
    // common patterns: { items: [] } or { results: [] }
    (data?.items as Wheel[]) || (data?.results as Wheel[]) || [];

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Wheels
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              {year && make && model
                ? `Showing wheels for ${year} ${make} ${model}${trim ? ` ${trim}` : ""}.`
                : "Select your vehicle in the header to filter wheels."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-neutral-600">Sort</label>
            <select className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold">
              <option>Best Match</option>
              <option>Price Low to High</option>
              <option>Price High to Low</option>
              <option>Most Popular</option>
            </select>
          </div>
        </div>

        {data?.error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Wheel search error: {String(data.error).slice(0, 500)}
            <div className="mt-2 text-xs text-red-800">
              (We may need to adjust the Wheel Pros query parameter names.)
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.length ? (
            items.map((w, idx) => (
              <article
                key={w.sku || idx}
                className="rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="text-xs font-semibold text-neutral-600">
                  {w.brand || "Wheel"}
                </div>
                <h3 className="mt-0.5 text-sm font-extrabold text-neutral-900">
                  {w.model || w.sku || "Wheel"}
                </h3>
                {w.finish ? (
                  <div className="mt-1 text-xs text-neutral-600">{w.finish}</div>
                ) : null}

                <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                  Image placeholder
                </div>

                <div className="mt-4">
                  <div className="text-2xl font-extrabold text-neutral-900">
                    {w.price ? `$${w.price}` : "Call for price"}
                  </div>
                  <div className="text-xs text-neutral-600">each</div>
                </div>

                <div className="mt-4 grid gap-2">
                  <Link
                    href="/schedule"
                    className="rounded-xl bg-neutral-900 px-3 py-2 text-center text-xs font-extrabold text-white"
                  >
                    Schedule Install
                  </Link>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <a
                      href={BRAND.links.tel}
                      className="font-extrabold text-neutral-900 hover:underline"
                    >
                      Call
                    </a>
                    <a
                      href={BRAND.links.sms}
                      className="font-extrabold text-neutral-900 hover:underline"
                    >
                      Text
                    </a>
                    <a
                      href={BRAND.links.whatsapp}
                      className="font-extrabold text-neutral-900 hover:underline"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
              No wheel results yet. Select a vehicle (with trim) in the header and
              try again.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
