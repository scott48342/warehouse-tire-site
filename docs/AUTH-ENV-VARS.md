# Authentication Environment Variables

This document describes the environment variables required for the Better Auth authentication system.

## Required Variables

### `POSTGRES_URL`
**Required.** Already configured for the site.

PostgreSQL connection string. Better Auth uses this database for storing users, sessions, and auth tokens.

### `BETTER_AUTH_SECRET`
**Required for production.**

A cryptographically random secret used for signing session tokens and other auth tokens. Must be at least 32 characters.

Generate one with:
```bash
openssl rand -base64 32
```

Or:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```
BETTER_AUTH_SECRET=your-random-secret-at-least-32-characters
```

**In development:** If not set, a default dev secret is used with a warning. Do NOT rely on this in production.

### `RESEND_API_KEY`
**Required for production email delivery.**

API key from [Resend](https://resend.com). Used to send:
- Email verification links after signup
- Password reset links

If not set, emails will be logged to console only (development mode).

```
RESEND_API_KEY=re_xxxxxxxxxxxx
```

## Optional Variables

### `AUTH_EMAIL_FROM`
**Optional.** Default: `Warehouse Tire Direct <noreply@warehousetiredirect.com>`

The "From" address for authentication emails. Must be a verified sender in Resend.

```
AUTH_EMAIL_FROM=Warehouse Tire Direct <noreply@warehousetiredirect.com>
```

### `NEXT_PUBLIC_BASE_URL`
**Recommended for production.** Already configured for the site.

The public-facing URL of the site. Used for generating email verification and password reset links.

Examples:
- Production: `https://shop.warehousetiredirect.com`
- Local: `https://shop.warehousetire.net`
- Development: `http://localhost:3000`

If not set, Better Auth will attempt to use `VERCEL_URL` or fall back to `http://localhost:3000`.

## Vercel Configuration

For production deployment, ensure these variables are set in Vercel:

1. Go to Project Settings → Environment Variables
2. Add/verify:
   - `BETTER_AUTH_SECRET` (all environments) - **REQUIRED**
   - `RESEND_API_KEY` (all environments)
   - `AUTH_EMAIL_FROM` (optional, all environments)

The following are already configured:
- `POSTGRES_URL` - Database connection
- `NEXT_PUBLIC_BASE_URL` - Site URL

## Security Notes

1. **Never commit secrets** - All sensitive values should be in environment variables only
2. **RESEND_API_KEY** - Keep this secret; it allows sending emails from your domain
3. **Session cookies** - Better Auth automatically uses secure cookies in production (HTTPS)

## Testing Email Locally

Without `RESEND_API_KEY`, auth operations will log email URLs to the console:

```
[auth] [DEV] Verification URL: http://localhost:3000/api/auth/verify-email?token=xxx
[auth] [DEV] Token: xxx
```

You can click these URLs directly in development to verify emails or reset passwords.
