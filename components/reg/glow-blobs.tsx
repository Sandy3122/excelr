/**
 * Decorative blurred glow circles behind the navy hero.
 * Soft blue/indigo orbs + small accent dots, matching the Figma screenshots.
 */
export default function GlowBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-28 top-[-40px] h-[340px] w-[340px] rounded-full bg-[#3B82F6]/35 blur-3xl md:h-[460px] md:w-[460px]" />
      <div className="absolute -left-16 bottom-[-140px] h-[300px] w-[300px] rounded-full bg-[#6366F1]/30 blur-3xl" />
      <div className="absolute right-[-120px] top-[-60px] h-[380px] w-[380px] rounded-full bg-[#0EA5E9]/28 blur-3xl md:h-[500px] md:w-[500px]" />
      <div className="absolute bottom-[-120px] right-[10%] h-[280px] w-[280px] rounded-full bg-[#8B5CF6]/25 blur-3xl" />
      <div className="absolute left-[35%] top-[40%] h-[200px] w-[200px] rounded-full bg-[#6366F1]/20 blur-3xl md:left-[45%]" />

      {/* small solid accent dots */}
      <span className="absolute left-[12%] top-[22%] h-2 w-2 rounded-full bg-[#818CF8]/90" />
      <span className="absolute right-[18%] top-[30%] h-1.5 w-1.5 rounded-full bg-[#0EA5E9]/80" />
      <span className="absolute bottom-[28%] left-[22%] h-2 w-2 rounded-full bg-[#A5B4FC]/70" />
    </div>
  );
}
