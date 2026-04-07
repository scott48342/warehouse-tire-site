/**
 * Homepage Background Wrapper
 * Provides continuous dark cinematic background throughout the page
 */

interface HomepageBackgroundProps {
  children: React.ReactNode;
}

export function HomepageBackground({ children }: HomepageBackgroundProps) {
  return (
    <div className="relative min-h-screen bg-neutral-950">
      {/* Fixed background image layer */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/homepage/bg-scenic.jpg')",
        }}
      />
      
      {/* Dark gradient overlay for readability */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/80" />
      
      {/* Additional texture overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/40" />

      {/* Content layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
