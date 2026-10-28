/**
 * World UI state (Phase 15A/15B): which overlay panel is open (and any
 * subject/section it was scoped to), the single tracked objective, and the
 * "locate in world" action. Mounted ABOVE the router outlet (in WorldShell)
 * so opening a panel or swapping HQ↔room never resets panel or objective
 * state, and opening a panel never navigates or moves the player. Only one
 * panel is ever open; only one objective is ever tracked.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { InteractAction, PanelId, WorldObjective } from "./worldTypes";

interface LocateTarget {
  title: string;
  subjectId: string | null;
  sceneId: string;
  interactableId?: string;
  urgency?: WorldObjective["urgency"];
}

interface WorldUiValue {
  openPanel: PanelId | null;
  /** Subject the current panel is scoped to, when opened from a room object. */
  panelSubjectId: string | null;
  /** Optional sub-section hint (e.g. "resources", "achievements"). */
  panelSection: string | null;
  togglePanel: (panel: PanelId) => void;
  openPanelFor: (panel: PanelId, subjectId?: string | null, section?: string | null) => void;
  closePanel: () => void;
  /** The one active objective (null = fall back to the auto recommendation). */
  objective: WorldObjective | null;
  setObjective: (objective: WorldObjective | null) => void;
  /** Track a task without navigating (from the Tasks panel). */
  trackObjective: (target: LocateTarget) => void;
  /** Locate: track it AND walk there (closes the panel). */
  locateInWorld: (target: LocateTarget) => void;
  /** Pending "Start Focus Session" request — WorldScene consumes it on room entry. */
  focusRequest: string | null;
  requestFocus: (subjectId: string) => void;
  consumeFocusRequest: () => void;
  /** Semester Setup (Phase 18A) — a full overlay above the panel system, opened from Menu or empty first launch. */
  semesterSetupOpen: boolean;
  openSemesterSetup: () => void;
  closeSemesterSetup: () => void;
  /**
   * Phase 20F Part 12 — the Menu-level Campus Directory accessibility
   * shortcut. `MenuPanel.tsx` renders `CampusDirectoryPanel` directly (a
   * plain, three.js-free list — no lazy boundary needed) but has no access
   * to `Game3D.tsx`'s internal scene-switching state, so a selection is
   * queued here (the same "pending request, consumed once" shape as
   * `focusRequest` above) and `Game3D.tsx` picks it up via its own
   * `handleAction` — the exact same travel path a physical door or the
   * in-world signpost already uses, never a second travel mechanism.
   */
  campusTravelRequest: InteractAction | null;
  requestCampusTravel: (action: InteractAction) => void;
  consumeCampusTravelRequest: () => void;
  /**
   * Phase 20F Part 12 "current-location indicator" — the top-centre HUD
   * location label (`HudLocation` in `WorldShell.tsx`) is derived from the
   * URL route, which never changes as the player travels between campus
   * buildings in the 3D world (deliberately — Phase 20E's whole point was
   * seamless travel with no per-building navigation). `Game3D.tsx` reports
   * its actual current building here whenever it changes so the HUD can
   * override the route-derived label; `null` when the 3D world isn't
   * mounted at all (WorldShell then falls back to its normal route logic).
   */
  current3DLocationLabel: string | null;
  setCurrent3DLocationLabel: (label: string | null) => void;
}

const WorldUiContext = createContext<WorldUiValue | null>(null);

function toObjective(target: LocateTarget): WorldObjective {
  return {
    id: `obj-${target.sceneId}-${target.interactableId ?? "room"}`,
    title: target.title,
    subjectId: target.subjectId,
    sceneId: target.sceneId,
    interactableId: target.interactableId,
    urgency: target.urgency,
  };
}

export function WorldUiProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);
  const [panelSubjectId, setPanelSubjectId] = useState<string | null>(null);
  const [panelSection, setPanelSection] = useState<string | null>(null);
  const [objective, setObjective] = useState<WorldObjective | null>(null);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);

  const closePanel = useCallback(() => setOpenPanel(null), []);

  const openPanelFor = useCallback(
    (panel: PanelId, subjectId: string | null = null, section: string | null = null) => {
      setPanelSubjectId(subjectId);
      setPanelSection(section);
      setOpenPanel(panel);
    },
    []
  );

  const togglePanel = useCallback((panel: PanelId) => {
    setPanelSubjectId(null);
    setPanelSection(null);
    setOpenPanel((prev) => (prev === panel ? null : panel));
  }, []);

  const trackObjective = useCallback((target: LocateTarget) => setObjective(toObjective(target)), []);

  const locateInWorld = useCallback(
    (target: LocateTarget) => {
      setObjective(toObjective(target));
      setOpenPanel(null);
      if (target.sceneId === "hq") navigate("/");
      else if (target.subjectId) navigate(`/subjects/${target.subjectId}`, { state: { via: "door" } });
    },
    [navigate]
  );

  const requestFocus = useCallback(
    (subjectId: string) => {
      setFocusRequest(subjectId);
      setOpenPanel(null);
      navigate(`/subjects/${subjectId}`, { state: { via: "door" } });
    },
    [navigate]
  );
  const consumeFocusRequest = useCallback(() => setFocusRequest(null), []);

  // Phase 18E: returning from the Canvas OAuth redirect reloads the whole
  // app at "/" with a `canvasStatus` query param — Semester Setup wasn't a
  // distinct route to begin with (it's this overlay), so the ONLY way to
  // resume the flow after a real page navigation away and back is to
  // re-open it here, once, on initial mount, and let SemesterSetupOverlay
  // itself read the same query param to resume at the right step.
  const [semesterSetupOpen, setSemesterSetupOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("canvasStatus");
  });
  const openSemesterSetup = useCallback(() => {
    setOpenPanel(null);
    setSemesterSetupOpen(true);
  }, []);
  const closeSemesterSetup = useCallback(() => setSemesterSetupOpen(false), []);

  const [campusTravelRequest, setCampusTravelRequest] = useState<InteractAction | null>(null);
  const requestCampusTravel = useCallback((action: InteractAction) => setCampusTravelRequest(action), []);
  const consumeCampusTravelRequest = useCallback(() => setCampusTravelRequest(null), []);

  const [current3DLocationLabel, setCurrent3DLocationLabel] = useState<string | null>(null);

  const value = useMemo<WorldUiValue>(
    () => ({
      openPanel,
      panelSubjectId,
      panelSection,
      togglePanel,
      openPanelFor,
      closePanel,
      objective,
      setObjective,
      trackObjective,
      locateInWorld,
      focusRequest,
      requestFocus,
      consumeFocusRequest,
      semesterSetupOpen,
      openSemesterSetup,
      closeSemesterSetup,
      campusTravelRequest,
      requestCampusTravel,
      consumeCampusTravelRequest,
      current3DLocationLabel,
      setCurrent3DLocationLabel,
    }),
    [
      openPanel,
      panelSubjectId,
      panelSection,
      togglePanel,
      openPanelFor,
      closePanel,
      objective,
      trackObjective,
      locateInWorld,
      focusRequest,
      requestFocus,
      consumeFocusRequest,
      semesterSetupOpen,
      openSemesterSetup,
      closeSemesterSetup,
      campusTravelRequest,
      requestCampusTravel,
      consumeCampusTravelRequest,
      current3DLocationLabel,
    ]
  );

  return <WorldUiContext.Provider value={value}>{children}</WorldUiContext.Provider>;
}

export function useWorldUi(): WorldUiValue {
  const ctx = useContext(WorldUiContext);
  if (!ctx) throw new Error("useWorldUi must be used within a WorldUiProvider");
  return ctx;
}
