/**
 * V2 Phase 1 "Prestige Vertical Slice" — the Grand Courtyard: the hub every
 * other built district (and every locked one) opens off. A genuinely
 * spacious 50m×50m plaza (docs/UNIGAME_V2_MASTER_DESIGN.md §4.1) with a
 * working fountain, a colonnade walk, statues, and several "Coming Soon"
 * gates for districts this phase deliberately does not build (§3 map:
 * North Tower, East Wing, Student Village) — elegant locked gates rather
 * than placeholder areas, per the brief.
 */

import { useState } from "react";
import { PrestigeSceneShell } from "../PrestigeSceneShell";
import { StoneColumn, Fountain, StatueFigure, Banner, TorchSconce, ComingSoonGate, GrandDoor, STONE } from "../architecture/ArchitectureKit";
import { buildGrandCourtyardNpcs } from "../prestigeNpcs";
import { MentorCheckInPrompt } from "../../../components/mentor/MentorCheckInPrompt";
import type { InteractAction, SceneWorld, WorldInteractable } from "../../../world/worldTypes";

export function buildGrandCourtyardWorld(): SceneWorld {
  return {
    sceneId: "prestige-grand-courtyard",
    width: 5000,
    height: 5000,
    walkable: { xMin: 250, xMax: 4750, feetBack: 250, feetFront: 4750 },
    heightFront: 140,
    heightBack: 100,
    spawn: { x: 2500, feetY: 4400 },
    obstacles: [
      // The central fountain.
      { xMin: 2260, xMax: 2740, feetMin: 2260, feetMax: 2740 },
    ],
    interactables: [
      { id: "to-main-gate", kind: "door", label: "Main Gate", actionLabel: "Return to the Main Gate", action: { type: "travel", sceneId: "prestige-main-gate" }, rect: [2380, 4550, 240, 140], standPoint: { x: 2500, feetY: 4380 }, range: 110 },
      { id: "to-great-hall", kind: "door", label: "The Great Hall", actionLabel: "Enter the Great Hall", action: { type: "travel", sceneId: "prestige-great-hall" }, rect: [2380, 260, 240, 140], standPoint: { x: 2500, feetY: 480 }, range: 110 },
      { id: "to-hall-of-artisans", kind: "door", label: "Hall of Artisans", actionLabel: "Enter the Hall of Artisans", action: { type: "travel", sceneId: "prestige-hall-of-artisans" }, rect: [260, 2380, 140, 240], standPoint: { x: 480, feetY: 2500 }, range: 110 },
      { id: "gate-north-tower", kind: "door", label: "North Tower", actionLabel: "Approach the Gate", action: { type: "locked-notice", districtName: "North Tower" }, rect: [1450, 260, 220, 140], standPoint: { x: 1560, feetY: 480 }, range: 100 },
      { id: "gate-east-wing", kind: "door", label: "East Wing", actionLabel: "Approach the Gate", action: { type: "locked-notice", districtName: "East Wing — Arcane Archive" }, rect: [4600, 2380, 140, 220], standPoint: { x: 4520, feetY: 2500 }, range: 100 },
      { id: "gate-student-village", kind: "door", label: "Student Village", actionLabel: "Approach the Gate", action: { type: "locked-notice", districtName: "Student Village" }, rect: [3450, 4550, 220, 140], standPoint: { x: 3560, feetY: 4380 }, range: 100 },
      // A single real, small preview room — distinct from the locked
      // "Student Village" gate above (which represents the FULL future
      // district this phase doesn't build). §12 of the Master Design asks
      // for exactly one reachable preview room, not the whole dormitory.
      { id: "to-dorm-preview", kind: "door", label: "A Glimpse of the Dormitories", actionLabel: "Peer Inside", action: { type: "travel", sceneId: "prestige-dorm-preview" }, rect: [3950, 620, 200, 140], standPoint: { x: 4050, feetY: 830 }, range: 100 },
    ],
  };
}

