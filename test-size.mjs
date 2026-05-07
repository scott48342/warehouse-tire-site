function toSimpleSize(s) {
  const v = String(s || '').trim().toUpperCase();
  
  // Metric sizes: 245/50R18 → 2455018
  const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  
  // Flotation/LT sizes: 37x12.50R22 → 37125022
  const f = v.match(/^(\d{2,3})\s*[X\/\-]\s*(\d{1,2})\.?(\d{0,2})\s*R?\s*(\d{2})/i);
  if (f) {
    const dia = f[1];
    const widthWhole = f[2];
    const widthDecimal = f[3] || '00';
    const rim = f[4];
    return `${dia}${widthWhole}${widthDecimal.padEnd(2, '0')}${rim}`;
  }
  
  const m2 = v.match(/^(\d{7,8})$/);
  if (m2) return m2[1];
  return '';
}

// Test cases
console.log('Testing toSimpleSize for flotation sizes:');
console.log('  37x12.50R22 →', toSimpleSize('37x12.50R22'), '(should be 37125022)');
console.log('  35x12.50R20 →', toSimpleSize('35x12.50R20'), '(should be 35125020)');
console.log('  33x12.50R18 →', toSimpleSize('33x12.50R18'), '(should be 33125018)');
console.log('  35/12.50R17 →', toSimpleSize('35/12.50R17'), '(should be 35125017)');
console.log('');
console.log('Testing metric sizes still work:');
console.log('  245/50R18 →', toSimpleSize('245/50R18'), '(should be 2455018)');
console.log('  225/60R16 →', toSimpleSize('225/60R16'), '(should be 2256016)');
console.log('');
console.log('Testing passthrough:');
console.log('  37125022 →', toSimpleSize('37125022'), '(should be 37125022)');
console.log('  2455018 →', toSimpleSize('2455018'), '(should be 2455018)');
