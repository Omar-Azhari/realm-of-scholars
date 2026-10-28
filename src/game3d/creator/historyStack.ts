/**
 * A tiny, framework-agnostic undo/redo stack (Phase 20B, Part 3/13). Pure
 * data in, pure data out — no React — so the Character Creator's
 * undo/redo behaviour is directly unit-testable in a plain Node harness
 * (scripts/verify-phase20b-character.ts) without mounting any component.
 * `CharacterCreator.tsx` wraps this in a single `useState` call; all the
 * actual logic lives here.
 */

export interface HistoryStack<T> {
  entries: T[];
  index: number;
}

export function createHistoryStack<T>(initial: T): HistoryStack<T> {
  return { entries: [initial], index: 0 };
}

/** Pushing after an undo discards the redo branch — standard undo/redo semantics, matching every text editor. */
export function pushHistory<T>(stack: HistoryStack<T>, next: T): HistoryStack<T> {
  return { entries: [...stack.entries.slice(0, stack.index + 1), next], index: stack.index + 1 };
}

export function undoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  return stack.index > 0 ? { ...stack, index: stack.index - 1 } : stack;
}

export function redoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  return stack.index < stack.entries.length - 1 ? { ...stack, index: stack.index + 1 } : stack;
}

export function currentHistoryValue<T>(stack: HistoryStack<T>): T {
  return stack.entries[stack.index];
}

export function canUndoHistory<T>(stack: HistoryStack<T>): boolean {
  return stack.index > 0;
}

export function canRedoHistory<T>(stack: HistoryStack<T>): boolean {
  return stack.index < stack.entries.length - 1;
}
