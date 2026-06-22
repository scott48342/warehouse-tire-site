# Local Production-Mode Testing

When validating changes with a production build locally
(`next build && next start`), the local server **must use the same database
family as Vercel production**. Otherwise you get false failures that do not
reproduce in production.

## The database

- **Vercel production** `POSTGRES_URL` points at the **Neon** Postgres instance
  (host: `ep-aged-dust-*.neon.tech`). This is the source of truth for all
  runtime tables, including `tireweb_sku_cache`.
- The local dev env file `.env.local` already uses the correct **Neon**
  `POSTGRES_URL`, so plain `next dev` and `next start` (with no
  `.env.production.local`) both hit the right database.

## The footgun: a stale `.env.production.local`

`next start` runs with `NODE_ENV=production`, and Next.js loads env files in
this priority:

```
.env.production.local  >  .env.local  >  .env.production  >  .env
```

A `vercel env pull --environment=production` writes a `.env.production.local`
whose `POSTGRES_URL` may point at the **Prisma proxy** endpoint
(`db.prisma.io`). That endpoint does **not** contain all runtime tables (e.g.
`tireweb_sku_cache` is missing). Because `.env.production.local` outranks
`.env.local`, local `next start` then silently queries the wrong DB.

### Symptom observed (Phase 2C, 2026-06-22)

Bare TireWeb PDP URLs (`/tires/<partNumber>` with no `?source`/`?size`) returned
**404 locally** because the cache redirect queried `tireweb_sku_cache`, which is
absent on `db.prisma.io`. The same URLs worked correctly in production (Neon).
The error surfaced as Postgres `42P01 undefined_table`, swallowed by a
defensive `try/catch`, so it manifested only as a 404.

## The rule

- **Preferred:** do **not** keep a real `.env.production.local`. With it absent,
  `next start` falls back to `.env.local` (Neon) and matches Vercel.
- If you must have one (e.g. for production-only flags), override only the keys
  you need and keep `POSTGRES_URL` pointed at the **same Neon instance** as
  Vercel. **Never** point it at `db.prisma.io` / the Prisma proxy.
- See `.env.production.local.example` for a template (no secrets).

## Verify before trusting a local prod-mode run

```bash
# Which DB host will next start use?  (should be ...neon.tech, NOT db.prisma.io)
#   check the POSTGRES_URL host in whichever env file wins (see priority above)

# Smoke test: a known TireWeb part should 307-redirect to a resolvable route
curl -sI "http://localhost:3000/tires/TH0389" | grep -i "^location"
# expected: location: /tires/km/TH0389?size=275%2F65R18
```

If a bare TireWeb URL 404s locally but works in production, suspect a stale
`.env.production.local` pointing at the wrong database.
