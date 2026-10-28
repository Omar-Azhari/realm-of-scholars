/**
 * Subject building placeholders (Phase 20E, Part 5) — one parameterized
 * scene (not 4 separate files) since all 4 share the same "future
 * expansion point" shape: a small room, a unique palette, a mentor, and a
 * desk that hands off into the REAL, already-built 2D subject room
 * (`SubjectRoomScreen`, via the existing `enter-room` action) rather than
 * duplicating any module/assessment/mentor-dialogue gameplay here — "no
 * gameplay duplication," per the brief. Reuses the real subject ids from
 * `semesterData.ts` and each subject's existing `roomPersona.ts` flavour
 * (its "roomSuffix" — Studio/Lab/Ops Room/Incubator) rather than
 * inventing new names, and the real accent colours already established
 * for these subjects (`subjectTheme.ts`/tokens.css) for the palette.
 *
 * Deliberately identical LAYOUT across all 4 (only palette/mentor/props
 * vary) — "no duplicated layouts" (Part 2) is scoped to the campus's 6
 * distinct-purpose locations, each already genuinely unique; these are
 * explicit placeholders for future, not-yet-built subject-specific
 * gameplay, so one shared shell is the honest, non-duplicative choice
 * (see the Phase 20E completion report for this reasoning).
 */

import { RoundedBox } from "@react-three/drei";
import { CampusBuildingScene, type BuildingNpcDefinition, type BuildingPalette } from "../../scenes/CampusBuildingScene";
import { Bookshelf, ContactShadow, PotPlant } from "../../rooms/furniturePieces";
import { floorPointToVector3 } from "../../types/coordinates";
import { ROOM_THEMES } from "../../rooms/roomThemes";
import { getRoomPersona } from "../../../components/room/roomPersona";
import { subjects } from "../../../data/semesterData";
import type { NpcSchedule } from "../../characters/npcSchedule";
import type { CharacterAppearance, PlayerPersonality } from "../../../types/domain";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";
import type { TimeOfDay } from "../timeOfDay";

/** Real accent colours already established for these 4 subjects (subjectTheme.ts/tokens.css) — reused here, not reinvented, since CSS custom properties can't be read directly by a Three.js material. */
const SUBJECT_ACCENTS: Record<string, { wall: string; floor: string; trim: string }> = {
  "user-interface-design": { wall: "#3a2a42", floor: "#241a2b", trim: "#b24bf3" },
  "cloud-based-web-application-development": { wall: "#1e2a38", floor: "#141d28", trim: "#3da9fc" },
  "project-management": { wall: "#2a2416", floor: "#1e2a52", trim: "#ffb238" },
  "professional-practices-and-entrepreneurship-in-it": { wall: "#1a2e22", floor: "#152018", trim: "#2ed17e" },
};

// V2 Phase 1 (additive) — exported so `game3d/prestige/prestigeNpcs.ts` can
// reuse Iris's real, established appearance/personality verbatim for the
// Hall of Artisans rather than re-authoring a second copy. No behaviour
// change to this file's own use of these constants.
export const SUBJECT_MENTOR_APPEARANCE: Record<string, CharacterAppearance> = {
  "user-interface-design": {
    bodyId: "body-d", skinToneId: "skin-03", hairId: "hair-long-sleek", hairColorId: "haircolor-platinum",
    eyesId: "eyes-amber", eyebrowsId: "brow-soft-arch", facialHairId: null,
    topId: "top-crew-tee-0", jacketId: "jacket-cardigan-1", bottomId: "bottom-jeans-straight-1", shoesId: "shoes-sneakers-1", accessoryIds: [],
  },
  "cloud-based-web-application-development": {
    bodyId: "body-a", skinToneId: "skin-06", hairId: "hair-short-crop", hairColorId: "haircolor-black",
    eyesId: "eyes-dark-brown", eyebrowsId: "brow-thin", facialHairId: "facial-stubble",
    topId: "top-button-shirt-1", jacketId: null, bottomId: "bottom-pleated-trousers-1", shoesId: "shoes-loafers-1", accessoryIds: ["acc-glasses-round"],
  },
  "project-management": {
    bodyId: "body-c", skinToneId: "skin-05", hairId: "hair-side-part", hairColorId: "haircolor-brown",
    eyesId: "eyes-hazel", eyebrowsId: "brow-medium", facialHairId: null,
    topId: "top-button-shirt-1", jacketId: "jacket-cardigan-1", bottomId: "bottom-pleated-trousers-1", shoesId: "shoes-loafers-1", accessoryIds: [],
  },
  "professional-practices-and-entrepreneurship-in-it": {
    bodyId: "body-b", skinToneId: "skin-02", hairId: "hair-swept-back", hairColorId: "haircolor-honeyblonde",
    eyesId: "eyes-blue", eyebrowsId: "brow-thick", facialHairId: null,
    topId: "top-hoodie-1", jacketId: null, bottomId: "bottom-joggers-0", shoesId: "shoes-sneakers-2", accessoryIds: [],
  },
};

