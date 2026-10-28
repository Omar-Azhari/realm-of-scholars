/**
 * Step 2 — Import sources (Phase 18A, Part 7). A calm, honest picker: real
 * file upload for the six working providers, and the not-yet-available
 * surfaces (public web search, LMS connections) shown as clearly disabled
 * with their real availability date — never presented as equal options.
 * Duplicate files (by content hash) and corrupted/unsupported files are
 * caught here, before anything reaches a provider.
 */

import { useRef, useState } from "react";
import { AlertTriangle, Copy, FileText, GraduationCap, Upload, X } from "lucide-react";
import { ingestFile, findDuplicate, nextSourceId } from "../../../../import/ingestion";
import type { ImportSourceFile, ProviderInput, SupportedFileKind } from "../../../../import/types";

export interface StagedFile {
  sourceId: string;
  filename: string;
  kind: SupportedFileKind | null;
  sizeBytes: number;
  contentHash: string | null;
  status: "ready" | "duplicate" | "error";
  message: string | null;
  input: ProviderInput | null;
}

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown,.json,.ics";

export function SourcesStep({
  stagedFiles,
  onStagedFilesChange,
  onProcess,
  onContinueManually,
  onConnectCanvas,
  onConnectMoodle,
  onBack,
}: {
  stagedFiles: StagedFile[];
  onStagedFilesChange: (files: StagedFile[]) => void;
  onProcess: (inputs: ProviderInput[], sourceFiles: ImportSourceFile[]) => void;
  onContinueManually: () => void;
  onConnectCanvas: () => void;
  /** Optional — only offered when Study Details identified an institution whose LMS is Moodle (Phase 18F). */
  onConnectMoodle?: () => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    const next = [...stagedFiles];
    for (const file of Array.from(fileList)) {
      const sourceId = nextSourceId();
      try {
        const ingested = await ingestFile(file, sourceId);
        const dup = findDuplicate(
          ingested.contentHash,
          next.filter((f) => f.status === "ready").map((f) => ({ sourceId: f.sourceId, filename: f.filename, contentHash: f.contentHash ?? "" }))
        );
        if (dup) {
          next.push({
            sourceId,
            filename: ingested.input.filename,
            kind: ingested.input.kind,
            sizeBytes: ingested.sizeBytes,
            contentHash: ingested.contentHash,
            status: "duplicate",
            message: `Same content as "${dup.filename}" — skipped.`,
            input: null,
          });
        } else {
          next.push({
            sourceId,
            filename: ingested.input.filename,
            kind: ingested.input.kind,
            sizeBytes: ingested.sizeBytes,
            contentHash: ingested.contentHash,
            status: "ready",
            message: null,
            input: ingested.input,
          });
        }
      } catch (error) {
        next.push({
          sourceId,
          filename: file.name,
          kind: null,
          sizeBytes: file.size,
          contentHash: null,
          status: "error",
          message: error instanceof Error ? error.message : "This file couldn't be read.",
          input: null,
        });
      }
    }
    onStagedFilesChange(next);
    setBusy(false);
  }

  function removeFile(sourceId: string) {
    onStagedFilesChange(stagedFiles.filter((f) => f.sourceId !== sourceId));
  }

  const readyFiles = stagedFiles.filter((f) => f.status === "ready" && f.input);

  function handleProcess() {
    const inputs = readyFiles.map((f) => f.input as ProviderInput);
    const sourceFiles: ImportSourceFile[] = readyFiles.map((f) => ({
      sourceId: f.sourceId,
      filename: f.filename,
      kind: f.kind as SupportedFileKind,
      sizeBytes: f.sizeBytes,
      contentHash: f.contentHash ?? "",
      providerId: "",
      importedAt: new Date().toISOString(),
    }));
    onProcess(inputs, sourceFiles);
  }

  return (
    <div className="setup-step">
      <p className="setup-lede">Add whatever you have — subject guides, a syllabus, or a calendar export.</p>

      <div className="setup-source-grid">
        <button type="button" className="setup-source-card" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload size={20} aria-hidden="true" />
          <span>Upload subject guides</span>
          <span className="setup-source-hint">PDF, Word, text, Markdown or JSON</span>
        </button>
        <button type="button" className="setup-source-card" onClick={() => inputRef.current?.click()} disabled={busy}>
          <FileText size={20} aria-hidden="true" />
          <span>Upload calendar</span>
          <span className="setup-source-hint">.ics file from your LMS or timetable</span>
        </button>
        <button type="button" className="setup-source-card" onClick={onConnectCanvas} disabled={busy}>
          <GraduationCap size={20} aria-hidden="true" />
          <span>Connect Canvas</span>
          <span className="setup-source-hint">Read-only — courses, assignments, modules, calendar</span>
        </button>
        {onConnectMoodle ? (
          <button type="button" className="setup-source-card" onClick={onConnectMoodle} disabled={busy}>
            <GraduationCap size={20} aria-hidden="true" />
            <span>Connect La Trobe LMS</span>
            <span className="setup-source-hint">Moodle detected — read-only when available</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="setup-file-input"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
        aria-label="Choose files to import"
      />

      {stagedFiles.length > 0 ? (
        <ul className="setup-file-list" data-testid="staged-files">
          {stagedFiles.map((f) => (
            <li key={f.sourceId} className={`setup-file-row setup-file-row--${f.status}`}>
              {f.status === "ready" ? <FileText size={14} aria-hidden="true" /> : null}
              {f.status === "duplicate" ? <Copy size={14} aria-hidden="true" /> : null}
              {f.status === "error" ? <AlertTriangle size={14} aria-hidden="true" /> : null}
              <span className="setup-file-name">{f.filename}</span>
              {f.message ? <span className="setup-file-message">{f.message}</span> : null}
              <button type="button" onClick={() => removeFile(f.sourceId)} aria-label={`Remove ${f.filename}`}>
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="setup-actions">
        <button type="button" className="button--primary" onClick={handleProcess} disabled={readyFiles.length === 0 || busy}>
          Process {readyFiles.length} file{readyFiles.length === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={onContinueManually}>
          Continue manually
        </button>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
