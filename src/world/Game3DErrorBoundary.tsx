/**
 * 3D Campus error boundary (Phase 20F Part 14 — error/empty states pass).
 * The app already has a top-level `ErrorBoundary` (RC1 Part 6) that catches
 * any crash and offers a full-page reload — safe, but blunt: it has no way
 * to know a crash came from the experimental 3D renderer specifically, so
 * it can't offer this renderer's own most useful recovery, switching back
 * to the legacy 2D world (which reads the exact same save, with zero data
 * loss, and has shipped far longer). This boundary sits just inside that
 * one, wrapping only `Game3DLazy` — a WebGL/Canvas failure, a failed lazy
 * chunk fetch (a genuine "failed building load"), or any other 3D-only
 * render crash is caught here first, before it would otherwise reach the
 * generic top-level fallback.
 *
 * Never exposes stack traces to the player — same discipline as the
 * top-level boundary, details go to the console only.
 */

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Layers } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Switch `settings.worldRenderer` to "legacy-2d" — the one action that reliably recovers regardless of what actually failed. */
  onUseLegacy2D: () => void;
}

interface State {
  failed: boolean;
}

export class Game3DErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("UniGame's 3D Campus recovered from an error:", error);
  }

  private handleRetry = (): void => {
    this.setState({ failed: false });
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="game3d-error-panel" role="alert">
        <AlertTriangle size={28} aria-hidden="true" />
        <h2>The 3D Campus couldn't load</h2>
        <p>
          This is usually temporary — often a connection hiccup while fetching a building. Your
          saved progress is untouched either way.
        </p>
        <div className="game3d-error-actions">
          <button type="button" onClick={this.handleRetry}>
            <RotateCcw size={15} aria-hidden="true" /> Retry
          </button>
          <button type="button" onClick={this.props.onUseLegacy2D}>
            <Layers size={15} aria-hidden="true" /> Use 2D Campus instead
          </button>
        </div>
      </div>
    );
  }
}
