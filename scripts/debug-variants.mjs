import { getModelVariants } from '../src/lib/fitment-db/modelAliases.js';

const variants = getModelVariants('M3');
console.log('getModelVariants("M3"):', variants);

const variants2 = getModelVariants('m3');
console.log('getModelVariants("m3"):', variants2);
