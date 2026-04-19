/**
 * Accessories Category Hierarchy
 * 
 * Modeled after DealerLine's mega-menu structure:
 * - Level 1: Main categories (shown on hover)
 * - Level 2: Subcategories (shown on hover of level 1)
 */

export type SubCategory = {
  id: string;
  name: string;
  icon?: string;
  /** Maps to sub_type in DB */
  subTypes?: string[];
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Subcategories that appear on hover */
  children?: SubCategory[];
  /** If no children, maps directly to category in DB */
  directCategory?: boolean;
};

export const ACCESSORY_CATEGORIES: Category[] = [
  {
    id: "wheel_installation",
    name: "Wheel Installation",
    icon: "🔧",
    description: "Everything to mount your wheels",
    children: [
      { id: "lug_nut", name: "Lug Kits", icon: "🔩", subTypes: ["lug_nut", "lug nut"] },
      { id: "hub_ring", name: "Hub Rings", icon: "⭕", subTypes: ["hub_ring", "hub ring"] },
      { id: "wheel_lock", name: "Wheel Locks", icon: "🔒", subTypes: ["wheel_lock"] },
      { id: "tpms", name: "TPMS Sensors", icon: "📊", subTypes: ["tpms"] },
      { id: "valve_stem", name: "Valve Stems", icon: "🎈", subTypes: ["valve_stem", "valve stem"] },
    ],
  },
  {
    id: "wheel_accessories",
    name: "Wheel Accessories",
    icon: "🎯",
    description: "Caps, spacers, and more",
    children: [
      { id: "center_cap", name: "Center Caps", icon: "🎯", subTypes: ["center_cap", "center cap"] },
      { id: "spacer", name: "Wheel Spacers", icon: "📏", subTypes: ["spacer", "wheel spacer"] },
      { id: "adapter", name: "Wheel Adapters", icon: "🔄", subTypes: ["adapter"] },
    ],
  },
  {
    id: "lighting",
    name: "Lighting",
    icon: "💡",
    description: "LED pods, bars, and vehicle lighting",
    children: [
      { id: "led_pod", name: "LED Pods", icon: "🔦", subTypes: ["led_pod", "led"] },
      { id: "light_bar", name: "Light Bars", icon: "📏", subTypes: ["light_bar", "light bar"] },
      { id: "fog_light", name: "Fog Lights", icon: "🌫️", subTypes: ["fog_light"] },
      { id: "headlight", name: "Headlights", icon: "🔆", subTypes: ["headlight"] },
      { id: "tail_light", name: "Tail Lights", icon: "🚨", subTypes: ["tail_light"] },
      { id: "rock_light", name: "Rock Lights", icon: "🪨", subTypes: ["rock_light"] },
      { id: "lighting_parts", name: "Parts & Bulbs", icon: "💡", subTypes: ["lighting_parts", "lighting"] },
    ],
  },
];

/**
 * Get all sub_type values for a subcategory ID
 */
export function getSubTypesForCategory(categoryId: string, subCategoryId?: string): string[] {
  for (const cat of ACCESSORY_CATEGORIES) {
    if (cat.id === categoryId && !subCategoryId) {
      // Return all sub_types for all children
      return cat.children?.flatMap(c => c.subTypes || []) || [];
    }
    
    const child = cat.children?.find(c => c.id === subCategoryId);
    if (child) {
      return child.subTypes || [];
    }
  }
  return [];
}

/**
 * Get the DB category value for a category ID
 */
export function getDbCategoryForId(categoryId: string): string | null {
  const categoryMap: Record<string, string> = {
    "lug_nut": "lug_nut",
    "hub_ring": "hub_ring", 
    "wheel_lock": "lug_nut",
    "tpms": "tpms",
    "valve_stem": "valve_stem",
    "center_cap": "center_cap",
    "spacer": "spacer",
    "adapter": "spacer",
    "led_pod": "lighting",
    "light_bar": "lighting",
    "fog_light": "lighting",
    "headlight": "lighting",
    "tail_light": "lighting",
    "rock_light": "lighting",
    "lighting_parts": "lighting",
  };
  return categoryMap[categoryId] || null;
}

/**
 * Build URL for accessory category/subcategory
 * Uses /accessories/browse/ prefix to avoid conflict with /accessories/[sku] product pages
 */
export function buildAccessoryUrl(categoryId: string, subCategoryId?: string): string {
  if (subCategoryId) {
    return `/accessories/browse/${categoryId}/${subCategoryId}`;
  }
  return `/accessories/browse/${categoryId}`;
}

/**
 * Flat list for simple category display (backwards compat)
 */
export const FLAT_CATEGORIES = [
  { id: "center_cap", name: "Center Caps", icon: "🎯", description: "Finish the look of your wheels" },
  { id: "lug_nut", name: "Lug Nuts & Locks", icon: "🔩", description: "Secure your wheels properly" },
  { id: "hub_ring", name: "Hub Centric Rings", icon: "⭕", description: "Eliminate wheel vibration" },
  { id: "lighting", name: "LED Lighting", icon: "💡", description: "LED pods, fog lights, headlights & more" },
  { id: "tpms", name: "TPMS Sensors", icon: "📊", description: "Tire pressure monitoring" },
  { id: "valve_stem", name: "Valve Stems", icon: "🎈", description: "Standard and chrome stems" },
  { id: "spacer", name: "Wheel Spacers", icon: "📏", description: "Wider stance and clearance" },
];
