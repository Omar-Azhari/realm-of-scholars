/**
 * V2 Phase 1 "Prestige Vertical Slice" — the entry point for the new
 * `prestige-v2` world renderer, the direct sibling of `Game3D.tsx` (which
 * stays completely unmodified — see docs/UNIGAME_V2_MASTER_DESIGN.md
 * §16/§17). Mounted only when `settings.worldRenderer === "prestige-v2"`
 * (`SemesterHomeScreen.tsx`), exactly like `Game3D.tsx` is mounted only for
 * `"experimental-3d"`.
 *
 * Scope, deliberately narrow per the brief: 4 real, walkable districts
 * (Main Gate, Grand Courtyard, Great Hall, Hall of Artisans) plus one
 * preview-only Dormitory room — no Character Creator, Room Editor, Study
 * Planner, or Campus Directory wiring here (none of that is reachable from
 * these 5 scenes' own interactables); the existing Menu panel and its
 * other entries remain fully available regardless, since this component
 * mounts inside the SAME `WorldShell`/`Outlet` every renderer shares.
 *
 * Mentor conversations reuse `useMentorConversation.ts` (the SAME portable
 * hook the Dashboard already uses) rather than re-deriving Game3D.tsx's
 * own inline conversation-building logic a second time — this file never
 * touches `ContextEngine.ts`/`MentorDialogueProvider.ts`/`RecommendationEngine.ts`
 * directly.
 */

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { useMotionPreference } from "../../hooks/useMotionPreference";
import { useSaveData } from "../../state/SaveDataContext";
import { useMentorConversation } from "../../hooks/useMentorConversation";
import { useWorldUi } from "../../world/WorldUiContext";
import { MentorConversationPanel } from "../../components/mentor/MentorConversationPanel";
import { MentorCheckInPrompt } from "../../components/mentor/MentorCheckInPrompt";
import { resolveQualityPreset } from "../quality";
import { emitSound } from "../../lib/sound";
import type { CampusSceneId, InteractAction, WorldInteractable } from "../../world/worldTypes";

const MainGateLazy = lazy(() => import("./scenes/MainGateScene"));
const GrandCourtyardLazy = lazy(() => import("./scenes/GrandCourtyardScene"));
const GreatHallLazy = lazy(() => import("./scenes/GreatHallScene"));
const HallOfArtisansLazy = lazy(() => import("./scenes/HallOfArtisansScene"));
const DormPreviewLazy = lazy(() => import("./scenes/DormPreviewScene"));

type PrestigeSceneId = Extract<CampusSceneId, `prestige-${string}`>;

/** Human-readable district names for the persistent HUD location chip — the same "report where the player currently is" contract Game3D.tsx's own `setCurrent3DLocationLabel` effect already follows. */
const SCENE_LABELS: Record<PrestigeSceneId, string> = {
  "prestige-main-gate": "Main Gate",
  "prestige-grand-courtyard": "Grand Courtyard",
  "prestige-great-hall": "Great Hall",
  "prestige-hall-of-artisans": "Hall of Artisans",
  "prestige-dorm-preview": "Dormitory Preview",
};

const TRANSITION_FADE_MS = 260;
const TRANSITION_FADE_MS_REDUCED = 0;

