import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default async function TireDetailPage({
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
          <Link
            href="/tires"
            className="text-sm font-semibold text-neutral-700 hover:underline"
          >
            ← Back to results
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <a
              href={BRAND.links.tel}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-extrabold"
            >
              Call
            </a>
            <a
              href={BRAND.links.sms}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-extrabold"
            >
              Text
            </a>
            <Link
              href="/schedule"
              className="rounded-full bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold text-white"
            >
              Schedule Install
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
                  {name}
                </h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag>All-season</Tag>
                  <Tag>Touring</Tag>
                  <Tag>60k warranty</Tag>
                </div>
              </div>
              <div className="rounded-2xl bg-amber-100 px-3 py-2 text-sm font-extrabold text-neutral-900">
                $100 rebate
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6">
                <div className="text-xs font-semibold text-neutral-600">Image</div>
                <div className="mt-2 text-sm text-neutral-700">
                  Placeholder (we’ll swap to supplier images).
                </div>
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
                  <summary className="cursor-pointer text-sm font-extrabold">
                    Will these fit my vehicle?
                  </summary>
                  <p className="mt-2 text-sm text-neutral-700">
                    We’ll confirm fitment before install. Use the vehicle selector
                    or call/text us.
                  </p>
                </details>
                <details className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-extrabold">
                    Can I schedule before ordering is live?
                  </summary>
                  <p className="mt-2 text-sm text-neutral-700">
                    Yes—schedule now and we’ll confirm availability and pricing.
                  </p>
                </details>
              </div>
            </div>
          </section>

          <aside className="sticky top-24 h-fit rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-semibold text-neutral-600">Price</div>
            <div className="mt-1 text-4xl font-extrabold text-neutral-900">$149</div>
            <div className="text-xs text-neutral-600">each</div>

            <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
              <div className="text-xs font-semibold text-neutral-600">Availability</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">
                In stock near you
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                Earliest install: this week (placeholder)
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <Link
                href="/schedule"
                className="rounded-2xl bg-[var(--brand-red)] px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
              >
                Schedule Install
              </Link>
              <a
                href={BRAND.links.tel}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-extrabold text-neutral-900"
              >
                Call {BRAND.phone.callDisplay}
              </a>
              <a
                href={BRAND.links.sms}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-extrabold text-neutral-900"
              >
                Text {BRAND.phone.textDisplay}
              </a>
              <a
                href={BRAND.links.whatsapp}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-extrabold text-neutral-900"
              >
                WhatsApp
              </a>
            </div>

            <div className="mt-4 text-xs text-neutral-600">
              No-pressure: we confirm fitment and availability before install.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-800">
      {children}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-neutral-100 py-2 last:border-b-0">
      <div className="text-neutral-600">{k}</div>
      <div className="font-semibold text-neutral-900">{v}</div>
    </div>
  );
}
