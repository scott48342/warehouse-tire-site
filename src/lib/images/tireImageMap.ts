/**
 * Tire Image Mapping
 * 
 * Maps tire brands and models to known image URLs.
 * Used as fallback when API doesn't provide an image.
 */

// Default fallback image
export const DEFAULT_TIRE_IMAGE = '/images/default-tire.svg'

// Brand-level fallback images (when we have brand but no model match)
export const BRAND_IMAGES: Record<string, string> = {
  'michelin': 'https://www.michelinman.com/content/dam/tire/michelin/web/medc/global/cross-climate-2/cc2-solo-tire.png',
  'bridgestone': 'https://www.bridgestonetire.com/content/dam/bst-brand/na/bridgestone/tire-images/weatherpeak.png',
  'goodyear': 'https://www.goodyear.com/images/tires/assurance-weatherready.png',
  'continental': 'https://www.continental-tires.com/car/tires/truecontact-tour/truecontact-tour-tire.png',
  'pirelli': 'https://www.pirelli.com/tyres/en-us/car/catalogue/cinturato-p7-all-season-plus.png',
  'cooper': 'https://us.coopertire.com/content/dam/coopertire/images/products/discoverer-at3-4s.png',
  'toyo': 'https://www.toyotires.com/media/tires/open-country-at-iii.png',
  'bfgoodrich': 'https://www.bfgoodrichtires.com/content/dam/bfgoodrich/na/tires/all-terrain-t-a-ko2.png',
  'yokohama': 'https://www.yokohamatire.com/tires/geolandar-a-t-g015/image.png',
  'hankook': 'https://www.hankooktire.com/us/tires/kinergy-pt-h737.png',
  'falken': 'https://www.falkentire.com/tires/wildpeak-at3w/wildpeak_at3w.png',
  'general': 'https://www.generaltire.com/tires/grabber-atx/grabber-atx.png',
  'kumho': 'https://www.kumhotireusa.com/tires/crugen-hp71/crugen-hp71.png',
  'nexen': 'https://www.nexentireusa.com/tires/roadian-htx-2/roadian-htx-2.png',
  'firestone': 'https://www.firestonetire.com/content/dam/bst-brand/na/firestone/tire-images/destination-le3.png',
  'nitto': 'https://www.nittotire.com/tires/ridge-grappler/ridge-grappler.png',
  'sumitomo': '/images/default-tire.svg',
  'fuzion': '/images/default-tire.svg',
  'mastercraft': '/images/default-tire.svg',
  'uniroyal': '/images/default-tire.svg',
}

// Specific model images (brand:model -> imageUrl)
// Normalized: lowercase brand, lowercase model with spaces replaced by dashes
export const MODEL_IMAGES: Record<string, string> = {
  // Michelin
  'michelin:defender-ltx-m-s': 'https://www.michelinman.com/content/dam/tire/michelin/web/medc/na/tires/defender-ltx-m-s.png',
  'michelin:primacy-tour-a-s': 'https://www.michelinman.com/content/dam/tire/michelin/web/medc/na/tires/primacy-tour-as.png',
  'michelin:crossclimate2': 'https://www.michelinman.com/content/dam/tire/michelin/web/medc/global/cross-climate-2/cc2-solo-tire.png',
  'michelin:pilot-sport-4s': 'https://www.michelinman.com/content/dam/tire/michelin/web/medc/na/tires/pilot-sport-4s.png',
  
  // Bridgestone
  'bridgestone:dueler-h-l-alenza': 'https://www.bridgestonetire.com/content/dam/bst-brand/na/bridgestone/tire-images/dueler-hl-alenza.png',
  'bridgestone:ecopia-ep422': 'https://www.bridgestonetire.com/content/dam/bst-brand/na/bridgestone/tire-images/ecopia-ep422.png',
  'bridgestone:weatherpeak': 'https://www.bridgestonetire.com/content/dam/bst-brand/na/bridgestone/tire-images/weatherpeak.png',
  
  // Goodyear
  'goodyear:wrangler-all-terrain': 'https://www.goodyear.com/images/tires/wrangler-all-terrain-adventure.png',
  'goodyear:assurance-weatherready': 'https://www.goodyear.com/images/tires/assurance-weatherready.png',
  'goodyear:eagle-f1-asymmetric': 'https://www.goodyear.com/images/tires/eagle-f1-asymmetric-5.png',
  
  // Cooper
  'cooper:discoverer-at3-4s': 'https://us.coopertire.com/content/dam/coopertire/images/products/discoverer-at3-4s.png',
  'cooper:discoverer-at3-xlt': 'https://us.coopertire.com/content/dam/coopertire/images/products/discoverer-at3-xlt.png',
  'cooper:discoverer-rugged-trek': 'https://us.coopertire.com/content/dam/coopertire/images/products/discoverer-rugged-trek.png',
  
  // BFGoodrich
  'bfgoodrich:all-terrain-t-a-ko2': 'https://www.bfgoodrichtires.com/content/dam/bfgoodrich/na/tires/all-terrain-t-a-ko2.png',
  'bfgoodrich:mud-terrain-t-a-km3': 'https://www.bfgoodrichtires.com/content/dam/bfgoodrich/na/tires/mud-terrain-t-a-km3.png',
  
  // Falken
  'falken:wildpeak-a-t3w': 'https://www.falkentire.com/tires/wildpeak-at3w/wildpeak_at3w.png',
  'falken:wildpeak-m-t': 'https://www.falkentire.com/tires/wildpeak-mt/wildpeak_mt.png',
  
  // Nitto
  'nitto:ridge-grappler': 'https://www.nittotire.com/tires/ridge-grappler/ridge-grappler.png',
  'nitto:terra-grappler-g2': 'https://www.nittotire.com/tires/terra-grappler-g2/terra-grappler-g2.png',
}

/**
 * Normalize a string for lookup (lowercase, replace spaces with dashes)
 */
function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Get tire image URL with fallback chain:
 * 1. API-provided imageUrl (if valid)
 * 2. Model-specific image from mapping
 * 3. Brand-level image from mapping
 * 4. Default fallback image
 */
export function getTireImage(
  imageUrl: string | undefined | null,
  brand: string | undefined | null,
  model: string | undefined | null
): string {
  // 1. Use API image if provided and valid
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
    return imageUrl
  }

  const normalizedBrand = normalize(brand || '')
  const normalizedModel = normalize(model || '')

  // 2. Try model-specific image
  if (normalizedBrand && normalizedModel) {
    const modelKey = `${normalizedBrand}:${normalizedModel}`
    if (MODEL_IMAGES[modelKey]) {
      return MODEL_IMAGES[modelKey]
    }
    
    // Try partial model match (first word of model)
    const firstModelWord = normalizedModel.split('-')[0]
    for (const [key, url] of Object.entries(MODEL_IMAGES)) {
      if (key.startsWith(`${normalizedBrand}:${firstModelWord}`)) {
        return url
      }
    }
  }

  // 3. Try brand-level image
  if (normalizedBrand && BRAND_IMAGES[normalizedBrand]) {
    return BRAND_IMAGES[normalizedBrand]
  }

  // 4. Default fallback
  return DEFAULT_TIRE_IMAGE
}

/**
 * Check if an image URL is the default fallback
 */
export function isDefaultImage(url: string): boolean {
  return url === DEFAULT_TIRE_IMAGE
}