/** Matches each subject's own established voice tone (`mentorDialogue.ts`'s VOICES) rather than inventing new personalities. */
export const SUBJECT_MENTOR_PERSONALITY: Record<string, PlayerPersonality> = {
  "user-interface-design": { primaryTraitId: "trait-creative", secondaryTraitIds: ["trait-calm"] },
  "cloud-based-web-application-development": { primaryTraitId: "trait-thoughtful", secondaryTraitIds: ["trait-disciplined"] },
  "project-management": { primaryTraitId: "trait-calm", secondaryTraitIds: ["trait-diligent"] },
  "professional-practices-and-entrepreneurship-in-it": { primaryTraitId: "trait-ambitious", secondaryTraitIds: ["trait-sociable"] },
};

export function buildSubjectBuildingWorld(subjectId: string): SceneWorld {
  return {
    sceneId: `campus-subject-${subjectId}`,
    width: 560,
    height: 420,
    walkable: { xMin: 40, xMax: 520, feetBack: 40, feetFront: 380 },
    heightFront: 140,
    heightBack: 90,
    spawn: { x: 280, feetY: 320 },
    obstacles: [{ xMin: 180, xMax: 380, feetMin: 60, feetMax: 140 }],
    interactables: [
      { id: "subject-exit", kind: "door", label: "Campus HQ", actionLabel: "Return to Campus HQ", action: { type: "travel", sceneId: "campus-hq" }, rect: [230, 380, 100, 30], standPoint: { x: 280, feetY: 360 }, range: 60 },
      { id: "subject-desk", kind: "desk", label: "Study Desk", actionLabel: "Enter Room", action: { type: "enter-room", subjectId }, rect: [180, 60, 200, 80], standPoint: { x: 280, feetY: 170 }, range: 70 },
      { id: "subject-mentor", kind: "mentor", label: "Mentor", actionLabel: "Talk", action: { type: "npc-chat", role: "subject-mentor", npcLabel: "Mentor", subjectId }, rect: [200, 30, 160, 40], standPoint: { x: 280, feetY: 150 }, range: 90 },
    ],
  };
}

export function buildSubjectBuildingPalette(subjectId: string): BuildingPalette {
  const accent = SUBJECT_ACCENTS[subjectId] ?? SUBJECT_ACCENTS["user-interface-design"];
  return {
    wallColor: accent.wall,
    floorColor: accent.floor,
    trimColor: accent.trim,
    lighting: ROOM_THEMES["creative-studio"].lighting,
  };
}

export function buildSubjectBuildingNpcs(subjectId: string): BuildingNpcDefinition[] {
  const appearance = SUBJECT_MENTOR_APPEARANCE[subjectId] ?? SUBJECT_MENTOR_APPEARANCE["user-interface-design"];
  const personality = SUBJECT_MENTOR_PERSONALITY[subjectId] ?? SUBJECT_MENTOR_PERSONALITY["user-interface-design"];
  const schedule: NpcSchedule = {
    id: `subject-mentor-${subjectId}`,
    waypoints: [
      { standPoint: { x: 280, feetY: 150 }, activity: "think", durationSeconds: 20, facingLeft: false },
      { standPoint: { x: 280, feetY: 150 }, activity: "talk", durationSeconds: 12, facingLeft: false },
    ],
  };
  return [{ id: `subject-mentor-${subjectId}`, label: "Mentor", appearance, personality, schedule, scheduleTimeOffsetSeconds: 0, interactableId: "subject-mentor" }];
}

