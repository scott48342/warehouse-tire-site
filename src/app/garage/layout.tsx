import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jake Garage | Build Your Perfect Setup",
  description: "Tell Jake what you drive and what look you want. Get expert wheel and tire recommendations in a conversation.",
  openGraph: {
    title: "Jake Garage | Build Your Perfect Setup",
    description: "Tell Jake what you drive and what look you want. Get expert wheel and tire recommendations in a conversation.",
    images: ["/og/jake-garage.png"],
  },
};

export default function GarageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* No header/nav - full immersive experience */}
      {children}
    </div>
  );
}
