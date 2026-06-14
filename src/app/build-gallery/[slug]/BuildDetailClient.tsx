"use client";

import { useRouter } from "next/navigation";
import { JakeBuildContext } from "@/lib/fitment-db/schema-gallery";

interface BuildDetailClientProps {
  jakeContext: JakeBuildContext;
  vehicleLabel: string;
  wheelLabel: string;
  tireLabel: string;
}

export function BuildDetailClient({ 
  jakeContext, 
  vehicleLabel, 
  wheelLabel, 
  tireLabel 
}: BuildDetailClientProps) {
  const router = useRouter();
  
  const handleBuildSimilar = () => {
    // Build the prompt for Jake
    const prompt = `I want to build something similar to this ${vehicleLabel} with ${wheelLabel} wheels and ${tireLabel} tires`;
    
    // Encode context for URL
    const contextParam = encodeURIComponent(JSON.stringify(jakeContext));
    
    // Navigate to Jake with context
    router.push(`/jake?q=${encodeURIComponent(prompt)}&buildContext=${contextParam}`);
  };
  
  return (
    <button
      onClick={handleBuildSimilar}
      className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-lg px-6 py-4 rounded-xl transition-all shadow-lg hover:shadow-red-500/25"
    >
      Build Something Similar →
    </button>
  );
}
