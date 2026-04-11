/**
 * Video Generator for TikTok/Reels
 * 
 * Creates short video content from wheel images
 * - Ken Burns effect (zoom/pan)
 * - Text overlays with specs
 * - Background music (add your own royalty-free track)
 * 
 * Requires: FFmpeg installed and in PATH
 * 
 * Usage: node generate-video.js <content.json>
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ============================================================================
// Config
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, 'output');
const MUSIC_DIR = path.join(__dirname, 'music'); // Add royalty-free tracks here
const FONTS_DIR = path.join(__dirname, 'fonts');

// Video settings
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920; // 9:16 for TikTok/Reels
const VIDEO_DURATION = 8; // seconds
const FPS = 30;

// ============================================================================
// FFmpeg Helpers
// ============================================================================

/**
 * Check if FFmpeg is available
 */
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a video from a wheel image with Ken Burns effect and text overlay
 */
async function createWheelVideo(content, outputPath) {
  const { imagePath, wheel, caption } = content;
  
  // Text for overlay
  const brandText = wheel.brand.toUpperCase();
  const styleText = wheel.styleName;
  const priceText = `$${wheel.price}/wheel`;
  const specsText = `${wheel.size} | ${wheel.boltPattern}`;
  
  // FFmpeg filter for Ken Burns effect
  // Zoom from 1.0 to 1.3 over the duration with smooth pan
  const zoomFilter = `scale=8000:-1,zoompan=z='min(zoom+0.001,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${VIDEO_DURATION * FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${FPS}`;
  
  // Simple filter without text (Windows font issues)
  // TODO: Add text overlay when fonts are configured
  const filterComplex = `[0:v]${zoomFilter}[outv]`;
  
  // Build FFmpeg command
  const args = [
    '-y', // Overwrite output
    '-loop', '1', // Loop input image
    '-i', imagePath,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-t', VIDEO_DURATION.toString(),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    outputPath,
  ];
  
  // Check for background music
  const musicFiles = fs.existsSync(MUSIC_DIR) 
    ? fs.readdirSync(MUSIC_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'))
    : [];
  
  if (musicFiles.length > 0) {
    const randomMusic = musicFiles[Math.floor(Math.random() * musicFiles.length)];
    const musicPath = path.join(MUSIC_DIR, randomMusic);
    
    // Insert music input and mix audio
    args.splice(4, 0, '-i', musicPath);
    args.splice(args.indexOf('-map'), 0, '-map', '1:a');
    args.splice(args.indexOf('-t'), 0, '-shortest');
    
    console.log(`  🎵 Using music: ${randomMusic}`);
  }
  
  return new Promise((resolve, reject) => {
    console.log(`  🎬 Rendering video (${VIDEO_DURATION}s @ ${VIDEO_WIDTH}x${VIDEO_HEIGHT})...`);
    
    const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg failed: ${stderr.slice(-500)}`));
      }
    });
    
    ffmpeg.on('error', reject);
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node generate-video.js <content.json>');
    console.log('       node generate-video.js --all  (generate videos for all content)');
    process.exit(1);
  }
  
  console.log('\n🎬 Video Generator for TikTok/Reels\n');
  
  // Check FFmpeg
  if (!checkFFmpeg()) {
    console.error('❌ FFmpeg not found. Install it: https://ffmpeg.org/download.html');
    process.exit(1);
  }
  
  // Create music dir if it doesn't exist
  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    console.log(`📁 Created ${MUSIC_DIR} - add royalty-free music tracks here!\n`);
  }
  
  // Get content files to process
  let contentFiles = [];
  
  if (args.includes('--all')) {
    contentFiles = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(OUTPUT_DIR, f));
  } else {
    const inputFile = args[0];
    const filepath = inputFile.includes(path.sep) ? inputFile : path.join(OUTPUT_DIR, inputFile);
    if (!fs.existsSync(filepath)) {
      console.error(`❌ File not found: ${filepath}`);
      process.exit(1);
    }
    contentFiles = [filepath];
  }
  
  console.log(`Processing ${contentFiles.length} content file(s)...\n`);
  
  // Generate videos
  let success = 0;
  for (const filepath of contentFiles) {
    const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const videoPath = filepath.replace('.json', '_video.mp4');
    
    // Skip if video already exists
    if (fs.existsSync(videoPath)) {
      console.log(`⏭️ Skipping ${content.id} (video exists)`);
      continue;
    }
    
    console.log(`📹 ${content.wheel.brand} ${content.wheel.styleName}`);
    
    try {
      await createWheelVideo(content, videoPath);
      
      // Update content JSON with video path
      content.videoPath = videoPath;
      content.platforms.tiktok.videoPath = videoPath;
      content.platforms.instagram.reelsPath = videoPath;
      fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
      
      console.log(`  ✅ Created: ${path.basename(videoPath)}\n`);
      success++;
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}\n`);
    }
  }
  
  console.log(`\n✨ Generated ${success} video(s)`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
