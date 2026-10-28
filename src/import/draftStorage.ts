/**
 * Import-draft persistence (Phase 18A, Part 2/9). Lives in its OWN
 * localStorage key — never inside `UniGameSaveData` — so a large in-progress
 * candidate package can never bloat or risk the main save, and clearing it
 * is always a single, safe, isolated operation. This is why the phase needs
 * no save-version bump: see docs/PHASE_18A_IMPORT_ARCHITECTURE.md §7.
 *
 * Read/write both go through a light structural check (not a full coercer
 * tree like the main save) — a corrupt or stale draft is simply treated as
 * "no draft" rather than crashing anything.
 */

import type { AcademicImportPackage } from "./types";

export const IMPORT_DRAFT_KEY = "unigame:importDraft:v1";

function looksLikePackage(value: unknown): value is AcademicImportPackage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).importId === "string" &&
    Array.isArray((value as Record<string, unknown>).subjects)
  );
}

export function saveImportDraft(pkg: AcademicImportPackage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IMPORT_DRAFT_KEY, JSON.stringify(pkg));
  } catch {
    // Best-effort — a failed draft save never blocks the in-memory flow.
  }
}

export function loadImportDraft(): AcademicImportPackage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IMPORT_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return looksLikePackage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearImportDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(IMPORT_DRAFT_KEY);
  } catch {
    // Nothing to do — worst case the stale draft is simply overwritten next time.
  }
}
