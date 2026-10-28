/**
 * The single, canonical `React.lazy` reference to Room Edit Mode
 * (src/game3d/editor/RoomEditor.tsx) — same "one lazy reference, shared
 * cache" reasoning as `CharacterCreatorLazy.ts`. Both the in-3D-world Room
 * Planner board and a future Menu accessibility entry (Part 11) import
 * THIS one reference rather than each lazy-loading their own copy.
 */

import { lazy } from "react";

export const RoomEditorLazy = lazy(() => import("../game3d/editor/RoomEditor").then((m) => ({ default: m.RoomEditor })));
