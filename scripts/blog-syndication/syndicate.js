/**
 * Blog Syndication Script
 * 
 * Posts blog articles to multiple platforms for SEO backlinks.
 * 
 * Usage:
 *   node syndicate.js                          # Syndicate all new posts
 *   node syndicate.js --slug=my-post           # Syndicate specific post
 *   node syndicate.js --platform=facebook      # Post to specific platform only
 *   node syndicate.js --dry-run                # Preview without posting
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

// ============================================================================
// Config
// ============================================================================

const BLOG_DIR = path.join(__dirname, '../../src/content/blog');
const SYNDICATED_LOG = path.join(__dirname, 'syndicated.json');
const BASE_URL = 'https://shop.warehousetiredirect.com';

// Facebook
const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FB_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

// LinkedIn
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_ORG_ID = process.env.LINKEDIN_ORG_ID;

// Medium
const MEDIUM_TOKEN = process.env.MEDIUM_INTEGRATION_TOKEN;
const MEDIUM_AUTHOR_ID = process.env.MEDIUM_AUTHOR_ID;

// Reddit
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD;

// Subreddits to post to (be selective - don't spam!)
const REDDIT_SUBREDDITS = {
  tires: ['Tires', 'MechanicAdvice'],
  wheels: ['Wheels', 'Rims', 'projectcar'],
  trucks: ['Trucks', 'f150', 'ram_trucks', 'Silverado'],
  jeep: ['Jeep', 'JeepWrangler', 'Wrangler'],
  general: ['Cartalk', 'autorepair'],
};

const GRAPH_API_VERSION = 'v19.0';

// ============================================================================
// Blog Post Parser
// ============================================================================

/**
 * Parse MDX frontmatter and content
 */
function parseBlogPost(slug) {
  const filepath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Blog post not found: ${slug}`);
  }
  
  const content = fs.readFileSync(filepath, 'utf-8');
  
  // Parse frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    throw new Error(`No frontmatter found in ${slug}`);
  }
  
  const frontmatter = {};
  fmMatch[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      let value = valueParts.join(':').trim();
      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      frontmatter[key.trim()] = value;
    }
  });
  
  // Get body content (after frontmatter)
  const body = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
  
  // Extract first paragraph for excerpt
  const firstPara = body.split('\n\n')[0]
    .replace(/[#*_`\[\]]/g, '') // Remove markdown
    .trim();
  
  return {
    slug,
    title: frontmatter.title || slug,
    description: frontmatter.description || firstPara.slice(0, 160),
    excerpt: firstPara.slice(0, 300) + (firstPara.length > 300 ? '...' : ''),
    image: frontmatter.image || null,
    date: frontmatter.date || new Date().toISOString().split('T')[0],
    tags: frontmatter.tags ? frontmatter.tags.split(',').map(t => t.trim()) : [],
    body,
    url: `${BASE_URL}/blog/${slug}`,
  };
}

/**
 * Get all blog posts
 */
function getAllPosts() {
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace('.mdx', ''))
    .map(slug => parseBlogPost(slug));
}

// ============================================================================
// Syndication Tracking
// ============================================================================

function getSyndicatedLog() {
  if (!fs.existsSync(SYNDICATED_LOG)) {
    return { posts: {} };
  }
  return JSON.parse(fs.readFileSync(SYNDICATED_LOG, 'utf-8'));
}

function saveSyndicatedLog(log) {
  fs.writeFileSync(SYNDICATED_LOG, JSON.stringify(log, null, 2));
}

function markAsSyndicated(slug, platform, result) {
  const log = getSyndicatedLog();
  if (!log.posts[slug]) {
    log.posts[slug] = { platforms: {} };
  }
  log.posts[slug].platforms[platform] = {
    timestamp: new Date().toISOString(),
    ...result,
  };
  saveSyndicatedLog(log);
}

function isAlreadySyndicated(slug, platform) {
  const log = getSyndicatedLog();
  return !!(log.posts[slug]?.platforms[platform]);
}

// ============================================================================
// Platform: Facebook
// ============================================================================

