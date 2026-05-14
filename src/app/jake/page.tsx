import { Metadata } from "next";
import { JakeChat } from "@/components/jake";

export const metadata: Metadata = {
  title: "Ask Jake - AI Fitment Expert | Warehouse Tire Direct",
  description: "Get personalized tire and wheel recommendations from Jake, your AI fitment expert. Tell him your vehicle and he'll help you find the perfect setup.",
  openGraph: {
    title: "Ask Jake - AI Fitment Expert",
    description: "Get personalized tire and wheel recommendations from Jake, your AI fitment expert.",
  },
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function JakePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialPrompt = params.q || undefined;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <JakeChat initialPrompt={initialPrompt} />
    </div>
  );
}
