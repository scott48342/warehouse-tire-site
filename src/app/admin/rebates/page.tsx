import { getPool, listRebates, type SiteRebate } from "@/lib/rebates";

export const runtime = "nodejs";

function fmtTime(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function fmtExpires(s: string | null): { text: string; expired: boolean; soon: boolean } {
  if (!s) return { text: "No expiry", expired: false, soon: false };
  try {
    const d = new Date(s);
    const now = new Date();
    const expired = d < now;
    const soon = !expired && d.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
    const text = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { text: expired ? `Expired ${text}` : text, expired, soon };
  } catch {
    return { text: s, expired: false, soon: false };
  }
}

function getTargetingLabel(r: SiteRebate): string {
  const parts: string[] = [];
  if (r.eligible_skus?.length) parts.push(`${r.eligible_skus.length} SKUs`);
  if (r.eligible_models?.length) parts.push(`${r.eligible_models.length} models`);
  if (r.eligible_sizes?.length) parts.push(`${r.eligible_sizes.length} sizes`);
  if (parts.length === 0 && r.brand_wide) return "Brand-wide";
  return parts.join(", ") || "No targeting";
}

export default async function RebatesAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const refreshed = (Array.isArray((sp as any).refreshed) ? (sp as any).refreshed[0] : (sp as any).refreshed) || "";
  const count = (Array.isArray((sp as any).count) ? (sp as any).count[0] : (sp as any).count) || "";
  const saved = (Array.isArray((sp as any).saved) ? (sp as any).saved[0] : (sp as any).saved) || "";

  let rebates: Awaited<ReturnType<typeof listRebates>> = [];
  let dbError: string | null = null;

  try {
    const db = getPool();
    rebates = await listRebates(db);
  } catch (e: any) {
    dbError = e?.message || String(e);
  }

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Tire Rebates</h1>
            <p className="mt-1 text-sm text-neutral-700">
              Manage manufacturer rebates. Check{" "}
              <a href="https://www.discounttire.com/promotions" target="_blank" className="underline">
                Discount Tire
              </a>{" "}
              for current offers. Auto-expires based on end date.
            </p>
          </div>
        </div>

        {dbError && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Rebates admin unavailable: {dbError}
          </div>
        )}

        {saved && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            ✓ Rebate saved successfully.
          </div>
        )}

        {/* Warning box */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>⚠️ Manufacturer rebates only</strong> — Form URL must go to manufacturer's site 
          (e.g., goodyearrebates.com). Do NOT add Discount Tire "Instant Savings" or credit card promos.
        </div>

        {/* Add/Edit Form */}
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="text-base font-extrabold text-neutral-900">Add / Update Rebate</div>
          <div className="mt-1 text-xs text-neutral-500">
            One rebate per brand. Use targeting fields to limit eligibility.
          </div>

          <form action="/api/admin/rebates/upsert" method="post" className="mt-4 grid gap-4">
            {/* Row 1: Core info */}
            <div className="grid gap-3 md:grid-cols-4">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Brand *
                <input name="brand" required className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Goodyear" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Rebate Amount
                <input name="rebateAmount" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="$80 or Up to $100" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Rebate Type
                <select name="rebateType" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
                  <option value="mail-in">Mail-in Rebate</option>
                  <option value="instant">Instant Rebate</option>
                  <option value="prepaid-card">Prepaid Card</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Valid Dates
                <input name="endsText" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="March 1 – June 30" />
              </label>
            </div>

            {/* Row 2: Headline */}
            <label className="grid gap-1 text-xs font-semibold text-neutral-700">
              Headline *
              <input
                name="headline"
                required
                className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                placeholder="Get $80 back via Mastercard Prepaid Card on select sets of tires"
              />
            </label>

            {/* Row 3: URLs */}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Learn More URL
                <input name="learnMoreUrl" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="https://..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Form / Submit URL (manufacturer site)
                <input name="formUrl" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="https://goodyearrebates.com/..." />
              </label>
            </div>

            {/* Row 4: Requirements */}
            <label className="grid gap-1 text-xs font-semibold text-neutral-700">
              Purchase Requirements
              <input name="requirements" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Set of 4 tires required" />
            </label>

            {/* Targeting Section */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-bold text-neutral-900">Eligibility Targeting</div>
              <div className="mt-1 text-xs text-neutral-500">
                Leave all blank + check "Brand-wide" to apply to all tires of this brand.
                Otherwise, specify SKUs, models, or sizes.
              </div>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                  Eligible SKUs (comma-separated, exact match)
                  <input name="eligibleSkus" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-mono" placeholder="GOO123456, GOO123457" />
                </label>

                <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                  Eligible Models (comma-separated, partial match)
                  <input name="eligibleModels" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Assurance, Eagle F1, Wrangler AT" />
                </label>

                <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                  Eligible Sizes (comma-separated, exact match)
                  <input name="eligibleSizes" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-mono" placeholder="225/60R16, 265/70R17" />
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                  <input type="checkbox" name="brandWide" value="1" defaultChecked />
                  Brand-wide (applies to all tires if no SKUs/models/sizes specified)
                </label>
              </div>
            </div>

            {/* Row 5: Internal notes */}
            <label className="grid gap-1 text-xs font-semibold text-neutral-700">
              Internal Notes (not shown to customers)
              <textarea name="internalNotes" rows={2} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm" placeholder="Admin notes..." />
            </label>

            {/* Row 6: Enable + Submit */}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                <input type="checkbox" name="enabled" value="1" className="h-5 w-5" />
                Enable rebate
              </label>
              <button className="h-11 rounded-xl bg-neutral-900 px-6 text-sm font-extrabold text-white hover:bg-neutral-800">
                Save Rebate
              </button>
            </div>
          </form>
        </div>

        {/* Rebates List */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="grid grid-cols-[80px_1fr_100px_100px_100px] gap-0 border-b border-neutral-200 bg-neutral-50 p-3 text-xs font-extrabold text-neutral-700">
            <div>Status</div>
            <div>Offer</div>
            <div>Brand</div>
            <div>Targeting</div>
            <div>Expires</div>
          </div>

          {rebates.length ? (
            <div className="divide-y divide-neutral-200">
              {rebates.map((r) => {
                const exp = fmtExpires(r.expires_at);
                const targeting = getTargetingLabel(r);
                return (
                  <div
                    key={r.id}
                    className={
                      "grid grid-cols-[80px_1fr_100px_100px_100px] gap-0 p-3 " +
                      (exp.expired ? "bg-red-50 opacity-60" : exp.soon ? "bg-amber-50" : "")
                    }
                  >
                    <div>
                      <form action="/api/admin/rebates/toggle" method="post">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="enabled" value={r.enabled ? "0" : "1"} />
                        <button
                          className={
                            "h-7 rounded-lg px-2 text-[10px] font-extrabold " +
                            (exp.expired
                              ? "bg-red-200 text-red-800"
                              : r.enabled
                                ? "bg-emerald-600 text-white"
                                : "border border-neutral-200 bg-white text-neutral-900")
                          }
                        >
                          {exp.expired ? "EXPIRED" : r.enabled ? "ON" : "OFF"}
                        </button>
                      </form>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-neutral-900">{r.headline}</span>
                        {r.rebate_amount && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {r.rebate_amount}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {r.learn_more_url && (
                          <a className="text-neutral-900 underline" href={r.learn_more_url} target="_blank">
                            Details
                          </a>
                        )}
                        {r.form_url && (
                          <a className="text-neutral-900 underline" href={r.form_url} target="_blank">
                            Form
                          </a>
                        )}
                        {r.ends_text && <span className="text-neutral-500">{r.ends_text}</span>}
                        {r.requirements && <span className="text-neutral-500">• {r.requirements}</span>}
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-neutral-700">{r.brand || "—"}</div>
                    
                    <div className="text-[10px] text-neutral-500">{targeting}</div>

                    <div className={
                      "text-xs font-medium " +
                      (exp.expired ? "text-red-600" : exp.soon ? "text-amber-600" : "text-neutral-600")
                    }>
                      {exp.text}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-sm text-neutral-700">No rebates yet. Add one above.</div>
          )}
        </div>

        <div className="mt-4 text-xs text-neutral-500">
          Rebate badges show on eligible tire SRP cards and PDPs. Expired rebates auto-hide.
        </div>
      </div>
    </main>
  );
}
