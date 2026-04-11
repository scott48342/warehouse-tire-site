# Social Content Generator

Auto-generates and posts wheel content to Facebook, Instagram, and TikTok.

## Setup

### 1. Environment Variables

Add to `.env.local`:

```env
# Facebook/Instagram (Meta Graph API)
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_ACCESS_TOKEN=your_long_lived_page_access_token
INSTAGRAM_ACCOUNT_ID=your_instagram_business_account_id  # Optional

# TikTok (coming soon)
TIKTOK_ACCESS_TOKEN=
```

### 2. Get Meta API Credentials

1. Go to [Meta for Developers](https://developers.facebook.com/apps/)
2. Create or select your app
3. Add "Facebook Login" and "Pages API" products
4. Go to [Access Token Tool](https://developers.facebook.com/tools/accesstoken/)
5. Get your Page Access Token
6. [Extend to long-lived token](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/) (lasts 60 days)

### 3. Install Dependencies

```bash
cd scripts/social-content
npm install form-data  # For Facebook uploads
```

### 4. Add Background Music (Optional)

Drop royalty-free MP3/WAV files into `music/` folder for video backgrounds.
Recommended: [Pixabay Music](https://pixabay.com/music/), [Free Music Archive](https://freemusicarchive.org/)

## Usage

### Generate Content

```bash
# Generate 3 wheel posts (default)
node generate.js

# Generate 10 posts
node generate.js --count=10
```

Output goes to `output/` folder:
- `{style}_{timestamp}.jpg` - Wheel image
- `{style}_{timestamp}.json` - Content metadata + captions

### Generate Videos (for TikTok/Reels)

Requires [FFmpeg](https://ffmpeg.org/download.html) installed.

```bash
# Generate video for specific content
node generate-video.js fuel_flame_1234567890.json

# Generate videos for all content
node generate-video.js --all
```

### Post to Facebook

```bash
# Post next unposted content
node post-facebook.js

# Preview without posting
node post-facebook.js --dry-run

# Post specific content
node post-facebook.js --file=fuel_flame_1234567890.json
```

### Automated Posting (Cron)

Set up twice-daily posting:

```bash
# In Clawdbot, create cron jobs:
# Morning post (9 AM ET)
# Evening post (6 PM ET)
```

## File Structure

```
social-content/
├── generate.js          # Generate content from wheel inventory
├── generate-video.js    # Create TikTok/Reels videos
├── post-facebook.js     # Post to Facebook/Instagram
├── posted.json          # Track what's been posted
├── output/              # Generated content
│   ├── *.jpg            # Wheel images
│   ├── *.mp4            # Videos (if generated)
│   └── *.json           # Content metadata
├── music/               # Background music for videos
└── README.md
```

## Content Strategy

The generator picks wheels that:
- Are in stock
- Have good images
- Are reasonably priced ($100-$800)
- Look good on popular vehicles (F-150, Wrangler, Mustang, etc.)

Captions include:
- Wheel name and specs
- Price
- Relevant hashtags
- Call-to-action

## TikTok Posting

TikTok doesn't allow easy automated posting. Options:

1. **Manual Upload**: Generate videos, manually upload to TikTok
2. **Later.com**: Schedule TikTok posts through their platform ($25/mo)
3. **TikTok API**: Apply for Content Posting API access (slow approval)

For now, generate videos and use a scheduler or manual upload.
