/**
 * The 3D island. Click the ground to walk, click a person or place to
 * interact, right-click for every option, drag / arrow keys / Q-E to turn
 * the camera, scroll to zoom.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, PerformanceMonitor, Sky } from "@react-three/drei";
import { Bloom, BrightnessContrast, EffectComposer, GodRays, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Character } from "./Character";
import { BuildingModel, ModelCharacter, PropModel, THEME_BUILDING, THEME_FLAG, WithFallback, type AvatarId, type HatId, type OneShot } from "./models";
import { onGameEvent } from "../state/events";
import { Scenery, Terrain } from "./Terrain";
import { Campus, CampusBuilding, LandmarkSign } from "./Campus";
import { LifeNodeVisual } from "./LifeNodes";
import { CombatDriver, CryptGate, Enemies } from "./Enemies";
import { castSpell, combat, playerAttack, playerEat } from "../combat/combat";
import { weapon as weaponInfo } from "../life/catalog";
import {
  BossLair,
  DuelArena,
  Landmark,
  MeditationShrine,
  QuestBoard,
  RuneAltar,
  ScrollTable,
  Signpost,
  Waystone,
} from "./Structures";
import { runtime, setHover, setNearby, WALK_SPEED, type ContextMenuRequest, type MenuOption } from "./runtime";
import { RaceDriver, RaceGates } from "./RaceGates";
import { HumanCharacter } from "./HumanCharacter";
import { usePlayerAppearance } from "../customise/usePlayerAppearance";
import { professorLook } from "../customise/npcs";
import { EMOTES } from "../customise/emotes";
import { Effects } from "./Effects";
import { FloatingCandles, NightGlow, OwlCourier, Owls, SecretDoorVisual } from "./Academy";
import { spawnBolt } from "./vfx";
import { cinematicProgress } from "./cinematic";
import { WeatherFx } from "./WeatherFx";
import { useWeather } from "./useWeather";
import { weatherGloom } from "./weather";
import { SPELL_KINDS, spellBar } from "../life/spells";
import { buffActive, SWIFTNESS_BONUS } from "../life/potions";
import { familiarLevel } from "../customise/familiar";
import { BROOM_SPEED, broomUnlocked, FLY_HEIGHT, weeksToBroom } from "../life/broom";
import { DoorVisual, FurnitureVisual, NoticeboardVisual, RoomShell, WardrobeVisual } from "./DormInterior";
import { LecternStand, TheatreShell } from "./TheatreInterior";
import { WalkInRooms } from "./WalkInRooms";
import { race, RACE_SPRINT } from "../arcade/race";
import { findPath, interactionTiles, nearestWalkable, type TilePoint } from "../world/pathfinding";
import { TILE, groundHeight, isWalkable, objectCenter, type ActionId, type World, type WorldObject } from "../world/worldGen";
import { THEME_STYLES } from "../world/themes";
import { chat, emit } from "../state/events";
import { realmStore, useRealm } from "../state/store";
import { weekKey } from "../state/actions";
import { activeBoss, bossModel } from "../state/bosses";
import { isWeakWeek } from "../state/stats";
import { DAY_SKY, SUN_OFFSET, skyAt, type SkyState } from "./sky";
import { findShopItem } from "../state/shop";
import { playFootstep, type StepSurface } from "../audio";
import type { PlayerLook, RegionTheme } from "../types";

export interface SceneHandlers {
  onInteract: (object: WorldObject, action: ActionId) => void;
  onContextMenu: (request: ContextMenuRequest) => void;
}

interface RealmSceneProps {
  world: World;
  look: PlayerLook;
  avatar: AvatarId;
  handlers: SceneHandlers;
  quality: "ultra" | "high" | "low";
  /** Stop drawing (a full-screen play-world game is open on top). */
  paused?: boolean;
}

const HubContext = createContext<World["hub"] | null>(null);
/** Late-afternoon sun: low enough for long, soft shadows and warm light. */

function useSky(realTime: boolean): SkyState {
  const [hours, setHours] = useState(() => new Date().getHours() + new Date().getMinutes() / 60);
  useEffect(() => {
    if (!realTime) return;
    const id = window.setInterval(() => setHours(new Date().getHours() + new Date().getMinutes() / 60), 60_000);
    return () => window.clearInterval(id);
  }, [realTime]);
  return useMemo(() => (realTime ? skyAt(hours) : DAY_SKY), [realTime, hours]);
}

/** A bright disc far off in the sun's direction, for the god-rays effect to shine through the trees. */
function SunDisc({ onReady }: { onReady: (mesh: THREE.Mesh | null) => void }) {
  const realTimeSky = useRealm((s) => s.settings.realTimeSky);
  const sky = useSky(realTimeSky);
  const mesh = useRef<THREE.Mesh>(null);
  useEffect(() => {
    onReady(mesh.current);
    return () => onReady(null);
  }, [onReady]);
  useFrame(() => {
    if (!mesh.current) return;
    const dir = sky.sun.clone().normalize();
    mesh.current.position.set(runtime.player.x + dir.x * 140, Math.max(10, dir.y * 140), runtime.player.z + dir.z * 140);
    mesh.current.visible = !sky.night && runtime.room === null;
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[7, 16, 12]} />
      <meshBasicMaterial color="#fff2c8" transparent opacity={0.9} toneMapped={false} fog={false} />
    </mesh>
  );
}

export function RealmScene({ world, look, avatar, handlers, quality, paused = false }: RealmSceneProps) {
  const high = quality !== "low";
  const ultra = quality === "ultra";
  const [sun, setSun] = useState<THREE.Mesh | null>(null);
  const sunReady = useCallback((m: THREE.Mesh | null) => setSun(m), []);
  const rays = world.mode === "island" && sun;
  // Render at the screen's real pixel density (sharp on a 1.5x laptop display), up to 2x. If the frame
  // rate drops it steps down, but never below 1x (below that everything turns soft and blurry).
  const full = typeof window === "undefined" ? 1.5 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const [dpr, setDpr] = useState(full);
  return (
    <Canvas
      shadows
      dpr={dpr}
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: !high, powerPreference: "high-performance" }}
      camera={{ fov: 42, near: 0.1, far: 1500 }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMissed={() => setHover(null)}
      style={{ position: "absolute", inset: 0 }}
    >
      <PerformanceMonitor
        bounds={() => [45, 58]}
        flipflops={4}
        onDecline={() => setDpr((d) => Math.max(1, d > 1.25 ? 1.25 : 1))}
        onIncline={() => setDpr((d) => Math.min(full, d < 1.25 ? 1.25 : full))}
        onFallback={() => setDpr(1)}
      />
      <SceneContents world={world} look={look} avatar={avatar} handlers={handlers} quality={quality} />
      {high && world.mode === "island" ? <SunDisc onReady={sunReady} /> : null}
      {ultra ? (
        <EffectComposer multisampling={0}>
          <N8AO aoRadius={1.1} distanceFalloff={0.8} intensity={2.4} quality="performance" halfRes depthAwareUpsampling={false} />
          {rays ? <GodRays sun={sun} samples={50} density={0.94} decay={0.92} weight={0.35} exposure={0.45} clampMax={1} blur /> : <></>}
          <Bloom intensity={0.55} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur levels={5} />
          <Vignette offset={0.28} darkness={0.5} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          {/* A gentle grade: a touch more contrast and colour than raw tone mapping gives. */}
          <BrightnessContrast brightness={0.01} contrast={0.07} />
          <HueSaturation saturation={0.1} />
          <SMAA />
        </EffectComposer>
      ) : high ? (
        <EffectComposer multisampling={0}>
          {rays ? <GodRays sun={sun} samples={36} density={0.94} decay={0.92} weight={0.3} exposure={0.4} clampMax={1} blur /> : <></>}
          <Bloom intensity={0.55} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur levels={5} />
          <Vignette offset={0.28} darkness={0.5} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          {/* A gentle grade: a touch more contrast and colour than raw tone mapping gives. */}
          <BrightnessContrast brightness={0.01} contrast={0.07} />
          <HueSaturation saturation={0.1} />
          <SMAA />
        </EffectComposer>
      ) : null}
    </Canvas>
  );
}

