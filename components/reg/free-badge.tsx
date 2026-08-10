import Image from "next/image";

/** "Absolutely FREE for All" badge (spec §3.2). Image asset from Figma. */
export default function FreeBadge({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/reg/free-badge.png"
      alt="Absolutely FREE for All"
      width={2481}
      height={834}
      className={className}
      priority
    />
  );
}
