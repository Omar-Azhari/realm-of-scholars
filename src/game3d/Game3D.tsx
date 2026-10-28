/**
 * Milestone 20A entry point (Phase 20). The ONLY import site for
 * `three`/`@react-three/fiber`/`@react-three/drei` in this codebase — this
 * whole module is `React.lazy`-loaded from its mount points
 * (SemesterHomeScreen/SubjectRoomScreen), gated behind
 * `settings.worldRenderer === "experimental-3d"`, so a user who never
 * switches the setting downloads zero bytes of Three.js
 * (docs/PHASE_20_3D_WORLD_CUSTOMISATION.md §7).
 *
 * Keeps React UI (the interaction prompt, the Study Planner overlay)
 * outside the R3F `<Canvas>` — Part 3's own instruction — reusing the
 * existing, already-accessible `RoomPanel` (src/components/room/RoomPanel.tsx,
 * unmodified) for the overlay chrome.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { GraduationCap, LayoutGrid, Shirt, Signpost, X } from "lucide-react";
import { CampusDirectoryPanel } from "./campus/CampusDirectoryPanel";
import { getCampusLocationMeta } from "./campus/campusMap";
import { TestRoomScene } from "./scenes/TestRoomScene";
import { RoomPanel } from "../components/room/RoomPanel";
import { StudyPlannerScreen } from "../screens/StudyPlannerScreen";
// `CharacterCreatorLazy`, not a direct import — even though this whole
// module is already behind the game3d lazy boundary, `CharacterCreator`
// pulls in its OWN extra weight (a second Canvas + OrbitControls preview);
// a build check confirmed a direct static import here eagerly fetched
// that ~866KB chunk the instant the 3D world loaded, before the wardrobe
// was ever opened. Going through the shared lazy reference defers it to
// the moment `creatorOpen` actually renders it — the same "load on
// demand" discipline as Game3D's own lazy boundary, just one layer in.
import { CharacterCreatorLazy } from "../world/CharacterCreatorLazy";
// Room Edit Mode (Phase 20D) needs its own lazy boundary for the same
// reason the Character Creator does — see RoomEditorLazy.ts.
import { RoomEditorLazy } from "../world/RoomEditorLazy";
import { createDefaultAppearance, createDefaultPersonality, createDefaultRoomCustomisation } from "../data/playerIdentityDefaults";
import { useMotionPreference } from "../hooks/useMotionPreference";
import { useSaveData } from "../state/SaveDataContext";
import { useWorldUi } from "../world/WorldUiContext";
import { getRoomChangeReaction } from "../lib/roomReactions";
import { getAmbientNpcLine, getMentorAdvice, getMentorGreeting } from "./campus/npcGreetings";
import { getTimeOfDay } from "./campus/timeOfDay";
import { emitSound } from "../lib/sound";
import { resolveQualityPreset } from "./quality";
import { ROOM_NPCS } from "./rooms/testRoomWorld";
// Phase 21 Part 7 — the SAME per-subject mentor dialogue engine the 2D
// world already uses (WorldScene.tsx), reused rather than duplicated, so
// the 3D subject-building mentors finally sound like Iris/Cass/Mara/Theo
// instead of one generic voice regardless of subject.
import { getNpcMemory, applyRecognition, hasGreetedToday } from "../lib/npcMemory";
// Phase 23 "Living AI Mentor" — the multi-stage conversation engine +
// portable panel, replacing the single-line getMentorLine/getMentorAdvice
// call for subject mentors and the guide ONLY; every other NPC role keeps
// its existing speechToast treatment unchanged.
import { buildStudentContext } from "../ai/ContextEngine";
import { ruleBasedMentorDialogueProvider, type MentorConversation } from "../ai/MentorDialogueProvider";
import { withDailyCheckInFollowUp } from "../ai/CheckInFollowUp";
import { MentorConversationPanel } from "../components/mentor/MentorConversationPanel";
// Phase 24 "Proactive Mentor Engine" — decides whether/who/when to
// surface an unprompted mentor notification; this file only ever reads its
// decision (`pickNextProactiveEvent`) and renders it, never re-deriving or
// duplicating the trigger logic itself.
import { pickNextProactiveEvent, type ProactiveEvent } from "../ai/ProactiveMentorEngine";
import { MentorNotification } from "../components/mentor/MentorNotification";
import { MentorCheckInPrompt } from "../components/mentor/MentorCheckInPrompt";
import { getMelbourneDateIso, getMelbourneDateTimeKey } from "../lib/selectors";
import type { InteractAction, WorldInteractable, CampusSceneId } from "../world/worldTypes";
import type { RoomThemeId } from "../types/domain";

/** Toast is attributed to the Guide NPC (the mentor already populating this room) — Part 8's "NPCs acknowledge changes," reusing that NPC rather than inventing a bespoke narrator voice. */
const GUIDE_NPC_LABEL = ROOM_NPCS.find((npc) => npc.id === "mentor")?.label ?? "Guide";
/** How long a speech/reaction toast stays up before auto-dismissing. */
const SPEECH_TOAST_DISPLAY_MS = 6000;
/** How often the real-clock time-of-day is re-derived — atmosphere only, doesn't need per-frame precision. */
const TIME_OF_DAY_REFRESH_MS = 5 * 60 * 1000;
/** How often the Proactive Mentor Engine gets a chance to surface a notification — deliberately not per-frame; a background check, not a gameplay-critical timer (Phase 24). */
const PROACTIVE_CHECK_INTERVAL_MS = 75 * 1000;

