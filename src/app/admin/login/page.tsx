export const runtime = "nodejs";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const next = (Array.isArray((sp as any).next) ? (sp as any).next[0] : (sp as any).next) || "/admin";
  const err = (Array.isArray((sp as any).err) ? (sp as any).err[0] : (sp as any).err) || "";

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-md px-4 py-14">
        <h1 className="text-2xl font-extrabold text-neutral-900">Admin</h1>
        <p className="mt-1 text-sm text-neutral-700">Sign in to manage rebates and quote settings.</p>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Invalid password.
          </div>
        ) : null}

        <form action="/api/admin/login" method="post" className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <input type="hidden" name="next" value={next} />

          <label className="grid gap-1 text-xs font-semibold text-neutral-700">
            Password
            <input
              name="password"
              type="password"
              required
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              autoFocus
            />
          </label>

          <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
