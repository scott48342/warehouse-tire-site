import Link from "next/link";
import { BRAND } from "@/lib/brand";

type Tire = {
  slug: string;
  name: string;
  category: string;
  price: number;
  badge?: string;
  rating: number;
  reviews: number;
  availability: string;
};

const TIRES: Tire[] = [
  {
    slug: "all-season-touring-1",
    name: "All-Season Touring",
    category: "Comfort • Daily Driver",
    price: 149,
    badge: "$100 rebate",
    rating: 4.7,
    reviews: 842,
    availability: "In stock near you • install this week",
  },
  {
    slug: "lt-all-terrain-1",
    name: "LT All-Terrain",
    category: "Truck • Off-road",
    price: 219,
    badge: "Popular",
    rating: 4.6,
    reviews: 512,
    availability: "Check fitment to confirm availability",
  },
  {
    slug: "performance-summer-1",
    name: "Performance Summer",
    category: "Sport • Handling",
    price: 189,
    badge: "Financing",
    rating: 4.5,
    reviews: 214,
    availability: "Ships fast • install options available",
  },
  {
    slug: "winter-3pmsf-1",
    name: "Winter 3PMSF",
    category: "Snow • Ice",
    price: 175,
    badge: "3PMSF",
    rating: 4.8,
    reviews: 391,
    availability: "Limited stock • call to confirm",
  },
];

export default function TiresPage() {
  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Tires
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              Filter, compare, and schedule install. (Data is placeholder for now.)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-neutral-600">Sort</label>
            <select className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold">
              <option>Best match</option>
              <option>Price (low to high)</option>
              <option>Price (high to low)</option>
              <option>Top rated</option>
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="sticky top-24 hidden h-fit rounded-2xl border border-neutral-200 bg-white p-4 md:block">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Filters</h2>
              <button className="text-xs font-semibold text-neutral-600 hover:underline">
                Clear all
              </button>
            </div>

            <FilterGroup title="Vehicle / Size">
              <div className="grid gap-2">
                <input
                  placeholder="ZIP (optional)"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <button className="h-10 rounded-xl bg-neutral-900 text-sm font-extrabold text-white">
                  Check fitment
                </button>
              </div>
            </FilterGroup>

            <FilterGroup title="Season">
              <Check label="All-season" />
              <Check label="All-terrain" />
              <Check label="Winter" />
              <Check label="Summer" />
            </FilterGroup>

            <FilterGroup title="Brand">
              <Check label="Michelin" />
              <Check label="Goodyear" />
              <Check label="Bridgestone" />
              <Check label="Continental" />
              <Check label="Budget" />
            </FilterGroup>

            <FilterGroup title="Price">
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="$ min"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <input
                  placeholder="$ max"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
              </div>
            </FilterGroup>

            <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-neutral-800">
              <div className="font-extrabold">Tip</div>
              <div className="mt-1">
                Best conversions come from showing local availability and an easy
                schedule flow.
              </div>
            </div>
          </aside>

          <section className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Chip>All-season</Chip>
              <Chip>225/65R17</Chip>
              <Chip>In stock near you</Chip>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TIRES.map((t) => (
                <article
                  key={t.slug}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-neutral-900">
                        {t.name}
                      </h3>
                      <div className="mt-1 text-xs text-neutral-600">
                        {t.category}
                      </div>
                    </div>
                    {t.badge ? <Badge>{t.badge}</Badge> : null}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-neutral-700">
                    <span className="font-extrabold">{t.rating.toFixed(1)}</span>
                    <span className="text-amber-500">★★★★★</span>
                    <span className="text-neutral-500">({t.reviews})</span>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-extrabold text-neutral-900">
                        ${t.price}
                      </div>
                      <div className="text-xs text-neutral-600">each</div>
                    </div>
                    <Link
                      href={`/tires/${t.slug}`}
                      className="rounded-xl bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
                    >
                      View
                    </Link>
                  </div>

                  <div className="mt-3 text-xs text-neutral-600">{t.availability}</div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href="/schedule"
                      className="rounded-xl bg-neutral-900 px-3 py-2 text-center text-xs font-extrabold text-white"
                    >
                      Schedule
                    </Link>
                    <a
                      href={BRAND.links.tel}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center text-xs font-extrabold text-neutral-900"
                    >
                      Call
                    </a>
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
              Next: wire supplier feed + real filters + “in stock near you” logic.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-800">
      {children}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-extrabold text-neutral-900">
      {children}
    </span>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-xs font-extrabold text-neutral-900">{title}</div>
      <div className="mt-2 grid gap-2">{children}</div>
    </div>
  );
}

function Check({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-800">
      <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
