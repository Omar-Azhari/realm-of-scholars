/**
 * The single, canonical `React.lazy` reference to the Character Creator
 * (src/game3d/creator/CharacterCreator.tsx) — same reasoning as
 * `Game3DLazy.ts`: this is the only import site, so the
 * `three`/`@react-three/fiber`/`@react-three/drei` dependency graph is
 * only ever requested when a player actually reaches an Appearance step
 * (onboarding) or opens the Wardrobe/Menu entry, never bundled into the
 * main chunk. Both the onboarding flow and the in-world Wardrobe/Menu
 * import THIS one lazy reference rather than each lazy-loading their own
 * copy, so the module (and its cache) is shared.
 */

import { lazy } from "react";

export const CharacterCreatorLazy = lazy(() =>
  import("../game3d/creator/CharacterCreator").then((m) => ({ default: m.CharacterCreator }))
);
