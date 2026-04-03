# Email Campaign System

**Created:** 2026-04-03

Marketing campaign infrastructure built on top of existing email subscriber system. Completely separate from abandoned cart email flows.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN UI (future)                           │
│  Campaign Builder → Preview → Schedule/Send → Stats Dashboard   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN API                                   │
│  /api/admin/email-campaigns/*                                   │
│  CRUD, schedule, start, pause, resume, cancel, stats            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICES                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Audience    │  │ Campaign    │  │ Campaign Renderer       │ │
│  │ Resolver    │  │ Service     │  │ (DB-first, no vendor)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CRON JOBS                                    │
│  process: Start scheduled campaigns                              │
│  send-batch: Send emails in batches                             │
│  recurring: Create monthly instances                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE                                     │
│  email_campaigns → email_campaign_recipients → email_campaign_events │
│  email_subscribers (extended with campaign fields)               │
└─────────────────────────────────────────────────────────────────┘
```

## Database Changes

### New Tables

1. **email_campaigns** - Campaign definitions
   - Status workflow: draft → scheduled → sending → sent
   - Stores content, audience rules, stats

2. **email_campaign_recipients** - Snapshot of recipients at send time
   - Created when campaign is scheduled (not dynamic)
   - Tracks per-recipient status and engagement

3. **email_campaign_events** - Detailed event log
   - sent, delivered, opened, clicked, bounced, complained, unsubscribed

### email_subscribers Extensions

- `unsubscribe_token` - One-click unsubscribe
- `suppression_reason` - hard_bounce, complaint, spam_report
- `suppressed_at` - When suppressed
- `last_active_at` - For segmentation
- `last_cart_at` - For behavior targeting
- `last_order_at` - For purchase-based segmentation
- `last_campaign_sent_at` - Prevents over-mailing

## API Routes

### Admin Campaign API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/email-campaigns` | List campaigns |
| POST | `/api/admin/email-campaigns` | Create campaign |
| GET | `/api/admin/email-campaigns/[id]` | Get campaign |
| PATCH | `/api/admin/email-campaigns/[id]` | Update campaign |
| DELETE | `/api/admin/email-campaigns/[id]` | Delete campaign |
| POST | `/api/admin/email-campaigns/[id]/duplicate` | Duplicate |
| GET | `/api/admin/email-campaigns/[id]/audience-preview` | Preview audience |
| POST | `/api/admin/email-campaigns/[id]/build-audience` | Build snapshot |
| POST | `/api/admin/email-campaigns/[id]/send-test` | Send test email |
| POST | `/api/admin/email-campaigns/[id]/schedule` | Schedule for future |
| POST | `/api/admin/email-campaigns/[id]/start-now` | Start immediately |
| POST | `/api/admin/email-campaigns/[id]/pause` | Pause sending |
| POST | `/api/admin/email-campaigns/[id]/resume` | Resume paused |
| POST | `/api/admin/email-campaigns/[id]/cancel` | Cancel campaign |
| GET | `/api/admin/email-campaigns/[id]/stats` | Get statistics |

### Cron Routes

| Route | Frequency | Description |
|-------|-----------|-------------|
| `/api/cron/email-campaigns/process` | Every 1-5 min | Start scheduled campaigns |
| `/api/cron/email-campaigns/send-batch` | Every 1-2 min | Process send batches |
| `/api/cron/email-campaigns/recurring` | Daily | Create monthly instances |

### Webhook

| Route | Description |
|-------|-------------|
| `/api/webhooks/resend` | Handle Resend events (delivered, opened, clicked, bounced, complained) |

## Example: audienceRulesJson

```json
{
  "vehicleMake": "Ford",
  "vehicleModel": "Mustang",
  "vehicleYearMin": 2015,
  "vehicleYearMax": 2024,
  "sources": ["newsletter", "checkout"],
  "hasCart": false,
  "hasPurchase": true,
  "activeWithinDays": 90,
  "recentCampaignExcludeDays": 7,
  "includeTest": false
}
```

## Example: contentJson

```json
{
  "blocks": [
    {
      "type": "hero",
      "data": {
        "headline": "Summer Tire Sale",
        "subheadline": "Up to 30% off all-season tires",
        "backgroundColor": "#dc2626"
      }
    },
    {
      "type": "promo_banner",
      "data": {
        "text": "Use code SUMMER30 at checkout",
        "expiresAt": "2026-06-30T23:59:59Z"
      }
    },
    {
      "type": "product_grid",
      "data": {
        "title": "Top Picks",
        "columns": 2,
        "products": [
          {
            "name": "Michelin Pilot Sport 4S",
            "brand": "Michelin",
            "imageUrl": "https://...",
            "price": "$299",
            "originalPrice": "$349",
            "linkUrl": "/tires/michelin-pilot-sport-4s"
          }
        ]
      }
    },
    {
      "type": "cta_button",
      "data": {
        "text": "Shop All Tires",
        "url": "/tires",
        "style": "primary",
        "alignment": "center"
      }
    }
  ]
}
```

## Content Block Types

| Type | Description |
|------|-------------|
| `hero` | Large header with headline, optional image |
| `promo_banner` | Highlighted promotional text |
| `rebate_section` | List of manufacturer rebates |
| `product_grid` | 2-4 column product showcase |
| `package_highlight` | Featured wheel+tire package |
| `text_block` | Free-form HTML/text content |
| `cta_button` | Call-to-action button |
| `divider` | Horizontal rule |

## Test Plan

### 1. Migration Test
```bash
# Run migration
psql $POSTGRES_URL -f drizzle/migrations/0020_email_campaigns.sql

# Verify tables created
psql $POSTGRES_URL -c "\dt email_campaign*"
```

### 2. API Tests

```bash
# Create a test campaign
curl -X POST http://localhost:3001/api/admin/email-campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "campaignType": "newsletter",
    "subject": "Test Subject",
    "isTest": true,
    "contentJson": {"blocks": []},
    "audienceRulesJson": {"includeTest": true}
  }'

# List campaigns
curl http://localhost:3001/api/admin/email-campaigns?includeTest=true

# Preview audience
curl http://localhost:3001/api/admin/email-campaigns/{id}/audience-preview

# Send test email
curl -X POST http://localhost:3001/api/admin/email-campaigns/{id}/send-test \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 3. Safe Mode Testing

Set `EMAIL_SAFE_MODE=true` in `.env.local` to log emails instead of sending.

```bash
# Enable safe mode
echo "EMAIL_SAFE_MODE=true" >> .env.local

# Start campaign (will log instead of send)
curl -X POST http://localhost:3001/api/admin/email-campaigns/{id}/start-now

# Run batch (check logs)
curl http://localhost:3001/api/cron/email-campaigns/send-batch
```

## Rollout Notes

### Phase 1: Database & API (Current)
1. ✅ Run migration `0020_email_campaigns.sql`
2. ✅ Deploy API routes
3. Test with `isTest: true` campaigns only
4. Verify cron jobs work in safe mode

### Phase 2: Admin UI
1. Build campaign list page
2. Build campaign builder (content editor)
3. Build audience preview component
4. Build stats dashboard

### Phase 3: Production
1. Disable `EMAIL_SAFE_MODE`
2. Configure Resend webhook URL
3. Set up Vercel cron jobs
4. Monitor delivery rates

## Files Created

```
drizzle/migrations/
  0020_email_campaigns.sql

src/lib/email/campaigns/
  types.ts
  audienceResolver.ts
  campaignRenderer.ts
  campaignService.ts
  index.ts

src/app/api/admin/email-campaigns/
  route.ts
  [id]/route.ts
  [id]/duplicate/route.ts
  [id]/audience-preview/route.ts
  [id]/build-audience/route.ts
  [id]/send-test/route.ts
  [id]/schedule/route.ts
  [id]/start-now/route.ts
  [id]/pause/route.ts
  [id]/resume/route.ts
  [id]/cancel/route.ts
  [id]/stats/route.ts

src/app/api/cron/email-campaigns/
  process/route.ts
  send-batch/route.ts
  recurring/route.ts

src/app/api/webhooks/
  resend/route.ts

src/lib/fitment-db/schema.ts (modified)
```

## What's NOT Touched

- ❌ Abandoned cart email flow (`abandonedCartEmail.ts`)
- ❌ Fitment logic
- ❌ Existing subscriber service (only extended)
- ❌ Order confirmation emails
- ❌ Quote emails