function SceneContents({ world, look, avatar, handlers }: RealmSceneProps) {
  const realTimeSky = useRealm((s) => s.settings.realTimeSky);
  const sky = useSky(realTimeSky);
  const weather = useWeather();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const openMenu = (event: ThreeEvent<MouseEvent>, options: MenuOption[]) => {
    event.nativeEvent.preventDefault();
    handlersRef.current.onContextMenu({ x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, options });
  };

  if (world.mode === "interior") {
    return (
      <HubContext.Provider value={world.hub}>
        {world.interior === "theatre" ? (
          <TheatreShell onFloorClick={(x, z) => runtime.walkTo?.(x, z)} onFloorHover={() => setHover({ verb: "Walk here", target: "", extra: 0 })} />
        ) : (
          <RoomShell onFloorClick={(x, z) => runtime.walkTo?.(x, z)} onFloorHover={() => setHover({ verb: "Walk here", target: "", extra: 0 })} />
        )}
        {world.objects.map((object) => (
          <ObjectNode key={object.id} world={world} object={object} openMenu={openMenu} />
        ))}
        <Player world={world} look={look} avatar={avatar} handlersRef={handlersRef} night={false} />
        <Effects world={world} night={false} ambient={false} />
        <ClickMarker world={world} />
        <CameraRig world={world} />
      </HubContext.Provider>
    );
  }

  const gloom = weatherGloom(weather);
  const fogColor = gloom.fog > 0 ? `#${new THREE.Color(sky.fog).lerp(new THREE.Color(sky.night ? "#1a1e28" : "#9aa3ad"), gloom.fog * 0.7).getHexString()}` : sky.fog;
  const fogNear = (sky.night ? 26 : 38) * (1 - gloom.fog * 0.75);
  const fogFar = (sky.night ? 90 : 120) * (1 - gloom.fog * 0.6);

  return (
    <HubContext.Provider value={world.hub}>
      <color attach="background" args={[fogColor]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
      <FogReach near={fogNear} far={fogFar} />
      <IndoorBackdrop />
      <Outdoors>
        <WeatherFx weather={weather} />
        <Sky distance={900} sunPosition={sky.sun.toArray()} turbidity={5} rayleigh={sky.night ? 0.3 : 1.4} mieCoefficient={0.004} mieDirectionalG={0.85} />
      </Outdoors>
      <Environment resolution={128} frames={1} environmentIntensity={sky.env} far={2000}>
        <Sky distance={900} sunPosition={SUN_OFFSET.toArray()} turbidity={5} rayleigh={1.4} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial color="#4a6a3a" />
        </mesh>
      </Environment>
      <hemisphereLight args={[sky.hemiSky, "#5a6b3a", sky.hemiIntensity * (0.6 + gloom.light * 0.4)]} />
      <Sun sky={gloom.light < 1 ? { ...sky, lightIntensity: sky.lightIntensity * gloom.light } : sky} />
      <Outdoors>
        <Terrain
          world={world}
          onGroundHover={() => setHover({ verb: "Walk here", target: "", extra: 0 })}
          onGroundClick={(x, z) => runtime.walkTo?.(x, z)}
          onGroundContext={(x, z, event) =>
            openMenu(event, [
              { label: "Walk here", run: () => runtime.walkTo?.(x, z) },
            ])
          }
        />
        <Scenery world={world} />
        <Campus world={world} night={sky.night} />
      </Outdoors>
      {world.rooms?.length ? <WalkInRooms rooms={world.rooms} onFloorClick={(x, z) => runtime.walkTo?.(x, z)} onFloorHover={() => setHover({ verb: "Walk here", target: "", extra: 0 })} /> : null}
      {world.objects.map((object) => (
        <ObjectNode key={object.id} world={world} object={object} openMenu={openMenu} />
      ))}
      <Player world={world} look={look} avatar={avatar} handlersRef={handlersRef} night={sky.night} />
      <CombatDriver world={world} />
      <RaceDriver />
      <Effects world={world} night={sky.night} />
      <Outdoors>
        <Enemies world={world} />
        <RaceGates world={world} />
        <FloatingCandles world={world} night={sky.night} />
        {sky.night ? <NightGlow world={world} /> : null}
        <Owls world={world} />
        <OwlCourier />
      </Outdoors>
      <ClickMarker world={world} />
      <CameraRig world={world} />
    </HubContext.Provider>
  );
}

function Sun({ sky }: { sky: SkyState }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  useEffect(() => {
    if (light.current) scene.add(light.current.target);
  }, [scene]);
  useFrame((_, delta) => {
    if (!light.current) return;
    const { x, z } = runtime.player;
    light.current.position.set(x + sky.light.x, sky.light.y, z + sky.light.z);
    light.current.target.position.set(x, 0, z);
    // Indoors the room's own light takes over; the sun only spills in softly.
    const target = sky.lightIntensity * (runtime.room ? 0.3 : 1);
    light.current.intensity += (target - light.current.intensity) * Math.min(1, delta * 6);
  });
  return (
    <directionalLight
      ref={light}
      color={sky.lightColor}
      intensity={sky.lightIntensity}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-24}
      shadow-camera-right={24}
      shadow-camera-top={24}
      shadow-camera-bottom={-24}
      shadow-camera-near={1}
      shadow-camera-far={80}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-radius={4}
    />
  );
}

/** Everything that belongs to the outside world: hidden while you're inside a walk-in room. */
function Outdoors({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = runtime.room === null;
  });
  return <group ref={group}>{children}</group>;
}

