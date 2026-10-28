/**
 * Campus map registry (Phase 20E, Part 6 "campus map... building names").
 * Pure data — label + one-line purpose per building, keyed by the same
 * `CampusSceneId` the travel action and each building's own scene file
 * use. This is the ONE place "what buildings exist and what are they for"
 * lives, so the Menu's campus-map panel and any future way-finding UI
 * read from here rather than re-describing each building inline.
 *
 * Subject buildings are handled separately (`SUBJECT_BUILDINGS` in
 * `subjectBuilding/subjectBuildingData.ts`) since there are 4 of them,
 * keyed by real subject id, not by a fixed `CampusSceneId`.
 */

import type { CampusSceneId } from "../../world/worldTypes";
import type { UniGameSaveData } from "../../types/domain";

export interface CampusLocationMeta {
  id: CampusSceneId;
  label: string;
  /** One line describing the building's purpose — Primary Goal's "every room must have a clear purpose." */
  purpose: string;
}

export const CAMPUS_LOCATIONS: CampusLocationMeta[] = [
  { id: "campus-hq", label: "Campus HQ", purpose: "Your personal space — customise your room, check today's brief." },
  { id: "library", label: "Library", purpose: "Quiet reading and research — browse learning resources." },
  { id: "computer-lab", label: "Computer Lab", purpose: "Hands-on technical work — check assessments and code." },
  { id: "lecture-theatre", label: "Lecture Theatre", purpose: "Attend lectures — review the semester calendar." },
  { id: "student-lounge", label: "Student Lounge", purpose: "Relax and recharge — catch up with your mentor." },
  { id: "administration", label: "Administration", purpose: "Student services — semester setup and settings." },
];

export function getCampusLocationMeta(id: CampusSceneId): CampusLocationMeta | undefined {
  return CAMPUS_LOCATIONS.find((loc) => loc.id === id);
}

export interface FavouriteBuilding {
  location: CampusLocationMeta;
  visitDays: number;
}

/**
 * Phase 22 Part 1 "favourite buildings" — the ONE place this ranking is
 * computed, so `ContextEngine.ts` and `PlayerJournalScreen.tsx` (Phase 21,
 * which previously computed this inline) both read the same derivation
 * instead of two copies drifting apart.
 */
export function getFavouriteBuildings(save: UniGameSaveData, limit = 3): FavouriteBuilding[] {
  return CAMPUS_LOCATIONS.map((location) => ({ location, visit: save.buildingVisits[location.id] }))
    .filter((entry): entry is { location: CampusLocationMeta; visit: { visitDays: number; lastVisitDate: string | null } } => !!entry.visit && entry.visit.visitDays > 0)
    .sort((a, b) => b.visit.visitDays - a.visit.visitDays)
    .slice(0, limit)
    .map((entry) => ({ location: entry.location, visitDays: entry.visit.visitDays }));
}
