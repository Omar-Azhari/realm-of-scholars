/**
 * The single, canonical `React.lazy` reference to the Phase 20 3D world
 * (src/game3d/Game3D.tsx) — imported by both SemesterHomeScreen and
 * SubjectRoomScreen (docs/PHASE_20_3D_WORLD_CUSTOMISATION.md §1/§7) so the
 * entire `three`/`@react-three/fiber`/`@react-three/drei` dependency graph
 * is only ever requested when `settings.worldRenderer === "experimental-3d"`
 * actually renders it — never downloaded by a user who stays on the
 * default `"legacy-2d"` renderer.
 */

import { lazy } from "react";

export const Game3DLazy = lazy(() => import("../game3d/Game3D"));