/** Indoors, the world outside the room is darkness: a dark backdrop and no fog. */
function IndoorBackdrop() {
  const { scene } = useThree();
  const outdoor = useMemo(() => new THREE.Color(), []);
  const dark = useMemo(() => new THREE.Color("#07080f"), []);
  const wasInside = useRef(false);
  useFrame(() => {
    const bg = scene.background as THREE.Color | null;
    if (!bg || !(bg as THREE.Color).isColor) return;
    const inside = runtime.room !== null;
    if (inside && !wasInside.current) outdoor.copy(bg);
    if (inside) bg.copy(dark);
    else if (wasInside.current) bg.copy(outdoor);
    wasInside.current = inside;
  });
  return null;
}

/**
 * Fog is measured from the camera, so when the camera pulls far back (the fly-over,
 * a long zoom) the same fog would white out the whole island. The fog's reach grows
 * with the camera's distance from the player, keeping the haze about the same.
 */
function FogReach({ near, far }: { near: number; far: number }) {
  const { scene, camera } = useThree();
  useFrame(() => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog || !(fog as THREE.Fog).isFog) return;
    const away = Math.hypot(camera.position.x - runtime.player.x, camera.position.y, camera.position.z - runtime.player.z);
    if (runtime.room) {
      fog.near = 1000;
      fog.far = 2000;
      return;
    }
    const extra = Math.max(0, away - 18);
    fog.near = near + extra;
    fog.far = far + extra * 1.4;
  });
  return null;
}

function verbFor(object: WorldObject): string {
  return object.actions[0]?.label ?? "Examine";
}

function ObjectNode({ world, object, openMenu }: { world: World; object: WorldObject; openMenu: (e: ThreeEvent<MouseEvent>, options: MenuOption[]) => void }) {
  const center = objectCenter(object);
  // Inside a walk-in room only that room's things show (their ids start with the room's name).
  const node = useRef<THREE.Group>(null);
  useFrame(() => {
    if (node.current) node.current.visible = runtime.room === null || object.id.startsWith(`${runtime.room}-`);
  });
  const y = groundHeight(world, center.x, center.z);

  const run = (actionId: string) => runtime.interact?.(object, actionId);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    if (object.actions.length > 0) run(object.actions[0].id);
    else chat(object.examine);
  };

  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const options: MenuOption[] = [
      ...object.actions.map((action) => ({ label: action.label, target: object.name, run: () => run(action.id) })),
      { label: "Walk here", run: () => runtime.walkTo?.(Math.floor(e.point.x), Math.floor(e.point.z)) },
      { label: "Examine", target: object.name, run: () => chat(object.examine) },
    ];
    openMenu(e, options);
  };

  return (
    <group
      ref={node}
      position={[center.x, y, center.z]}
      rotation={[0, object.rot, 0]}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover({ verb: verbFor(object), target: object.name, extra: object.actions.length + 1 });
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(null);
        document.body.style.cursor = "";
      }}
    >
      <ObjectVisual object={object} />
    </group>
  );
}

function ObjectVisual({ object }: { object: WorldObject }) {
  switch (object.kind) {
    case "citadel":
    case "fountain":
      return <PurposeNode object={object} />;
    case "landmark":
      return <LandmarkNode object={object} />;
    case "waystone":
      return <WaystoneNode object={object} />;
    case "quest-board":
      return <QuestBoardNode object={object} />;
    case "duel-arena":
      return (
        <>
          <DuelArena theme={object.theme ?? "arcane"} />
          <WithFallback fallback={null}>
            <PropModel id="target" height={1.1} position={[1.0, 0, 0.9]} rotation={-0.7} />
            <PropModel id="weaponrack" height={0.9} position={[-1.05, 0, -0.85]} rotation={0.8} />
          </WithFallback>
        </>
      );
    case "scroll-table":
      return <ScrollTable />;
    case "rune-altar":
      return <RuneAltar theme={object.theme ?? "arcane"} />;
    case "meditation-shrine":
      return <ShrineNode object={object} />;
    case "signpost":
      return <Signpost />;
    case "tutor":
      return <TutorNode object={object} />;
    case "boss-lair":
      return <BossLairNode object={object} />;
    case "bazaar":
    case "group-board":
      return <PurposeNode object={object} />;
    case "workshop":
      return (
        <>
          <ScrollTable />
          <WithFallback fallback={null}>
            <PropModel id="crate" height={0.4} position={[0.65, 0, 0.1]} rotation={0.4} />
            <PropModel id="barrel" height={0.55} position={[-0.7, 0, -0.1]} />
          </WithFallback>
        </>
      );
    case "trophy-hall":
      return <PurposeNode object={object} />;
    case "crypt-gate":
      return <CryptGate />;
    case "fishing-spot":
    case "ore-rock":
    case "tree-node":
      return <LifeNodeVisual object={object} />;
    case "cooking-fire":
    case "anvil":
    case "games-hall":
      return <PurposeNode object={object} />;
    case "furniture":
      return <FurnitureVisual object={object} />;
    case "cauldron":
      return <PurposeNode object={object} />;
    case "secret-door":
      return <SecretDoorVisual id={object.id} />;
    case "duel-club":
      return <PurposeNode object={object} />;
    case "wardrobe":
      return <WardrobeVisual />;
    case "noticeboard":
      return <NoticeboardVisual />;
    case "door":
      return <DoorVisual />;
    case "harbour":
    case "exchange-hall":
    case "dorm":
    case "library":
    case "lecture-hall":
    case "parkour-tower":
    case "archery-range":
    case "pingpong-hall":
    case "scenery":
      return <PurposeNode object={object} />;
    case "lectern":
      return (
        <>
          <LecternStand />
          <group position={[0, 0, -0.75]}>
            <WithFallback fallback={null}>
              <TutorBody theme="arcane" id={object.id} rot={object.rot} />
            </WithFallback>
          </group>
        </>
      );
  }
}

/** Purpose buildings (library, lecture theatre, bazaar, dorm, ...): architecture, sign and beacon live in Campus.tsx. */
function PurposeNode({ object }: { object: WorldObject }) {
  const hub = useContext(HubContext);
  return <CampusBuilding object={object} hub={hub} />;
}

function BossLairNode({ object }: { object: WorldObject }) {
  // A primitive selector result keeps useSyncExternalStore stable.
  const awake = useRealm((s) => {
    const subject = s.curriculum?.subjects.find((sub) => sub.id === object.subjectId);
    const boss = subject ? activeBoss(s, subject) : null;
    return boss ? `${boss.assessment.id}|${bossModel(boss.assessment)}` : "";
  });
  const model = awake ? (awake.split("|")[1] as "skeleton_warrior" | "skeleton_mage") : null;
  return (
    <>
      <BossLair awake={Boolean(awake)} />
      {model ? (
        <WithFallback key={awake} fallback={null}>
          <ModelCharacter avatar={model} height={2.1} idleClip="Idle_Combat" />
        </WithFallback>
      ) : null}
    </>
  );
}

function LandmarkNode({ object }: { object: WorldObject }) {
  const theme = object.theme ?? "arcane";
  return (
    <WithFallback fallback={<Landmark theme={theme} />}>
      <BuildingModel id={THEME_BUILDING[theme]} span={7.4} />
      <PropModel id={THEME_FLAG[theme]} height={2.4} position={[3.3, 0, 3.3]} rotation={0.4} />
      <LandmarkSign object={object} />
    </WithFallback>
  );
}

