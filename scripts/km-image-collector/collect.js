/**
 * K&M Tire Image Collector
 * 
 * Gently collects partNumber → imageUrl mappings from K&M Weblink search results.
 * Designed to run with browser automation at human browsing speeds.
 * 
 * Usage: Run via Clawdbot browser automation, not standalone.
 */

// Common tire sizes to search (passenger/light truck)
const TIRE_SIZES = [
  // Popular passenger sizes
  '2055516', '2155516', '2255016', '2055017', '2155517', 
  '2255517', '2355517', '2155017', '2255017', '2355017',
  '2455017', '2055518', '2155518', '2255518', '2355518',
  '2455518', '2655018', '2256517', '2356517', '2456017',
  '2456517', '2556017', '2656017', '2356018', '2456018',
  '2556018', '2656018', '2755518', '2755518', '2856018',
  
  // Popular SUV/truck sizes  
  '2357015', '2657015', '2457016', '2657016', '2457017',
  '2657017', '2757017', '2857017', '2457518', '2657518',
  '2757018', '2857018', '2657019', '2757019', '2857019',
  '2657020', '2757020', '2857020', '2957020', '3057020',
  '2757021', '2857021', '2957021', '3157021', '3357022',
  
  // Additional common sizes
  '1856014', '1856515', '1957015', '2057015', '2157016',
  '2257016', '2357016', '2157017', '2257017', '2357017',
];

module.exports = { TIRE_SIZES };
