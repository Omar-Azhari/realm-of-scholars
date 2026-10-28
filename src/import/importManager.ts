/**
 * Runs a set of already-ingested files (or a manual-entry payload) through
 * their matching providers, collects progress/cancellation, and hands the
 * combined output to the merge engine to produce one AcademicImportPackage
 * (Phase 18A, Part 3 "the import manager must be able to combine output
 * from several providers into one candidate package").
 */

import type { AcademicProvider, ImportedSourcePackage, ImportProgressEvent, ImportSourceFile, ProviderInput } from "./types";
import { ImportError } from "./types";
import { findProviderForKind } from "./providers/registry";
import { mergeSourcePackages, type ImportPackageMeta } from "./merge/mergeEngine";
import type { AcademicImportPackage } from "./types";

export interface RunOneResult {
  sourceId: string;
  ok: boolean;
  sourcePackage: ImportedSourcePackage | null;
  error: ImportError | null;
}

export interface ImportRunOptions {
  providers: AcademicProvider[];
  inputs: ProviderInput[];
  sourceFiles: ImportSourceFile[];
  meta: ImportPackageMeta;
  signal: AbortSignal;
  onProgress: (event: ImportProgressEvent) => void;
}

/** Runs every input through its provider, sequentially (predictable progress, bounded memory). */
export async function runImport(options: ImportRunOptions): Promise<{ results: RunOneResult[]; pkg: AcademicImportPackage }> {
  const { providers, inputs, sourceFiles, meta, signal, onProgress } = options;
  const results: RunOneResult[] = [];

  for (const input of inputs) {
    if (signal.aborted) {
      results.push({
        sourceId: input.sourceId,
        ok: false,
        sourcePackage: null,
        error: new ImportError("cancelled", "Import cancelled.", input.sourceId),
      });
      continue;
    }

    const provider = findProviderForKind(providers, input.kind);
    if (!provider) {
      results.push({
        sourceId: input.sourceId,
        ok: false,
        sourcePackage: null,
        error: new ImportError("unsupported-file-type", `No provider is available for ${input.filename}.`, input.sourceId),
      });
      continue;
    }

    const validationError = provider.validate(input);
    if (validationError) {
      results.push({ sourceId: input.sourceId, ok: false, sourcePackage: null, error: validationError });
      continue;
    }

    try {
      const sourcePackage = await provider.extract(input, { signal, onProgress });
      results.push({ sourceId: input.sourceId, ok: true, sourcePackage, error: null });
    } catch (error) {
      const importError =
        error instanceof ImportError
          ? error
          : new ImportError("unknown", error instanceof Error ? error.message : "Something went wrong.", input.sourceId);
      results.push({ sourceId: input.sourceId, ok: false, sourcePackage: null, error: importError });
    }
  }

  const sourcePackages = results.filter((r): r is RunOneResult & { sourcePackage: ImportedSourcePackage } => r.sourcePackage !== null).map((r) => r.sourcePackage);
  const pkg = mergeSourcePackages(sourcePackages, sourceFiles, meta, new Date().toISOString());
  return { results, pkg };
}
