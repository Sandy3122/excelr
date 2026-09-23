"use client";

import Image from "next/image";
import { useRegEvent } from "./reg-event-context";

/** "Absolutely FREE for All" badge (spec §3.2). Image asset from Figma. */
export default function FreeBadge({ className = "" }: { className?: string }) {
  const { freeBadgeSrc } = useRegEvent();

  return (
    <Image
      src={freeBadgeSrc}
      alt="Absolutely FREE for All"
      width={2481}
      height={834}
      className={className}
      priority
    />
  );
}
