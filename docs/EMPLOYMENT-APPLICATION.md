# Employment Application System

## Overview

The employment application system allows job seekers to apply online at `/careers`. Applications are stored in the database, emails are sent to management and applicants, and an admin dashboard is available at `/admin/applications`.

## URLs

- **Public Form**: `/careers` (or `/employment` if you add a redirect)
- **Admin Dashboard**: `/admin/applications`

## Features

### Public Application Form (`/careers`)

- **Personal Information**: Name, phone, email, address
- **Position Details**: Position, preferred store, desired pay, start date, employment type
- **Availability**: Day-by-day availability with time ranges
- **Qualification Questions**: Work authorization, transportation, license, previous employment
- **Experience**: Years of automotive/tire experience, customer service, sales
- **Skills Checkboxes**: ASE certified, forklift, alignment, TPMS, mount/balance, oil change, brakes, suspension
- **Employment History**: Up to 3 previous employers with full details
- **Education**: Highest level completed
- **References**: Up to 3 professional references
- **Resume Upload**: PDF, DOC, DOCX (max 10MB) - stored in Vercel Blob
- **How did you hear about us**: Source tracking
- **Additional Comments**: Free text
- **Electronic Signature**: Certification agreement + typed signature

### Admin Dashboard (`/admin/applications`)

- View all applications with search and filters
- Filter by status, position, store
- Update application status: New → Reviewing → Interviewed → Hired/Rejected/Archived
- View full application details in modal
- Download resumes
- Pagination

### Email Notifications

1. **Management Notification**: Full HTML email with all application details sent to `EMPLOYMENT_TO`
2. **Applicant Confirmation**: Professional confirmation email sent to applicant

## Environment Variables

Add these to Vercel (or `.env.local` for development):

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM=noreply@warehousetire.net

# Optional (defaults shown)
EMPLOYMENT_TO=scott@warehousetire.net  # Falls back to CONTACT_TO

# Spam Protection (optional but recommended)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAxxx  # Cloudflare Turnstile site key
TURNSTILE_SECRET_KEY=0x4AAAAAAAxxx            # Cloudflare Turnstile secret key
```

## Database Setup

Run the migration to create the `employment_applications` table:

```bash
# Option 1: Run the SQL directly
psql $POSTGRES_URL < drizzle/migrations/0013_employment_applications.sql

# Option 2: Use Drizzle Kit
npx drizzle-kit push
```

## Cloudflare Turnstile Setup (Recommended)

1. Go to https://dash.cloudflare.com/turnstile
2. Add a new site
3. Copy the site key to `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
4. Copy the secret key to `TURNSTILE_SECRET_KEY`

Without Turnstile configured, the form will still work but relies only on the honeypot field for spam protection.

## File Structure

```
src/
├── app/
│   ├── careers/
│   │   └── page.tsx              # Public application form
│   ├── admin/
│   │   └── applications/
│   │       └── page.tsx          # Admin dashboard
│   └── api/
│       ├── employment/
│       │   └── route.ts          # Submit application API
│       └── admin/
│           └── applications/
│               ├── route.ts      # List applications API
│               └── [id]/
│                   └── route.ts  # Get/update/delete application API
└── lib/
    └── fitment-db/
        └── schema-employment.ts  # Drizzle schema

drizzle/
└── migrations/
    └── 0013_employment_applications.sql  # Database migration
```

## Status Workflow

```
New → Reviewing → Interviewed → Hired
                            └→ Rejected
                            └→ Archived
```

## Security Features

- **Honeypot field**: Hidden field that bots fill out
- **Turnstile**: Cloudflare CAPTCHA alternative (optional)
- **Duplicate prevention**: Same email + position blocked for 24 hours
- **Input sanitization**: All fields trimmed and validated
- **File validation**: Only PDF/DOC/DOCX allowed, 10MB max
- **IP logging**: For abuse tracking

## Adding Navigation Link

Add "Employment" to the main nav in `src/components/header/Header.tsx` (or your nav component):

```tsx
<Link href="/careers">Careers</Link>
```

Add "Now Hiring" to the footer as specified.

## Future Enhancements

- PDF export of applications
- Interview scheduling integration
- Background check integration
- Applicant tracking status emails
- Multiple location support
- Job postings management
