/**
 * Decorative hero atmosphere — faint thin circle outlines, optionally over a
 * soft blue glow.
 *
 * `glow`    — coloured blobs + circles (the original /reg hero).
 * `outline` — circles only, for heroes whose background is already a flat,
 *             saturated blue and would wash out under the blobs.
 */
export default function GlowBlobs({
  variant = "glow",
}: {
  variant?: "glow" | "outline";
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {variant === "glow" && (
        <>
          {/* Soft blue glow behind the heading/copy (upper-left, kept off the edge) */}
          <div className="absolute left-[6%] top-[14%] h-[420px] w-[420px] rounded-full bg-[#2B62D8]/30 blur-[120px] md:h-[520px] md:w-[520px]" />
          {/* Gentle cool glow behind the student (upper-right) */}
          <div className="absolute right-[6%] top-[6%] h-[360px] w-[360px] rounded-full bg-[#1E4FB5]/25 blur-[120px]" />
        </>
      )}

      {/* Faint thin circle outlines — one top-right near the student, one bottom-left */}
      <div className="absolute right-[10%] top-[10%] h-[360px] w-[360px] rounded-full border border-white/[0.07] md:h-[440px] md:w-[440px]" />
      <div className="absolute bottom-[-140px] left-[6%] h-[360px] w-[360px] rounded-full border border-white/[0.06]" />
    </div>
  );
}
