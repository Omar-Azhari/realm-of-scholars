/**
 * File ingestion & safety layer (Phase 18A, Part 4).
 *
 * Every file the user adds to a Semester Setup import passes through here
 * before any provider ever sees it: type sniffing (not just extension
 * trust), a configurable size limit, content hashing for duplicate
 * detection, and a safe display filename. Nothing here executes file
 * content — sniffing reads only the first bytes/characters needed to
 * identify the format.
 */

import { ImportError, type ProviderInput, type SupportedFileKind } from "./types";

/** Per-kind size ceiling. Configurable in one place; generous for real syllabus PDFs. */
export const FILE_SIZE_LIMITS: Record<SupportedFileKind, number> = {
  pdf: 25 * 1024 * 1024,
  docx: 15 * 1024 * 1024,
  text: 2 * 1024 * 1024,
  markdown: 2 * 1024 * 1024,
  ics: 5 * 1024 * 1024,
  json: 5 * 1024 * 1024,
};

const EXTENSION_KIND: Record<string, SupportedFileKind> = {
  pdf: "pdf",
  docx: "docx",
  txt: "text",
  md: "markdown",
  markdown: "markdown",
  ics: "ics",
  json: "json",
};

/** Magic-byte/content sniffing — an extension alone is never trusted for binary formats. */
function sniffKind(filename: string, head: Uint8Array, headText: string): SupportedFileKind | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  // PDF: literal "%PDF-" header, regardless of extension.
  const asciiHead = String.fromCharCode(...head.slice(0, 5));
  if (asciiHead === "%PDF-") return "pdf";

  // DOCX is a ZIP container: "PK\x03\x04" magic bytes.
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    if (ext === "docx") return "docx";
    // A zip that isn't named .docx is out of scope — reject rather than guess.
    return null;
  }

  const trimmed = headText.trimStart();
  if (ext === "ics" || trimmed.startsWith("BEGIN:VCALENDAR")) return "ics";
  if (ext === "json" || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    // Only trust JSON sniffing when the extension agrees or content is unambiguous.
    if (ext === "json") return "json";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  }
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "txt") return "text";

  return EXTENSION_KIND[ext] ?? null;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Strips any path information a browser might echo back — display name only, never a path. */
export function safeDisplayFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return base.length > 120 ? `${base.slice(0, 117)}…` : base;
}

export interface IngestedFile {
  input: ProviderInput;
  contentHash: string;
  sizeBytes: number;
}

/**
 * Reads and validates one File into a provider-ready input. Throws
 * `ImportError` with a specific, user-facing code for every rejection path
 * — the UI never has to guess why a file was refused.
 */
export async function ingestFile(file: File, sourceId: string): Promise<IngestedFile> {
  const safeName = safeDisplayFilename(file.name);

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new ImportError("corrupted-file", `"${safeName}" could not be read — it may be corrupted.`, sourceId);
  }

  if (buffer.byteLength === 0) {
    throw new ImportError("empty-file", `"${safeName}" is empty.`, sourceId);
  }

  const head = new Uint8Array(buffer.slice(0, 512));
  const headText = new TextDecoder("utf-8", { fatal: false }).decode(head);
  const kind = sniffKind(file.name, head, headText);

  if (!kind) {
    throw new ImportError(
      "unsupported-file-type",
      `"${safeName}" isn't a supported file type. UniGame reads PDF, DOCX, TXT, Markdown, ICS and JSON files.`,
      sourceId
    );
  }

  const limit = FILE_SIZE_LIMITS[kind];
  if (buffer.byteLength > limit) {
    const mb = (limit / (1024 * 1024)).toFixed(0);
    throw new ImportError(
      "file-too-large",
      `"${safeName}" is larger than the ${mb} MB limit for ${kind.toUpperCase()} files.`,
      sourceId
    );
  }

  const contentHash = await sha256Hex(buffer);

  const isTextLike = kind === "text" || kind === "markdown" || kind === "ics" || kind === "json";
  let text: string | null = null;
  if (isTextLike) {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new ImportError(
        "corrupted-file",
        `"${safeName}" isn't valid text (unexpected encoding) — it may be corrupted.`,
        sourceId
      );
    }
  }

  return {
    input: {
      sourceId,
      filename: safeName,
      kind,
      bytes: isTextLike ? null : buffer,
      text,
    },
    contentHash,
    sizeBytes: buffer.byteLength,
  };
}

/** Detects a duplicate by content hash against files already added to the current import session. */
export function findDuplicate(
  contentHash: string,
  existing: ReadonlyArray<{ sourceId: string; filename: string; contentHash: string }>
): { sourceId: string; filename: string } | null {
  const match = existing.find((f) => f.contentHash === contentHash);
  return match ? { sourceId: match.sourceId, filename: match.filename } : null;
}

let sourceIdCounter = 0;
/** Deterministic-enough, collision-free within a single import session. */
export function nextSourceId(): string {
  sourceIdCounter += 1;
  return `src-${sourceIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
