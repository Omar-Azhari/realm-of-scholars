/**
 * Client-safe Moodle institution list (Phase 18F). Zero imports,
 * deliberately, so no client bundle can transitively pull in
 * `moodleInstitutionRegistry.ts`'s env-var name or endpoint URLs — the same
 * isolation `canvasInstitutionPublicList.ts` uses, for the same reason (a
 * real bundle-leak this project already found and fixed once for Canvas;
 * never repeat that shape for Moodle). This is the ONLY Moodle-institution
 * data any client component may import.
 */

export interface MoodleInstitutionPublicInfo {
  institutionId: string;
  displayName: string;
  lmsKind: "moodle";
}

export const MOODLE_INSTITUTION_PUBLIC_LIST: MoodleInstitutionPublicInfo[] = [
  { institutionId: "latrobe", displayName: "La Trobe University", lmsKind: "moodle" },
];
