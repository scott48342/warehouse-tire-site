import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_URL = "https://api.wheel-size.com/v2/";

function getApiKey(): string {
  const key = process.env.WHEELSIZE_API_KEY;
  if (!key) throw new Error("Missing WHEELSIZE_API_KEY");
  return key;
}

async function apiGet(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("user_key", getApiKey());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const safeUrl = url.toString().replace(/user_key=[^&]+/, "user_key=***");
  console.log(`[debug-lookup] GET ${safeUrl}`);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "JSON parse failed", raw: text.slice(0, 500) };
  }

  return { status: res.status, data };
}

/**
 * GET /api/fitment/debug-lookup?year=2024&make=Ford&model=F-150
 * Debug endpoint to trace Wheel-Size API lookups step by step
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year") || "2024";
  const make = url.searchParams.get("make") || "Ford";
  const model = url.searchParams.get("model") || "F-150";

  const results: any = {
    input: { year, make, model },
    steps: [],
  };

  try {
    // Step 1: Find the make
    const makesRes = await apiGet("makes/");
    const makes = makesRes.data?.data || [];
    const foundMakes = makes.filter((m: any) =>
      m.name.toLowerCase() === make.toLowerCase() ||
      m.slug.toLowerCase() === make.toLowerCase()
    );
    results.steps.push({
      step: 1,
      action: "GET makes/",
      totalMakes: makes.length,
      matchingMakes: foundMakes,
    });

    const makeSlug = foundMakes[0]?.slug || make.toLowerCase();

    // Step 2: Get models for the make
    const modelsRes = await apiGet("models/", { make: makeSlug });
    const models = modelsRes.data?.data || [];
    
    // Try various model name formats
    const modelLower = model.toLowerCase();
    const modelNoHyphen = modelLower.replace(/-/g, "");
    const modelWithHyphen = modelLower.includes("-") ? modelLower : modelLower.replace(/(\d+)/, "-$1");
    
    const foundModels = models.filter((m: any) => {
      const slug = m.slug?.toLowerCase() || "";
      const name = m.name?.toLowerCase() || "";
      return slug === modelLower || 
             slug === modelNoHyphen ||
             slug === modelWithHyphen ||
             name === modelLower ||
             name === modelNoHyphen ||
             name.includes(modelLower);
    });

    results.steps.push({
      step: 2,
      action: `GET models/ with make=${makeSlug}`,
      totalModels: models.length,
      searchedFor: { modelLower, modelNoHyphen, modelWithHyphen },
      matchingModels: foundModels,
      allFSeriesModels: models.filter((m: any) => m.name?.startsWith("F-") || m.name?.startsWith("F ")).slice(0, 15),
    });

    const modelSlug = foundModels[0]?.slug || model.toLowerCase();

    // Step 3: Get years for the model
    const yearsRes = await apiGet("years/", { make: makeSlug, model: modelSlug });
    const years = yearsRes.data?.data || [];
    const hasYear = years.some((y: any) => String(y.name) === year || y.slug === year);
    
    results.steps.push({
      step: 3,
      action: `GET years/ with make=${makeSlug}, model=${modelSlug}`,
      totalYears: years.length,
      availableYears: years.map((y: any) => y.name || y.slug),
      hasRequestedYear: hasYear,
    });

    // Step 4: Get modifications for the year/make/model
    const modsRes = await apiGet("modifications/", { 
      make: makeSlug, 
      model: modelSlug, 
      year 
    });
    const mods = modsRes.data?.data || [];

    results.steps.push({
      step: 4,
      action: `GET modifications/ with make=${makeSlug}, model=${modelSlug}, year=${year}`,
      totalModifications: mods.length,
      modifications: mods.map((m: any) => ({
        slug: m.slug,
        name: m.name,
        trim: m.trim,
        body: m.body,
        regions: m.regions,
        generation: m.generation?.name,
      })),
    });

    // Step 5: Search by model without modification
    const searchRes1 = await apiGet("search/by_model/", {
      make: makeSlug,
      model: modelSlug,
      year,
    });
    const searchData1 = searchRes1.data?.data || [];

    results.steps.push({
      step: 5,
      action: `GET search/by_model/ with make=${makeSlug}, model=${modelSlug}, year=${year} (NO modification)`,
      resultCount: searchData1.length,
      firstResult: searchData1[0] ? {
        slug: searchData1[0].slug,
        trim: searchData1[0].trim,
        body: searchData1[0].body,
        hasTechnical: !!searchData1[0].technical,
        hasWheels: !!searchData1[0].wheels,
        wheelsCount: searchData1[0].wheels?.length || 0,
      } : null,
    });

    // Step 6: Search with first available modification
    if (mods.length > 0) {
      const testMod = mods[0];
      const searchRes2 = await apiGet("search/by_model/", {
        make: makeSlug,
        model: modelSlug,
        year,
        modification: testMod.slug,
      });
      const searchData2 = searchRes2.data?.data || [];

      results.steps.push({
        step: 6,
        action: `GET search/by_model/ with modification=${testMod.slug}`,
        modificationUsed: testMod,
        resultCount: searchData2.length,
        fullResult: searchData2[0] || null,
      });

      // Extract technical data
      if (searchData2[0]?.technical) {
        results.technicalData = searchData2[0].technical;
      }
      if (searchData2[0]?.wheels) {
        results.wheelSetups = searchData2[0].wheels;
      }
    }

    // Step 7: Test failure cases
    results.failureTests = [];

    // Test wrong model name format
    const testFormats = [
      { make: makeSlug, model: "f150", year, desc: "model without hyphen" },
      { make: makeSlug, model: "F-150", year, desc: "model with capital letters" },
      { make: "Ford", model: "F-150", year, desc: "make with capital letters" },
    ];

    for (const test of testFormats) {
      const testRes = await apiGet("search/by_model/", test);
      results.failureTests.push({
        desc: test.desc,
        params: { make: test.make, model: test.model, year: test.year },
        resultCount: testRes.data?.data?.length || 0,
      });
    }

    results.success = true;
    results.summary = {
      makeSlug,
      modelSlug,
      year,
      totalModifications: mods.length,
      hasVehicleData: (searchRes1.data?.data?.length || 0) > 0,
    };

  } catch (err: any) {
    results.error = err?.message || String(err);
    results.success = false;
  }

  return NextResponse.json(results, { status: results.success ? 200 : 500 });
}
