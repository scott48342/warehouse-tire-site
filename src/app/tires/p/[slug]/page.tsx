import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default async function TirePlaceholderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Placeholder data (until supplier feeds are integrated)
  const name = slug
    .split("-")
    .slice(0, -1)
    .join(" ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <Link href="/tires" className="text-sm font-semibold text-neutral-700 hover:underline">
             Back to results
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <a href={BRAND.links.tel} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-extrabold">
              Call
            </a>
            <Link href="/schedule" className="rounded-full bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold text-white">
              Schedule Install
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">{name}</h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag>All-season</Tag>
                  <Tag>Touring</Tag>
                  <Tag>60k warranty</Tag>
                </div>
              </div>
              <div className="rounded-2xl bg-amber-100 px-3 py-2 text-sm font-extrabold text-neutral-900">$100 rebate</div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6">
                <div className="text-xs font-semibold text-neutral-600">Image</div>
                <div className="mt-2 text-sm text-neutral-700">Placeholder (well swap to supplier images).</div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6">
                <div className="text-xs font-semibold text-neutral-600">Highlights</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-neutral-800">
                  <li>Great wet traction</li>
                  <li>Quiet ride</li>
                  <li>Strong warranty</li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-extrabold text-neutral-900">Specs</h2>
              <div className="mt-3 grid gap-2 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
                <Row k="Season" v="All-season" />
                <Row k="Category" v="Touring" />
                <Row k="Speed rating" v="H" />
                <Row k="Load index" v="99" />
                <Row k="Warranty" v="60,000 miles" />
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-extrabold text-neutral-900">Reviews</h2>
              <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                Reviews module placeholder.
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-extrabold text-neutral-900">FAQ</h2>
              <div className="mt-3 grid gap-2">
                <details className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-extrabold">Will these fit my vehicle?</summary>
                  <p className="mt-2 text-sm text-neutral-700">Well confirm fitment before install. Use the vehicle selector or call us.</p>
                </details>
                <details className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-extrabold">Can I schedule before ordering is live?</summary>
                  <p className="mt-2 text-sm text-neutral-700">Yesschedule now and well confirm availability and pricing.</p>
                </details>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="text-xs font-semibold text-neutral-600">Price</div>
            <div className="mt-1 text-3xl font-extrabold text-neutral-900">$199.99</div>
            <div className="mt-4 grid gap-2">
              <Link href="/schedule" className="h-11 rounded-xl bg-[var(--brand-red)] px-4 py-3 text-center text-sm font-extrabold text-white">
                Schedule Install
              </Link>
              <a href={BRAND.links.tel} className="h-11 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-extrabold">
                Call
              </a>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900">{children}</span>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-neutral-600">{k}</div>
      <div className="font-extrabold text-neutral-900">{v}</div>
    </div>
  );
}