async function postToFacebook(post, dryRun = false) {
  if (!FB_PAGE_ID || !FB_ACCESS_TOKEN) {
    console.log('  ⚠️  Facebook: Missing credentials (FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN)');
    return null;
  }
  
  if (isAlreadySyndicated(post.slug, 'facebook')) {
    console.log('  ⏭️  Facebook: Already syndicated');
    return null;
  }
  
  const message = `📰 NEW BLOG POST\n\n${post.title}\n\n${post.excerpt}\n\n👉 Read more: ${post.url}\n\n${post.tags.map(t => '#' + t.replace(/\s+/g, '')).join(' ')} #WheelsTires #Automotive`;
  
  console.log('  📘 Facebook:');
  console.log(`     "${message.slice(0, 100)}..."`);
  
  if (dryRun) {
    console.log('     [DRY RUN - not posting]');
    return { dryRun: true };
  }
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message,
      link: post.url,
      access_token: FB_ACCESS_TOKEN,
    });
    
    const options = {
      hostname: 'graph.facebook.com',
      path: `/${GRAPH_API_VERSION}/${FB_PAGE_ID}/feed`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) {
            console.log(`     ❌ Error: ${json.error.message}`);
            reject(new Error(json.error.message));
          } else {
            console.log(`     ✅ Posted! ID: ${json.id}`);
            markAsSyndicated(post.slug, 'facebook', { postId: json.id });
            resolve(json);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================================
// Platform: LinkedIn
// ============================================================================

async function getLinkedInPersonUrn() {
  // Get the current user's URN from LinkedIn API
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.linkedin.com',
      path: '/v2/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LINKEDIN_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`     [DEBUG] /v2/me response: ${JSON.stringify(json).slice(0, 200)}`);
          if (json.id) {
            resolve(`urn:li:person:${json.id}`);
          } else if (json.sub) {
            resolve(`urn:li:person:${json.sub}`);
          } else {
            reject(new Error('Could not get user URN: ' + JSON.stringify(json).slice(0, 100)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function postToLinkedIn(post, dryRun = false) {
  if (!LINKEDIN_TOKEN) {
    console.log('  ⚠️  LinkedIn: Missing LINKEDIN_ACCESS_TOKEN');
    return null;
  }
  
  if (isAlreadySyndicated(post.slug, 'linkedin')) {
    console.log('  ⏭️  LinkedIn: Already syndicated');
    return null;
  }
  
  const text = `${post.title}\n\n${post.excerpt}\n\nRead more: ${post.url}`;
  
  console.log('  💼 LinkedIn:');
  console.log(`     "${text.slice(0, 100)}..."`);
  
  if (dryRun) {
    console.log('     [DRY RUN - not posting]');
    return { dryRun: true };
  }
  
  // Get the person URN for the authenticated user
  let authorUrn;
  try {
    authorUrn = await getLinkedInPersonUrn();
    console.log(`     Author: ${authorUrn}`);
  } catch (e) {
    console.log(`     ❌ Error getting user info: ${e.message}`);
    return null;
  }
  
  // Use the new Posts API (v2)
  const body = JSON.stringify({
    author: authorUrn,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    content: {
      article: {
        source: post.url,
        title: post.title,
        description: post.description
      }
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false
  });
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.linkedin.com',
      path: '/v2/posts',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINKEDIN_TOKEN}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            console.log(`     ❌ Error (${res.statusCode}): ${json.message || data}`);
            resolve(null);
          } else {
            const postId = res.headers['x-restli-id'] || json.id || 'unknown';
            console.log(`     ✅ Posted! ID: ${postId}`);
            markAsSyndicated(post.slug, 'linkedin', { postId });
            resolve(json);
          }
        } catch (e) {
          console.log(`     ❌ Error: ${e.message}`);
          resolve(null);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`     ❌ Error: ${e.message}`);
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

// ============================================================================
// Platform: Medium
// ============================================================================

async function postToMedium(post, dryRun = false) {
  if (!MEDIUM_TOKEN) {
    console.log('  ⚠️  Medium: Missing MEDIUM_INTEGRATION_TOKEN');
    return null;
  }
  
  if (isAlreadySyndicated(post.slug, 'medium')) {
    console.log('  ⏭️  Medium: Already syndicated');
    return null;
  }
  
  console.log('  📝 Medium:');
  console.log(`     "${post.title}"`);
  
  if (dryRun) {
    console.log('     [DRY RUN - not posting]');
    return { dryRun: true };
  }
  
  // First get user ID if we don't have it
  let authorId = MEDIUM_AUTHOR_ID;
  if (!authorId) {
    const me = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.medium.com',
        path: '/v1/me',
        headers: { 'Authorization': `Bearer ${MEDIUM_TOKEN}` },
      };
      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data).data);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    authorId = me.id;
  }
  
  // Add canonical link and cross-post notice
  const content = `${post.body}\n\n---\n\n*This article was originally published on [Warehouse Tire Direct](${post.url}).*`;
  
  const body = JSON.stringify({
    title: post.title,
    contentFormat: 'markdown',
    content,
    tags: post.tags.slice(0, 5), // Medium allows max 5 tags
    canonicalUrl: post.url, // Important for SEO!
    publishStatus: 'public',
  });
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.medium.com',
      path: `/v1/users/${authorId}/posts`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MEDIUM_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errors) {
            console.log(`     ❌ Error: ${json.errors[0].message}`);
            resolve(null);
          } else {
            console.log(`     ✅ Posted! URL: ${json.data.url}`);
            markAsSyndicated(post.slug, 'medium', { 
              postId: json.data.id,
              url: json.data.url,
            });
            resolve(json.data);
          }
        } catch (e) {
          console.log(`     ❌ Error: ${e.message}`);
          resolve(null);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`     ❌ Error: ${e.message}`);
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

// ============================================================================
// Platform: Reddit
// ============================================================================

let redditAccessToken = null;

