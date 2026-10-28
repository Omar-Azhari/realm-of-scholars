/**
 * Menu panel (Phase 15B) — the single home for secondary systems, replacing
 * the old Profile and Settings primary tabs. A readable text-labelled list
 * opens each section as a sub-view (progressive disclosure): Profile (with
 * achievements, statistics, relationships, timeline, journal), Settings (with
 * accessibility + save export/import), and Help. Room objects can deep-open a
 * section via the panel-section hint (e.g. the trophy shelf → Achievements).
 */

import { Suspense, useState } from "react";
import { ChevronRight, ArrowLeft, CircleUserRound, Medal, BarChart3, Settings as SettingsIcon, HelpCircle, Save, FileUp, Undo2, CalendarClock, Shirt, LayoutGrid, Signpost, type LucideIcon } from "lucide-react";
import { SettingsScreen } from "../../../screens/SettingsScreen";
import { StudyPlannerScreen } from "../../../screens/StudyPlannerScreen";
import { ProfilePanel, type ProfileSub } from "./ProfilePanel";
import { useWorldUi } from "../../../world/WorldUiContext";
import { useSaveData } from "../../../state/SaveDataContext";
import { CharacterCreatorLazy } from "../../../world/CharacterCreatorLazy";
import { RoomEditorLazy } from "../../../world/RoomEditorLazy";
import { createDefaultAppearance, createDefaultPersonality, createDefaultRoomCustomisation } from "../../../data/playerIdentityDefaults";
import { SkeletonPanel } from "../../ui/SkeletonPanel";
import { CampusDirectoryPanel } from "../../../game3d/campus/CampusDirectoryPanel";

type View = "home" | "profile" | "settings" | "help" | "study-planner" | "character-creator" | "room-planner" | "campus-directory";

interface Item {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  go: () => void;
}

