// Test fetching tire sizes from tiresize.com for Crossfire

const url = "https://tiresize.com/tires/chrysler/crossfire/2005/";

console.log("Fetching:", url);

try {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html",
    },
  });
  
  console.log("Status:", response.status);
  
  if (!response.ok) {
    console.log("Failed to fetch");
    process.exit(1);
  }
  
  const html = await response.text();
  
  // Extract tire sizes
  const sizePattern = /\b(\d{3}\/\d{2}R\d{2}|\d{2}x[\d.]+R\d{2}|P\d{3}\/\d{2}R\d{2}|LT\d{3}\/\d{2}R\d{2})\b/gi;
  const matches = html.match(sizePattern) || [];
  const sizes = [...new Set(matches.map(s => s.toUpperCase()))];
  
  console.log("\nFound tire sizes:", sizes);
  console.log("Count:", sizes.length);
  
  // Also look for the specific tire info section
  if (html.includes("225/40R18") || html.includes("255/35R19")) {
    console.log("\n✅ Found expected Crossfire tire sizes!");
  }
  
} catch (err) {
  console.error("Error:", err.message);
}
