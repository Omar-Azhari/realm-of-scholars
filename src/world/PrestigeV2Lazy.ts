/**
 * The single, canonical `React.lazy` reference to V2 Phase 1's "Prestige
 * Vertical Slice" (src/game3d/prestige/PrestigeWorld.tsx) — the direct
 * sibling of `Game3DLazy.ts` for the OLD `experimental-3d` renderer (that
 * file stays untouched). Imported only where `settings.worldRenderer ===
 * "prestige-v2"` actually renders it, so the same
 * `three`/`@react-three/fiber`/`@react-three/drei` dependency graph is
 * never downloaded by a user who stays on "legacy-2d" or "experimental-3d".
 */

import { lazy } from "react";

export const PrestigeV2Lazy = lazy(() => import("../game3d/prestige/PrestigeWorld"));