export function MenuPanel() {
  const { panelSection, openSemesterSetup, closePanel, requestCampusTravel } = useWorldUi();
  const { saveData, updatePlayerIdentity, canUndoLastSemesterImport, undoLastSemesterImport } = useSaveData();
  // A room object may deep-open a section (e.g. trophy shelf → achievements).
  const [view, setView] = useState<View>(
    panelSection === "achievements" || panelSection === "statistics" ? "profile" : "home"
  );
  const [profileSub, setProfileSub] = useState<ProfileSub>(
    panelSection === "achievements" ? "achievements" : "overview"
  );

  const openProfile = (sub: ProfileSub) => {
    setProfileSub(sub);
    setView("profile");
  };

  const items: Item[] = [
    { key: "profile", label: "Profile", hint: "Identity & progression", icon: CircleUserRound, go: () => openProfile("overview") },
    { key: "achievements", label: "Achievements", hint: "Badges you've earned", icon: Medal, go: () => openProfile("achievements") },
    { key: "statistics", label: "Statistics", hint: "Study time, streaks, XP", icon: BarChart3, go: () => openProfile("overview") },
    {
      key: "study-planner",
      label: "Study Planner",
      hint: "Weekly modules, assessments & exams at a glance",
      icon: CalendarClock,
      go: () => setView("study-planner"),
    },
    {
      key: "character-creator",
      label: "Character Creator",
      hint: "Change your appearance and personality — same as the in-world Wardrobe",
      icon: Shirt,
      go: () => setView("character-creator"),
    },
    {
      key: "room-planner",
      label: "Room Planner",
      hint: "Change your room's theme and furniture — same as the in-world Room Planner board",
      icon: LayoutGrid,
      go: () => setView("room-planner"),
    },
    // Phase 20F Part 12 — the Menu-level Campus Directory accessibility
    // shortcut, only meaningful when the 3D Campus is the active renderer
    // (the legacy 2D world has no equivalent building-to-building travel
    // concept). "World walking remains the primary experience" per the
    // brief — this is an alternative, not a replacement; it opens the
    // exact same directory list the in-world signpost does.
    ...(saveData.settings.worldRenderer === "experimental-3d"
      ? [
          {
            key: "campus-directory",
            label: "Campus Directory",
            hint: "Travel to any campus building — the same list as the in-world signpost",
            icon: Signpost,
            go: () => setView("campus-directory"),
          },
        ]
      : []),
    {
      key: "semester-setup",
      label: "Semester Setup",
      hint: "Import subjects & deadlines from your documents",
      icon: FileUp,
      go: () => {
        closePanel();
        openSemesterSetup();
      },
    },
    ...(canUndoLastSemesterImport()
      ? [
          {
            key: "undo-import",
            label: "Undo last semester import",
            hint: "Restore your semester to how it was just before that import",
            icon: Undo2,
            go: () => {
              if (window.confirm("Undo the last semester import? This restores your save to how it was immediately before that import.")) {
                undoLastSemesterImport();
              }
            },
          },
        ]
      : []),
    { key: "settings", label: "Settings", hint: "Preferences & accessibility", icon: SettingsIcon, go: () => setView("settings") },
    { key: "help", label: "Help", hint: "How to play", icon: HelpCircle, go: () => setView("help") },
    { key: "save", label: "Save data", hint: "Export & import your progress", icon: Save, go: () => setView("settings") },
  ];

  if (view !== "home") {
    return (
      <div className="menu-panel">
        <button type="button" className="menu-back" onClick={() => setView("home")}>
          <ArrowLeft size={15} aria-hidden="true" /> Menu
        </button>
        {view === "profile" ? <ProfilePanel initialSub={profileSub} /> : null}
        {view === "settings" ? <SettingsScreen /> : null}
        {view === "help" ? <HelpView /> : null}
        {view === "study-planner" ? <StudyPlannerScreen /> : null}
        {view === "character-creator" ? (
          <Suspense fallback={<SkeletonPanel lines={4} minHeight={320} />}>
            <CharacterCreatorLazy
              initialAppearance={saveData.playerIdentity?.appearance ?? createDefaultAppearance()}
              initialPersonality={saveData.playerIdentity?.personality ?? createDefaultPersonality()}
              onDone={(appearance, personality) => {
                updatePlayerIdentity({ appearance, personality });
                setView("home");
              }}
              onCancel={() => setView("home")}
            />
          </Suspense>
        ) : null}
        {view === "room-planner" ? (
          // Accessibility entry (Phase 20D Part 11) — same Room Edit Mode
          // reachable via the in-world Room Planner board, so keyboard/menu
          // navigation never requires physically walking to it. No live 3D
          // preview here (this panel renders above either renderer, legacy
          // 2D included, which has no 3D room to preview into) — editing
          // and Apply/Cancel work identically; only the live-preview extra
          // is unavailable outside the 3D world's own board.
          <Suspense fallback={<SkeletonPanel lines={4} minHeight={320} />}>
            <RoomEditorLazy
              initialTheme={saveData.playerIdentity?.preferredRoomTheme ?? "modern-campus"}
              initialRoomCustomisation={saveData.playerIdentity?.roomCustomisation ?? createDefaultRoomCustomisation()}
              onDraftChange={() => {}}
              onCancel={() => setView("home")}
              onApply={(theme, roomCustomisation) => {
                updatePlayerIdentity({ preferredRoomTheme: theme, roomCustomisation });
                setView("home");
              }}
            />
          </Suspense>
        ) : null}
        {view === "campus-directory" ? (
          <CampusDirectoryPanel
            onSelect={(action) => {
              requestCampusTravel(action);
              closePanel();
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="menu-panel">
      <ul className="menu-list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <button type="button" onClick={item.go}>
                <Icon size={18} aria-hidden="true" className="menu-item-icon" />
                <span className="menu-item-text">
                  <span className="menu-item-label">{item.label}</span>
                  <span className="menu-item-hint">{item.hint}</span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HelpView() {
  return (
    <section className="screen menu-help">
      <h2 className="screen-title">How to play</h2>
      <ol className="menu-help-steps">
        <li>
          <strong>Move around campus.</strong> Click the floor to walk, or use WASD / arrow keys.
        </li>
        <li>
          <strong>Open Tasks</strong> to see your recommended next task and choose what to do.
        </li>
        <li>
          <strong>Follow the tracked objective</strong> — walk to the highlighted room or object and
          press <kbd>E</kbd> (or click) to interact.
        </li>
      </ol>
      <p className="screen-lede">
        The four tabs on the right open Tasks, Subjects, Calendar and this Menu. Press{" "}
        <kbd>Esc</kbd> to close any panel. Doors lead between rooms; the study desk starts a Focus
        session; the exit returns you to Campus HQ.
      </p>
    </section>
  );
}