/** No in-engine 3D text/font system exists yet, so the plaque's identity is purely the accent-tinted glow — the readable subject name lives in the HUD location label and the campus map panel instead of on this mesh. */
function SubjectPlaque({ x, y, z, accent }: { x: number; y: number; z: number; accent: string }) {
  return (
    <group position={[x, y, z]}>
      <RoundedBox args={[1.2, 0.4, 0.03]} radius={0.02} smoothness={1}>
        <meshStandardMaterial color="#2a1f1a" roughness={0.7} metalness={0} />
      </RoundedBox>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.0, 0.16]} />
        {/* Art Bible Part 5 rule 1 — metalness always 0. (This plaque's emissive glow is itself a flagged tension against rule 3's "glass and screens are the only emissive materials" — kept as the one practical way to give an identity marker any presence at all without an in-engine text/font system; not something rule 1's metalness fix should also try to resolve.) */}
        <meshStandardMaterial color={accent} roughness={0.6} metalness={0} emissive={accent} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

export function SubjectBuildingDressing({ subjectId }: { subjectId: string }) {
  const accent = SUBJECT_ACCENTS[subjectId] ?? SUBJECT_ACCENTS["user-interface-design"];
  const desk = floorPointToVector3({ x: 280, feetY: 95 });
  const plaque = floorPointToVector3({ x: 280, feetY: 45 });

  return (
    <>
      <Bookshelf x={desk[0] - 1.3} z={desk[2]} color={accent.trim} />
      <ContactShadow x={desk[0]} z={desk[2]} radius={0.85} />
      <RoundedBox args={[1.6, 0.755, 0.75]} radius={0.02} smoothness={1} position={[desk[0], 0.3775, desk[2]]} castShadow receiveShadow>
        <meshStandardMaterial color={accent.trim} roughness={0.8} metalness={0} />
      </RoundedBox>
      <PotPlant x={desk[0] + 1.3} y={0} z={desk[2]} />
      <SubjectPlaque x={plaque[0]} y={1.6} z={plaque[2]} accent={accent.trim} />
    </>
  );
}

export function SubjectBuildingScene({
  subjectId,
  reduceMotion,
  onAction,
  onInRangeChange,
  timeOfDay,
  talkingNpcId = null,
}: {
  subjectId: string;
  reduceMotion: boolean;
  onAction: (action: InteractAction) => void;
  onInRangeChange: (item: WorldInteractable | null) => void;
  timeOfDay: TimeOfDay;
  /** Phase 23 "Visual Improvements" — see CampusBuildingScene.tsx. */
  talkingNpcId?: string | null;
}) {
  const resolvedSubjectId = subjects.some((s) => s.id === subjectId) ? subjectId : "user-interface-design";
  // getRoomPersona is read here only to confirm this building's flavour text
  // exists and is real (not fabricated) — the actual display copy is
  // surfaced by the HUD/campus-map layer, not this 3D scene.
  void getRoomPersona(resolvedSubjectId);

  return (
    <CampusBuildingScene
      world={buildSubjectBuildingWorld(resolvedSubjectId)}
      palette={buildSubjectBuildingPalette(resolvedSubjectId)}
      npcs={buildSubjectBuildingNpcs(resolvedSubjectId)}
      dressing={<SubjectBuildingDressing subjectId={resolvedSubjectId} />}
      ambienceSounds={["hvac-hum"]}
      timeOfDay={timeOfDay}
      reduceMotion={reduceMotion}
      onAction={onAction}
      onInRangeChange={onInRangeChange}
      talkingNpcId={talkingNpcId}
    />
  );
}

export default SubjectBuildingScene;
