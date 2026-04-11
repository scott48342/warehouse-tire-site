# Blog Syndication System

Auto-posts blog content to multiple platforms for SEO backlinks.

## Platforms

| Platform | Status | Backlink Value | Notes |
|----------|--------|----------------|-------|
| Facebook | ✅ Ready | Medium | Uses existing page token |
| LinkedIn | 🔧 Setup needed | High | Company page posts |
| Medium | 🔧 Setup needed | High | Full republish with canonical |
| Reddit | 🔧 Setup needed | High | Auto-selects relevant subreddits |
| Quora | ❌ Manual only | Medium | No API for posting |

## Setup

### Environment Variables

Add to `.env.local`:

```env
# ========== FACEBOOK (already have) ==========
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_ACCESS_TOKEN=your_page_token

# ========== LINKEDIN ==========
# 1. Create app at https://www.linkedin.com/developers/apps
# 2. Request "w_member_social" and "w_organization_social" permissions
# 3. Get OAuth token via authorization flow
LINKEDIN_ACCESS_TOKEN=your_oauth_token
LINKEDIN_ORG_ID=your_company_page_id  # Optional, for company posts

# ========== MEDIUM ==========
# 1. Go to https://medium.com/me/settings/security
# 2. Scroll to "Integration tokens"
# 3. Generate a new token
MEDIUM_INTEGRATION_TOKEN=your_token

# ========== REDDIT ==========
# 1. Go to https://www.reddit.com/prefs/apps
# 2. Create "script" type app
# 3. Note: Use a dedicated account, not your personal one
REDDIT_CLIENT_ID=your_app_id
REDDIT_CLIENT_SECRET=your_app_secret
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
```

## LinkedIn Setup (Step by Step)

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click "Create App"
3. Fill in:
   - App name: "Warehouse Tire Direct"
   - LinkedIn Page: Select your company page
   - App logo: Upload logo
4. Under "Products", request access to:
   - "Share on LinkedIn"
   - "Sign In with LinkedIn using OpenID Connect"
5. Under "Auth", note your Client ID and Client Secret
6. Add redirect URL: `https://shop.warehousetiredirect.com/api/auth/linkedin/callback`
7. Generate an access token using OAuth flow (or use a tool like [LinkedIn Token Generator](https://www.linkedin.com/developers/tools/oauth))

## Medium Setup

1. Log into Medium
2. Go to Settings → Security → Integration Tokens
3. Click "Get integration token"
4. Copy the token to your `.env.local`

That's it! Medium is the easiest to set up.

## Reddit Setup

1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Click "create another app..."
3. Select "script"
4. Name: "Warehouse Tire Blog"
5. Redirect URI: `http://localhost:8080` (not used for script apps)
6. Create the app
7. Note the client ID (under app name) and secret

**Important Reddit Notes:**
- Create a dedicated Reddit account for posting (don't use personal)
- The script auto-selects 2-3 relevant subreddits based on content
- Posts are spread out to avoid rate limits
- Don't over-post — Reddit will ban spammy accounts

### Target Subreddits

The script automatically picks from:
- **Tire content**: r/Tires, r/MechanicAdvice
- **Wheel content**: r/Wheels, r/Rims, r/projectcar
- **Truck content**: r/Trucks, r/f150, r/ram_trucks, r/Silverado
- **Jeep content**: r/Jeep, r/JeepWrangler, r/Wrangler
- **General**: r/Cartalk, r/autorepair

## Usage

```bash
cd scripts/blog-syndication

# Syndicate all new posts to all platforms
node syndicate.js

# Dry run (preview without posting)
node syndicate.js --dry-run

# Specific platform only
node syndicate.js --platform=facebook
node syndicate.js --platform=linkedin
node syndicate.js --platform=medium
node syndicate.js --platform=reddit

# Specific post only
node syndicate.js --slug=best-wheels-for-lifted-trucks-2026
```

## Automated Posting

Cron job runs daily at 10 AM ET:
- Checks for new blog posts
- Syndicates to all configured platforms
- Tracks what's been posted in `syndicated.json`

## Content Strategy

### Facebook
- Engaging hook + excerpt
- Link to full article
- Hashtags for reach

### LinkedIn
- Professional angle
- Industry insights focus
- Good for B2B visibility

### Medium
- Full article republished
- **Canonical URL** points back to your site (important for SEO!)
- Cross-posted notice at bottom

### Reddit
- Link posts (not self-posts)
- Posted to relevant subreddits only
- Avoid looking promotional — let the content speak

## Tracking

All syndication tracked in `syndicated.json`:
```json
{
  "posts": {
    "best-wheels-for-lifted-trucks-2026": {
      "platforms": {
        "facebook": { "timestamp": "...", "postId": "..." },
        "linkedin": { "timestamp": "...", "postId": "..." },
        "medium": { "timestamp": "...", "url": "..." },
        "reddit": { "timestamp": "...", "posts": [...] }
      }
    }
  }
}
```

## Manual Platforms

### Quora (No API)
1. Find relevant questions about tires/wheels
2. Write a helpful, detailed answer
3. Naturally link to your blog post as a resource
4. Don't be spammy — provide real value

### Pinterest (Future)
Can add if you have good hero images for posts.

## Troubleshooting

### Facebook token expired
Tokens expire after 60 days. Refresh via [Access Token Tool](https://developers.facebook.com/tools/accesstoken/).

### LinkedIn 401 error
OAuth token expired. Need to re-authorize.

### Reddit rate limited
Wait 10 minutes. Reduce posting frequency.

### Medium duplicate error
Post already exists. Check `syndicated.json`.