function WaystoneNode({ object }: { object: WorldObject }) {
  const key = weekKey(object.subjectId ?? "", object.week ?? 0);
  const studied = useRealm((s) => Boolean(s.progress.weeks[key]?.studiedAt));
  const mastered = useRealm((s) => (s.progress.weeks[key]?.minigamesWon ?? 0) >= 3);
  const weak = useRealm((s) => isWeakWeek(s, object.subjectId ?? "", object.week ?? 0));
  return <Waystone theme={object.theme ?? "arcane"} studied={studied} mastered={mastered} weak={weak} />;
}

function QuestBoardNode({ object }: { object: WorldObject }) {
  const open = useRealm((s) => {
    const subject = s.curriculum?.subjects.find((sub) => sub.id === object.subjectId);
    return Boolean(subject?.assessments.some((a) => s.progress.quests[a.id]?.status !== "complete"));
  });
  return <QuestBoard hasActive={open} />;
}

function ShrineNode({ object }: { object: WorldObject }) {
  const active = useRealm((s) => s.progress.activeFocus?.subjectId === object.subjectId);
  return <MeditationShrine active={active} />;
}

function TutorNode({ object }: { object: WorldObject }) {
  const theme = object.theme ?? "arcane";
  const style = THEME_STYLES[theme];
  const hat = theme === "arcane" || theme === "alchemy" ? "wizard" : theme === "grove" ? "hood" : "none";
  return (
    <WithFallback fallback={<IdleNpc look={{ skin: "#d8a47a", hair: "#4a3020", tunic: style.robe, legs: style.robe, cape: style.accent }} robe hat={hat} staff={theme === "arcane"} />}>
      <TutorBody theme={theme} id={object.id} rot={object.rot} />
    </WithFallback>
  );
}

/** A professor: faces you and gestures while you talk, then settles back. */
function TutorBody({ theme, id, rot }: { theme: RegionTheme; id: string; rot: number }) {
  const look = useMemo(() => professorLook(theme), [theme]);
  const group = useRef<THREE.Group>(null);
  const gesture = useRef<OneShot | null>(null);
  const nextGesture = useRef(0);
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const talking = runtime.talkingTo === id;
    let target = 0;
    if (talking) {
      const world = new THREE.Vector3();
      g.getWorldPosition(world);
      // Face the player, relative to the node's own rotation.
      target = Math.atan2(runtime.player.x - world.x, runtime.player.z - world.z) - rot;
      const t = state.clock.elapsedTime;
      if (t > nextGesture.current) {
        nextGesture.current = t + 2 + Math.random() * 1.5;
        gesture.current = ["Interact", "Point", "Wave", "Interact"][Math.floor(Math.random() * 4)];
      }
    }
    g.rotation.y = angleLerp(g.rotation.y, target, Math.min(1, delta * 5));
  });
  return (
    <group ref={group}>
      <HumanCharacter appearance={look.appearance} hat={look.hat} height={1.75} idleClip="Idle" oneShotRef={gesture} />
    </group>
  );
}

