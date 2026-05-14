import { Metadata } from "next";
import { headers } from "next/headers";
import { JakeChat } from "@/components/jake";

export const metadata: Metadata = {
  title: "Ask Jake - Your Fitment Expert | Warehouse Tire Direct",
  description: "Get personalized tire and wheel recommendations from Jake, your fitment expert available 24/7. Tell him your vehicle and he'll help you find the perfect setup.",
  openGraph: {
    title: "Ask Jake - Your Fitment Expert",
    description: "Get personalized tire and wheel recommendations from Jake, your fitment expert available 24/7.",
  },
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

// Detect if we're on the local site
async function isLocalSite(): Promise<boolean> {
  if (process.env.FORCE_LOCAL_MODE === "true") return true;
  if (process.env.FORCE_NATIONAL_MODE === "true") return false;
  
  const headersList = await headers();
  const host = headersList.get("host") || "";
  
  return host.includes("warehousetire.net") || host.includes("localhost:3001");
}

export default async function JakePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialPrompt = params.q || undefined;
  const isLocal = await isLocalSite();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <JakeChat initialPrompt={initialPrompt} isLocal={isLocal} />
    </div>
  );
}
