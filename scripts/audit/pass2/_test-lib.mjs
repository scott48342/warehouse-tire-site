import { normTire, slugCandidates, trimVariantCandidates, modelTrimCandidates, usafMake, isFamilySlug } from "./lib.mjs";
const sizes = ["P225/60R16", "LT315/70R17/C", "255/40ZR19", "225/50RF18", "185/60R15C", "33x12.50R20LT/C", "31x10.50R15LT/C", "30x9.5R15", "P225/50VR16", "225/50R17 94V", "F70-14", "8.00-15", "235/45ZR18", "LT245/75R16/E", "37x12.50R17LT/C", "205/55R16XL", "225/45R17 91W", "285/45R22", "P235/70R16"];
console.log(sizes.map((s) => `${s} -> ${normTire(s)}`).join("\n"));
console.log("---");
for (const [mk, md] of [["ford", "f-150"], ["ford", "f-250-super-duty"], ["chevrolet", "silverado-2500hd"], ["mazda", "cx-5"], ["honda", "cr-v"], ["toyota", "c-hr"], ["lexus", "es-350"], ["mercedes-benz", "gle-350"], ["chevrolet", "suburban"], ["chevrolet", "suburban-1500"], ["jeep", "grand-cherokee"], ["chevrolet", "s10"], ["chevrolet", "k1500"], ["bmw", "330i-xdrive"], ["ram", "1500"], ["chrysler", "town-country"], ["mercedes", "c-class"], ["gmc", "yukon-xl"], ["kia", "k5"], ["infiniti", "qx80"], ["chevrolet", "silverado-1500"], ["jaguar", "f-type"], ["nissan", "gt-r"], ["volkswagen", "id-4"], ["dodge", "ram-1500"]]) {
  console.log(`${usafMake(mk)} | ${md} fam=${isFamilySlug(mk, md)} -> ${slugCandidates(mk, md).map((c) => `${c.name}[${c.kind}]`).join(" ; ")}`);
}
console.log("---");
for (const [mk, md, t] of [["mercedes", "c-class", "AMG C 43 4MATIC"], ["mercedes-benz", "c-class", "C 300"], ["mercedes-benz", "gle", "GLE 53 AMG"], ["mercedes-benz", "s-class", "Maybach S560"], ["bmw", "3-series", "330i xDrive"], ["bmw", "3-series", "M340i"], ["lexus", "es", "ES 350"], ["lexus", "rx", "RX 350L"], ["dodge", "ram-1500", "Laramie"]]) {
  console.log(`${mk} ${md} "${t}" -> ${trimVariantCandidates(mk, md, t).map((c) => c.name).join(" ; ")} || ${modelTrimCandidates("Ram 1500", t).map((c) => c.name).join(" ; ")}`);
}
