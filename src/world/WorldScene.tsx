/**
 * The single active world scene (Phase 15A). Renders either Campus HQ or a
 * subject room from the manifest, and layers free player movement
 * (click-to-move + WASD), attached interactables, mentor dialogue, the study
 * desk focus flow, and HQ↔room transitions on top. Replaces the old
 * pose-scripted HQScene / SubjectRoomScene as the interactive surface, while
 * reusing the same SceneStage renderer, sprites, room-evolution visuals and
 * Focus Mode.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useSceneDef } from "../engine/AssetContext";
import { SceneStage } from "../engine/SceneStage";
import { Actor } from "../engine/Actor";
import { SpeechBubble } from "../components/hq/SpeechBubble";
import { FocusPanel } from "../components/room/FocusPanel";
import { RoomPanel } from "../components/room/RoomPanel";
import { RoomLifeLayer } from "../components/room/RoomLifeLayer";
import { useSaveData } from "../state/SaveDataContext";
import { useMotionPreference } from "../hooks/useMotionPreference";
import { computeSubjectSimState } from "../lib/simulation";
import { computeMentorRelationship } from "../lib/mentorRelationship";
import { computeRoomEvolution } from "../lib/roomEvolution";
import { getSemesterCalendar } from "../lib/semesterCalendar";
import { getMentorLine } from "../lib/mentorDialogue";
import { getTopPriorityItems } from "../lib/priority";
import { getSubjectCompletedModuleCount } from "../lib/selectors";
import { emitSound } from "../lib/sound";
import { buildHqWorld, buildRoomWorld } from "./sceneWorld";
import { useWorldMovement, nearestInRange } from "./useWorldMovement";
import { WorldPlayer } from "./WorldPlayer";
import { Interactable } from "./Interactable";
import { useWorldUi } from "./WorldUiContext";
import type { HallSceneDef, RoomSceneDef } from "../engine/manifestTypes";
import type { SubjectRecord } from "../types/domain";
import type { InteractAction, SceneWorld, WorldInteractable } from "./worldTypes";
import { Info } from "lucide-react";

const GREETING_MS = 4500;

/** A scene viewed permissively as either hall or room (we know which at runtime). */
type WorldSceneDef = HallSceneDef & Omit<RoomSceneDef, "kind">;

