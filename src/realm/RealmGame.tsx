/**
 * The in-world game screen: 3D island + RuneScape-style interface.
 * Routes every world interaction to the right dialogue, window or mini-game.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RealmScene, type SceneHandlers } from "./scene/RealmScene";
import { runtime, type ContextMenuRequest } from "./scene/runtime";
import { generateWorld, type ActionId, type WorldObject } from "./world/worldGen";
import { ChatBox, type Dialogue } from "./hud/ChatBox";
import { ContextMenu, HoverText, LevelUpBanner, NearbyPrompt, XpDrops } from "./hud/Overlays";
import { Minimap } from "./hud/Minimap";
import { SidePanel, type SidePanelActions } from "./hud/SidePanel";
import { CodexWindow, ControlsWindow, DailyWindow, GraduationWindow, LampWindow, QuestBoardWindow, QuestJournal, StudyWindow } from "./hud/Windows";
import { nearestWalkable } from "./world/pathfinding";
import { preloadRealmModels } from "./scene/models";
import { Window } from "./hud/Window";
import { QuizDuel } from "./minigames/QuizDuel";
import { ScrollMatch } from "./minigames/ScrollMatch";
import { RuneScramble } from "./minigames/RuneScramble";
import { Meditation } from "./minigames/Meditation";
import { tutorDialogue } from "./dialogues";
import { realmStore, sanitizeState, useRealm } from "./state/store";
import { chat, emit, onGameEvent } from "./state/events";
import { completeFocus, dropItem, graduationStatus, resetRealm, restInBed } from "./state/actions";
import { duckMusic, playSound, resumeAudioOnGesture, startAmbience, startMusic, stopAmbience, stopMusic } from "./audio";
import { CalendarImportWindow, GrimoireWindow, GroupWindow, ShopWindow, TutorChatWindow } from "./hud/StudyWindows";
import { TouchControls } from "./hud/TouchControls";
import { SceneLoader } from "./hud/SceneLoader";
import { CookWindow, CraftWindow, GatherGame } from "./hud/LifeWindows";
import { FocusPops } from "./hud/FocusPops";
import { CombatHud } from "./hud/CombatHud";
import { RaceHud } from "./hud/RaceHud";
import { ArcadeWindow } from "./arcade/ArcadeWindow";
import { ArenaWindow } from "./arena/ArenaWindow";
import { TowerDefence } from "./arcade/TowerDefence";
import { abandonRace, startRace } from "./arcade/race";
import { withRooms, roomToWorld, roomAngle } from "./world/rooms";
import { FRONT_SEAT } from "./lecture/theatre";
import { LectureWindow } from "./hud/LectureWindow";

// The play-world games load only when opened (each is its own full-screen 3D scene).
const ParkourGame = lazy(() => import("./games/parkour").then((m) => ({ default: m.ParkourGame })));
const ArcheryGame = lazy(() => import("./games/archery").then((m) => ({ default: m.ArcheryGame })));
const PingPongGame = lazy(() => import("./games/pingpong").then((m) => ({ default: m.PingPongGame })));
import { Crosshair } from "./hud/Crosshair";
import { StaminaBar } from "./hud/StaminaBar";
import { FpsMeter, fpsRequested } from "./hud/FpsMeter";
import { ExpoBar } from "./hud/ExpoBar";
import { isExpo } from "./expo";
import "../styles/lecture.css";
import { moveIn } from "./dorm/dorm";
import { defaultAppearance } from "./customise/humans";
import { beatRival, beginVoyage, islandsFor, landOn, type IslandSpec } from "./world/islands";
import { NoticeboardWindow, SailWindow } from "./hud/TravelWindows";
import { combat } from "./combat/combat";
import { DormWindow } from "./dorm/DormWindow";
import { WardrobeWindow } from "./customise/WardrobeWindow";
import { EmoteWheel } from "./hud/EmoteWheel";
import { AreaBanner } from "./hud/AreaBanner";
import { MailWindow, useOwlPost } from "./hud/MailWindow";
import { SpellbookWindow } from "./hud/Spellbook";
import { CauldronWindow } from "./hud/CauldronWindow";
import { LadderWindow } from "./hud/LadderWindow";
import { SecretDoorWindow } from "./hud/SecretDoorWindow";
import { TextbookWindow } from "./hud/TextbookWindow";
import { YearbookWindow } from "./hud/YearbookWindow";
import { WeatherChip } from "./hud/WeatherChip";
import { TopBar } from "./hud/TopBar";
import { CinematicOverlay } from "./hud/CinematicOverlay";
import { startCinematic } from "./scene/cinematic";
import { HOUSES } from "./customise/houses";
import { bumpCounter } from "./state/stats";
import { StudyRoomWindow, TimetableWindow } from "./hud/TimetableWindows";
import { nextOpponent, opponentTier, winLadderDuel } from "./state/ladder";
import { startDungeon } from "./combat/combat";
import { activeBoss, bossName, bossStatus } from "./state/bosses";
import { dueCards } from "./state/grimoire";
import { checkResearchAvailable } from "./curriculum/curriculumClient";
import { workshopFor, type WorkshopKind } from "./curriculum/workshop";
import { MockExam } from "./minigames/MockExam";
import { Workshop } from "./minigames/Workshop";
import { AddQuestionsWindow, ExplainWindow, GradesWindow, LibraryWindow, TrophyHallWindow } from "./hud/ProgressWindows";
import { checkAchievements } from "./state/achievements";
import { enableReminders, useReminders } from "./state/reminders";
import { siegeActive } from "./state/bosses";
import type { ArenaGameId, ChatMessage, InventoryItem, RealmCurriculum, RealmPlayer } from "./types";

type OpenWindow =
  | { kind: "quest"; assessmentId: string }
  | { kind: "board"; subjectId: string }
  | { kind: "study"; subjectId: string; week: number }
  | { kind: "codex"; subjectId: string }
  | { kind: "duel"; subjectId: string; week: number | null }
  | { kind: "match"; subjectId: string }
  | { kind: "scramble"; subjectId: string }
  | { kind: "meditate"; subjectId: string }
  | { kind: "lamp"; itemIndex: number }
  | { kind: "graduation" }
  | { kind: "daily" }
  | { kind: "controls" }
  | { kind: "quest-complete"; title: string; questPoints: number; xp: number; skillName: string }
  | { kind: "confirm-reenrol" }
  | { kind: "grimoire" }
  | { kind: "tutor-chat"; subjectId: string; tutorName: string }
  | { kind: "calendar" }
  | { kind: "shop" }
  | { kind: "group" }
  | { kind: "boss"; subjectId: string; assessmentId: string }
  | { kind: "mock"; subjectId: string }
  | { kind: "workshop"; subjectId: string; game: WorkshopKind }
  | { kind: "grades" }
  | { kind: "explain"; subjectId: string; week?: number }
  | { kind: "add-questions"; subjectId: string }
  | { kind: "trophies" }
  | { kind: "library" }
  | { kind: "gather"; resourceId: string; nodeName: string }
  | { kind: "cook" }
  | { kind: "craft" }
  | { kind: "arcade" }
  | { kind: "arena"; game?: ArenaGameId }
  | { kind: "tower-defence" }
  | { kind: "dorm" }
  | { kind: "wardrobe"; back?: "dorm"; first?: boolean }
  | { kind: "sail" }
  | { kind: "noticeboard" }
  | { kind: "mail" }
  | { kind: "spellbook" }
  | { kind: "cauldron" }
  | { kind: "ladder" }
  | { kind: "secret"; doorId: string }
  | { kind: "textbook" }
  | { kind: "yearbook" }
  | { kind: "timetable" }
  | { kind: "study-room" }
  | { kind: "ladder-duel"; subjectId: string }
  | { kind: "rival"; subjectId: string }
  | { kind: "lecture"; lecternId: string }
  | { kind: "parkour" }
  | { kind: "archery" }
  | { kind: "pingpong" };

interface RealmGameProps {
  player: RealmPlayer;
  curriculum: RealmCurriculum;
}

/** Which island you're on (home, or one you sailed to). Rooms like the dorm are walk-in parts of the home island. */
type Location = { place: "island"; islandId: string; byBoat: boolean };