function CourtyardDressing({ onLocked }: { onLocked: (districtName: string) => void }) {
  const world = buildGrandCourtyardWorld();
  const lockedGates = world.interactables.filter((i): i is WorldInteractable & { action: { type: "locked-notice"; districtName: string } } => i.action.type === "locked-notice");

  return (
    <>
      <Fountain x={25} z={25} radius={2.6} />

      {/* A colonnade walk framing the path toward the Great Hall. */}
      {[-4, -2.4, 2.4, 4].map((ox) => (
        <StoneColumn key={ox} x={25 + ox} z={12} heightM={5.6} radius={0.36} />
      ))}

      <StatueFigure x={8} z={8} heightM={3} />
      <StatueFigure x={42} z={8} heightM={3} />
      <StatueFigure x={8} z={42} heightM={3} />
      <StatueFigure x={42} z={42} heightM={3} />

      <Banner x={25} y={5.2} z={4.4} color="#7a1f2b" />
      <Banner x={20} y={5.2} z={4.4} color="#3d5a73" />
      <Banner x={30} y={5.2} z={4.4} color="#3a6b4a" />

      <TorchSconce x={12} y={2.6} z={40} />
      <TorchSconce x={38} y={2.6} z={40} />
      <TorchSconce x={12} y={2.6} z={10} />
      <TorchSconce x={38} y={2.6} z={10} />

      {/* The real, walkable doors to Great Hall / Hall of Artisans / Main Gate
          — purely decorative meshes (no onClick, see GrandDoor's own header
          comment); the actual, correctly range-gated interaction comes from
          the matching WorldInteractable the shell renders on top. Drawn as
          grand doors so these 3 real destinations read as obviously more
          significant than the locked gates below. */}
      <GrandDoor x={25} z={4.6} widthM={3.2} heightM={4.2} rotationY={Math.PI} />
      <GrandDoor x={25} z={45.4} widthM={3.2} heightM={4.2} rotationY={0} />
      <GrandDoor x={4.6} z={25} widthM={3.2} heightM={4.2} rotationY={Math.PI / 2} />

      {/* A single, smaller real door to the Dormitory PREVIEW room — modest on purpose (a "glimpse," not a grand entrance), distinct from the locked Student Village gate nearby which represents the full future district. */}
      <GrandDoor x={40.5} z={6.9} widthM={2} heightM={2.8} rotationY={Math.PI} />
      <TorchSconce x={39.4} y={2.4} z={6.6} rotationY={0.6} />
      <TorchSconce x={41.6} y={2.4} z={6.6} rotationY={-0.6} />

      {/* Every locked district gets the SAME elegant "Coming Soon" gate — never a placeholder area, per the brief. */}
      {lockedGates.map((gate) => {
        const [rx, ry, rw, rh] = gate.rect;
        const x = (rx + rw / 2) / 100;
        const z = (ry + rh / 2) / 100;
        const facingCentre = Math.atan2(25 - x, 25 - z);
        return <ComingSoonGate key={gate.id} x={x} z={z} rotationY={facingCentre} onClick={() => onLocked(gate.action.type === "locked-notice" ? gate.action.districtName : "")} />;
      })}
    </>
  );
}

const LIGHTING = {
  ambientColor: "#c9b98a",
  ambientIntensity: 0.62,
  hemisphereSky: "#cfe0f0",
  hemisphereGround: "#8d8060",
  hemisphereIntensity: 0.55,
  sunColor: "#fff0cf",
  sunIntensity: 1.5,
  sunPosition: [18, 26, 12] as [number, number, number],
};

export function GrandCourtyardScene({
  reduceMotion,
  onAction,
  onInRangeChange,
}: {
  reduceMotion: boolean;
  onAction: (action: InteractAction) => void;
  onInRangeChange: (item: WorldInteractable | null) => void;
}) {
  const [lockedDistrict, setLockedDistrict] = useState<string | null>(null);

  const handleAction = (action: InteractAction) => {
    if (action.type === "locked-notice") {
      setLockedDistrict(action.districtName);
      return;
    }
    onAction(action);
  };

  return (
    <>
      <PrestigeSceneShell
        world={buildGrandCourtyardWorld()}
        lighting={LIGHTING}
        floorColor={STONE}
        npcs={buildGrandCourtyardNpcs()}
        dressing={<CourtyardDressing onLocked={setLockedDistrict} />}
        ambienceSounds={["courtyard-fountain", "birds-outside", "wind-outside"]}
        reduceMotion={reduceMotion}
        onAction={handleAction}
        onInRangeChange={onInRangeChange}
      />
      {lockedDistrict ? (
        <MentorCheckInPrompt
          npcLabel="Notice Board"
          question={`${lockedDistrict} — Coming Soon. This district hasn't been built yet; check back in a future update.`}
          options={[{ id: "ok", label: "Understood" }]}
          onSelect={() => setLockedDistrict(null)}
          onDismiss={() => setLockedDistrict(null)}
        />
      ) : null}
    </>
  );
}

export default GrandCourtyardScene;
