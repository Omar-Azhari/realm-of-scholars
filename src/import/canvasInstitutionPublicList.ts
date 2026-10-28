/**
 * Client-safe Canvas institution list (Phase 18E, Part 2/20) — id and
 * display name ONLY, in its own standalone file with zero imports. This is
 * deliberate, not just a re-export: `canvasInstitutionRegistry.ts` (the
 * FULL registry, with environment-variable NAMES and internal OAuth
 * endpoint URLs) is imported by server-only code
 * (`src/server/lms/canvas/*`), and a client component importing even a
 * derived/filtered constant FROM that same module risks the bundler
 * including the whole module's top-level construction code in the client
 * bundle (verified empirically this phase — see the frontend Semester
 * Setup Canvas flow's build-output check). Keeping this list in its own
 * file with no path back to the full registry is the simplest way to make
 * that structurally impossible rather than relying on tree-shaking
 * behaviour. Frontend components (`CanvasConnectStep.tsx`) import ONLY
 * this file — never `canvasInstitutionRegistry.ts` directly.
 *
 * Keep this list's ids in sync with `CANVAS_INSTITUTION_REGISTRY` by hand
 * — verified by scripts/verify-phase18e-canvas.ts.
 */

export interface CanvasInstitutionPublicInfo {
  id: string;
  displayName: string;
}

export const CANVAS_INSTITUTION_PUBLIC_LIST: CanvasInstitutionPublicInfo[] = [
  { id: "unimelb", displayName: "University of Melbourne" },
  { id: "monash", displayName: "Monash University" },
  { id: "rmit", displayName: "RMIT University" },
  { id: "latrobe", displayName: "La Trobe University" },
  { id: "deakin", displayName: "Deakin University" },
  { id: "swinburne", displayName: "Swinburne University of Technology" },
  { id: "vu", displayName: "Victoria University" },
];
