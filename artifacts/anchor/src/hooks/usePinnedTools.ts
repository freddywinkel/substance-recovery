import { useCallback } from "react";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { TOOL_IDS, type RecoveryToolId } from "@/lib/recoveryFeatures";

export function usePinnedTools(): {
  pinned: string[];
  isPinned: (id: string) => boolean;
  togglePin: (id: string) => void;
  limitReached: boolean;
} {
  const { homePreferences, togglePinnedTool } = useRecoveryFeatures();
  const pinned = homePreferences.pinnedToolIds;

  const isPinned = useCallback(
    (id: string) => pinned.includes(id as RecoveryToolId),
    [pinned]
  );

  const togglePin = useCallback((id: string) => {
    if (!TOOL_IDS.includes(id as RecoveryToolId)) return;
    void togglePinnedTool(id as RecoveryToolId);
  }, [togglePinnedTool]);

  return { pinned, isPinned, togglePin, limitReached: pinned.length >= 2 };
}
