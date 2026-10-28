/**
 * Campus Directory (Phase 20E, Part 6 "campus map... building names").
 * Opened from Campus HQ's signpost — a way-finding list of every real
 * building plus the 4 subject-building placeholders, each one click away
 * via the existing `travel` action (no new travel mechanism). Doubles as
 * the accessibility-friendly alternative to walking through a physical
 * door (Part 12), and as the Menu's own "Travel" entry (reused, not
 * duplicated — see MenuPanel.tsx).
 */

import { BookOpen, Building2, Coffee, DoorOpen, GraduationCap, Landmark, Laptop, LayoutGrid } from "lucide-react";
import { CAMPUS_LOCATIONS } from "./campusMap";
import { subjects } from "../../data/semesterData";
import { getSubjectAccentVar } from "../../lib/subjectTheme";
import type { InteractAction, CampusSceneId } from "../../world/worldTypes";

const LOCATION_ICONS: Record<CampusSceneId, typeof Landmark> = {
  "campus-hq": Landmark,
  library: BookOpen,
  "computer-lab": Laptop,
  "lecture-theatre": GraduationCap,
  "student-lounge": Coffee,
  administration: Building2,
  "subject-building": LayoutGrid,
  // V2 Phase 1 (additive) — these 5 ids belong to the separate prestige-v2
  // renderer and are never added to CAMPUS_LOCATIONS below, so this legacy
  // directory panel never actually lists them; entries only exist to keep
  // this Record exhaustive over the (now larger) CampusSceneId union.
  "prestige-main-gate": Landmark,
  "prestige-grand-courtyard": Landmark,
  "prestige-great-hall": Landmark,
  "prestige-hall-of-artisans": Landmark,
  "prestige-dorm-preview": Landmark,
};

export function CampusDirectoryPanel({ onSelect }: { onSelect: (action: InteractAction) => void }) {
  const buildings = CAMPUS_LOCATIONS.filter((loc) => loc.id !== "campus-hq");

  return (
    <div className="campus-directory">
      <ul className="campus-directory-list">
        {buildings.map((loc) => {
          const Icon = LOCATION_ICONS[loc.id];
          return (
            <li key={loc.id}>
              <button type="button" onClick={() => onSelect({ type: "travel", sceneId: loc.id })}>
                <Icon size={18} aria-hidden="true" />
                <span className="campus-directory-text">
                  <span className="campus-directory-label">{loc.label}</span>
                  <span className="campus-directory-purpose">{loc.purpose}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="campus-directory-heading">Subject Buildings</h3>
      <ul className="campus-directory-list">
        {subjects.map((subject) => (
          <li key={subject.id}>
            <button type="button" onClick={() => onSelect({ type: "travel", sceneId: "subject-building", subjectId: subject.id })}>
              <span className="campus-directory-dot" style={{ background: `var(${getSubjectAccentVar(subject.id)})` }} aria-hidden="true" />
              <span className="campus-directory-text">
                <span className="campus-directory-label">{subject.name}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="campus-directory-leave" onClick={() => onSelect({ type: "leave-room" })}>
        <DoorOpen size={16} aria-hidden="true" /> Leave Campus
      </button>
    </div>
  );
}

export default CampusDirectoryPanel;