// Phase 20E, Part 1/11 — every campus building beyond Campus HQ streams in
// on its own lazy chunk, downloaded only the moment the player actually
// travels there (confirmed in the production build as separate small
// chunks per building), never bundled into Game3D's own chunk.
const LibraryLazy = lazy(() => import("./campus/library/LibraryScene"));
const ComputerLabLazy = lazy(() => import("./campus/computerLab/ComputerLabScene"));
const LectureTheatreLazy = lazy(() => import("./campus/lectureTheatre/LectureTheatreScene"));
const StudentLoungeLazy = lazy(() => import("./campus/studentLounge/StudentLoungeScene"));
const AdministrationLazy = lazy(() => import("./campus/administration/AdministrationScene"));
const SubjectBuildingLazy = lazy(() => import("./campus/subjectBuilding/SubjectBuildingScene"));

// Phase 20F Part 7 "destination preload" — the SAME import() specifiers as
// the lazy() factories above, called early (the instant the player is in
// range of a door, before they press E) so the chunk is already
// downloading/cached by the time `travel` actually fires. A duplicate
// import() of a module already in flight or resolved is a cache hit, not a
// second network request — this never competes with the lazy() call above,
// it just warms it.
const CAMPUS_SCENE_PRELOADERS: Partial<Record<CampusSceneId, () => Promise<unknown>>> = {
  library: () => import("./campus/library/LibraryScene"),
  "computer-lab": () => import("./campus/computerLab/ComputerLabScene"),
  "lecture-theatre": () => import("./campus/lectureTheatre/LectureTheatreScene"),
  "student-lounge": () => import("./campus/studentLounge/StudentLoungeScene"),
  administration: () => import("./campus/administration/AdministrationScene"),
  "subject-building": () => import("./campus/subjectBuilding/SubjectBuildingScene"),
};

/** Phase 20F Part 7 — how long the fade-to-black/fade-in each take, either side of a building swap. "Brief transitions, no traditional loading screen." */
const TRANSITION_FADE_MS = 220;
/**
 * Zero under reduced motion (Phase 20F Part 17 accessibility review — a
 * prior "60ms" value here was still a genuine CSS opacity transition, just
 * a fast one, contradicting its own comment's claim of "no visible
 * animated fade"). The veil still does its functional job — covering the
 * scene swap and gating input against double-transition — via the same
 * two-phase state machine; only the CSS transition duration and the
 * setTimeout gate length collapse to instant.
 */
const TRANSITION_FADE_MS_REDUCED = 0;

