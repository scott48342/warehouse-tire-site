import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import https from 'https';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'garage', 'generated');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Image prompts based on the asset sheet
const PROMPTS = {
  // Category card vehicle images
  'card-aggressive-street': `Cinematic photo of a black RAM 1500 truck with aggressive lifted suspension, large off-road wheels and tires, dramatic side angle view. Dark garage environment with moody red accent lighting, wet concrete floor with reflections. Professional automotive photography, 8k quality, dark atmospheric mood.`,
  
  'card-quiet-comfort': `Cinematic photo of a white Chevrolet Tahoe SUV, stock height, clean elegant appearance, side 3/4 view. Dark garage environment with soft lighting, wet concrete floor with reflections. Professional automotive photography, 8k quality, premium luxury feel.`,
  
  'card-blackout-builds': `Cinematic photo of a murdered-out black Chevrolet Silverado truck, all black wheels, dark tinted windows, aggressive stance, front 3/4 view. Dark garage environment, dramatic shadows, wet concrete floor. Professional automotive photography, 8k quality, sleek menacing look.`,
  
  'card-towing-hauling': `Cinematic photo of a heavy-duty Ford F-350 dually truck, work truck appearance, towing setup, strong powerful stance, side view. Dark garage environment with industrial lighting, wet concrete floor. Professional automotive photography, 8k quality, built for work aesthetic.`,
  
  'card-offroad-overland': `Cinematic photo of a Toyota Tacoma with overland build, roof rack with gear, lifted suspension, all-terrain tires, adventure-ready look, 3/4 front view. Dark garage environment with warm accent lighting, wet concrete floor. Professional automotive photography, 8k quality, expedition vehicle aesthetic.`,
  
  'card-show-stance': `Cinematic photo of a Chevrolet Camaro sports car, lowered stance, large custom wheels, aggressive body kit, show car quality, low angle front 3/4 view. Dark garage environment with dramatic red accent lighting, wet concrete floor with reflections. Professional automotive photography, 8k quality, head-turning show car look.`,
};

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function generateImage(name, prompt) {
  console.log(`\n🎨 Generating: ${name}`);
  console.log(`   Prompt: ${prompt.substring(0, 80)}...`);
  
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1536x1024"  // Wide format
    });
    
    const imageUrl = response.data[0].url;
    const filepath = path.join(OUTPUT_DIR, `${name}.png`);
    
    console.log(`   ⬇️  Downloading...`);
    await downloadImage(imageUrl, filepath);
    console.log(`   ✅ Saved: ${filepath}`);
    
    return filepath;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Jake Garage Asset Generator');
  console.log('================================\n');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  const results = [];
  
  for (const [name, prompt] of Object.entries(PROMPTS)) {
    const filepath = await generateImage(name, prompt);
    results.push({ name, success: !!filepath, filepath });
    
    // Rate limiting - wait between requests
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n================================');
  console.log('📊 Generation Summary:');
  const successful = results.filter(r => r.success).length;
  console.log(`   ✅ Success: ${successful}/${results.length}`);
  
  if (successful > 0) {
    console.log('\n📁 Generated files:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.filepath}`);
    });
  }
}

main().catch(console.error);
