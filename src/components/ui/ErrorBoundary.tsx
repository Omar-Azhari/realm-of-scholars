/**
 * Top-level error boundary (RC1 Part 6). Catches render crashes and failed
 * lazy-chunk loads (the two ways a React tree dies) and shows a friendly
 * recovery panel instead of a blank page. Never shows stack traces — the
 * details go to the console for developers only. Saved progress lives in
 * localStorage, so a reload is always safe.
 */

import { Component, type ReactNode } from "react";

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Developers get the details; users never do.
    console.error("UniGame recovered from an error:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app-error-panel" role="alert">
        <h1>Something went wrong</h1>
        <p>
          Part of UniGame failed to load — usually a temporary connection hiccup while fetching an
          update. Your saved progress is safe on this device.
        </p>
        <p>Reloading the page almost always fixes this.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload UniGame
        </button>
      </div>
    );
  }
}
