import Link from "next/link";

export const runtime = "nodejs";

type TpmsItem = {
  partNumber?: string;
  mfgPartNumber?: string;
  size?: string;
  description?: string;
  vendorName?: string;
  brand?: string;
  cost?: number;
  fet?: number;
  quantity?: {
    primary?: number;
    alternate?: number;
    national?: number;
  };
  code?: string | number;
};

type ApiOk = {
  partNumber: string;
  vendor?: string;
  upstream: string;
  count: number;
  items: TpmsItem[];
};

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getMarkupMultiplier() {
  // Default: 45% over cost (cost * 1.45)
  const raw = (process.env.ACCESSORIES_TPMS_MARKUP || process.env.TPMS_MARKUP || "1.45").trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1.45;
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
  const cost = typeof item?.cost === "number" ? item.cost : undefined;
  const multiplier = getMarkupMultiplier();
  const price = typeof cost === "number" ? Number((cost * multiplier).toFixed(2)) : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link href="/accessories/tpms" className="text-sm font-semibold text-neutral-700 hover:underline">
        ← Back to TPMS search
      </Link>

      <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">{partNumber}</h1>
            {item?.description ? (
              <p className="mt-2 text-sm font-semibold text-neutral-700">{item.description}</p>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">TPMS sensor</p>
            )}

            <div className="mt-4 grid gap-2 text-sm text-neutral-700">
              {item?.vendorName ? (
                <div>
                  Vendor: <span className="font-semibold">{item.vendorName}</span>
                </div>
              ) : null}
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
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 md:w-[320px]">
            <div className="text-xs font-semibold text-neutral-500">Price</div>
            <div className="mt-1 text-3xl font-extrabold text-neutral-900">
              {typeof price === "number" ? money(price) : "—"}
            </div>
            {typeof cost === "number" ? (
              <div className="mt-2 text-xs text-neutral-600">
                Based on KM cost {money(cost)} × {multiplier}
              </div>
            ) : (
              <div className="mt-2 text-xs text-neutral-600">Unable to load cost from KM.</div>
            )}

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
