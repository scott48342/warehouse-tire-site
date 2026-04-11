/**
 * Facebook/Instagram Poster
 * 
 * Posts generated content to Facebook Page and Instagram Business
 * Uses Meta Graph API
 * 
 * Required env vars:
 *   FACEBOOK_PAGE_ID - Your Facebook Page ID
 *   FACEBOOK_ACCESS_TOKEN - Page Access Token (long-lived)
 *   INSTAGRAM_ACCOUNT_ID - Instagram Business Account ID (optional)
 * 
 * Usage: 
 *   node post-facebook.js                    # Post oldest unposted content
 *   node post-facebook.js --file=xxx.json   # Post specific content
 *   node post-facebook.js --dry-run         # Preview without posting
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

// ============================================================================
// Config
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, 'output');
const POSTED_LOG = path.join(__dirname, 'posted.json');

// Support multiple pages with --page=1 or --page=2
const pageArg = process.argv.find(a => a.startsWith('--page='));
const pageNum = pageArg ? parseInt(pageArg.split('=')[1]) : 1;

const PAGE_ID = pageNum === 2 
  ? process.env.FACEBOOK_PAGE_ID_2 
  : process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = pageNum === 2 
  ? process.env.FACEBOOK_ACCESS_TOKEN_2 
  : process.env.FACEBOOK_ACCESS_TOKEN;
const INSTAGRAM_ID = process.env.INSTAGRAM_ACCOUNT_ID;

const PAGE_NAME = pageNum === 2 ? 'Warehouse Tire 1' : 'Warehouse Tire';

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ============================================================================
// Meta Graph API Helpers
// ============================================================================

/**
 * Make a Graph API request
 */
function graphApiRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${GRAPH_API_BASE}${endpoint}`);
    
    if (method === 'GET' && data) {
      Object.entries(data).forEach(([k, v]) => url.searchParams.append(k, v));
    }
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {},
    };
    
    let postData = null;
    if (method === 'POST' && data) {
      if (data instanceof FormData) {
        Object.assign(options.headers, data.getHeaders());
        postData = data;
      } else {
        options.headers['Content-Type'] = 'application/json';
        postData = JSON.stringify(data);
      }
    }
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) {
            reject(new Error(`Graph API Error: ${json.error.message}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Invalid response: ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      if (postData instanceof FormData) {
        postData.pipe(req);
      } else {
        req.write(postData);
        req.end();
      }
    } else {
      req.end();
    }
  });
}

/**
 * Upload photo to Facebook Page
 */
async function postPhotoToFacebook(imagePath, caption) {
  console.log('  Uploading to Facebook...');
  
  const form = new FormData();
  form.append('source', fs.createReadStream(imagePath));
  form.append('caption', caption);
  form.append('access_token', ACCESS_TOKEN);
  
  const result = await graphApiRequest(`/${PAGE_ID}/photos`, 'POST', form);
  return result;
}

/**
 * Post to Instagram Business Account
 * Instagram requires a 2-step process: create media container, then publish
 */
async function postToInstagram(imageUrl, caption) {
  if (!INSTAGRAM_ID) {
    console.log('  Skipping Instagram (no INSTAGRAM_ACCOUNT_ID)');
    return null;
  }
  
  console.log('  Creating Instagram media container...');
  
  // Step 1: Create media container
  const container = await graphApiRequest(`/${INSTAGRAM_ID}/media`, 'POST', {
    image_url: imageUrl,
    caption: caption,
    access_token: ACCESS_TOKEN,
  });
  
  // Step 2: Publish the container
  console.log('  Publishing to Instagram...');
  const result = await graphApiRequest(`/${INSTAGRAM_ID}/media_publish`, 'POST', {
    creation_id: container.id,
    access_token: ACCESS_TOKEN,
  });
  
  return result;
}

// ============================================================================
// Content Management
// ============================================================================

/**
 * Get list of already posted content IDs
 */