function IdleNpc(props: { look: PlayerLook; robe?: boolean; hat?: "wizard" | "hood" | "none"; staff?: boolean }) {
  const phase = useMemo(() => Math.random() * 10, []);
  return <Character {...props} phase={phase} />;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

interface PlayerState {
  x: number;
  z: number;
  facing: number;
  path: TilePoint[];
  pending: { object: WorldObject; action: string } | null;
}

const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
const BODY_RADIUS = 0.22;

/** The player's body (a small circle) must fit on walkable tiles. */
function canStand(world: World, x: number, z: number): boolean {
  for (const [ox, oz] of [
    [-BODY_RADIUS, -BODY_RADIUS],
    [BODY_RADIUS, -BODY_RADIUS],
    [-BODY_RADIUS, BODY_RADIUS],
    [BODY_RADIUS, BODY_RADIUS],
  ]) {
    if (!isWalkable(world, Math.floor(x + ox), Math.floor(z + oz))) return false;
  }
  return true;
}

/** Finds the closest usable object within reach and publishes it for the Space prompt. */
function updateNearby(world: World, x: number, z: number): void {
  let best: WorldObject | null = null;
  let bestDist = 1.35;
  for (const object of world.objects) {
    if (object.actions.length === 0) continue;
    // A walk-in building is "in reach" only at its door, and never while you're inside it.
    const room = world.rooms?.find((r) => r.buildingId === object.id);
    if (room && runtime.room === room.kind) continue;
    const dx = room ? Math.abs(room.outside.x + 0.5 - x) : Math.max(object.x - x, 0, x - (object.x + object.w));
    const dz = room ? Math.abs(room.outside.z + 0.5 - z) : Math.max(object.z - z, 0, z - (object.z + object.d));
    const d = Math.hypot(dx, dz);
    if (d < bestDist) {
      bestDist = d;
      best = object;
    }
  }
  setNearby(best);
}

/** Shift running boost: how much faster than walking. */
const SPRINT_BOOST = 1.7;

/** How long a jump lasts (seconds) and how high it goes (world units). */
const JUMP_SECONDS = 0.62;
const JUMP_HEIGHT = 0.85;

function angleLerp(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function Player({ world, look, avatar, handlersRef, night }: { world: World; look: PlayerLook; avatar: AvatarId; handlersRef: React.MutableRefObject<SceneHandlers>; night: boolean }) {
  const group = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const sitting = useRef(false);
  /** 0..1 ease into and out of walking speed; and the speed relative to a normal walk (for the animation). */
  const pace = useRef(0);
  const gait = useRef(1);
  /** Jumping: seconds into the current jump (-1 = on the ground), and the leg tuck (0..1) for the pose. */
  const jumpT = useRef(-1);
  const air = useRef(0);
  /** Shift held: the running boost (limited by stamina). */
  const shift = useRef(false);
  const oneShot = useRef<OneShot | null>(null);
  const stride = useRef(0);
  const capeColor = useRealm((st) => findShopItem(st, st.progress.wardrobe.cape)?.look ?? null);
  const hat = useRealm((st) => (findShopItem(st, st.progress.wardrobe.hat)?.look as HatId | undefined) ?? null);
  const pet = useRealm((st) => findShopItem(st, st.progress.wardrobe.pet)?.look ?? null);
  const playerName = useRealm((st) => st.player?.name ?? "");
  const weaponTint = useRealm((st) => weaponInfo(st.progress.weapon)?.tint ?? null);
  const title = useRealm((st) => st.progress.title);
  const appearance = usePlayerAppearance();
  const [broomOn, setBroomOn] = useState(false);
  const familiar = useRealm((st) => familiarLevel(st));
  /** Swiftness Tonic active (checked every few seconds). */
  const swift = useRef(false);
  useEffect(() => {
    const check = () => (swift.current = buffActive(realmStore.get(), "swiftness"));
    check();
    const id = window.setInterval(check, 3000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(
    () =>
      onGameEvent((event) => {
        if (event.type === "level-up" || event.type === "quest-complete" || event.type === "graduated") oneShot.current = "Cheer";
      }),
    [],
  );
  const state = useRef<PlayerState>({ x: world.spawn.x, z: world.spawn.z, facing: Math.PI, path: [], pending: null });
  const lastPlace = useRef("");

  const keys = useRef(new Set<string>());

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      return !!node && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT" || node.isContentEditable);
    };
    const blockedByUi = () => document.querySelector(".rs-window-backdrop, .rs-dialogue") !== null;
    /** Uses whatever is in reach. Returns false when nothing is. */
    const activateNearby = (): boolean => {
      const near = runtime.nearby;
      if (!near || near.actions.length === 0 || blockedByUi()) return false;
      const c = objectCenter(near);
      state.current.facing = Math.atan2(c.x - state.current.x, c.z - state.current.z);
      oneShot.current = "Interact";
      handlersRef.current.onInteract(near, near.actions[0].id);
      return true;
    };
    /** Hop. Not while flying, sitting or in the middle of a jump already. */
    const jump = () => {
      if (runtime.player.flying || runtime.seat || jumpT.current >= 0 || blockedByUi()) return;
      jumpT.current = 0;
    };
    // E (or the touch "Use" button, or a click in mouse-look) uses what's in reach. Space only ever
    // jumps, so jumping about never walks you into a building or onto a signpost's fast travel.
    runtime.useNearby = () => void activateNearby();
    runtime.useInFront = () => void activateNearby();
    runtime.jump = jump;
    runtime.actNow = (object, actionId) => handlersRef.current.onInteract(object, actionId as ActionId);
    /** Swing at the nearest enemy in reach, facing it, with the class's attack animation. */
    const attack = () => {
      if (blockedByUi() || runtime.player.flying) return;
      const target = playerAttack(state.current.x, state.current.z);
      if (!target) return;
      state.current.facing = Math.atan2(target.x - state.current.x, target.z - state.current.z);
      state.current.path = [];
      // A wand casts a bolt; bare hands throw a punch.
      const wand = weaponInfo(realmStore.get().progress.weapon);
      oneShot.current = wand ? "Spellcast_Shoot" : "Punch";
      if (wand) {
        const f = state.current.facing;
        spawnBolt({ x: state.current.x + Math.sin(f) * 0.4, y: 1.35, z: state.current.z + Math.cos(f) * 0.4 }, { x: target.x, y: 1, z: target.z }, wand.tint);
      }
    };
    runtime.attackNow = attack;
    /** B: take off or land (outdoors, once a subject is mastered). */
    const toggleBroom = () => {
      if (world.mode !== "island") return;
      if (!runtime.player.flying && runtime.room) {
        chat("Not indoors! Step outside to take off.");
        return;
      }
      if (!runtime.player.flying) {
        if (!broomUnlocked(realmStore.get())) {
          const near = weeksToBroom(realmStore.get());
          chat(near ? `Master a subject to earn a broom: study every week of ${near.subject} (${near.left} to go).` : "Master a subject to earn a broom.");
          return;
        }
        runtime.player.flying = true;
        setBroomOn(true);
        state.current.path = [];
        emit({ type: "sound", name: "spell" });
        chat("You kick off on your broom. B to land.");
      } else {
        if (!canStand(world, state.current.x, state.current.z)) {
          chat("You can't land here. Find solid ground below.");
          return;
        }
        runtime.player.flying = false;
        setBroomOn(false);
        state.current.path = [];
      }
    };
    runtime.toggleBroom = toggleBroom;
    /** Cast the spell in a spell-bar slot (keys 1-4). */
    const castFromBar = (slot: number) => {
      const spell = spellBar(realmStore.get())[slot];
      if (!spell) return;
      const result = castSpell(spell, state.current.x, state.current.z);
      if (!result) return;
      state.current.path = [];
      oneShot.current = "Spellcast_Shoot";
      if (result !== "self") {
        state.current.facing = Math.atan2(result.x - state.current.x, result.z - state.current.z);
        spawnBolt({ x: state.current.x, y: 1.35, z: state.current.z }, { x: result.x, y: 1, z: result.z }, SPELL_KINDS[spell.kind].color);
      }
    };
    runtime.castSlot = castFromBar;
    runtime.emote = (id) => {
      const emote = EMOTES.find((e) => e.id === id);
      if (!emote || blockedByUi()) return;
      state.current.path = [];
      state.current.pending = null;
      oneShot.current = emote.clip;
    };
    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      shift.current = e.shiftKey;
      const k = e.key.toLowerCase();
      if (MOVE_KEYS.has(k)) {
        if (blockedByUi()) return;
        e.preventDefault();
        keys.current.add(k);
      } else if (k === " ") {
        e.preventDefault();
        if (!e.repeat) jump();
      } else if (k === "e" && !e.repeat) {
        if (activateNearby()) e.preventDefault();
      } else if (k === "f" && !blockedByUi()) {
        attack();
      } else if (k === "h" && !blockedByUi()) {
        playerEat();
      } else if (k === "b" && !blockedByUi()) {
        toggleBroom();
      } else if (/^[1-4]$/.test(k) && !blockedByUi() && !document.querySelector(".rs-emote-wheel")) {
        castFromBar(Number(k) - 1);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      shift.current = e.shiftKey;
      keys.current.delete(e.key.toLowerCase());
    };
    const clear = () => {
      keys.current.clear();
      shift.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    return () => {
      runtime.useNearby = null;
      runtime.useInFront = null;
      runtime.jump = null;
      runtime.actNow = null;
      runtime.attackNow = null;
      runtime.emote = null;
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
    };
  }, [handlersRef, avatar, world]);

  useEffect(() => {
    const s = state.current;
    // A new place (another island, or a room world) starts you at its spawn. The same place
    // rebuilt (e.g. after redecorating your walk-in dorm) keeps you where you are.
    const placeKey = `${world.mode}|${world.islandId}|${world.interior ?? ""}|${world.size}`;
    if (placeKey !== lastPlace.current) {
      lastPlace.current = placeKey;
      // Cleared on this world's first frame (not here: development mode runs effects twice).
      const at = runtime.arrival?.mode === world.mode ? runtime.arrival : null;
      s.x = at?.x ?? world.spawn.x;
      s.z = at?.z ?? world.spawn.z;
      s.path = [];
      s.pending = null;
      runtime.player.flying = false;
      runtime.seat = null;
    }

    runtime.objects = world.objects;
    const currentTile = (): TilePoint => ({ x: Math.floor(s.x), z: Math.floor(s.z) });

    runtime.walkTo = (x, z) => {
      if (runtime.player.flying) {
        s.pending = null;
        s.path = [{ x: Math.max(0, Math.min(world.size - 1, x)), z: Math.max(0, Math.min(world.size - 1, z)) }];
        runtime.marker = { x: x + 0.5, z: z + 0.5, red: false, at: performance.now() };
        return;
      }
      const target = isWalkable(world, x, z) ? { x, z } : nearestWalkable(world, { x, z });
      if (!target) return;
      const path = findPath(world, currentTile(), [target]);
      s.pending = null;
      if (path === null) {
        chat("I can't reach that!");
        return;
      }
      s.path = path;
      runtime.marker = { x: target.x + 0.5, z: target.z + 0.5, red: false, at: performance.now() };
    };

    runtime.interact = (object, actionId) => {
      if (runtime.player.flying) {
        chat("Land first (press B) to use that.");
        return;
      }
      const goals = interactionTiles(world, object);
      const path = findPath(world, currentTile(), goals);
      if (path === null) {
        chat("I can't reach that!");
        return;
      }
      s.path = path;
      s.pending = { object, action: actionId };
      const c = objectCenter(object);
      runtime.marker = { x: c.x, z: c.z, red: true, at: performance.now() };
      emit({ type: "sound", name: "click" });
    };

    runtime.teleport = (x, z) => {
      runtime.seat = null;
      s.x = x;
      s.z = z;
      s.path = [];
      s.pending = null;
    };

    return () => {
      runtime.walkTo = null;
      runtime.interact = null;
      runtime.teleport = null;
    };
  }, [world]);

  useFrame((_, rawDelta) => {
    if (runtime.arrival?.mode === world.mode) runtime.arrival = null;
    const delta = Math.min(rawDelta, 0.1);
    const s = state.current;
    let isMoving = false;
    // Sprinting during the Island Race.
    const flying = runtime.player.flying;
    // Running boost: Shift sprints on foot while there's stamina (about 4 seconds from full; refills in ~2.5).
    const wantsBoost = shift.current && !flying && !runtime.seat && (keys.current.size > 0 || Math.hypot(runtime.joystick.x, runtime.joystick.y) > 0.15 || s.path.length > 0);
    // After running dry, a little stamina has to come back before you can boost again.
    const canBoost = runtime.player.stamina > 0.01 && (runtime.player.sprinting || runtime.player.stamina > 0.15);
    runtime.player.sprinting = wantsBoost && canBoost;
    runtime.player.stamina = Math.max(0, Math.min(1, runtime.player.stamina + (runtime.player.sprinting ? -delta / 4 : delta / 2.5)));
    const boost = runtime.player.sprinting ? SPRINT_BOOST : 1;
    const sprint = (flying ? BROOM_SPEED : race.run && !race.run.done ? RACE_SPRINT : 1) * (swift.current ? SWIFTNESS_BONUS : 1) * boost;
    // On a broom you can cross anything inside the island's bounds.
    const free = (x: number, z: number) => (flying ? x > 0.5 && z > 0.5 && x < world.size - 0.5 && z < world.size - 0.5 : canStand(world, x, z));
    const k = keys.current;
    const stick = runtime.joystick;
    const fwd = Math.max(-1, Math.min(1, (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) + stick.y));
    const strafe = Math.max(-1, Math.min(1, (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + stick.x));
    // Moving (keys, a click to walk, an action) stands you up from a seat.
    if (runtime.seat && (Math.hypot(fwd, strafe) > 0.15 || s.path.length > 0 || s.pending)) {
      s.x = runtime.seat.standX;
      s.z = runtime.seat.standZ;
      runtime.seat = null;
    }
    const seat = runtime.seat;
    sitting.current = seat !== null;
    if (seat) {
      s.x = seat.x;
      s.z = seat.z;
      s.facing = seat.facing;
    } else if (Math.hypot(fwd, strafe) > 0.15) {
      // Camera-relative walking: "up" always moves away from the camera.
      s.path = [];
      s.pending = null;
      pace.current = Math.min(1, pace.current + delta * 7);
      const yaw = runtime.camera.yaw;
      let mx = -Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
      let mz = -Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      // A half-pushed joystick walks slower; keys are always full speed. A short ease-in takes the jolt out of starting.
      const ease = 0.35 + 0.65 * pace.current;
      const step = WALK_SPEED * sprint * delta * Math.min(1, len) * ease;
      gait.current = sprint * Math.min(1, len) * ease;
      const nx = s.x + mx * step;
      const nz = s.z + mz * step;
      if (free(nx, s.z)) s.x = nx;
      if (free(s.x, nz)) s.z = nz;
      s.facing = Math.atan2(mx, mz);
      isMoving = true;
    } else if (s.path.length > 0) {
      const next = s.path[0];
      const tx = next.x + 0.5;
      const tz = next.z + 0.5;
      const dx = tx - s.x;
      const dz = tz - s.z;
      const dist = Math.hypot(dx, dz);
      pace.current = Math.min(1, pace.current + delta * 7);
      const ease = 0.35 + 0.65 * pace.current;
      const step = WALK_SPEED * sprint * delta * ease;
      gait.current = sprint * ease;
      if (dist <= step) {
        s.x = tx;
        s.z = tz;
        s.path.shift();
      } else {
        s.x += (dx / dist) * step;
        s.z += (dz / dist) * step;
      }
      if (dist > 0.001) s.facing = Math.atan2(dx, dz);
      isMoving = true;
    } else if (s.pending) {
      const { object, action } = s.pending;
      s.pending = null;
      const c = objectCenter(object);
      s.facing = Math.atan2(c.x - s.x, c.z - s.z);
      oneShot.current = "Interact";
      handlersRef.current.onInteract(object, action as ActionId);
    }
    if (!isMoving) pace.current = 0;
    moving.current = isMoving;
    // Footsteps: one every ~0.8 tiles walked, sounding like the ground underfoot.
    if (isMoving) {
      stride.current += Math.hypot(s.x - runtime.player.x, s.z - runtime.player.z);
      if (stride.current > 0.8) {
        stride.current = 0;
        if (realmStore.get().settings.sound) playFootstep(surfaceAt(world, s.x, s.z));
      }
    }
    updateNearby(world, s.x, s.z);
    runtime.player.x = s.x;
    runtime.player.z = s.z;
    runtime.player.facing = s.facing;
    // A jump: a quick arc up and down, legs tucking at the top.
    let hop = 0;
    if (jumpT.current >= 0) {
      jumpT.current += delta;
      const t = jumpT.current / JUMP_SECONDS;
      if (t >= 1) {
        jumpT.current = -1;
        air.current = 0;
        if (realmStore.get().settings.sound) playFootstep(surfaceAt(world, s.x, s.z));
      } else {
        hop = 4 * JUMP_HEIGHT * t * (1 - t);
        air.current = Math.sin(Math.PI * t);
      }
    }
    // Rise to flying height (or settle back down) smoothly, with a gentle bob in the air.
    const targetAlt = flying ? FLY_HEIGHT + Math.sin(performance.now() / 600) * 0.12 : 0;
    runtime.player.altitude += (targetAlt - runtime.player.altitude) * Math.min(1, delta * 4);
    if (group.current) {
      group.current.visible = !runtime.camera.firstPerson;
      runtime.player.hop = hop;
      group.current.position.set(s.x, groundHeight(world, s.x, s.z) + runtime.player.altitude + hop - (seat ? seat.drop : 0), s.z);
      group.current.rotation.y = angleLerp(group.current.rotation.y, s.facing, Math.min(1, delta * 12));
    }
  });

  return (
    <>
      <group ref={group}>
        <WithFallback fallback={<Character look={look} movingRef={moving} />}>
          <HumanCharacter appearance={appearance} movingRef={moving} oneShotRef={oneShot} capeColor={capeColor} hat={hat} weaponTint={weaponTint} height={1.7} sittingRef={sitting} speedRef={gait} airRef={air} />
        </WithFallback>
        {broomOn ? <BroomMesh /> : null}
        {title ? (
          <Html position={[0, 2.15, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
            <div className="rs-nametag">
              {playerName} <span>{title}</span>
            </div>
          </Html>
        ) : null}
        {night ? <pointLight position={[0.3, 1.6, 0.4]} color="#ffc27a" intensity={9} distance={9} decay={1.6} /> : null}
      </group>
      {pet ? <Pet world={world} kind={pet} level={familiar} /> : null}
    </>
  );
}

/** A broomstick under the rider, bristles behind. */
function BroomMesh() {
  return (
    <group position={[0, 0.82, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.035, 1.9, 8]} />
        <meshStandardMaterial color="#6b4a2e" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, -1.05]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.16, 0.55, 12, 1, true]} />
        <meshStandardMaterial color="#c8a050" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.78]}>
        <torusGeometry args={[0.05, 0.015, 6, 12]} />
        <meshStandardMaterial color="#8a2a20" />
      </mesh>
    </group>
  );
}

function surfaceAt(world: World, x: number, z: number): StepSurface {
  const kind = world.kinds[Math.floor(z) * world.size + Math.floor(x)];
  if (kind === TILE.path || kind === TILE.plaza) return "stone";
  if (kind === TILE.dirt) return "dirt";
  if (kind === TILE.sand) return "sand";
  return "grass";
}

/** A companion bought at the bazaar. It trots after the player and waits beside them. */
function Pet({ world, kind, level }: { world: World; kind: string; level: number }) {
  /** Familiars grow: bigger and brighter with each level. */
  const grow = 0.8 + level * 0.1;
  const group = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const pos = useRef({ x: runtime.player.x - 1, z: runtime.player.z });
  const glow = useRef<THREE.Mesh>(null);
  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const p = runtime.player;
    // Sit just behind and to the right of the player.
    const tx = p.x - Math.sin(p.facing) * 0.9 + Math.cos(p.facing) * 0.6;
    const tz = p.z - Math.cos(p.facing) * 0.9 - Math.sin(p.facing) * 0.6;
    const dx = tx - pos.current.x;
    const dz = tz - pos.current.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 8) {
      pos.current = { x: tx, z: tz };
    } else if (dist > 0.15) {
      const step = Math.min(dist, (dist > 2 ? 5 : 3.2) * delta);
      pos.current.x += (dx / dist) * step;
      pos.current.z += (dz / dist) * step;
    }
    moving.current = dist > 0.3;
    if (!group.current) return;
    const bob = kind === "wisp" ? 1.3 + Math.sin(state.clock.elapsedTime * 2.2) * 0.15 : 0;
    group.current.position.set(pos.current.x, groundHeight(world, pos.current.x, pos.current.z) + bob, pos.current.z);
    if (dist > 0.05) group.current.rotation.y = angleLerp(group.current.rotation.y, Math.atan2(dx, dz), Math.min(1, delta * 8));
    if (glow.current) glow.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.12);
  });
  return (
    <group ref={group}>
      {kind === "wisp" ? (
        <mesh ref={glow} raycast={() => null}>
          <icosahedronGeometry args={[0.14 * grow, 2]} />
          <meshStandardMaterial color="#d8f4ff" emissive={level >= 5 ? "#ffe27a" : "#7fd8ff"} emissiveIntensity={2 + level} toneMapped={false} />
        </mesh>
      ) : (
        <WithFallback fallback={null}>
          <ModelCharacter avatar="skeleton_minion" movingRef={moving} height={0.75 * grow} moveClip="Walking_A" />
        </WithFallback>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Click marker + camera
// ---------------------------------------------------------------------------

function ClickMarker({ world }: { world: World }) {
  const group = useRef<THREE.Group>(null);
  const yellow = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffe14a" }), []);
  const red = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff3a2a" }), []);
  const meshes = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    if (!group.current) return;
    const age = (performance.now() - runtime.marker.at) / 1000;
    const visible = age < 0.55;
    group.current.visible = visible;
    if (!visible) return;
    const scale = 1 - age * 1.2;
    group.current.position.set(runtime.marker.x, groundHeight(world, runtime.marker.x, runtime.marker.z) + 0.05, runtime.marker.z);
    group.current.scale.setScalar(Math.max(0.2, scale));
    meshes.current.forEach((m) => (m.material = runtime.marker.red ? red : yellow));
  });
  return (
    <group ref={group} visible={false}>
      {[Math.PI / 4, -Math.PI / 4].map((r, i) => (
        <mesh key={i} ref={(m) => { if (m) meshes.current[i] = m; }} rotation={[-Math.PI / 2, 0, r]}>
          <planeGeometry args={[0.7, 0.12]} />
          <primitive object={yellow} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig({ world }: { world: World }) {
  const { camera, gl, scene, raycaster, events } = useThree();
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __realmScene?: THREE.Scene }).__realmScene = scene;
  }, [scene]);
  const keys = useRef(new Set<string>());
  const focus = useRef(new THREE.Vector3(world.spawn.x, 0, world.spawn.z));
  // First-person walking feel: head bob, landing dip.
  const bob = useRef({ phase: 0, amount: 0, dip: 0 });
  const lastPos = useRef({ x: 0, z: 0 });
  const lastHop = useRef(0);

  useEffect(() => {
    // Pointer events land on the canvas's wrapper (the scene's event source), not the canvas itself.
    const el = ((events.connected as HTMLElement | undefined) ?? gl.domElement.parentElement ?? gl.domElement) as HTMLElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    const isTyping = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      return !!node && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable);
    };
    const locked = () => document.pointerLockElement === el;
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      // First person, Minecraft/Roblox style: click to lock the mouse, then move it to look.
      // With the mouse locked, a click uses whatever is in front of you.
      if (runtime.camera.firstPerson) {
        if (locked()) {
          if (e.button === 0) runtime.useInFront?.();
          return;
        }
        el.requestPointerLock?.();
      }
      dragging = true;
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (locked()) {
        runtime.camera.yaw -= e.movementX * 0.0024;
        runtime.camera.look = Math.min(1.35, Math.max(-1.35, runtime.camera.look - e.movementY * 0.0024));
        return;
      }
      if (!dragging) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) < 6 && e.button !== 1) {
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      if (runtime.camera.firstPerson) {
        // Drag to look around.
        runtime.camera.yaw -= (e.clientX - lastX) * 0.005;
        runtime.camera.look = Math.min(1.2, Math.max(-1.2, runtime.camera.look - (e.clientY - lastY) * 0.005));
      } else {
        runtime.camera.yaw -= (e.clientX - lastX) * 0.008;
        runtime.camera.pitch = Math.min(1.35, Math.max(0.3, runtime.camera.pitch + (e.clientY - lastY) * 0.006));
      }
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // The view only changes with the view button; scrolling just zooms the over-the-shoulder camera.
      if (runtime.camera.firstPerson) return;
      runtime.camera.distance = Math.min(30, Math.max(6, runtime.camera.distance * (1 + e.deltaY * 0.0012)));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      keys.current.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const clearKeys = () => keys.current.clear();
    window.addEventListener("blur", clearKeys);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, [gl, events.connected]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const k = keys.current;
    const fp = runtime.camera.firstPerson;
    if (fp) {
      if (k.has("pageup") || k.has("r")) runtime.camera.look = Math.min(1.2, runtime.camera.look + delta * 1.2);
      if (k.has("pagedown") || k.has("t")) runtime.camera.look = Math.max(-1.2, runtime.camera.look - delta * 1.2);
    } else {
      if (k.has("pageup") || k.has("r")) runtime.camera.pitch = Math.min(1.35, runtime.camera.pitch + delta * 1.2);
      if (k.has("pagedown") || k.has("t")) runtime.camera.pitch = Math.max(0.3, runtime.camera.pitch - delta * 1.2);
    }

    // A wider view in first person (like Minecraft/Roblox); the narrower lens suits the follow camera.
    const persp = camera as THREE.PerspectiveCamera;
    const fov = fp ? (runtime.player.sprinting ? 80 : 72) : runtime.player.sprinting ? 46 : 42;
    if (Math.abs(persp.fov - fov) > 0.05) {
      persp.fov += (fov - persp.fov) * Math.min(1, delta * 10);
      persp.updateProjectionMatrix();
    }
    // Free the mouse whenever a window, conversation, lecture or the menu needs it. Only our own lock:
    // a play-world game (archery) may hold the mouse for itself.
    const lockWrap = (events.connected as HTMLElement | undefined) ?? gl.domElement.parentElement ?? gl.domElement;
    const ownLock = document.pointerLockElement !== null && lockWrap.contains(document.pointerLockElement);
    if (ownLock && (!fp || document.querySelector(".rs-window-backdrop, .rs-dialogue, .rs-lecture, .rs-drawer.open, .rs-menu"))) document.exitPointerLock();
    // With the mouse locked the hidden cursor isn't aiming at anything: pointer events on objects are off
    // (a click uses what's in front of you instead).
    if (ownLock) raycaster.layers.set(31);
    else raycaster.layers.set(0);

    if (fp) {
      // Through the character's eyes (lower when sitting); yaw 0 looks north (-Z), like the orbit camera.
      const { x, z } = runtime.player;
      // Walking: a head bob in step with the stride (up-down twice per cycle, a little side sway).
      const moved = Math.hypot(x - lastPos.current.x, z - lastPos.current.z);
      lastPos.current.x = x;
      lastPos.current.z = z;
      const walking = moved > 0.002 && runtime.player.hop === 0 && !runtime.seat && !runtime.player.flying;
      bob.current.amount += ((walking ? 1 : 0) - bob.current.amount) * Math.min(1, delta * 8);
      if (walking) bob.current.phase += moved * 2.3;
      // Landing from a jump: a quick dip, like the knees taking the weight.
      if (lastHop.current > 0.05 && runtime.player.hop === 0) bob.current.dip = 0.09;
      lastHop.current = runtime.player.hop;
      bob.current.dip *= Math.pow(0.0005, delta);
      const bobY = Math.abs(Math.sin(bob.current.phase)) * 0.07 * bob.current.amount - bob.current.dip;
      const sway = Math.sin(bob.current.phase) * 0.035 * bob.current.amount;
      const eyeY = groundHeight(world, x, z) + runtime.player.altitude + runtime.player.hop + 1.55 - (runtime.seat?.drop ?? 0) + bobY;
      focus.current.set(x, eyeY - 0.65, z);
      const { yaw, look } = runtime.camera;
      const side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      camera.position.set(x - Math.sin(yaw) * 0.12 + side.x * sway, eyeY, z - Math.cos(yaw) * 0.12 + side.z * sway);
      camera.lookAt(camera.position.x - Math.sin(yaw) * Math.cos(look) * 10, eyeY + Math.sin(look) * 10, camera.position.z - Math.cos(yaw) * Math.cos(look) * 10);
      return;
    }

    if (world.interior === "theatre") {
      // Low enough to see the big screen over the benches.
      runtime.camera.distance = Math.min(runtime.camera.distance, 13);
      runtime.camera.pitch = Math.max(runtime.camera.pitch, 0.3);
      runtime.camera.yaw = Math.max(-0.7, Math.min(0.9, runtime.camera.yaw));
    } else if (world.mode === "interior") {
      runtime.camera.distance = Math.min(runtime.camera.distance, 10);
      runtime.camera.pitch = Math.max(runtime.camera.pitch, 0.7);
      runtime.camera.yaw = Math.max(-0.35, Math.min(1.2, runtime.camera.yaw));
    }
    const { x, z } = runtime.player;
    const target = new THREE.Vector3(x, groundHeight(world, x, z) + 0.9 + runtime.player.altitude, z);
    focus.current.lerp(target, Math.min(1, delta * 8));
    const { yaw, pitch, distance } = runtime.camera;
    camera.position.set(
      focus.current.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      focus.current.y + Math.sin(pitch) * distance,
      focus.current.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    // Combat camera shake, decaying quickly.
    if (combat.shake > 0.002) {
      camera.position.x += (Math.random() - 0.5) * combat.shake;
      camera.position.y += (Math.random() - 0.5) * combat.shake;
      combat.shake *= Math.pow(0.02, delta);
    }
    // A fly-over sweeps around the island, then glides into the normal view.
    const t = world.mode === "island" ? cinematicProgress() : null;
    if (t !== null) {
      const C = world.size / 2;
      const ease = t * t * (3 - 2 * t);
      const a = -Math.PI / 2 + ease * Math.PI * 1.3;
      const r = world.size * (0.62 - 0.3 * ease);
      const cine = new THREE.Vector3(C + Math.cos(a) * r, 34 - 18 * ease, C + Math.sin(a) * r);
      const blend = Math.max(0, (t - 0.72) / 0.28);
      const settle = blend * blend * (3 - 2 * blend);
      camera.position.lerpVectors(cine, camera.position, settle);
      const look = new THREE.Vector3(C, 0, C).lerp(focus.current, settle);
      camera.lookAt(look);
      return;
    }
    camera.lookAt(focus.current);
  });

  return null;
}
