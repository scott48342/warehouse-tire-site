import Link from "next/link";
import { redirect } from "next/navigation";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

export default async function TiresVehicleSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";

  if (year && make && model) {
    const want = `${slugify(year)}-${slugify(make)}-${slugify(model)}`;
    if (slug !== want) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(sp)) {
        const val = Array.isArray(v) ? v[0] : v;
        if (val) qs.set(k, val);
      }
      redirect(`/tires/v/${want}?${qs.toString()}`);
    }

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = Array.isArray(v) ? v[0] : v;
      if (val) qs.set(k, val);
    }
    redirect(`/tires?${qs.toString()}`);
  }

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Tires</h1>
        <p className="mt-2 text-sm text-neutral-700">
          This link needs year/make/model parameters.
        </p>
        <div className="mt-4">
          <Link href="/tires" className="text-sm font-extrabold text-neutral-900 hover:underline">
            Go to Tires
          </Link>
        </div>
      </div>
    </main>
  );
}
