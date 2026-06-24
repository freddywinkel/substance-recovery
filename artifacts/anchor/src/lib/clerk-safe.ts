import { createContext, useContext } from "react";

/** True when the app is wrapped in a live ClerkProvider (keys present and valid). */
export const ClerkAvailableContext = createContext<boolean>(false);

export function useClerkAvailable() {
  return useContext(ClerkAvailableContext);
}