export default function PrestigeWorld() {
  const navigate = useNavigate();
  const reduceMotion = useMotionPreference();
  const { saveData } = useSaveData();
  const { setCurrent3DLocationLabel } = useWorldUi();
  const qualityPreset = useMemo(() => resolveQualityPreset(saveData.settings.graphicsQuality), [saveData.settings.graphicsQuality]);

  const [currentScene, setCurrentScene] = useState<PrestigeSceneId>("prestige-main-gate");
  const [transitionPhase, setTransitionPhase] = useState<"none" | "out" | "in">("none");
  const transitionPhaseRef = useRef<"none" | "out" | "in">("none");
  const pendingSceneRef = useRef<PrestigeSceneId | null>(null);
  const transitionDurationMs = reduceMotion ? TRANSITION_FADE_MS_REDUCED : TRANSITION_FADE_MS;

  // Same known, confirmed fix as Game3D.tsx's own mount effect (see its
  // header comment): R3F's Canvas measures its container via
  // ResizeObserver on mount, but a lazy-loaded module inside a Suspense
  // boundary doesn't always have settled layout at that exact instant —
  // it then sticks with the browser's 300x150 canvas default until
  // something else triggers a resize.
  useEffect(() => {
    const id = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    return () => window.clearTimeout(id);
  }, []);

  const [inRange, setInRange] = useState<WorldInteractable | null>(null);
  const [inspectNotice, setInspectNotice] = useState<{ title: string; body: string } | null>(null);

  const { active: mentorActive, openConversation, closeConversation } = useMentorConversation();

  useEffect(() => {
    setCurrent3DLocationLabel(SCENE_LABELS[currentScene]);
    return () => setCurrent3DLocationLabel(null);
  }, [currentScene, setCurrent3DLocationLabel]);

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
        setTransitionPhase("in");
      } else {
        transitionPhaseRef.current = "none";
        setTransitionPhase("none");
      }
    }, transitionDurationMs);
    return () => window.clearTimeout(id);
  }, [transitionPhase, transitionDurationMs]);

  const handleAction = (action: InteractAction) => {
    switch (action.type) {
      case "travel": {
        if (transitionPhaseRef.current !== "none") break;
        if (!action.sceneId.startsWith("prestige-")) break; // this renderer only ever produces its own 5 scene ids
        emitSound("door-open");
        pendingSceneRef.current = action.sceneId as PrestigeSceneId;
        transitionPhaseRef.current = "out";
        setTransitionPhase("out");
        setInRange(null);
        break;
      }
      case "npc-chat": {
        const npcKey = action.role === "subject-mentor" && action.subjectId ? action.subjectId : "guide";
        openConversation(npcKey, action.npcLabel);
        break;
      }
      case "enter-room": {
        navigate(`/subjects/${action.subjectId}`);
        break;
      }
      case "inspect": {
        setInspectNotice({ title: action.title, body: action.body });
        break;
      }
      case "leave-room": {
        navigate("/");
        break;
      }
      default:
        break;
    }
  };

  const sceneNode = useMemo(() => {
    const common = {
      reduceMotion,
      onAction: handleAction,
      onInRangeChange: setInRange,
    };
    switch (currentScene) {
      case "prestige-main-gate":
        return <MainGateLazy {...common} />;
      case "prestige-grand-courtyard":
        return <GrandCourtyardLazy {...common} />;
      case "prestige-great-hall":
        // The Great Hall's NPCs are all decorative diners — none is ever a
        // conversation target, so talkingNpcId stays at its default (null).
        return <GreatHallLazy {...common} />;
      case "prestige-hall-of-artisans":
        return <HallOfArtisansLazy {...common} talkingNpcId={mentorActive?.conversation.npcKey ?? null} />;
      case "prestige-dorm-preview":
        return <DormPreviewLazy {...common} />;
      default:
        return <GrandCourtyardLazy {...common} />;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene, reduceMotion, mentorActive]);

  return (
    <div className="game3d-root prestige-v2-root">
      <Canvas shadows={qualityPreset.shadowsEnabled} camera={{ fov: 52 }} dpr={qualityPreset.dpr} style={{ width: "100%", height: "100%" }} resize={{ debounce: 0 }}>
        <Suspense fallback={null}>{sceneNode}</Suspense>
      </Canvas>

      <div className={`game3d-transition-veil${transitionPhase === "out" ? " is-covering" : ""}`} style={{ transitionDuration: `${transitionDurationMs}ms` }} />

      {inRange ? (
        <div className="world-prompt" data-testid="prestige-interaction-prompt">
          <button type="button" onClick={() => handleAction(inRange.action)} aria-label={`${inRange.kind === "door" ? "Door" : inRange.label}: ${inRange.kind === "door" ? `Enter ${inRange.label}` : inRange.actionLabel}. Press E.`}>
            <span className="world-prompt-object">{inRange.kind === "door" ? "Door" : inRange.label}</span>
            <span className="world-prompt-action">
              <kbd>E</kbd>
              {inRange.kind === "door" ? `Enter ${inRange.label}` : inRange.actionLabel}
            </span>
          </button>
        </div>
      ) : null}

      {mentorActive ? (
        <MentorConversationPanel npcLabel={mentorActive.npcLabel} conversation={mentorActive.conversation} onClose={closeConversation} />
      ) : null}

      {inspectNotice ? (
        <MentorCheckInPrompt
          npcLabel={inspectNotice.title}
          question={inspectNotice.body}
          options={[{ id: "ok", label: "Close" }]}
          onSelect={() => setInspectNotice(null)}
          onDismiss={() => setInspectNotice(null)}
        />
      ) : null}
    </div>
  );
}
