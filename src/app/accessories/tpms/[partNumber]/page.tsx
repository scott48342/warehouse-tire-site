import Link from "next/link";
import { fetchHamatonEnrichment } from "@/lib/hamaton";

export const runtime = "nodejs";

type TpmsItem = {
  partNumber?: string;
  mfgPartNumber?: string;
  size?: string;
  description?: string;
  inStock?: boolean;
  price?: number;
  isHamaton?: boolean;
};

type ApiOk = {
  partNumber: string;
  count: number;
  items: TpmsItem[];
};

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getMarkupAmount() {
  // Default: $45.00 over cost (cost + 45)
  const raw = (process.env.ACCESSORIES_TPMS_MARKUP_AMOUNT || process.env.TPMS_MARKUP_AMOUNT || "45").trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 45;
}

export default async function TpmsProductPage({
  params,
}: {
  params: Promise<{ partNumber: string }>;
}) {
  const { partNumber } = await params;

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://shop.warehousetiredirect.com").replace(/\/$/, "");

  const res = await fetch(
    `${baseUrl}/api/km/partlookup?partNumber=${encodeURIComponent(partNumber)}`,
    { cache: "no-store" }
  ).catch(() => null);

  let data: ApiOk | null = null;
  if (res && res.ok) {
    data = (await res.json()) as ApiOk;
  }

  const item = data?.items?.[0];
  const price = typeof item?.price === "number" ? item.price : undefined;

  const hamaton = item?.isHamaton ? await fetchHamatonEnrichment(partNumber) : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link href="/accessories/tpms" className="text-sm font-semibold text-neutral-700 hover:underline">
        ← Back to TPMS search
      </Link>

      <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            {/* Show a product-specific image if we have one; otherwise fall back to a generic placeholder. */}
            {
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hamaton?.imageUrl || "/images/placeholders/tpms-sensor.png"}
                alt={hamaton?.title || partNumber}
                className="mb-5 w-full max-w-[360px] rounded-2xl border border-neutral-200 bg-white p-3"
              />
            }

            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">{partNumber}</h1>
            {hamaton?.title ? (
              <p className="mt-2 text-base font-extrabold text-neutral-900">{hamaton.title}</p>
            ) : null}
            {item?.description ? (
              <p className="mt-2 text-sm font-semibold text-neutral-700">{item.description}</p>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">TPMS sensor</p>
            )}

            <div className="mt-4 grid gap-2 text-sm text-neutral-700">
              {item?.size ? (
                <div>
                  Type: <span className="font-semibold">{item.size}</span>
                </div>
              ) : null}
              {typeof item?.mfgPartNumber === "string" ? (
                <div>
                  Mfg part #: <span className="font-semibold">{item.mfgPartNumber}</span>
                </div>
              ) : null}

              {hamaton?.nutTorque ? (
                <div>
                  Nut torque: <span className="font-semibold">{hamaton.nutTorque}</span>
                </div>
              ) : null}
              {hamaton?.screwTorque ? (
                <div>
                  Screw torque: <span className="font-semibold">{hamaton.screwTorque}</span>
                </div>
              ) : null}
            </div>

            {hamaton?.bullets?.length ? (
              <div className="mt-5">
                <div className="text-sm font-extrabold text-neutral-900">Highlights</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  {hamaton.bullets.slice(0, 8).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hamaton?.sourceUrl ? (
              <div className="mt-4 text-sm">
                <a href={hamaton.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 hover:underline">
                  Manufacturer details
                </a>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 md:w-[320px]">
            <div className="text-xs font-semibold text-neutral-500">Price</div>
            <div className="mt-1 text-3xl font-extrabold text-neutral-900">
              {typeof price === "number" ? money(price) : "—"}
            </div>
            <div className="mt-3 text-sm font-extrabold text-green-800">
              {item?.inStock === false ? "Out of stock" : "In stock"}
            </div>

            <button
              type="button"
              disabled
              className="mt-5 h-11 w-full rounded-xl bg-[var(--brand-red)] text-sm font-extrabold text-white opacity-60"
              title="Cart not implemented yet"
            >
              Add to cart
            </button>

            <div className="mt-3 text-xs text-neutral-500">
              (Next: wire this into quotes/cart once we decide the checkout flow.)
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
