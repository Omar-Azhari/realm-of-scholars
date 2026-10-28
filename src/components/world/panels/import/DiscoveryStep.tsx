/**
 * Step 2a — Searching university (Phase 18B, Part 5; backend/fallback mode
 * added Phase 18C, Part 9; real discovery states added Phase 18D, Part 15).
 *
 * Shows a checklist of REAL, discrete states rather than a fake percentage —
 * the backend call is one atomic request/response with no server-sent
 * progress, so a numeric bar here would have to invent intermediate values
 * it can't actually observe. Every state below is genuinely true at the
 * moment it's shown: "validating"/"checking-patterns" are real client-side
 * checks that run before the network call; "searching" covers the single
 * in-flight request honestly (it does NOT claim to observe server-internal
 * sub-phases it has no visibility into); the terminal per-subject states
 * (found/partial/ambiguous/not-found/error) are read directly from the
 * response once it arrives.
 */

import { Loader2, ShieldCheck, Globe, Check, CircleDashed } from "lucide-react";

export type DiscoveryPhase = "validating" | "checking-patterns" | "searching" | "done";

const PHASE_ORDER: DiscoveryPhase[] = ["validating", "checking-patterns", "searching"];
const PHASE_LABELS: Record<DiscoveryPhase, string> = {
  validating: "Validating your request",
  "checking-patterns": "Checking verified university patterns",
  searching: "Searching official sources and extracting information",
  done: "Done",
};

export function DiscoveryStep({
  universityName,
  phase,
  mode,
  subjectStates,
  onCancel,
}: {
  universityName: string;
  phase: DiscoveryPhase;
  mode: "backend" | "direct" | null;
  /** Per-subject query label -> live status, filled in only once the response starts arriving (empty while still validating/checking/searching). */
  subjectStates: Array<{ label: string; status: "pending" | "found" | "partial" | "ambiguous" | "not-found" | "error" }>;
  onCancel: () => void;
}) {
  const currentIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div className="setup-step" data-testid="discovery-step">
      <p className="setup-lede">Searching {universityName}'s public handbook…</p>

      <ol className="setup-discovery-phases" aria-label="Discovery progress">
        {PHASE_ORDER.map((p, i) => {
          const isDone = currentIndex > i;
          const isActive = currentIndex === i;
          return (
            <li key={p} className={`setup-discovery-phase${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}>
              {isDone ? (
                <Check size={14} aria-hidden="true" />
              ) : isActive ? (
                <Loader2 size={14} className="setup-spin" aria-hidden="true" />
              ) : (
                <CircleDashed size={14} aria-hidden="true" />
              )}
              <span>
                {PHASE_LABELS[p]}
                {isActive ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {subjectStates.length > 0 ? (
        <ul className="setup-discovery-subject-states" aria-label="Per-subject discovery status">
          {subjectStates.map((s) => (
            <li key={s.label} className={`setup-discovery-subject-state is-${s.status}`}>
              <span className="setup-discovery-subject-label">{s.label}</span>
              <span className="setup-discovery-subject-badge">{subjectStatusLabel(s.status)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {mode ? (
        <p className="setup-hint" data-testid="discovery-mode">
          {mode === "backend" ? (
            <>
              <ShieldCheck size={13} aria-hidden="true" /> Using UniGame's secure search service.
            </>
          ) : (
            <>
              <Globe size={13} aria-hidden="true" /> Searching directly from your browser (the secure service wasn't reachable).
            </>
          )}
        </p>
      ) : null}

      <p className="setup-hint">
        UniGame only reads official, public handbook pages for this university — never a mirror,
        forum, cached copy, or authenticated page.
      </p>

      <div className="setup-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function subjectStatusLabel(status: "pending" | "found" | "partial" | "ambiguous" | "not-found" | "error"): string {
  switch (status) {
    case "pending":
      return "Waiting…";
    case "found":
      return "Found";
    case "partial":
      return "Partial";
    case "ambiguous":
      return "Needs your review";
    case "not-found":
      return "Not found";
    case "error":
      return "Error";
  }
}
