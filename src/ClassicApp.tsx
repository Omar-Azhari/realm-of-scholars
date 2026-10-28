import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WorldShell } from "./components/world/WorldShell";
import { AssetProvider } from "./engine/AssetContext";
import { SaveDataProvider, useSaveData } from "./state/SaveDataContext";
// The world scenes are the only full routes and stay eagerly loaded so HQ
// and the subject rooms never show a loading skeleton mid-transition.
import { SemesterHomeScreen } from "./screens/SemesterHomeScreen";
import { SubjectRoomScreen } from "./screens/SubjectRoomScreen";
import { OnboardingFlow } from "./screens/OnboardingFlow";

/**
 * World-first routing (Phase 15A). Only two full routes remain — the world
 * scenes — because every former planner page is now an overlay panel opened
 * from the tab rail (see WorldShell / PanelHost). Old page paths redirect to
 * the world so existing bookmarks never 404; the assessment-detail path
 * redirects into its subject room, where the assessment board opens Tasks.
 */
const REDIRECTS_TO_HQ = [
  "calendar",
  "priority",
  "missions",
  "reminders",
  "profile",
  "journal",
  "collections",
  "timeline",
  "settings",
];

/**
 * Phase 20B — gates the whole app on `playerIdentity`: `null` means this
 * save has never been through onboarding (a genuinely fresh save; an old
 * save that predates this phase is backfilled with a non-null default
 * identity during migration instead — see `sanitizeSaveData` in
 * persistence.ts), so it's the one place "returning users skip directly
 * to Campus" is enforced. Needs to sit below `SaveDataProvider` to read
 * `useSaveData()`, which is why this is split out from `App` itself.
 */
function AppShell() {
  const { saveData } = useSaveData();

  if (saveData.playerIdentity === null) {
    return <OnboardingFlow />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<WorldShell />}>
          <Route index element={<SemesterHomeScreen />} />
          <Route path="subjects/:subjectId" element={<SubjectRoomScreen />} />
          {/* Deep assessment links land in the subject room. */}
          <Route path="subjects/:subjectId/assessments/:assessmentId" element={<SubjectRoomScreen />} />
          {REDIRECTS_TO_HQ.map((path) => (
            <Route key={path} path={path} element={<Navigate to="/" replace />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function ClassicApp() {
  return (
    <SaveDataProvider>
      <AssetProvider>
        <AppShell />
      </AssetProvider>
    </SaveDataProvider>
  );
}