let messageCounter = 0;
/** One-off notices shown once per page load (effects run twice in development). */
const shownNotices = new Set<string>();
function noticeOnce(key: string, show: () => void): void {
  if (shownNotices.has(key)) return;
  shownNotices.add(key);
  show();
}
/** Unique across hot reloads and StrictMode double renders. */
function nextMessageId(): number {
  messageCounter = (messageCounter + 1) % 1000;
  return Date.now() * 1000 + messageCounter;
}

export function RealmGame({ player, curriculum }: RealmGameProps) {
  // Where the player is: your home campus or an island you sailed to.
  const [location, setLocation] = useState<Location>({ place: "island", islandId: "home", byBoat: false });
  const islands = useMemo(() => islandsFor(curriculum.enrolment), [curriculum]);
  const island = islands.find((i) => i.id === location.islandId) ?? islands[0];
  const dorm = useRealm((s) => s.progress.dorm);
  const homeWorld = useMemo(
    () =>
      generateWorld(curriculum.subjects, {
        university: curriculum.enrolment.university,
        island,
        arriveByBoat: location.byBoat,
      }),
    [curriculum, island, location],
  );
  // On your home campus the dorm and the lecture theatre are walk-in rooms inside their buildings.
  const world = useMemo(() => (island.kind === "home" ? withRooms(homeWorld, dorm) : homeWorld), [island, dorm, homeWorld]);
  /** Where you sit for a lecture, on the theatre's front bench. */
  const lectureSeat = useMemo(() => {
    const room = world.rooms?.find((r) => r.kind === "theatre");
    if (!room) return null;
    const at = roomToWorld(room, FRONT_SEAT.x, FRONT_SEAT.z);
    const stand = roomToWorld(room, FRONT_SEAT.standX, FRONT_SEAT.standZ);
    return { x: at.x, z: at.z, drop: FRONT_SEAT.drop, facing: FRONT_SEAT.facing + roomAngle(room), standX: stand.x, standZ: stand.z };
  }, [world]);
  // Your room is furnished from the start (a bed, a table and a chair), so it's ready to walk into.
  useEffect(() => {
    moveIn();
  }, []);
  const graphics = useRealm((s) => s.settings.graphics);
  const [showFps] = useState(fpsRequested);

  useEffect(() => {
    preloadRealmModels(player.avatar ?? "knight", curriculum.subjects.map((s) => s.theme));
  }, [player.avatar, curriculum]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: nextMessageId(), channel: "game", text: `Welcome to the Realm of Scholars at ${curriculum.enrolment.university}.` },
    { id: nextMessageId(), channel: "game", text: "WASD to move, Shift to sprint, Space to jump. Press E to use what's in front of you. Drag to turn the camera." },
    { id: nextMessageId(), channel: "game", text: "Your quests and what's due next are in the Menu (M), under Quests. Look into the fountain for today's challenges, and use the Agora signpost to travel to a subject." },
  ]);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [windowState, setWindowState] = useState<OpenWindow | null>(null);
  // The play-world games fill the screen with their own 3D scene, so the campus stops drawing underneath.
  const fullScreenGame = windowState?.kind === "parkour" || windowState?.kind === "archery" || windowState?.kind === "pingpong";
  const windowOpen = useRef(false);
  windowOpen.current = windowState !== null;
  const [menu, setMenu] = useState<ContextMenuRequest | null>(null);
  const focus = useRealm((s) => s.progress.activeFocus);
  const music = useRealm((s) => s.settings.music);
  const fileInput = useRef<HTMLInputElement>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  // Subscribe to game events first, so chat lines sent by the effects below are not lost.
  useEffect(
    () =>
      onGameEvent((event) => {
        if (event.type === "chat") {
          setMessages((list) => [...list.slice(-150), { id: nextMessageId(), channel: event.channel, text: event.text }]);
        } else if (event.type === "sound") {
          if (realmStore.get().settings.sound) playSound(event.name);
        } else if (event.type === "quest-complete") {
          setWindowState({ kind: "quest-complete", title: event.title, questPoints: event.questPoints, xp: event.xp, skillName: event.skillName });
        }
      }),
    [],
  );

  useEffect(() => {
    let live = true;
    void checkResearchAvailable().then((ok) => live && setAiAvailable(ok));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => resumeAudioOnGesture(), []);
  // First arrival: a fly-over of the island with a few words of welcome.
  useEffect(() => {
    const s = realmStore.get();
    if ((s.progress.counters.introSeen ?? 0) > 0) return;
    const h = s.player?.house ? HOUSES.find((x) => x.id === s.player!.house) : null;
    const id = window.setInterval(() => {
      // Wait until the character creator (or any window or game) is closed.
      if (windowOpen.current || document.querySelector(".rs-window")) return;
      window.clearInterval(id);
      startCinematic(
        [
          `Welcome to ${curriculum.enrolment.university}.`,
          `${world.hub.plazaName}: the heart of the academy.`,
          `Your ${curriculum.subjects.length} subject${curriculum.subjects.length === 1 ? " lies" : "s lie"} along the roads. Each one is a skill to master.`,
          h ? `House ${h.name} is counting on your points.` : "Choose a house in your wardrobe and earn it points.",
          "Study to earn Focus. Spend it on adventure.",
        ],
        11,
      );
      bumpCounter("introSeen");
    }, 1800);
    return () => window.clearInterval(id);
    // Only ever on the first visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Characters now have real bodies: an older save without one gets the creator first.
  useEffect(() => {
    if (!realmStore.get().player?.appearance) {
      setWindowState({ kind: "wardrobe", first: true });
      // (For older saves; an expo visitor is simply making their character for the first time.)
      if (!isExpo()) noticeOnce("new-bodies", () => chat("Characters now have real bodies. Make yours: body type, height, build, muscle, outfit and colours.", "quest"));
    }
  }, []);
  // Birdsong, crickets and surf follow the sound setting, the time of day and how close the shore is.
  const soundOn = useRealm((s) => s.settings.sound);
  useEffect(() => {
    if (!soundOn) return;
    startAmbience(() => {
      const st = realmStore.get();
      const hour = new Date().getHours();
      const night = st.settings.realTimeSky && (hour >= 19 || hour < 6);
      const px = Math.floor(runtime.player.x);
      const pz = Math.floor(runtime.player.z);
      let water = 0;
      let total = 0;
      for (let oz = -5; oz <= 5; oz += 1) {
        for (let ox = -5; ox <= 5; ox += 1) {
          const x = px + ox;
          const z = pz + oz;
          total++;
          if (x < 0 || z < 0 || x >= world.size || z >= world.size || world.kinds[z * world.size + x] === 3) water++;
        }
      }
      return { night, water: Math.min(1, (water / total) * 2.2) };
    });
    return () => stopAmbience();
  }, [soundOn, world]);
  useEffect(() => {
    if (music) startMusic();
    else stopMusic();
    return () => stopMusic();
  }, [music]);

  // Achievements unlock as soon as their rule is met (checked after any change, batched).
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => checkAchievements(), 400);
    };
    schedule();
    const unsubscribe = realmStore.subscribe(schedule);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useOwlPost();
  const studying = windowState !== null && ["duel", "boss", "rival", "ladder-duel", "grimoire", "meditate", "study", "mock", "workshop", "explain", "textbook", "match", "scramble", "lecture"].includes(windowState.kind);
  useEffect(() => duckMusic(studying), [studying]);
  const remindersOn = useRealm((s) => s.settings.reminders);
  useReminders(remindersOn);
  const siege = useRealm((s) => siegeActive(s));
  const a11y = useRealm((s) => `${s.settings.colorblind ? "cb" : ""} ${s.settings.reduceMotion ? "calm" : ""} text-${String(s.settings.textScale).replace(".", "")}`);

  // A gentle nudge to rest when studying very late.
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 5) noticeOnce("late", () => chat("It's late. Sleep helps memory stick, so keep this session short.", "game"));
  }, []);

  // Remind the player of review cards waiting in the Grimoire.
  useEffect(() => {
    const due = dueCards(realmStore.get()).length;
    if (due > 0) noticeOnce("grimoire", () => chat(`${due} question${due === 1 ? " is" : "s are"} due for review in your Grimoire of Mistakes.`, "quest"));
  }, []);


  // A meditation that finished while the player was away pays out when they return.
  useEffect(() => {
    const id = window.setInterval(() => {
      const active = realmStore.get().progress.activeFocus;
      if (active && Date.now() - new Date(active.startedAt).getTime() >= active.minutes * 60_000) completeFocus();
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const closeDialogue = useCallback(() => setDialogue(null), []);
  // Professors stop gesturing when the conversation ends.
  useEffect(() => {
    if (!dialogue) runtime.talkingTo = null;
  }, [dialogue]);

  /** Fast travel to a subject's region clearing. */
  const travelTo = useCallback(
    (subjectId: string) => {
      const region = world.regions.find((r) => r.subjectId === subjectId);
      if (!region) return;
      const tile = nearestWalkable(world, { x: Math.floor(region.clearing.x), z: Math.floor(region.clearing.z) }, 4);
      if (!tile) return;
      runtime.teleport?.(tile.x + 0.5, tile.z + 0.5);
      const name = curriculum.subjects.find((s) => s.id === subjectId)?.name ?? region.name;
      chat(`You travel to the ${region.name.split(" of ")[0]}: ${name}.`);
      emit({ type: "sound", name: "study" });
    },
    [world, curriculum],
  );

  const subjectOf = (id: string | undefined) => curriculum.subjects.find((s) => s.id === id);

  const interact = useCallback(
    (object: WorldObject, action: ActionId) => {
      const state = realmStore.get();
      const subject = curriculum.subjects.find((s) => s.id === object.subjectId);
      setMenu(null);
      switch (action) {
        case "talk":
          if (subject) {
            runtime.talkingTo = object.id;
            setDialogue(
              tutorDialogue(state, subject, object.name, {
                board: () => setWindowState({ kind: "board", subjectId: subject.id }),
                codex: () => setWindowState({ kind: "codex", subjectId: subject.id }),
                ask: () => setWindowState({ kind: "tutor-chat", subjectId: subject.id, tutorName: object.name }),
                explain: () => setWindowState({ kind: "explain", subjectId: subject.id }),
                close: () => setDialogue(null),
                show: setDialogue,
              }),
            );
          }
          break;
        case "read-board":
          if (subject) setWindowState({ kind: "board", subjectId: subject.id });
          break;
        case "study":
          if (subject && object.week !== undefined) setWindowState({ kind: "study", subjectId: subject.id, week: object.week });
          break;
        case "trial":
          if (subject && object.week !== undefined) setWindowState({ kind: "duel", subjectId: subject.id, week: object.week });
          break;
        case "duel":
          if (subject) setWindowState({ kind: "duel", subjectId: subject.id, week: null });
          break;
        case "match":
          if (subject) setWindowState({ kind: "match", subjectId: subject.id });
          break;
        case "scramble":
          if (subject) setWindowState({ kind: "scramble", subjectId: subject.id });
          break;
        case "meditate":
          if (subject) setWindowState({ kind: "meditate", subjectId: subject.id });
          break;
        case "read-sign":
          chat(object.examine);
          break;
        case "travel":
          if (subject) travelTo(subject.id);
          break;
        case "travel-menu":
          setDialogue({
            speaker: object.name,
            side: "npc",
            pages: ["Where would you like to travel?"],
            options: [
              ...world.districts.map((d) => ({
                label: `${d.name}: ${d.blurb}`,
                run: () => {
                  setDialogue(null);
                  const tile = nearestWalkable(world, { x: d.x, z: d.z + 1 }, 4);
                  if (tile) runtime.teleport?.(tile.x + 0.5, tile.z + 0.5);
                  chat(`You head to ${d.name}.`);
                },
              })),
              ...world.regions.map((region) => ({
                label: curriculum.subjects.find((s) => s.id === region.subjectId)?.name ?? region.name,
                run: () => {
                  setDialogue(null);
                  travelTo(region.subjectId);
                },
              })),
              { label: "Stay here.", run: () => setDialogue(null) },
            ],
          });
          break;
        case "enter-library":
          if (subject) setWindowState({ kind: "codex", subjectId: subject.id });
          break;
        case "daily":
          setWindowState({ kind: "daily" });
          break;
        case "trade":
          setWindowState({ kind: "shop" });
          break;
        case "mock":
          if (subject) setWindowState({ kind: "mock", subjectId: subject.id });
          break;
        case "workshop": {
          const game = subject ? workshopFor(subject) : null;
          if (subject && game) setWindowState({ kind: "workshop", subjectId: subject.id, game });
          break;
        }
        case "trophies":
          setWindowState({ kind: "trophies" });
          break;
        case "library":
          setWindowState({ kind: "library" });
          break;
        case "gather":
          if (object.resource) setWindowState({ kind: "gather", resourceId: object.resource, nodeName: object.name });
          break;
        case "cook":
          setWindowState({ kind: "cook" });
          break;
        case "dungeon":
          startDungeon(object.x + object.w / 2, object.z + object.d / 2 + 2, world);
          break;
        case "craft":
          setWindowState({ kind: "craft" });
          break;
        case "arcade":
          setWindowState({ kind: "arcade" });
          break;
        case "home":
        case "enter-theatre": {
          // Walk-in rooms: just walk through the door.
          const room = world.rooms?.find((r) => r.kind === (action === "home" ? "dorm" : "theatre"));
          if (room) runtime.walkTo?.(room.inside.x, room.inside.z);
          break;
        }
        case "lecture":
          setWindowState({ kind: "lecture", lecternId: object.id });
          break;
        case "parkour":
        case "archery":
        case "pingpong":
          setWindowState({ kind: action });
          break;
        case "leave": {
          // Walk back out through the door of the room you're in.
          const here = world.rooms?.find((r) => r.kind === runtime.room);
          if (here) runtime.walkTo?.(here.outside.x, here.outside.z);
          break;
        }
        case "customise":
          setWindowState({ kind: "wardrobe" });
          break;
        case "plan":
          setWindowState({ kind: "noticeboard" });
          break;
        case "mail":
          setWindowState({ kind: "mail" });
          break;
        case "brew":
          setWindowState({ kind: "cauldron" });
          break;
        case "ladder":
          setWindowState({ kind: "ladder" });
          break;
        case "knock":
          setWindowState({ kind: "secret", doorId: object.id });
          break;
        case "decorate":
          setWindowState({ kind: "dorm" });
          break;
        case "rest":
          if (restInBed()) combat.player.hp = combat.player.max;
          break;
        case "desk":
          setDialogue({
            speaker: "Your desk",
            side: "npc",
            pages: ["Notes, a lamp and a mug of tea. What will you do?"],
            options: [
              { label: "Open my study hub (plan, grades, mock exams).", run: () => { setDialogue(null); setWindowState({ kind: "library" }); } },
              ...curriculum.subjects.map((sub) => ({
                label: `Focus session: ${sub.name}`,
                run: () => {
                  setDialogue(null);
                  setWindowState({ kind: "meditate", subjectId: sub.id });
                },
              })),
              { label: "Not now.", run: () => setDialogue(null) },
            ],
          });
          break;
        case "review":
          setWindowState({ kind: "grimoire" });
          break;
        case "sit":
          setDialogue({
            speaker: "Comfy seat",
            side: "npc",
            pages: ["You settle in with your notes. Which subject will you read?"],
            options: [
              ...curriculum.subjects.map((sub) => ({
                label: sub.name,
                run: () => {
                  setDialogue(null);
                  setWindowState({ kind: "codex", subjectId: sub.id });
                },
              })),
              { label: "Just relax.", run: () => setDialogue(null) },
            ],
          });
          break;
        case "sail":
          setWindowState({ kind: "sail" });
          break;
        case "exchange":
          if (island.kind === "home") break;
          setDialogue({
            speaker: island.rival,
            side: "npc",
            pages: [
              `Welcome to ${island.name}. Scholars here study hard. Let's see if you do too.`,
              "Pick one of your subjects. I'll ask you hard questions from across all of it. Win, and the purse is yours.",
            ],
            options: [
              ...curriculum.subjects.map((sub) => ({
                label: sub.name,
                run: () => {
                  setDialogue(null);
                  setWindowState({ kind: "rival", subjectId: sub.id });
                },
              })),
              { label: "Another time.", run: () => setDialogue(null) },
            ],
          });
          break;
        case "group":
          setWindowState({ kind: "group" });
          break;
        case "boss": {
          if (!subject) break;
          const boss = activeBoss(state, subject);
          if (boss) {
            setDialogue({
              speaker: bossName(boss.assessment),
              side: "npc",
              pages: [
                `So, you dare face me before ${boss.assessment.title}? ${boss.status.reason}`,
                "Answer my questions on everything this task covers. Fail, and you know what to revise. Win, and you are ready.",
              ],
              options: [
                { label: "Fight.", run: () => { setDialogue(null); setWindowState({ kind: "boss", subjectId: subject.id, assessmentId: boss.assessment.id }); } },
                { label: "Not yet. I need to revise.", run: () => setDialogue(null) },
              ],
            });
          } else {
            setDialogue({
              speaker: object.name,
              side: "npc",
              pages: [
                "The stones are cold. No boss stirs here today.",
                ...subject.assessments.map((a) => `${a.title}: ${bossStatus(state, subject, a).reason}`),
              ],
            });
          }
          break;
        }
        case "enter-hall": {
          if (state.progress.graduatedAt) setWindowState({ kind: "graduation" });
          else {
            const status = graduationStatus(state);
            setDialogue({
              speaker: "Great Hall doors",
              side: "npc",
              pages: [
                "The great doors are sealed. A carving above them reads: “Only those who complete every quest may enter to graduate.”",
                `You have completed ${status.done} of ${status.total}.`,
              ],
            });
          }
          break;
        }
        default: {
          // Every action a world object can offer must be handled above (compile-time check).
          const unhandled: never = action;
          chat(`Nothing happens. (${String(unhandled)})`);
        }
      }
    },
    [curriculum, world, travelTo, island],
  );

  const islandRival = useMemo(() => ({ name: island.rival, tier: island.tier, label: "Exchange duel", onWin: () => void beatRival(island) }), [island]);

  /** Sets sail: pays the Focus, switches island, stamps the passport on landing. */
  const sail = useCallback(
    (to: IslandSpec) => {
      if (!beginVoyage(to)) return;
      abandonRace();
      setWindowState(null);
      setLocation({ place: "island", islandId: to.id, byBoat: true });
      if (to.kind === "home") chat("You sail home to your own campus.");
      else {
        chat(`You sail to ${to.name}.`);
        window.setTimeout(() => {
          if (landOn(to)) startCinematic([to.name, to.blurb, `${to.rival} waits in the exchange hall.`], 6);
        }, 900);
      }
    },
    [],
  );

  const handlers: SceneHandlers = useMemo(() => ({ onInteract: interact, onContextMenu: setMenu }), [interact]);

  const panelActions: SidePanelActions = {
    openSkill: (subjectId) => setWindowState({ kind: "codex", subjectId }),
    openQuest: (assessmentId) => setWindowState({ kind: "quest", assessmentId }),
    openCodex: (subjectId) => setWindowState({ kind: "codex", subjectId }),
    useItem: (index: number, item: InventoryItem) => {
      if (item.id === "xp-lamp") setWindowState({ kind: "lamp", itemIndex: index });
      else if (item.id === "tome" && item.subjectId) setWindowState({ kind: "codex", subjectId: item.subjectId });
      else if (item.id === "graduation-cape") chat("You swirl the Graduation Cape around your shoulders. You earned this.");
      else chat("Nothing interesting happens.");
    },
    examineItem: (item) =>
      chat(
        item.id === "xp-lamp"
          ? "A lamp of insight. Rub it to gain experience in a skill of your choice."
          : item.id === "tome"
            ? `Notes you've gathered studying. ${item.quantity} chapter${item.quantity === 1 ? "" : "s"}.`
            : item.id === "focus-candle"
              ? "Proof of hours spent in focused study."
              : item.id === "graduation-cape"
                ? "Awarded to those who complete every quest of the semester."
                : item.name,
      ),
    dropItem,
    toggleSound: () => realmStore.set((s) => ({ ...s, settings: { ...s.settings, sound: !s.settings.sound } })),
    openWardrobe: () => setWindowState({ kind: "wardrobe" }),
    toggleGraphics: () =>
      realmStore.set((s) => ({ ...s, settings: { ...s.settings, graphics: s.settings.graphics === "high" ? "ultra" : s.settings.graphics === "ultra" ? "low" : "high" } })),
    exportSave: () => {
      const blob = new Blob([realmStore.exportJson()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `realm-of-scholars-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      chat("Your save has been exported.");
    },
    importSave: () => fileInput.current?.click(),
    reEnrol: () => setWindowState({ kind: "confirm-reenrol" }),
    openClassic: () => {
      try {
        localStorage.setItem("unigame.mode", "classic");
      } catch {
        // ignore
      }
      window.location.reload();
    },
    showControls: () => setWindowState({ kind: "controls" }),
    openGrimoire: () => setWindowState({ kind: "grimoire" }),
    openSpellbook: () => setWindowState({ kind: "spellbook" }),
    openCalendar: () => setWindowState({ kind: "calendar" }),
    openGroup: () => setWindowState({ kind: "group" }),
    toggleMusic: () => realmStore.set((s) => ({ ...s, settings: { ...s.settings, music: !s.settings.music } })),
    openGrades: () => setWindowState({ kind: "grades" }),
    openMail: () => setWindowState({ kind: "mail" }),
    goHome: () => {
      runtime.teleport?.(world.spawn.x, world.spawn.z);
      chat("You teleport home to the Citadel.");
    },
    toggleReminders: async () => {
      if (realmStore.get().settings.reminders) {
        realmStore.set((s) => ({ ...s, settings: { ...s.settings, reminders: false } }));
        return;
      }
      if (await enableReminders()) {
        realmStore.set((s) => ({ ...s, settings: { ...s.settings, reminders: true } }));
        chat("Reminders on: deadlines in the next 3 days, Grimoire reviews and a streak at risk, while the game is open.");
      } else chat("Notifications are blocked for this site. Allow them in your browser's site settings to get reminders.");
    },
    setSetting: (patch) => realmStore.set((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
  };

  const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const next = sanitizeState(parsed);
      if (!next.player) throw new Error("no player");
      realmStore.replace(next);
      chat("Save imported.");
    } catch {
      chat("That file isn't a Realm of Scholars save.");
    }
  };

  const closeWindow = () => setWindowState(null);

  const renderWindow = () => {
    if (!windowState) return null;
    switch (windowState.kind) {
      case "quest":
        return <QuestJournal assessmentId={windowState.assessmentId} onClose={closeWindow} />;
      case "board":
        return <QuestBoardWindow subjectId={windowState.subjectId} onClose={closeWindow} onOpenQuest={(id) => setWindowState({ kind: "quest", assessmentId: id })} />;
      case "study":
        return (
          <StudyWindow
            subjectId={windowState.subjectId}
            week={windowState.week}
            onClose={closeWindow}
            onTrial={() => setWindowState({ kind: "duel", subjectId: windowState.subjectId, week: windowState.week })}
            onExplain={() => setWindowState({ kind: "explain", subjectId: windowState.subjectId, week: windowState.week })}
          />
        );
      case "codex":
        return (
          <CodexWindow
            subjectId={windowState.subjectId}
            onClose={closeWindow}
            onExplain={() => setWindowState({ kind: "explain", subjectId: windowState.subjectId })}
            onAddQuestions={() => setWindowState({ kind: "add-questions", subjectId: windowState.subjectId })}
          />
        );
      case "duel": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <QuizDuel subject={subject} week={windowState.week} onClose={closeWindow} /> : null;
      }
      case "match": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <ScrollMatch subject={subject} onClose={closeWindow} /> : null;
      }
      case "scramble": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <RuneScramble subject={subject} onClose={closeWindow} /> : null;
      }
      case "meditate": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <Meditation subject={subject} onClose={closeWindow} /> : null;
      }
      case "lamp":
        return <LampWindow itemIndex={windowState.itemIndex} onClose={closeWindow} />;
      case "graduation":
        return <GraduationWindow onClose={closeWindow} />;
      case "daily":
        return <DailyWindow onClose={closeWindow} />;
      case "controls":
        return <ControlsWindow onClose={closeWindow} />;
      case "grimoire":
        return <GrimoireWindow onClose={closeWindow} />;
      case "grades":
        return <GradesWindow onClose={closeWindow} />;
      case "trophies":
        return <TrophyHallWindow onClose={closeWindow} onYearbook={() => setWindowState({ kind: "yearbook" })} />;
      case "gather":
        return <GatherGame key={windowState.nodeName} resourceId={windowState.resourceId} nodeName={windowState.nodeName} onClose={closeWindow} />;
      case "cook":
        return <CookWindow onClose={closeWindow} />;
      case "craft":
        return <CraftWindow onClose={closeWindow} />;
      case "arcade":
        return (
          <ArcadeWindow
            onClose={closeWindow}
            onTowerDefence={() => setWindowState({ kind: "tower-defence" })}
            onArena={(game) => setWindowState({ kind: "arena", game })}
            onRace={() => {
              if (startRace(world, runtime.player.x, runtime.player.z)) closeWindow();
            }}
            onSkyRace={() => {
              if (startRace(world, runtime.player.x, runtime.player.z, true)) {
                closeWindow();
                if (!runtime.player.flying) runtime.toggleBroom?.();
              }
            }}
          />
        );
      case "arena":
        return <ArenaWindow subjects={curriculum.subjects} initialGame={windowState.game} onClose={closeWindow} onBack={() => setWindowState({ kind: "arcade" })} />;
      case "tower-defence":
        return <TowerDefence onClose={closeWindow} />;
      case "dorm":
        return <DormWindow onClose={closeWindow} onWardrobe={() => setWindowState({ kind: "wardrobe", back: "dorm" })} />;
      case "sail":
        return <SailWindow islands={islands} here={island.id} onSail={sail} onClose={closeWindow} />;
      case "mail":
        return <MailWindow onClose={closeWindow} />;
      case "spellbook":
        return <SpellbookWindow onClose={closeWindow} />;
      case "cauldron":
        return <CauldronWindow onClose={closeWindow} />;
      case "textbook":
        return <TextbookWindow onClose={closeWindow} />;
      case "yearbook":
        return <YearbookWindow onClose={closeWindow} />;
      case "timetable":
        return <TimetableWindow onClose={closeWindow} />;
      case "study-room":
        return <StudyRoomWindow onClose={closeWindow} onStarted={(subjectId) => setWindowState({ kind: "meditate", subjectId })} />;
      case "secret":
        return <SecretDoorWindow doorId={windowState.doorId} onClose={closeWindow} />;
      case "ladder":
        return (
          <LadderWindow
            onClose={closeWindow}
            onChallenge={() => {
              const next = nextOpponent(realmStore.get());
              if (!next) return;
              setWindowState(null);
              setDialogue({
                speaker: next.name,
                side: "npc",
                pages: [`Rank ${next.rank}, ${next.house}. Pick your subject and I'll take you on in it.`],
                options: [
                  ...curriculum.subjects.map((sub) => ({ label: sub.name, run: () => { setDialogue(null); setWindowState({ kind: "ladder-duel", subjectId: sub.id }); } })),
                  { label: "Not today.", run: () => setDialogue(null) },
                ],
              });
            }}
          />
        );
      case "ladder-duel": {
        const subject = subjectOf(windowState.subjectId);
        const next = nextOpponent(realmStore.get());
        return subject && next ? (
          <QuizDuel subject={subject} week={null} rival={{ name: next.name, tier: opponentTier(next.rank), label: `Duelling club, rank ${next.rank}`, onWin: () => void winLadderDuel() }} onClose={closeWindow} />
        ) : null;
      }
      case "noticeboard":
        return (
          <NoticeboardWindow
            onClose={closeWindow}
            onOpenQuest={(id) => setWindowState({ kind: "quest", assessmentId: id })}
            onDaily={() => setWindowState({ kind: "daily" })}
            onGrimoire={() => setWindowState({ kind: "grimoire" })}
          />
        );
      case "parkour":
      case "archery":
      case "pingpong": {
        const Game = windowState.kind === "parkour" ? ParkourGame : windowState.kind === "archery" ? ArcheryGame : PingPongGame;
        return (
          <Suspense fallback={<div className="realm-loading">Loading…</div>}>
            <Game onClose={closeWindow} />
          </Suspense>
        );
      }
      case "lecture":
        return <LectureWindow subjects={curriculum.subjects} aiAvailable={aiAvailable} lecternId={windowState.lecternId} seat={lectureSeat} onClose={closeWindow} />;
      case "rival": {
        const subject = subjectOf(windowState.subjectId);
        return subject && island.kind !== "home" ? <QuizDuel subject={subject} week={null} rival={islandRival} onClose={closeWindow} /> : null;
      }
      case "wardrobe":
        return (
          <WardrobeWindow
            title={windowState.first ? "Make your character" : "Wardrobe"}
            doneLabel={windowState.first ? "Done, let's go" : "Done"}
            onClose={() => {
              // Closing the first-time creator keeps whatever is shown, so it doesn't open again.
              if (windowState.first && !realmStore.get().player?.appearance) {
                realmStore.set((s) => (s.player ? { ...s, player: { ...s.player, appearance: defaultAppearance("female") } } : s));
              }
              setWindowState(windowState.back === "dorm" ? { kind: "dorm" } : null);
            }}
          />
        );
      case "library":
        return (
          <LibraryWindow
            name={world.hub.libraryName}
            onClose={closeWindow}
            open={{
              grimoire: () => setWindowState({ kind: "grimoire" }),
              grades: () => setWindowState({ kind: "grades" }),
              calendar: () => setWindowState({ kind: "calendar" }),
              codex: (subjectId) => setWindowState({ kind: "codex", subjectId }),
              mock: (subjectId) => setWindowState({ kind: "mock", subjectId }),
              explain: (subjectId) => setWindowState({ kind: "explain", subjectId }),
              addQuestions: (subjectId) => setWindowState({ kind: "add-questions", subjectId }),
              textbook: () => setWindowState({ kind: "textbook" }),
              timetable: () => setWindowState({ kind: "timetable" }),
              studyRoom: () => setWindowState({ kind: "study-room" }),
            }}
          />
        );
      case "mock": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <MockExam subject={subject} onClose={closeWindow} /> : null;
      }
      case "workshop": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <Workshop subject={subject} kind={windowState.game} onClose={closeWindow} /> : null;
      }
      case "explain": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <ExplainWindow subject={subject} aiAvailable={aiAvailable} initialWeek={windowState.week} onClose={closeWindow} /> : null;
      }
      case "add-questions": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <AddQuestionsWindow subject={subject} onClose={closeWindow} /> : null;
      }
      case "calendar":
        return <CalendarImportWindow onClose={closeWindow} />;
      case "shop":
        return <ShopWindow onClose={closeWindow} />;
      case "group":
        return <GroupWindow onClose={closeWindow} />;
      case "tutor-chat": {
        const subject = subjectOf(windowState.subjectId);
        return subject ? <TutorChatWindow subject={subject} tutorName={windowState.tutorName} aiAvailable={aiAvailable} onClose={closeWindow} /> : null;
      }
      case "boss": {
        const subject = subjectOf(windowState.subjectId);
        const assessment = subject?.assessments.find((a) => a.id === windowState.assessmentId);
        return subject && assessment ? <QuizDuel subject={subject} week={null} boss={assessment} onClose={closeWindow} /> : null;
      }
      case "quest-complete":
        return (
          <Window title="Quest complete" onClose={closeWindow} className="quest-complete" width={460}>
            <div className="parchment qc-scroll">
              <p className="qc-title">{windowState.title}</p>
              <p>Quest complete. Well done.</p>
              <p className="qc-points">Quest Points: +{windowState.questPoints}</p>
              <h4>You are awarded:</h4>
              <ul>
                <li>
                  {windowState.xp.toLocaleString()} {windowState.skillName} XP
                </li>
                <li>{windowState.questPoints * 60} coins</li>
                <li>A Lamp of Insight</li>
              </ul>
            </div>
          </Window>
        );
      case "confirm-reenrol":
        return (
          <Window title="Re-enrol?" onClose={closeWindow}>
            <p>Starting a new enrolment rebuilds the realm from new subjects. Your current skills, quests and items will be cleared.</p>
            <p className="muted small">Tip: export your save first from the Options tab if you want to keep a copy.</p>
            <div className="row">
              <button
                type="button"
                className="rs-button danger"
                onClick={() => {
                  closeWindow();
                  resetRealm();
                }}
              >
                Start a new enrolment
              </button>
              <button type="button" className="rs-button secondary" onClick={closeWindow}>
                Cancel
              </button>
            </div>
          </Window>
        );
      default: {
        // Every window kind must be drawn above (compile-time check).
        const unhandled: never = windowState;
        return unhandled;
      }
    }
  };

  const focusSubject = focus ? subjectOf(focus.subjectId) : undefined;

  return (
    <div className={`realm-game ${a11y}`} onContextMenu={(e) => e.preventDefault()}>
      {siege ? <div className="rs-siege" role="status">Exam-week siege: every deadline boss is awake. Clear them all for a 1,000-coin bonus.</div> : null}
      <RealmScene world={world} look={player.look} avatar={player.avatar ?? "knight"} handlers={handlers} quality={graphics} paused={fullScreenGame} />
      <HoverText />
      <NearbyPrompt />
      <Minimap
        world={world}
        onHome={() => {
          runtime.teleport?.(world.spawn.x, world.spawn.z);
          chat("You teleport home to the Citadel.");
        }}
      />
      <XpDrops />
      <TopBar
        world={world}
        subjects={curriculum.subjects}
        meditation={focus && focusSubject ? { label: `Focus: ${focusSubject.code || focusSubject.name}`, onOpen: () => setWindowState({ kind: "meditate", subjectId: focus.subjectId }) } : null}
      >
        {world.mode === "island" ? <WeatherChip /> : null}
      </TopBar>
      <LevelUpBanner />
      <ChatBox messages={messages} dialogue={dialogue} onDialogueDone={closeDialogue} playerName={player.name} />
      <SidePanel actions={panelActions} />
      <TouchControls />
      <SceneLoader placeName={world.hub.plazaName} />
      <FocusPops />
      <CombatHud onOpenSpellbook={() => setWindowState({ kind: "spellbook" })} />
      <RaceHud />
      <EmoteWheel />
      <AreaBanner world={world} subjects={curriculum.subjects} />
      <CinematicOverlay />
      <Crosshair />
      <StaminaBar />
      {showFps ? <FpsMeter /> : null}
      {isExpo() ? <ExpoBar world={world} subjects={curriculum.subjects} /> : null}
      {menu ? <ContextMenu request={menu} onClose={() => setMenu(null)} /> : null}
      {renderWindow()}
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onImport} />
    </div>
  );
}
