import { Suspense, lazy } from "react";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";

/**
 * Realm of Scholars (the RuneScape-style fantasy game, src/realm/) is the
 * main experience. The classic campus remains available — chosen from the
 * realm's Options tab, or with `?classic` in the URL — and every classic
 * save is untouched by the realm, which keeps its own save.
 */
const RealmApp = lazy(() => import("./realm/RealmApp"));
const ClassicApp = lazy(() => import("./ClassicApp"));

function readMode(): "realm" | "classic" {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("classic")) return "classic";
    if (params.has("realm")) {
      localStorage.removeItem("unigame.mode");
      return "realm";
    }
    return localStorage.getItem("unigame.mode") === "classic" ? "classic" : "realm";
  } catch {
    return "realm";
  }
}

function returnToRealm() {
  try {
    localStorage.removeItem("unigame.mode");
  } catch {
    // ignore
  }
  window.location.href = "/";
}

export default function App() {
  if (readMode() === "realm") {
    return (
      <ErrorBoundary>
        <div className="realm-root">
          <Suspense fallback={<div className="realm-loading">Loading the realm…</div>}>
            <RealmApp />
          </Suspense>
        </div>
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <ClassicApp />
      </Suspense>
      <button type="button" className="back-to-realm" onClick={returnToRealm}>
        ⚔ Return to the Realm
      </button>
    </ErrorBoundary>
  );
}
