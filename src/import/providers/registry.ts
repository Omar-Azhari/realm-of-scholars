/**
 * Assembles every provider (Phase 18A, Part 3) into one lookup. The three
 * text-reducing document providers share a `getContextYear` closure so the
 * date parser can resolve a year the USER explicitly entered in Study
 * Details — never an inferred one (see extraction/dates.ts).
 */

import type { AcademicProvider, SupportedFileKind } from "../types";
import { createTextDocumentProvider } from "./textProvider";
import { createStructuredJsonProvider } from "./jsonProvider";
import { createIcsCalendarProvider } from "./icsProvider";
import { createManualCompletionProvider } from "./manualProvider";
import { createPdfDocumentProvider } from "./pdfProvider";
import { createDocxDocumentProvider } from "./docxProvider";
import { createOfficialUniversityProvider } from "./officialUniversityProvider";
import { PLACEHOLDER_PROVIDERS } from "./placeholders";

export function createProviderRegistry(getContextYear: () => number | null): AcademicProvider[] {
  return [
    createPdfDocumentProvider(getContextYear),
    createDocxDocumentProvider(getContextYear),
    createTextDocumentProvider(getContextYear),
    createIcsCalendarProvider(),
    createStructuredJsonProvider(),
    createManualCompletionProvider(),
    createOfficialUniversityProvider(),
    ...PLACEHOLDER_PROVIDERS,
  ];
}

/** Routes a file kind to the (first) real, configured provider that accepts it. */
export function findProviderForKind(providers: AcademicProvider[], kind: SupportedFileKind): AcademicProvider | null {
  return providers.find((p) => p.capabilities.configured && p.capabilities.acceptedFileKinds.includes(kind)) ?? null;
}
