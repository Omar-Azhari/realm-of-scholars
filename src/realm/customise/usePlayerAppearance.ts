import { useMemo } from "react";
import { useRealm } from "../state/store";
import { defaultAppearance } from "./humans";
import type { Appearance } from "../types";

/** The player's character, or a default body until they make one (older saves). */
export function usePlayerAppearance(): Appearance {
  const saved = useRealm((s) => s.player?.appearance);
  return useMemo(() => saved ?? defaultAppearance("female"), [saved]);
}