async function getRedditToken() {
  if (redditAccessToken) return redditAccessToken;
  
  const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
  
  return new Promise((resolve, reject) => {
    const postData = `grant_type=password&username=${encodeURIComponent(REDDIT_USERNAME)}&password=${encodeURIComponent(REDDIT_PASSWORD)}`;
    
    const options = {
      hostname: 'www.reddit.com',
      path: '/api/v1/access_token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'WarehouseTireDirect/1.0',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.access_token) {
            redditAccessToken = json.access_token;
            resolve(json.access_token);
          } else {
            reject(new Error(json.error || 'Failed to get token'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function selectSubreddits(post) {
  const subs = new Set();
  const title = post.title.toLowerCase();
  const tags = post.tags.map(t => t.toLowerCase());
  
  // Match based on content
  if (title.includes('tire') || tags.includes('tires')) {
    REDDIT_SUBREDDITS.tires.forEach(s => subs.add(s));
  }
  if (title.includes('wheel') || tags.includes('wheels')) {
    REDDIT_SUBREDDITS.wheels.forEach(s => subs.add(s));
  }
  if (title.includes('truck') || title.includes('f-150') || title.includes('silverado') || title.includes('ram')) {
    REDDIT_SUBREDDITS.trucks.forEach(s => subs.add(s));
  }
  if (title.includes('jeep') || title.includes('wrangler')) {
    REDDIT_SUBREDDITS.jeep.forEach(s => subs.add(s));
  }
  
  // Always include general automotive
  REDDIT_SUBREDDITS.general.forEach(s => subs.add(s));
  
  // Limit to 2-3 subreddits to avoid looking spammy
  return Array.from(subs).slice(0, 3);
}

async function postToReddit(post, dryRun = false) {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
    console.log('  ⚠️  Reddit: Missing credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD)');
    return null;
  }
  
  if (isAlreadySyndicated(post.slug, 'reddit')) {
    console.log('  ⏭️  Reddit: Already syndicated');
    return null;
  }
  
  const subreddits = selectSubreddits(post);
  console.log(`  🤖 Reddit: Targeting r/${subreddits.join(', r/')}`);
  
  if (dryRun) {
    console.log('     [DRY RUN - not posting]');
    return { dryRun: true, subreddits };
  }
  
  try {
    const token = await getRedditToken();
    const results = [];
    
    for (const subreddit of subreddits) {
      // Wait between posts to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
      
      const postData = new URLSearchParams({
        sr: subreddit,
        kind: 'link',
        title: post.title,
        url: post.url,
        resubmit: 'true',
      }).toString();
      
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'oauth.reddit.com',
          path: '/api/submit',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'WarehouseTireDirect/1.0',
          },
        };
        
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (json.json?.errors?.length) {
                console.log(`     ❌ r/${subreddit}: ${json.json.errors[0][1]}`);
                resolve(null);
              } else if (json.json?.data?.url) {
                console.log(`     ✅ r/${subreddit}: ${json.json.data.url}`);
                resolve({ subreddit, url: json.json.data.url });
              } else {
                console.log(`     ⚠️  r/${subreddit}: Unknown response`);
                resolve(null);
              }
            } catch (e) {
              resolve(null);
            }
          });
        });
        
        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
      });
      
      if (result) results.push(result);
    }
    
    if (results.length > 0) {
      markAsSyndicated(post.slug, 'reddit', { posts: results });
    }
    
    return results;
  } catch (err) {
    console.log(`     ❌ Reddit auth error: ${err.message}`);
    return null;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const slugArg = args.find(a => a.startsWith('--slug='));
  const platformArg = args.find(a => a.startsWith('--platform='));
  const dryRun = args.includes('--dry-run');
  
  console.log('\n📡 Blog Syndication\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No actual posts will be made\n');
  }
  
  // Get posts to syndicate
  let posts;
  if (slugArg) {
    const slug = slugArg.split('=')[1];
    posts = [parseBlogPost(slug)];
  } else {
    posts = getAllPosts();
  }
  
  console.log(`Found ${posts.length} blog post(s)\n`);
  
  // Medium API deprecated in 2023 - removed from auto-posting
  const platforms = platformArg 
    ? [platformArg.split('=')[1]]
    : ['facebook', 'linkedin', 'reddit'];
  
  for (const post of posts) {
    console.log(`\n📄 ${post.title}`);
    console.log(`   ${post.url}\n`);
    
    for (const platform of platforms) {
      try {
        switch (platform) {
          case 'facebook':
            await postToFacebook(post, dryRun);
            break;
          case 'linkedin':
            await postToLinkedIn(post, dryRun);
            break;
          case 'medium':
            await postToMedium(post, dryRun);
            break;
          case 'reddit':
            await postToReddit(post, dryRun);
            break;
          default:
            console.log(`  ⚠️  Unknown platform: ${platform}`);
        }
      } catch (err) {
        console.log(`  ❌ ${platform}: ${err.message}`);
      }
      
      // Rate limit between platforms
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log('\n✨ Done!\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
