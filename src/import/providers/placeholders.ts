/**
 * Typed placeholders for providers this phase prepares an interface for but
 * does not implement (Phase 18A scope boundary — Part 3). Each one satisfies
 * the full `AcademicProvider` contract so the import manager and UI never
 * need a special case for "not built yet", but:
 *
 *  - `capabilities.configured` is always `false`
 *  - `isAvailable()` always resolves `false`
 *  - `extract()` always throws `ImportError("not-configured", …)`
 *
 * None of these contact any network host. They exist purely as a stable
 * contract for later phases to implement against. See
 * docs/PHASE_18A_IMPORT_ARCHITECTURE.md §5 for the privacy boundary this
 * preserves (no credentials, no outbound calls, until a real phase wires
 * one of these up with explicit user consent).
 *
 * `universityWebProvider` (public university search) graduated to a real
 * implementation in Phase 18B — see `officialUniversityProvider.ts` — and
 * was removed from this file. Canvas/Moodle/Blackboard/Brightspace remain
 * placeholders (Phase 18B's explicit stop condition).
 */

import type { AcademicProvider, ImportedSourcePackage, ProviderInput } from "../types";
import { ImportError } from "../types";

function placeholder(id: string, displayName: string, comingIn: string): AcademicProvider {
  return {
    id,
    displayName,
    capabilities: {
      acceptedFileKinds: [],
      requiresNoFile: true,
      producesSubjects: true,
      producesCalendarEvents: true,
      configured: false,
    },
    isAvailable: () => false,
    validate(input: ProviderInput) {
      return new ImportError("not-configured", `${displayName} isn't available yet — coming in ${comingIn}.`, input.sourceId);
    },
    async extract(input: ProviderInput): Promise<ImportedSourcePackage> {
      throw new ImportError("not-configured", `${displayName} isn't available yet — coming in ${comingIn}.`, input.sourceId);
    },
  };
}

export const canvasProvider: AcademicProvider = placeholder("canvas-lms", "Canvas", "a later phase");
export const moodleProvider: AcademicProvider = placeholder("moodle-lms", "Moodle", "a later phase");
export const blackboardProvider: AcademicProvider = placeholder("blackboard-lms", "Blackboard", "a later phase");
export const brightspaceProvider: AcademicProvider = placeholder("brightspace-lms", "Brightspace", "a later phase");

export const PLACEHOLDER_PROVIDERS: AcademicProvider[] = [
  canvasProvider,
  moodleProvider,
  blackboardProvider,
  brightspaceProvider,
];
