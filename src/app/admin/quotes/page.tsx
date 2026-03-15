import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getPool, listQuotes } from "@/lib/quotes";

export const runtime = "nodejs";

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (Array.isArray((sp as any).q) ? (sp as any).q[0] : (sp as any).q) || "";

  let err: string | null = null;
  let items: Awaited<ReturnType<typeof listQuotes>> = [];

  try {
    const db = getPool();
    items = await listQuotes(db, { q: String(q || ""), limit: 100 });
  } catch (e: any) {
    err = e?.message || String(e);
  }

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Quotes</h1>
            <p className="mt-1 text-sm text-neutral-700">Saved customer quotes (shareable links).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a className="h-9 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold" href="/admin">
              Admin
            </a>
            <form action="/api/admin/logout" method="post">
              <button className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <form className="mt-6 flex flex-wrap items-end gap-2" action="/admin/quotes" method="get">
          <label className="grid gap-1 text-xs font-semibold text-neutral-700">
            Search
            <input
              name="q"
              defaultValue={q}
              className="h-10 w-[min(420px,100%)] rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              placeholder="Name, email, phone, vehicle"
            />
          </label>
          <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white">Search</button>
          <a className="h-10 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold" href="/quote/new">
            New quote
          </a>
        </form>

        {err ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{err}</div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="grid grid-cols-[160px_1fr_220px_220px] gap-0 border-b border-neutral-200 bg-neutral-50 p-3 text-xs font-extrabold text-neutral-700">
            <div>Quote</div>
            <div>Customer</div>
            <div>Vehicle</div>
            <div>Updated</div>
          </div>

          {items.length ? (
            <div className="divide-y divide-neutral-200">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-[160px_1fr_220px_220px] gap-0 p-3">
                  <div>
                    <Link href={`/quote/${it.id}`} className="text-sm font-extrabold text-neutral-900 hover:underline">
                      {it.id.slice(0, 8).toUpperCase()}
                    </Link>
                    <div className="mt-1 text-[11px] text-neutral-600">{BRAND.name}</div>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-neutral-900">{it.customer_first} {it.customer_last}</div>
                    <div className="mt-1 text-[11px] text-neutral-600">
                      {it.customer_email ? it.customer_email : ""}
                      {it.customer_email && it.customer_phone ? " • " : ""}
                      {it.customer_phone ? it.customer_phone : ""}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-neutral-700">{it.vehicle_label || "—"}</div>
                  <div className="text-xs text-neutral-600">{new Date(it.updated_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-neutral-700">No quotes yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}