function getPostedIds() {
  if (!fs.existsSync(POSTED_LOG)) {
    return new Set();
  }
  const log = JSON.parse(fs.readFileSync(POSTED_LOG, 'utf-8'));
  return new Set(log.posted || []);
}

/**
 * Mark content as posted
 */
function markAsPosted(contentId, platform, postId) {
  let log = { posted: [], history: [] };
  if (fs.existsSync(POSTED_LOG)) {
    log = JSON.parse(fs.readFileSync(POSTED_LOG, 'utf-8'));
  }
  
  if (!log.posted.includes(contentId)) {
    log.posted.push(contentId);
  }
  
  log.history.push({
    contentId,
    platform,
    postId,
    timestamp: new Date().toISOString(),
  });
  
  fs.writeFileSync(POSTED_LOG, JSON.stringify(log, null, 2));
}

/**
 * Get next unposted content
 */
function getNextUnpostedContent() {
  const postedIds = getPostedIds();
  
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort(); // Oldest first
  
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, file), 'utf-8'));
    if (!postedIds.has(content.id)) {
      return content;
    }
  }
  
  return null;
}

/**
 * Load specific content file
 */
function loadContent(filename) {
  const filepath = filename.includes(path.sep) ? filename : path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Content file not found: ${filepath}`);
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='));
  const dryRun = args.includes('--dry-run');
  const skipInstagram = args.includes('--skip-instagram');
  
  console.log('\n📱 Facebook/Instagram Poster\n');
  
  // Validate config
  if (!PAGE_ID || !ACCESS_TOKEN) {
    console.error('❌ Missing required env vars:');
    if (!PAGE_ID) console.error('   - FACEBOOK_PAGE_ID');
    if (!ACCESS_TOKEN) console.error('   - FACEBOOK_ACCESS_TOKEN');
    console.error('\nAdd these to .env.local');
    process.exit(1);
  }
  
  // Get content to post
  let content;
  if (fileArg) {
    const filename = fileArg.split('=')[1];
    content = loadContent(filename);
    console.log(`Loaded: ${filename}`);
  } else {
    content = getNextUnpostedContent();
    if (!content) {
      console.log('No unposted content found. Run generate.js first.');
      process.exit(0);
    }
    console.log(`Selected: ${content.id}`);
  }
  
  // Preview
  console.log('\n--- Content Preview ---');
  console.log(`Wheel: ${content.wheel.brand} ${content.wheel.styleName}`);
  console.log(`Price: $${content.wheel.price}`);
  console.log(`Image: ${path.basename(content.imagePath)}`);
  console.log(`\nCaption:\n${content.caption}`);
  console.log('--- End Preview ---\n');
  
  if (dryRun) {
    console.log('🔍 Dry run - not posting');
    return;
  }
  
  // Verify image exists
  if (!fs.existsSync(content.imagePath)) {
    console.error(`❌ Image not found: ${content.imagePath}`);
    process.exit(1);
  }
  
  // Post to Facebook
  try {
    const fbResult = await postPhotoToFacebook(
      content.imagePath,
      content.platforms.facebook.caption
    );
    console.log(`  ✅ Facebook post ID: ${fbResult.id || fbResult.post_id}`);
    markAsPosted(content.id, 'facebook', fbResult.id || fbResult.post_id);
  } catch (err) {
    console.error(`  ❌ Facebook error: ${err.message}`);
  }
  
  // Post to Instagram (if configured)
  if (!skipInstagram && INSTAGRAM_ID) {
    try {
      // Instagram needs a public URL, not a local file
      // For now, skip if we don't have a hosted URL
      console.log('  ⚠️ Instagram requires hosted image URL - skipping for now');
      // TODO: Upload to CDN first, then post to Instagram
    } catch (err) {
      console.error(`  ❌ Instagram error: ${err.message}`);
    }
  }
  
  console.log('\n✨ Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
