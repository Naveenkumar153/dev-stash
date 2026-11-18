"use client";

import { createContext, useContext } from "react";

// Outside a provider nothing is hidden; the server's checks still refuse.
const ProAccessContext = createContext(true);

interface ProAccessProviderProps {
  /** Pro, or gating switched off: what the server's gates check. */
  hasProAccess: boolean;
  children: React.ReactNode;
}

/**
 * Tells client components whether the signed-in user has Pro access, so the
 * New Item dialog can offer an upgrade instead of an upload that the server
 * would refuse. The server's checks stay authoritative.
 */
export function ProAccessProvider({ hasProAccess, children }: Readonly<ProAccessProviderProps>) {
  return <ProAccessContext.Provider value={hasProAccess}>{children}</ProAccessContext.Provider>;
}

export function useProAccess(): boolean {
  return useContext(ProAccessContext);
}