export function WorldScene({ subject }: { subject?: SubjectRecord }) {
  const isRoom = Boolean(subject);
  const sceneId = subject ? `room-${subject.id}` : "hq";
  const scene = useSceneDef<RoomSceneDef>(sceneId) as unknown as WorldSceneDef | null;
  const navigate = useNavigate();
  const reduceMotion = useMotionPreference();
  const { saveData, recordRoomVisit } = useSaveData();
  const worldUi = useWorldUi();

  const groundRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const queue = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), []);

  const [transition, setTransition] = useState<null | "enter" | "leave">(null);
  const [focusOpen, setFocusOpen] = useState(
    () => Boolean(subject) && saveData.activeFocusSession?.subjectId === subject?.id
  );
  const [talking, setTalking] = useState(isRoom); // greet on room entry (touch parity)
  const [inspect, setInspect] = useState<{ title: string; body: string } | null>(null);

  // Room-only derived state for evolution visuals + mentor dialogue.
  const evolution = useMemo(
    () => (subject ? computeRoomEvolution(saveData, subject) : null),
    [saveData, subject]
  );
  const sim = useMemo(
    () => (subject ? computeSubjectSimState(subject, saveData.tasks, saveData.assessmentProgress) : null),
    [saveData, subject]
  );
  const relationship = useMemo(
    () => (subject ? computeMentorRelationship(saveData, subject) : null),
    [saveData, subject]
  );
  const calendar = useMemo(() => getSemesterCalendar(saveData), [saveData]);

  const mentorLine = useMemo(() => {
    if (!subject || !sim || !relationship) return "";
    const [next] = getTopPriorityItems([subject], saveData.tasks, new Date(), 1);
    return getMentorLine({
      save: saveData,
      subject,
      sim,
      relationship,
      calendar,
      nextItemTitle: next ? (next.type === "module" ? next.module.title : next.assessment.title) : null,
      nextIsAssessment: next?.type === "assessment",
    });
  }, [subject, sim, relationship, saveData, calendar]);

  // Record a visit + arm the entry greeting timer (rooms only).
  useEffect(() => {
    if (!subject) return;
    recordRoomVisit(subject.id);
    setTalking(true);
    const timer = window.setTimeout(() => setTalking(false), GREETING_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject?.id]);

  // "Start Focus Session" requested from the Tasks panel → open Focus on entry.
  useEffect(() => {
    if (subject && worldUi.focusRequest === subject.id) {
      setFocusOpen(true);
      worldUi.consumeFocusRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject?.id, worldUi.focusRequest]);

  // Merge reached room-evolution stages into the scene (visual only).
  const evolvedScene = useMemo(() => {
    if (!scene?.evolution || !evolution) return scene;
    const reached = scene.evolution.stages.filter((s) => s.stage <= evolution.stage);
    if (reached.length === 0) return scene;
    return {
      ...scene,
      images: [...scene.images, ...reached.flatMap((s) => s.images ?? [])],
      lights: [...scene.lights, ...reached.flatMap((s) => s.lights ?? [])],
      ambience: [...(scene.ambience ?? []), ...reached.flatMap((s) => s.ambience ?? [])],
    };
  }, [scene, evolution]);

  const world = useMemo(() => {
    if (!scene) return null;
    return subject
      ? buildRoomWorld(scene as unknown as RoomSceneDef, subject.id, subject.name)
      : buildHqWorld(scene as unknown as HallSceneDef);
  }, [scene, subject]);

  const movementEnabled = transition === null && !focusOpen;
  const movement = useWorldMovement(world ?? EMPTY_WORLD, {
    reduceMotion,
    enabled: movementEnabled && Boolean(world),
  });

  // Footstep cadence — a soft step sound on a steady beat while walking
  // (Part 3 "footstep timing"). Silent by default; wiring is correct.
  useEffect(() => {
    if (!movement.moving || reduceMotion) return;
    const id = window.setInterval(() => emitSound("footsteps"), 330);
    return () => window.clearInterval(id);
  }, [movement.moving, reduceMotion]);

  const beginEnter = useCallback(
    (subjectId: string) => {
      emitSound("door-open");
      if (reduceMotion) {
        navigate(`/subjects/${subjectId}`, { state: { via: "door" } });
        return;
      }
      setTransition("enter");
      queue(() => navigate(`/subjects/${subjectId}`, { state: { via: "door" } }), 520);
    },
    [navigate, queue, reduceMotion]
  );

  const beginLeave = useCallback(() => {
    emitSound("door-open");
    if (reduceMotion) {
      navigate("/", { state: { returnFrom: subject?.id } });
      return;
    }
    setTransition("leave");
    queue(() => navigate("/", { state: { returnFrom: subject?.id } }), 520);
  }, [navigate, queue, reduceMotion, subject?.id]);

  const runAction = useCallback(
    (action: InteractAction) => {
      switch (action.type) {
        case "enter-room":
          beginEnter(action.subjectId);
          break;
        case "leave-room":
          beginLeave();
          break;
        case "talk":
          setTalking(true);
          queue(() => setTalking(false), GREETING_MS);
          break;
        case "focus":
          emitSound("monitor-on");
          setFocusOpen(true);
          break;
        case "open-panel":
          worldUi.openPanelFor(action.panel, action.subjectId ?? subject?.id ?? null, action.section ?? null);
          break;
        case "inspect":
          setInspect({ title: action.title, body: action.body });
          break;
      }
    },
    [beginEnter, beginLeave, queue, subject?.id, worldUi]
  );

  const activate = useCallback(
    (item: WorldInteractable) => {
      if (!movementEnabled) return;
      const near = nearestInRange(movement.pos, [item]);
      if (near) {
        runAction(item.action);
      } else {
        emitSound("footsteps");
        movement.moveTo(item.standPoint, { interactableId: item.id, onArrive: () => runAction(item.action) });
      }
    },
    [movement, movementEnabled, runAction]
  );

  const handleGroundClick = useCallback(
    (e: React.MouseEvent) => {
      if (!world || !groundRef.current || !movementEnabled) return;
      const rect = groundRef.current.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * world.width;
      const sy = ((e.clientY - rect.top) / rect.height) * world.height;
      emitSound("footsteps");
      movement.moveTo({ x: sx, feetY: sy });
    },
    [movement, movementEnabled, world]
  );

  const inRange = world ? nearestInRange(movement.pos, world.interactables) : null;

  // The "E" key triggers the in-range interaction (RPG-style). Bound once;
  // reads live state through refs so it never re-binds on movement.
  const interactRef = useRef<() => void>(() => {});
  interactRef.current = () => {
    if (!movementEnabled || worldUi.openPanel !== null || !inRange) return;
    runAction(inRange.action);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "e" && e.key !== "E") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      interactRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!scene || !world) {
    return <div className="world-scene-loading" aria-hidden="true" />;
  }

  const promptItem = inRange && movementEnabled ? inRange : null;
  const trackedId =
    worldUi.objective && worldUi.objective.sceneId === sceneId ? worldUi.objective.interactableId : undefined;

  // Environmental feedback + small idle reaction: face the object you stop by.
  const completedModules = subject ? getSubjectCompletedModuleCount(saveData.tasks, subject) : 0;
  const objCenterX = promptItem ? promptItem.rect[0] + promptItem.rect[2] / 2 : 0;
  const facingLeft = movement.moving
    ? movement.facingLeft
    : promptItem
      ? objCenterX < movement.pos.x
      : movement.facingLeft;

  // The bottom prompt reads as a natural sentence: doors say "Enter <name>",
  // everything else uses its already-natural verb phrase.
  const promptText = promptItem
    ? promptItem.kind === "door"
      ? `Enter ${promptItem.label}`
      : promptItem.actionLabel
    : "";

  return (
    <div className="world-scene" data-scene={sceneId} data-room={isRoom || undefined} data-anim={transition ?? undefined}>
      <SceneStage scene={evolvedScene ?? scene}>
        {/* Click-to-move ground layer (mouse affordance; keyboard uses WASD). */}
        <div
          ref={groundRef}
          className="world-ground"
          onClick={handleGroundClick}
          aria-hidden="true"
        />

        {/* HQ: ambient mentors by their doors (Enter handled by the door). */}
        {!isRoom
          ? scene.doors.map((door) => (
              <Actor
                key={door.subjectId}
                spriteId={`mentor-${door.subjectId}`}
                pose={{ x: door.x + scene.mentorOffsetX, feetY: scene.mentorFeetY, height: scene.mentorHeight }}
                sceneWidth={world.width}
                sceneHeight={world.height}
                animation="idle"
                label={`${door.label} mentor`}
              />
            ))
          : null}

        {/* Room: the resident mentor with live dialogue. */}
        {isRoom && subject ? (
          <Actor
            spriteId={`mentor-${subject.id}`}
            pose={{ x: scene.mentor.x, feetY: scene.mentor.feetY, height: scene.mentor.height }}
            sceneWidth={world.width}
            sceneHeight={world.height}
            animation={sim?.justCelebrated ? "celebrate" : talking ? "speaking" : "idle"}
            label={subject.characterConcept}
          >
            <SpeechBubble text={mentorLine} visible={talking || sim?.roomStatus === "urgent"} />
          </Actor>
        ) : null}

        {/* Interactables (attached to world objects). */}
        {world.interactables.map((item) => (
          <Interactable
            key={item.id}
            item={item}
            sceneWidth={world.width}
            sceneHeight={world.height}
            inRange={inRange?.id === item.id}
            tracked={trackedId === item.id}
            onActivate={activate}
          />
        ))}

        {/* Environmental feedback — the room fills with life as real modules
            get completed (notes on the board, mugs on busy weeks, books,
            monitor content). No panel needed to see your progress. */}
        {isRoom ? (
          <RoomLifeLayer
            scene={scene as unknown as RoomSceneDef}
            era={calendar.era}
            workload={sim?.workload ?? 0}
            completedModules={completedModules}
            focused={focusOpen}
          />
        ) : null}

        <WorldPlayer
          pos={movement.pos}
          height={movement.height}
          facingLeft={facingLeft}
          moving={movement.moving}
          marker={movement.marker}
          sceneWidth={world.width}
          sceneHeight={world.height}
          reduceMotion={reduceMotion}
        />

      </SceneStage>

      {/* Single bottom-centre interaction prompt — only when near an object. */}
      {promptItem ? (
        <div className="world-prompt" data-testid="interaction-prompt">
          <button type="button" onClick={() => runAction(promptItem.action)}>
            <kbd>E</kbd>
            <span>{promptText}</span>
          </button>
        </div>
      ) : null}

      {/* Transition veil */}
      {transition && !reduceMotion ? (
        <motion.div
          className="world-veil"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
          aria-hidden="true"
        />
      ) : null}

      {/* Focus Mode overlay */}
      {focusOpen && subject ? (
        <FocusPanel subject={subject} accent={scene.accent} onClose={() => setFocusOpen(false)} />
      ) : null}

      {/* Inspect popover */}
      {inspect ? (
        <RoomPanel title={inspect.title} icon={Info} accent={scene.accent} onClose={() => setInspect(null)}>
          <p className="room-panel-lede">{inspect.body}</p>
        </RoomPanel>
      ) : null}
    </div>
  );
}

const EMPTY_WORLD: SceneWorld = {
  sceneId: "none",
  width: 1600,
  height: 760,
  walkable: { xMin: 0, xMax: 1600, feetBack: 700, feetFront: 726 },
  heightFront: 150,
  heightBack: 90,
  spawn: { x: 800, feetY: 726 },
  obstacles: [],
  interactables: [],
};
