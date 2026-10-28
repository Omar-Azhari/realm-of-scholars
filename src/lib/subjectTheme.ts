import { LayoutGrid, Cloud, Kanban, Rocket, type LucideIcon } from "lucide-react";

/**
 * Single source for "which CSS accent variable belongs to which subject" —
 * previously duplicated as a local constant in SemesterHomeScreen,
 * SubjectRoomScreen, and navItems.
 */
export const SUBJECT_ACCENT_VARS: Record<string, string> = {
  "user-interface-design": "--ui-accent",
  "cloud-based-web-application-development": "--cwa-accent",
  "project-management": "--pm-accent",
  "professional-practices-and-entrepreneurship-in-it": "--ppe-accent",
};

/** Matching gradient token per subject, for icon badges / progress fills. */
export const SUBJECT_GRADIENT_VARS: Record<string, string> = {
  "user-interface-design": "--gradient-ui",
  "cloud-based-web-application-development": "--gradient-cwa",
  "project-management": "--gradient-pm",
  "professional-practices-and-entrepreneurship-in-it": "--gradient-ppe",
};

/** Matching glow token per subject, for hover/active box-shadow. */
export const SUBJECT_GLOW_VARS: Record<string, string> = {
  "user-interface-design": "--glow-ui",
  "cloud-based-web-application-development": "--glow-cwa",
  "project-management": "--glow-pm",
  "professional-practices-and-entrepreneurship-in-it": "--glow-ppe",
};

/**
 * One representative lucide icon per subject — a generic UI glyph standing
 * in for the room's theme (grid/sketch for UI Design, cloud for the cloud
 * subject, kanban board for Project Management, rocket for the
 * entrepreneurship subject), not a copy of any existing game's iconography.
 */
export const SUBJECT_ICONS: Record<string, LucideIcon> = {
  "user-interface-design": LayoutGrid,
  "cloud-based-web-application-development": Cloud,
  "project-management": Kanban,
  "professional-practices-and-entrepreneurship-in-it": Rocket,
};

export function getSubjectAccentVar(subjectId: string): string {
  return SUBJECT_ACCENT_VARS[subjectId] ?? "--hq-accent";
}

export function getSubjectGradientVar(subjectId: string): string {
  return SUBJECT_GRADIENT_VARS[subjectId] ?? "--gradient-hq";
}

export function getSubjectGlowVar(subjectId: string): string {
  return SUBJECT_GLOW_VARS[subjectId] ?? "--glow-hq";
}

export function getSubjectIcon(subjectId: string): LucideIcon {
  return SUBJECT_ICONS[subjectId] ?? LayoutGrid;
}
