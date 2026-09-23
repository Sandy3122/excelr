"use client";

import { createContext, useContext } from "react";
import { DEFAULT_REG_EVENT, type RegEventConfig } from "@/lib/reg-event";

/**
 * Which drive the surrounding registration UI belongs to. Defaults to the
 * original `/reg` event so components used outside a provider (e.g. the navbar
 * on a standalone page) keep working unchanged.
 */
const RegEventContext = createContext<RegEventConfig>(DEFAULT_REG_EVENT);

export function RegEventProvider({
  config,
  children,
}: {
  config: RegEventConfig;
  children: React.ReactNode;
}) {
  return (
    <RegEventContext.Provider value={config}>{children}</RegEventContext.Provider>
  );
}

export function useRegEvent(): RegEventConfig {
  return useContext(RegEventContext);
}
