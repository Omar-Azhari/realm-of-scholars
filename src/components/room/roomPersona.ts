/**
 * Per-subject room personality — display names for the in-room furniture
 * hotspots, and the mentor's voice lines. This is semantic content (what a
 * room object *is*, how a mentor *talks*), so it lives in code; everything
 * visual about the rooms (artwork, geometry, colours, lights) lives in
 * public/assets/manifest.json.
 *
 * Voice lines follow each mentor's confirmed personality angle from
 * planning/DESIGN_SYSTEM.md §Characters.
 */

export type RoomPanelId =
  | "assessments"
  | "modules"
  | "missions"
  | "progress"
  | "achievements"
  | "info"
  | "deadlines";

export interface RoomPersona {
  /** Location-chip suffix, e.g. "Studio" → "User Interface Design Studio". */
  roomSuffix: string;
  hotspotLabels: Record<RoomPanelId, string>;
  /** Lede line inside the modules panel. */
  modulesLede: string;
  /** Opening line of the mentor's study check-in. */
  checkInIntro: string;
}

const FALLBACK_PERSONA: RoomPersona = {
  roomSuffix: "Room",
  hotspotLabels: {
    modules: "Module Board",
    missions: "Noticeboard",
    info: "Info Board",
    progress: "Progress Wall",
    achievements: "Trophy Shelf",
    assessments: "Work Desk",
    deadlines: "Deadline Table",
  },
  modulesLede:
    "Expanding a module logs a review (+XP); ticking it complete feeds XP, streaks, and the room's mood.",
  checkInIntro: "Quick check-in — tell me how the session went.",
};

const PERSONAS: Record<string, RoomPersona> = {
  "user-interface-design": {
    roomSuffix: "Studio",
    hotspotLabels: {
      modules: "Mission Terminal",
      missions: "Noticeboard",
      info: "Whiteboard",
      progress: "Progress Wall",
      achievements: "Trophy Shelf",
      assessments: "Assessment Desk",
      deadlines: "Holo Table",
    },
    modulesLede:
      "The studio's build queue. Expanding a module logs a review (+XP); ticking it complete feeds XP, streaks, and the room's mood.",
    checkInIntro: "Sketch me the session — what made it onto the canvas?",
  },
  "cloud-based-web-application-development": {
    roomSuffix: "Lab",
    hotspotLabels: {
      modules: "Deploy Rack",
      missions: "Ticket Board",
      info: "Network Map",
      progress: "Uptime Monitor",
      achievements: "Badge Cabinet",
      assessments: "Ops Terminal",
      deadlines: "Holo Globe",
    },
    modulesLede:
      "The deployment pipeline. Expanding a module logs a review (+XP); ticking it complete ships it and feeds XP, streaks, and the room's mood.",
    checkInIntro: "Post-deploy review — walk me through the session.",
  },
  "project-management": {
    roomSuffix: "Ops Room",
    hotspotLabels: {
      modules: "Sprint Board",
      missions: "Sticky Wall",
      info: "Charter Board",
      progress: "Burndown Display",
      achievements: "Award Shelf",
      assessments: "Command Desk",
      deadlines: "Timeline Table",
    },
    modulesLede:
      "The sprint backlog. Expanding a module logs a review (+XP); ticking it complete closes the milestone and feeds XP, streaks, and the room's mood.",
    checkInIntro: "Stand-up time — what's the status on today's session?",
  },
  "professional-practices-and-entrepreneurship-in-it": {
    roomSuffix: "Incubator",
    hotspotLabels: {
      modules: "Venture Board",
      missions: "Founder's Corkboard",
      info: "Business Canvas",
      progress: "Growth Chart",
      achievements: "Trophy Case",
      assessments: "Pitch Desk",
      deadlines: "Demo-Day Table",
    },
    modulesLede:
      "The venture backlog. Expanding a module logs a review (+XP); ticking it complete is a win worth celebrating — XP, streaks, and the room's mood all move.",
    checkInIntro: "Investor update — how did the session go?",
  },
};

export function getRoomPersona(subjectId: string): RoomPersona {
  return PERSONAS[subjectId] ?? FALLBACK_PERSONA;
}