export function Game3D() {
  const navigate = useNavigate();

  // R3F's Canvas measures its container via ResizeObserver on mount, but
  // when this whole module is React.lazy-loaded inside a Suspense boundary
  // (required for §7's bundle-splitting), the container's final layout
  // isn't always settled at that exact first-measurement instant — R3F then
  // sticks with the browser's 300×150 canvas default until something else
  // triggers a resize. Dispatching one synthetic resize right after mount
  // (confirmed live in-browser to be the exact, sufficient fix — see
  // docs/PHASE_20_3D_WORLD_CUSTOMISATION.md's completion report) forces the
  // correct initial measurement without waiting on the user to resize their
  // real window.
  useEffect(() => {
    // A single requestAnimationFrame wasn't reliably enough delay in live
    // testing — a short timeout (after layout has genuinely settled) was
    // the version confirmed working.
    const id = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    return () => window.clearTimeout(id);
  }, []);
  const reduceMotion = useMotionPreference();
  const { saveData, updatePlayerIdentity, updateSettings, recordRoomVisit, recordBuildingVisit, recordNpcInteraction, flagAssessmentStruggle, recordProactiveEventFired, setDailyCheckIn, setEveningCheckIn } = useSaveData();
  // Quality tiers (Phase 20F Part 15) — re-resolves whenever the setting
  // changes; "auto" itself only re-evaluates the hardware heuristic when
  // this recomputes (i.e. on a fresh mount of Game3D), not every render.
  const qualityPreset = useMemo(() => resolveQualityPreset(saveData.settings.graphicsQuality), [saveData.settings.graphicsQuality]);
  const { openPanel, openPanelFor, campusTravelRequest, consumeCampusTravelRequest, setCurrent3DLocationLabel } = useWorldUi();
  const [inRange, setInRange] = useState<WorldInteractable | null>(null);
  const [studyPlannerOpen, setStudyPlannerOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  // Daily gameplay loop (Phase 20E Part 3) — "spawn in Campus HQ, mentor
  // greets them if nearby, Daily Brief appears." Both nudges are one-shot
  // per session (not per Melbourne day — "every time they launch UniGame"
  // is what Part 3 actually asks for) and dismissible; neither blocks
  // movement or is otherwise mandatory.
  const [dailyBriefNudgeVisible, setDailyBriefNudgeVisible] = useState(false);

  // Room Edit Mode (Phase 20D Part 5) — draft state lives here, one level
  // above TestRoomScene, so the live 3D room can preview it via
  // TestRoomScene's `preview*` props while the editor panel is open,
  // without writing anything to save data until Apply.
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftTheme, setDraftTheme] = useState<RoomThemeId | null>(null);
  const [draftPlacedFurniture, setDraftPlacedFurniture] = useState<Record<string, string | null> | null>(null);
  const [draftRotations, setDraftRotations] = useState<Record<string, number> | null>(null);
  // A single dismissible speech/reaction toast, shared by two Phase 20D/E
  // sources: the room-customisation "cosmetic reaction" (Part 8, 20D) and
  // any NPC's short contextual line (Part 9, 20E) — one UI, not two.
  const [speechToast, setSpeechToast] = useState<{ label: string; line: string } | null>(null);

  useEffect(() => {
    if (!speechToast) return;
    const id = window.setTimeout(() => setSpeechToast(null), SPEECH_TOAST_DISPLAY_MS);
    return () => window.clearTimeout(id);
  }, [speechToast]);

  // Phase 23 "Living AI Mentor" — a real multi-stage conversation, ONLY for
  // subject mentors + the guide (every other NPC role keeps the toast
  // above). `npcId` is the 3D scene's own NPC id (e.g.
  // `subject-mentor-${subjectId}`, or "mentor" for the guide) — used to
  // drive the `talking` pose override; `npcKey` is the memory/context key
  // (the subject id itself, or "guide") the dialogue engine actually uses.
  const [mentorConversation, setMentorConversation] = useState<{ npcId: string; npcKey: string; npcLabel: string; conversation: MentorConversation } | null>(null);

  // Phase 24 "Non-Intrusive Notifications" — the single, currently-shown
  // proactive nudge (if any). Deliberately separate state from
  // `mentorConversation` above: a notification is a passive chip, not a
  // conversation — clicking "Talk" replaces it with a real one via the
  // exact same `openMentorConversation` helper the in-world npc-chat
  // interaction already uses (see below).
  const [proactiveNotification, setProactiveNotification] = useState<{ event: ProactiveEvent; npcLabel: string } | null>(null);

  // Phase 24 "Daily Check-In" / "Evening Reflection" — small, once-per-day,
  // multiple-choice mentor prompts. Dismissing one doesn't record an
  // answer (so it can still resurface later this same day), but does stop
  // it from popping up again THIS session — a session-only nicety, not
  // persisted, so a genuinely fresh day always gets a fresh chance.
  const [dailyCheckInVisible, setDailyCheckInVisible] = useState(false);
  const [eveningCheckInVisible, setEveningCheckInVisible] = useState(false);
  const [eveningCheckInDismissed, setEveningCheckInDismissed] = useState(false);

  // Campus travel (Phase 20E Part 1) — which building is currently
  // rendered inside the one Canvas below. A scene swap unmounts the
  // previous building's scene component entirely (movement/camera state
  // resets to the new scene's own spawn, exactly like the legacy 2D
  // renderer's HQ<->room boundaries already work).
  const [currentScene, setCurrentScene] = useState<{ sceneId: CampusSceneId; subjectId?: string }>({ sceneId: "campus-hq" });

  // Current-location HUD indicator (Phase 20F Part 12) — the top-centre
  // location label in WorldShell.tsx is otherwise derived from the URL
  // route, which never changes as the player travels between campus
  // buildings here (deliberately — seamless travel was the whole point of
  // Phase 20E). Report the real current building any time it changes, and
  // clear it on unmount so the HUD falls back to its normal route-based
  // logic once the 3D world isn't mounted at all.
  useEffect(() => {
    const subjectName =
      currentScene.sceneId === "subject-building"
        ? (saveData.semester.subjects.find((s) => s.id === currentScene.subjectId)?.name ?? "Subject Building")
        : null;
    setCurrent3DLocationLabel(subjectName ?? getCampusLocationMeta(currentScene.sceneId)?.label ?? "Campus");
    return () => setCurrent3DLocationLabel(null);
  }, [currentScene, saveData.semester.subjects, setCurrent3DLocationLabel]);

  // Phase 21 Part 1b/2/8 — a real, previously-undiscovered gap: the ONLY
  // place `recordRoomVisit` was ever called is the legacy 2D `WorldScene.tsx`
  // (`grep`-confirmed) — no 3D-mode player, in any building, ever
  // incremented `mentorBonds.visitDays`, silently breaking the entire
  // points-based relationship system (Part 1) for the whole 3D campus, and
  // there was no per-BUILDING visit tracking anywhere at all (needed for
  // "you've been visiting the library a lot" and the Journal's "favourite
  // building"). Fixed here, once, at the one place every building entry
  // already flows through — mirrors WorldScene.tsx's own "record on room
  // mount" timing exactly, just for the 3D scene-switch instant instead of
  // a route mount.
  useEffect(() => {
    recordBuildingVisit(currentScene.sceneId);
    if (currentScene.sceneId === "subject-building" && currentScene.subjectId) {
      recordRoomVisit(currentScene.subjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene]);

  // Building transition polish (Phase 20F Part 7) — a brief fade veil
  // covers the exact instant the old scene unmounts and the new one mounts
  // (previously an instant, uncovered cut — the audit's "camera snapping"
  // / "visible loading" gap, since the lazy Suspense fallback was `null`).
  // `transitionPhaseRef` (not just the state) is what `handleAction` reads
  // so a rapid double E-press/click can't queue a second transition before
  // the first one's timer has even set state — "prevent double
  // interaction/transition spam" from the brief.
  const [transitionPhase, setTransitionPhaseState] = useState<"none" | "out" | "in">("none");
  const transitionPhaseRef = useRef<"none" | "out" | "in">("none");
  const pendingSceneRef = useRef<{ sceneId: CampusSceneId; subjectId?: string } | null>(null);
  const transitionDurationMs = reduceMotion ? TRANSITION_FADE_MS_REDUCED : TRANSITION_FADE_MS;

  useEffect(() => {
    if (transitionPhase === "none") return;
    const id = window.setTimeout(() => {
      if (transitionPhase === "out") {
        if (pendingSceneRef.current) {
          setCurrentScene(pendingSceneRef.current);
          pendingSceneRef.current = null;
        }
        setInRange(null);
        transitionPhaseRef.current = "in";
        setTransitionPhaseState("in");
      } else {
        transitionPhaseRef.current = "none";
        setTransitionPhaseState("none");
      }
    }, transitionDurationMs);
    return () => window.clearTimeout(id);
  }, [transitionPhase, transitionDurationMs]);

  // Destination preload (Part 7) — start warming a building's lazy chunk
  // the moment the player is in range of its door, well before they
  // actually press E.
  useEffect(() => {
    if (inRange?.kind === "door" && inRange.action.type === "travel") {
      void CAMPUS_SCENE_PRELOADERS[inRange.action.sceneId]?.();
    }
  }, [inRange]);

  // Time-of-day atmosphere (Phase 20E Part 7) — a real-clock read on mount,
  // refreshed periodically; never gates any interaction, purely visual.
  const [timeOfDay, setTimeOfDay] = useState(() => getTimeOfDay());
  useEffect(() => {
    const id = window.setInterval(() => setTimeOfDay(getTimeOfDay()), TIME_OF_DAY_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  // Daily gameplay loop (Part 3) — runs once, only if the player is still
  // in Campus HQ (guards against the rare case they travelled away in the
  // first couple of seconds). `currentSceneRef` avoids re-running this
  // mount-only effect every time the scene changes.
  const currentSceneRef = useRef(currentScene);
  currentSceneRef.current = currentScene;
  useEffect(() => {
    const greetId = window.setTimeout(() => {
      if (currentSceneRef.current.sceneId === "campus-hq") setSpeechToast({ label: GUIDE_NPC_LABEL, line: getMentorGreeting("guide") });
    }, 1500);
    const nudgeId = window.setTimeout(() => {
      if (currentSceneRef.current.sceneId === "campus-hq") setDailyBriefNudgeVisible(true);
    }, 4500);
    // Phase 24 "Daily Check-In" — once per Melbourne day, offered a little
    // after the Daily Brief nudge so it never competes with it for
    // attention. Only shown if today's pick doesn't already exist.
    const checkInId = window.setTimeout(() => {
      const todayIso = getMelbourneDateIso();
      if (currentSceneRef.current.sceneId === "campus-hq" && saveData.dailyCheckIn?.dateIso !== todayIso) {
        setDailyCheckInVisible(true);
      }
    }, 7000);
    return () => {
      window.clearTimeout(greetId);
      window.clearTimeout(nudgeId);
      window.clearTimeout(checkInId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 24 — extracted from the "npc-chat" branch below (unchanged
  // behaviour, just now shared) so a Phase 24 notification click can open
  // the exact same real conversation an in-world interaction does, rather
  // than a second, duplicate code path.
  const openMentorConversation = useCallback(
    (npcKey: string, npcId: string, npcLabel: string) => {
      const now = new Date();
      const memory = getNpcMemory(saveData, npcKey);
      const context = buildStudentContext(saveData, now);
      const { conversation, memoryUpdate } = ruleBasedMentorDialogueProvider.buildConversation(saveData, context, npcKey, now);

      const finalConversation: MentorConversation = hasGreetedToday(memory, now)
        ? { npcKey, stages: [{ stage: "greeting", line: applyRecognition(memoryUpdate.summaryLine, memory, npcKey, now) }] }
        : withDailyCheckInFollowUp(conversation, saveData, npcKey, now);

      recordNpcInteraction(npcKey, memoryUpdate.summaryLine, memoryUpdate.topic ?? undefined);
      if (npcKey !== "guide" && memoryUpdate.flagAssessmentId !== undefined) flagAssessmentStruggle(npcKey, memoryUpdate.flagAssessmentId);

      setMentorConversation({ npcId, npcKey, npcLabel, conversation: finalConversation });
    },
    [saveData, recordNpcInteraction, flagAssessmentStruggle]
  );

  // Phase 24 "Interruption Rules" — never interrupt during another
  // conversation, a menu/panel, a minigame (an active Focus Sprint), or a
  // scene transition. A ref (not just the state) so the periodic check
  // below always reads the LATEST suppression state without needing to
  // tear down and recreate its interval on every UI-state change.
  const suppressedRef = useRef(false);
  suppressedRef.current =
    mentorConversation !== null ||
    proactiveNotification !== null ||
    dailyCheckInVisible ||
    eveningCheckInVisible ||
    studyPlannerOpen ||
    creatorOpen ||
    directoryOpen ||
    editorOpen ||
    openPanel !== null ||
    transitionPhase !== "none" ||
    saveData.activeFocusSession !== null;

  const saveDataRef = useRef(saveData);
  saveDataRef.current = saveData;
  const eveningCheckInDismissedRef = useRef(eveningCheckInDismissed);
  eveningCheckInDismissedRef.current = eveningCheckInDismissed;

  // Phase 24 "Proactive Mentor Engine" — a periodic, low-frequency check
  // (not per-frame) for whether the mentor should approach the player
  // unprompted. Decision-making lives entirely in `ProactiveMentorEngine.ts`;
  // this effect only asks it, respects the daily cap/cooldowns it already
  // enforces, and renders whatever single event (if any) comes back. The
  // SAME low-frequency tick also covers Evening Reflection — "when leaving
  // for the day" has no real signal in a web app with no logout, so a
  // real-clock evening check is the honest, disclosed proxy (see
  // docs/PHASE_24_PROACTIVE_MENTOR.md).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (suppressedRef.current) return;
      const now = new Date();
      const save = saveDataRef.current;

      const todayIso = getMelbourneDateIso(now);
      const hour = Number(getMelbourneDateTimeKey(now).slice(11, 13));
      if (hour >= 18 && !eveningCheckInDismissedRef.current && save.eveningCheckIn?.dateIso !== todayIso && save.userProgress.lastActiveDate === todayIso) {
        setEveningCheckInVisible(true);
        return;
      }

      const context = buildStudentContext(save, now);
      const event = pickNextProactiveEvent(save, context, now);
      if (!event) return;
      recordProactiveEventFired(event.id);
      const npcLabel = event.npcKey === "guide" ? GUIDE_NPC_LABEL : (save.semester.subjects.find((s) => s.id === event.npcKey)?.name ?? GUIDE_NPC_LABEL);
      setProactiveNotification({ event, npcLabel });
    }, PROACTIVE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = useCallback(
    (action: InteractAction) => {
      switch (action.type) {
        case "leave-room":
          navigate("/");
          break;
        case "open-study-planner":
          setStudyPlannerOpen(true);
          break;
        case "open-character-creator":
          setCreatorOpen(true);
          break;
        case "open-room-editor":
          setEditorOpen(true);
          break;
        case "open-campus-directory":
          setDirectoryOpen(true);
          break;
        case "travel":
          // Phase 20F Part 7 — ignore a travel request that arrives while
          // a transition is already in flight (rapid double E-press/click,
          // or a queued moveTo-then-activate callback firing again) rather
          // than queuing/restarting a second fade mid-flight.
          if (transitionPhaseRef.current !== "none") break;
          // Part 10 "doors opening" — the existing door-open event (Phase
          // 20, previously unused by this renderer), fired once per
          // building transition.
          emitSound("door-open");
          pendingSceneRef.current = { sceneId: action.sceneId, subjectId: action.subjectId };
          transitionPhaseRef.current = "out";
          setTransitionPhaseState("out");
          // Hide the E-prompt for the duration of the veil — it sits at a
          // higher z-index than the veil (Part 7 "temporary input lock"),
          // so leaving it up would show a stale "Enter <Building>" prompt
          // floating over the fade.
          setInRange(null);
          break;
        case "enter-room":
          // Phase 20E Part 5 — a subject building's study desk hands off
          // into the REAL, already-built 2D subject room (modules,
          // assessments, mentor dialogue) rather than duplicating any of
          // that gameplay in the 3D placeholder.
          navigate(`/subjects/${action.subjectId}`);
          break;
        case "npc-chat": {
          // Phase 23 "Living AI Mentor" — a subject-mentor with a resolved
          // subjectId, or the guide, now gets a full multi-stage
          // conversation from MentorDialogueProvider.ts instead of one
          // line. Recognition (Phase 21 Part 3) still applies on top: if
          // this NPC already spoke today, a short acknowledgement replaces
          // the WHOLE conversation, not just its first line — "recognition,
          // not a second conversation."
          const subject = action.role === "subject-mentor" && action.subjectId ? saveData.semester.subjects.find((s) => s.id === action.subjectId) : undefined;
          if (subject || action.role === "guide") {
            const npcKey = subject ? subject.id : "guide";
            const npcId = subject ? `subject-mentor-${subject.id}` : "mentor";
            openMentorConversation(npcKey, npcId, action.npcLabel);
            break;
          }
          // Safety fallback (Part 14 discipline) — a "subject-mentor" whose
          // subjectId didn't resolve to a real subject (corrupted/missing
          // id) falls back to the generic guide-style advice rather than
          // passing an invalid role into getAmbientNpcLine.
          setSpeechToast({
            label: action.npcLabel,
            line: action.role === "subject-mentor" ? getMentorAdvice(saveData) : getAmbientNpcLine(action.role, action.npcLabel, saveData),
          });
          break;
        }
        case "open-panel":
          // Phase 20C Part 5 — the bookshelf's "Browse Learning Material"
          // interactable opens the EXISTING PanelHost-driven Subjects
          // panel (rendered by WorldShell, a sibling of this whole 3D
          // scene, not something Game3D owns) — real academic resource
          // content the 2D renderer already built, not new content.
          openPanelFor(action.panel, action.subjectId ?? null, action.section ?? null);
          break;
        default:
          break;
      }
    },
    [navigate, openPanelFor, saveData, openMentorConversation]
  );

  // Menu-level Campus Directory (Phase 20F Part 12) — MenuPanel.tsx (a
  // sibling of this whole 3D world, outside its component tree) queues a
  // selection via WorldUiContext; this consumes it through the exact same
  // `handleAction` every physical door and the in-world signpost already
  // use, so it's the same travel path with the same transition/input-lock
  // guarantees, not a second mechanism.
  useEffect(() => {
    if (campusTravelRequest) {
      handleAction(campusTravelRequest);
      consumeCampusTravelRequest();
    }
  }, [campusTravelRequest, handleAction, consumeCampusTravelRequest]);

  const closeRoomEditor = useCallback(() => {
    setEditorOpen(false);
    setDraftTheme(null);
    setDraftPlacedFurniture(null);
    setDraftRotations(null);
  }, []);

  const sceneNode = useMemo(() => {
    const commonProps = { reduceMotion, onAction: handleAction, onInRangeChange: setInRange, timeOfDay, shadowMapSize: qualityPreset.shadowMapSize };
    // Phase 23 "Visual Improvements" — which NPC (if any) a MentorConversationPanel is currently open with, so its NpcCharacter can play a "talk" pose instead of its usual schedule.
    const talkingNpcId = mentorConversation?.npcId ?? null;
    switch (currentScene.sceneId) {
      case "campus-hq":
        return (
          <TestRoomScene
            {...commonProps}
            previewTheme={draftTheme ?? undefined}
            previewPlacedFurniture={draftPlacedFurniture ?? undefined}
            previewRotations={draftRotations ?? undefined}
            editModeActive={editorOpen}
          />
        );
      case "library":
        return <LibraryLazy {...commonProps} talkingNpcId={talkingNpcId} />;
      case "computer-lab":
        return <ComputerLabLazy {...commonProps} talkingNpcId={talkingNpcId} />;
      case "lecture-theatre":
        return <LectureTheatreLazy {...commonProps} talkingNpcId={talkingNpcId} />;
      case "student-lounge":
        return <StudentLoungeLazy {...commonProps} talkingNpcId={talkingNpcId} />;
      case "administration":
        return <AdministrationLazy {...commonProps} talkingNpcId={talkingNpcId} />;
      case "subject-building":
        return <SubjectBuildingLazy {...commonProps} subjectId={currentScene.subjectId ?? "user-interface-design"} talkingNpcId={talkingNpcId} />;
      default:
        return null;
    }
  }, [currentScene, reduceMotion, handleAction, timeOfDay, qualityPreset.shadowMapSize, draftTheme, draftPlacedFurniture, draftRotations, editorOpen, mentorConversation]);

  // Interaction prompt standardisation (Phase 20F Part 8) — every
  // interactable's own `label` (object name) and `actionLabel` (primary
  // action) already exist as separate fields in `WorldInteractable`; this
  // is the one place that renders them, so "object name / action / key"
  // (the brief's exact format) only needs deciding once, for every
  // interactable in every scene. Doors are the one special case: a door's
  // `label` is its DESTINATION name (e.g. "Campus HQ"), not an object name
  // a player would recognise standing in front of it, so "Door" is used as
  // the generic object name and the destination folds into the action.
  const promptObjectName = inRange ? (inRange.kind === "door" ? "Door" : inRange.label) : null;
  const promptActionText = inRange ? (inRange.kind === "door" ? `Enter ${inRange.label}` : inRange.actionLabel) : null;

  return (
    <div className="game3d-root" data-testid="game3d-root">
      <h1 className="visually-hidden">UniGame Campus</h1>
      {/* fov 46 — widened from 20A's 42 to help the shrunk, pulled-back-camera
          room (BirdsEyeCamera.tsx, Milestone 20A.5) read as mostly-visible
          in frame at the new ~55° / further-back framing. */}
      <Canvas
        shadows={qualityPreset.shadowsEnabled}
        camera={{ fov: 46 }}
        dpr={qualityPreset.dpr}
        style={{ width: "100%", height: "100%" }}
        resize={{ debounce: 0 }}
      >
        <Suspense fallback={null}>{sceneNode}</Suspense>
      </Canvas>

      {/* Building transition veil (Phase 20F Part 7) — fades to opaque
          while the outgoing scene unmounts and the incoming one mounts
          (covering both the instant swap and the lazy chunk's Suspense
          fallback), then fades back out once the new scene is in. Always
          mounted (rather than conditionally) so the CSS opacity transition
          has something continuous to animate between "out" and "in". */}
      <div
        className={`game3d-transition-veil${transitionPhase === "out" ? " is-covering" : ""}`}
        style={{ transitionDuration: `${transitionDurationMs}ms` }}
        aria-hidden="true"
      />

      {inRange ? (
        <div className="world-prompt" data-testid="game3d-interaction-prompt">
          <button
            type="button"
            onClick={() => handleAction(inRange.action)}
            aria-label={`${promptObjectName}: ${promptActionText}. Press E.`}
          >
            <span className="world-prompt-object">{promptObjectName}</span>
            <span className="world-prompt-action">
              <kbd>E</kbd>
              {promptActionText}
            </span>
          </button>
        </div>
      ) : null}

      {/* First-session guidance (Phase 20F Part 13) — restrained, one-time,
          dismissible, resettable from Settings; reuses the legacy 2D
          world's exact "world-coach-mark" visual language (a separate save
          field, `campus3DGuidanceDismissed`, so dismissing one renderer's
          guidance never silently dismisses the other's). Only shown in
          Campus HQ — matching the 2D coach mark's own "home base only"
          scoping — and only ever ended by the player's own dismissal, never
          auto-timed out, so it never competes with or interrupts anything
          else on screen. No quest system: this is a static list, nothing
          tracks whether the player has actually done any of it. */}
      {!saveData.settings.campus3DGuidanceDismissed && currentScene.sceneId === "campus-hq" ? (
        <div className="world-coach-mark" role="status" data-testid="campus3d-first-session-guide">
          <div className="world-coach-mark-body">
            <strong>New to the 3D Campus?</strong>
            <ol>
              <li>Move — WASD / arrow keys, or click the floor.</li>
              <li>
                Interact — press <kbd>E</kbd> (or click) near a highlighted object.
              </li>
              <li>Check your Daily Brief for today's plan.</li>
              <li>Use the campus signpost (or Menu → Campus Directory) to travel anywhere.</li>
              <li>Enter a subject building or your Study Desk to begin work.</li>
              <li>Any building's exit door brings you back to Campus HQ.</li>
            </ol>
          </div>
          <button type="button" onClick={() => updateSettings({ campus3DGuidanceDismissed: true })}>
            <X size={14} aria-hidden="true" /> Got it
          </button>
        </div>
      ) : null}

      {speechToast ? (
        <div className="room-reaction-toast" role="status" data-testid="room-reaction-toast">
          <span className="room-reaction-toast-name">{speechToast.label}</span>
          <span className="room-reaction-toast-line">{speechToast.line}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setSpeechToast(null)}>
            ×
          </button>
        </div>
      ) : null}

      {/* Phase 23 "Living AI Mentor" — a real multi-stage conversation,
          deliberately its own panel rather than reusing speechToast above
          (see docs/PHASE_23_AUDIT.md §3): only subject mentors + the guide
          ever populate this. */}
      {mentorConversation ? (
        <MentorConversationPanel
          npcLabel={mentorConversation.npcLabel}
          conversation={mentorConversation.conversation}
          onClose={() => setMentorConversation(null)}
        />
      ) : null}

      {/* Phase 24 "Non-Intrusive Notifications" — the ProactiveMentorEngine's
          own suppression check already ensures this never appears while
          `mentorConversation` above is showing, but the notification's own
          "Talk" action still runs through the same real conversation path
          (`openMentorConversation`), not a fabricated shortcut. */}
      {proactiveNotification ? (
        <MentorNotification
          npcLabel={proactiveNotification.npcLabel}
          line={proactiveNotification.event.teaserLine}
          onOpen={() => {
            const { npcKey } = proactiveNotification.event;
            const npcId = npcKey === "guide" ? "mentor" : `subject-mentor-${npcKey}`;
            openMentorConversation(npcKey, npcId, proactiveNotification.npcLabel);
            setProactiveNotification(null);
          }}
          onDismiss={() => setProactiveNotification(null)}
        />
      ) : null}

      {/* Phase 24 "Daily Check-In" — a real subject pick (or "not sure yet"),
          never free text; the answer is referenced descriptively by a later
          conversation via `ai/CheckInFollowUp.ts`, never fed into
          RecommendationEngine/GoalSystem internals. */}
      {dailyCheckInVisible ? (
        <MentorCheckInPrompt
          npcLabel={GUIDE_NPC_LABEL}
          question="What are you planning to focus on today?"
          options={[
            ...saveData.semester.subjects.map((s) => ({ id: s.id, label: s.name })),
            { id: "unsure", label: "Not sure yet" },
          ]}
          onSelect={(id) => {
            setDailyCheckIn(id === "unsure" ? null : id);
            setDailyCheckInVisible(false);
          }}
          onDismiss={() => setDailyCheckInVisible(false)}
        />
      ) : null}

      {/* Phase 24 "Evening Reflection" — a real, honest fact only; never
          altering ReflectionEngine.ts's own derivation. */}
      {eveningCheckInVisible ? (
        <MentorCheckInPrompt
          npcLabel={GUIDE_NPC_LABEL}
          question="How did today feel — manageable, or a lot?"
          options={[
            { id: "manageable", label: "Pretty manageable" },
            { id: "a-lot", label: "Felt like a lot" },
          ]}
          onSelect={(id) => {
            setEveningCheckIn(id === "manageable");
            setEveningCheckInVisible(false);
          }}
          onDismiss={() => {
            setEveningCheckInVisible(false);
            setEveningCheckInDismissed(true);
          }}
        />
      ) : null}

      {dailyBriefNudgeVisible ? (
        <div className="daily-brief-nudge" role="status" data-testid="daily-brief-nudge">
          <span>Your Daily Brief is ready.</span>
          <button
            type="button"
            onClick={() => {
              setDailyBriefNudgeVisible(false);
              openPanelFor("daily-brief");
            }}
          >
            Open
          </button>
          <button type="button" aria-label="Dismiss" onClick={() => setDailyBriefNudgeVisible(false)}>
            ×
          </button>
        </div>
      ) : null}

      {studyPlannerOpen ? (
        <RoomPanel title="Study Planner" icon={GraduationCap} accent="#4f7cff" onClose={() => setStudyPlannerOpen(false)}>
          <StudyPlannerScreen />
        </RoomPanel>
      ) : null}

      {creatorOpen ? (
        <RoomPanel
          title="Wardrobe"
          icon={Shirt}
          accent="#c9694f"
          onClose={() => setCreatorOpen(false)}
          className="character-creator-panel"
        >
          <Suspense fallback={<div className="onboarding-creator-loading" role="status">Loading character creator…</div>}>
            <CharacterCreatorLazy
              initialAppearance={saveData.playerIdentity?.appearance ?? createDefaultAppearance()}
              initialPersonality={saveData.playerIdentity?.personality ?? createDefaultPersonality()}
              onCancel={() => setCreatorOpen(false)}
              onDone={(appearance, personality) => {
                updatePlayerIdentity({ appearance, personality });
                setCreatorOpen(false);
              }}
            />
          </Suspense>
        </RoomPanel>
      ) : null}

      {editorOpen ? (
        <RoomPanel title="Room Planner" icon={LayoutGrid} accent="#4f7a8c" onClose={closeRoomEditor} className="room-editor-panel">
          <Suspense fallback={<div className="onboarding-creator-loading" role="status">Loading room planner…</div>}>
            <RoomEditorLazy
              initialTheme={saveData.playerIdentity?.preferredRoomTheme ?? "modern-campus"}
              initialRoomCustomisation={saveData.playerIdentity?.roomCustomisation ?? createDefaultRoomCustomisation()}
              onDraftChange={(theme, placedFurniture, rotations) => {
                setDraftTheme(theme);
                setDraftPlacedFurniture(placedFurniture);
                setDraftRotations(rotations);
              }}
              onCancel={closeRoomEditor}
              onApply={(theme, roomCustomisation) => {
                const previousTheme = saveData.playerIdentity?.preferredRoomTheme ?? "modern-campus";
                const previousCustomisation = saveData.playerIdentity?.roomCustomisation ?? createDefaultRoomCustomisation();
                const reaction = getRoomChangeReaction(previousTheme, previousCustomisation, theme, roomCustomisation);
                updatePlayerIdentity({ preferredRoomTheme: theme, roomCustomisation });
                closeRoomEditor();
                if (reaction) setSpeechToast({ label: GUIDE_NPC_LABEL, line: reaction });
              }}
            />
          </Suspense>
        </RoomPanel>
      ) : null}

      {directoryOpen ? (
        <RoomPanel title="Campus Directory" icon={Signpost} accent="#4f7a8c" onClose={() => setDirectoryOpen(false)}>
          <CampusDirectoryPanel
            onSelect={(action) => {
              setDirectoryOpen(false);
              handleAction(action);
            }}
          />
        </RoomPanel>
      ) : null}
    </div>
  );
}

export default Game3D;
