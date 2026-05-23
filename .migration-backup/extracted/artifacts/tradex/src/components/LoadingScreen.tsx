import { useEffect, useState } from "react";

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 2500;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, (elapsed / duration) * 100);
      setProgress(currentProgress);

      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(onComplete, 200); // slight delay after 100%
      }
    };

    requestAnimationFrame(animate);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F14] flex flex-col items-center justify-center transition-opacity duration-500">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />
      
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6">
        <div className="flex items-start justify-center mb-2">
          <h1 className="text-5xl md:text-6xl font-bold text-[#3B82F6] tracking-tight">TradeX</h1>
          <span className="text-[#FACC15] text-sm md:text-base font-bold ml-1 mt-1 px-1.5 py-0.5 rounded bg-[#FACC15]/10">PRO</span>
        </div>
        
        <p className="text-[#9CA3AF] text-xs md:text-sm tracking-[0.3em] font-medium mb-12">
          ANALYTICS · BOTS · SIGNALS
        </p>

        <svg width="120" height="40" viewBox="0 0 120 40" className="mb-16">
          <path 
            d="M5 35 L30 20 L50 25 L80 10 L115 5" 
            fill="none" 
            stroke="#EF4444" 
            strokeWidth="3" 
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-[dash_2s_ease-out_forwards]"
            style={{
              strokeDasharray: 200,
              strokeDashoffset: 200 * (1 - progress/100)
            }}
          />
          <circle cx="115" cy="5" r="4" fill="#EF4444" />
        </svg>

        <div className="text-[#E5E7EB] font-medium mb-2 text-center h-6">
          {progress < 50 ? "Initializing TradeX session..." : "Finalizing workspace"}
        </div>
        <div className="text-[#9CA3AF] text-sm mb-6 text-center">
          {Math.floor(progress)}%
        </div>

        <div className="w-full h-1.5 bg-[#121821] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#22C55E] to-[#14b8a6] transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
