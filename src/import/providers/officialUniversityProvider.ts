/**
 * Official University provider (Phase 18B, Part 1). Replaces the Phase 18A
 * placeholder with a real implementation — but contains NO per-university
 * branching or scraping logic itself. Everything university-specific comes
 * from `universityRegistry.ts`; everything text-extraction-specific is the
 * exact same shared `parseSyllabusText()` engine every other document
 * provider uses (fed HTML-stripped page text, tracking real source URLs the
 * same way `pdfProvider.ts` tracks page numbers).
 *
 * Only ever fetches from a university's own declared `officialDomains`
 * (never a URL derived from page content), respects robots.txt, makes a
 * single attempt per page (no retries), and reports — never fabricates —
 * when a page can't be reached or when a university has no known direct
 * handbook link yet.
 */

import type {
  AcademicProvider,
  ExtractionContext,
  ImportedSourcePackage,
  ImportedSubjectCandidate,
  ImportWarning,
  ImportWarningKind,
  ProviderInput,
} from "../types";
import { ImportError } from "../types";
import { findUniversity, buildUniversityUrl, type UniversityDefinition } from "../universityRegistry";
import { safeFetchOfficialPage } from "../discovery/safeFetch";
import { htmlToPlainText } from "../extraction/htmlText";
import { parseSyllabusText } from "../extraction/syllabusParser";

export interface UniversityDiscoveryPayload {
  universityId: string;
  academicYear: string | null;
  teachingPeriod: string | null;
  subjectCodes: string[];
}

let warningCounter = 0;
function warn(kind: ImportWarningKind, message: string, sourceId: string): ImportWarning {
  warningCounter += 1;
  return { id: `uni-warn-${warningCounter}`, kind, message, sourceId };
}

let emptyCounter = 0;
function emptySubject(nameOrCode: string): ImportedSubjectCandidate {
  emptyCounter += 1;
  return {
    temporaryId: `subject-uni-empty-${emptyCounter}`,
    code: null,
    name: nameOrCode,
    description: null,
    coordinator: null,
    creditPoints: null,
    teachingPeriod: null,
    colourSuggestion: null,
    modules: [],
    assessments: [],
    readings: [],
    goals: [],
    sourceReferences: [],
    confidence: "missing",
    fieldConfidence: {},
  };
}

interface DiscoverOneResult {
  subject: ImportedSubjectCandidate;
  warnings: ImportWarning[];
}

async function discoverOneSubject(
  university: UniversityDefinition,
  rawCode: string,
  contextYear: number | null,
  sourceId: string
): Promise<DiscoverOneResult> {
  const warnings: ImportWarning[] = [];
  const looksLikeCode = university.subjectCodePattern.test(rawCode.toUpperCase());

  if (!looksLikeCode) {
    warnings.push(
      warn(
        "no-url-pattern",
        `"${rawCode}" doesn't look like a ${university.name} subject code — automatic discovery searches by code. Upload its subject guide instead.`,
        sourceId
      )
    );
    return { subject: emptySubject(rawCode), warnings };
  }

  const code = rawCode.toUpperCase();

  // Discovery order per Part 3: handbook, subject guide, timetable,
  // assessment, calendar. A null template is simply skipped — never guessed.
  const discoverySteps: Array<{ label: string; template: string | null }> = [
    { label: "handbook", template: university.handbookUrlTemplate },
    { label: "subject guide", template: university.subjectGuideUrlTemplate },
    { label: "timetable", template: university.timetableUrlTemplate },
    { label: "assessment", template: university.assessmentUrlTemplate },
    { label: "calendar", template: university.calendarUrlTemplate },
  ];

  const pages: Array<{ url: string; text: string }> = [];
  let anyTemplateExisted = false;

  for (const step of discoverySteps) {
    if (!step.template) continue;
    anyTemplateExisted = true;
    const url = buildUniversityUrl(step.template, code, university.codeCase);
    const result = await safeFetchOfficialPage(url, university.officialDomains);
    if (result.ok && result.text) {
      pages.push({ url: result.finalUrl, text: htmlToPlainText(result.text) });
    } else {
      warnings.push(
        warn(
          result.error?.includes("robots") ? "robots-disallowed" : "source-unreachable",
          `Couldn't reach ${university.name}'s ${step.label} page for ${code} (${result.error}) — try uploading its subject guide instead.`,
          sourceId
        )
      );
    }
  }

  if (!anyTemplateExisted) {
    warnings.push(
      warn(
        "no-url-pattern",
        `${university.name} doesn't have a known direct handbook link yet — upload ${code}'s subject guide instead.`,
        sourceId
      )
    );
  }

  if (pages.length === 0) {
    return { subject: emptySubject(code), warnings };
  }

  // Same "join pages, track boundaries for locate()" pattern as pdfProvider.ts,
  // just with real page URLs standing in for page numbers.
  let joined = "";
  const boundaries: Array<{ start: number; url: string }> = [];
  for (const page of pages) {
    boundaries.push({ start: joined.length, url: page.url });
    joined += `${page.text}\n\n`;
  }
  const locate = (index: number): string | null => {
    let current = boundaries[0] ?? null;
    for (const boundary of boundaries) {
      if (boundary.start <= index) current = boundary;
      else break;
    }
    return current ? current.url : null;
  };

  const { subject, warnings: parseWarnings } = parseSyllabusText(joined, {
    sourceId,
    filename: `${university.name} handbook — ${code}`,
    contextYear,
    locate,
  });

  return { subject, warnings: [...warnings, ...parseWarnings] };
}

export function createOfficialUniversityProvider(): AcademicProvider {
  return {
    id: "official-university-web",
    displayName: "Official university handbook (public)",
    capabilities: {
      acceptedFileKinds: [],
      requiresNoFile: true,
      producesSubjects: true,
      producesCalendarEvents: false,
      configured: true,
    },
    isAvailable: () => true,
    validate(input) {
      if (!input.text) return new ImportError("empty-file", "No university or subjects were provided.", input.sourceId);
      return null;
    },
    async extract(input: ProviderInput, ctx: ExtractionContext): Promise<ImportedSourcePackage> {
      if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);

      let payload: UniversityDiscoveryPayload;
      try {
        payload = JSON.parse(input.text ?? "{}") as UniversityDiscoveryPayload;
      } catch {
        throw new ImportError("parse-failed", "That search request couldn't be read.", input.sourceId);
      }

      const university = findUniversity(payload.universityId);
      if (!university) {
        throw new ImportError("not-configured", "That university isn't in UniGame's registry yet.", input.sourceId);
      }

      const codes = (payload.subjectCodes ?? []).map((c) => c.trim()).filter((c) => c.length > 0);
      const contextYear = payload.academicYear ? Number(payload.academicYear) : null;
      const subjects: ImportedSubjectCandidate[] = [];
      const warnings: ImportWarning[] = [];

      for (let i = 0; i < codes.length; i += 1) {
        if (ctx.signal.aborted) throw new ImportError("cancelled", "Import cancelled.", input.sourceId);
        ctx.onProgress({
          sourceId: input.sourceId,
          fraction: i / Math.max(codes.length, 1),
          message: `Searching ${university.name} for ${codes[i]}…`,
        });

        const result = await discoverOneSubject(university, codes[i], contextYear, input.sourceId);
        subjects.push(result.subject);
        warnings.push(...result.warnings);
      }

      ctx.onProgress({ sourceId: input.sourceId, fraction: 1, message: "Done." });
      return { providerId: "official-university-web", subjects, calendarEvents: [], warnings };
    },
  };
}
