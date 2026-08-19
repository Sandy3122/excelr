"use client";

import { useEffect, useState } from "react";
import { isRegistrationClosed } from "@/lib/registration-window";

export function useRegistrationClosed(initial: {
  closed: boolean;
  closesAtIso: string | null;
}): boolean {
  const [closed, setClosed] = useState(
    () => initial.closed || isRegistrationClosed(initial.closesAtIso),
  );

  useEffect(() => {
    const already = initial.closed || isRegistrationClosed(initial.closesAtIso);
    setClosed(already);
    if (already || !initial.closesAtIso) return;
    const ms = Date.parse(initial.closesAtIso) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) {
      setClosed(true);
      return;
    }
    const timer = window.setTimeout(() => setClosed(true), ms);
    return () => window.clearTimeout(timer);
  }, [initial.closed, initial.closesAtIso]);

  return closed;
}
