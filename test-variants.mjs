import { getModelVariants } from './src/lib/fitment-db/modelAliases.ts';

const input = "Silverado 2500 HD";
const variants = getModelVariants(input);
console.log(`Input: "${input}"`);
console.log(`Variants:`, variants);
