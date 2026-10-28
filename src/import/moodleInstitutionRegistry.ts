/**
 * La Trobe Moodle institution registry (Phase 18F, Part 3). Parallel to,
 * but deliberately SEPARATE from, `canvasInstitutionRegistry.ts` — Moodle's
 * connection shape (a single institution-issued web-service token, not an
 * OAuth client id/secret pair) is structurally different, and an
 * institution can appear here with no Canvas entry (or vice versa).
 *
 * No secret ever lives in this file — only an environment-variable NAME.
 * `isMoodleInstitutionConfigured()` reads `process.env` fresh on every call
 * (never cached at module load — the same discipline Phase 18C/18E already
 * established for their own registries).
 *
 * `moodleBaseUrl` is an UNVERIFIED, plausible default researched from
 * third-party sources during Phase 18F's audit (see
 * docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §3/§4) — La Trobe's own
 * official current-student support pages confirm the LMS IS Moodle and
 * describe the login flow, but do not publish the literal hostname in a
 * form this research could independently verify. Never presented as
 * confirmed-working; never used to mark the institution "configured" (that
 * requires a real token env var to actually be set — see
 * `isMoodleInstitutionConfigured()` below). An admin performing real
 * onboarding corrects this field first (see the deployment doc's onboarding
 * checklist), before anything else here is trusted.
 *
 * This file is imported by SERVER-side code only
 * (`src/server/lms/moodle/*`, `api/lms/moodle/*`). Client-side code must
 * use `moodleInstitutionPublicList.ts` instead (id/displayName/lmsKind
 * only, zero imports) — never this file — for the exact reason
 * `canvasInstitutionPublicList.ts` exists: importing this file from a
 * browser bundle would ship the token env-var NAME and every derived
 * endpoint URL into `dist/assets/*.js`, even though neither is a secret
 * VALUE, which is still unnecessary exposure this project has already hit
 * and fixed once for Canvas.
 */

export type MoodleAuthenticationMode = "institution-token" | "unconfigured";

export interface MoodleInstitutionDefinition {
  institutionId: string;
  displayName: string;
  lmsKind: "moodle";
  /** The institution's own Moodle instance root — unverified this phase, see file header. */
  moodleBaseUrl: string;
  loginUrl: string;
  /** Moodle's own fixed, documented REST path — not institution-specific. */
  webServiceEndpoint: string;
  /** Moodle's own standard function name, called first on every connection to validate host/site/token (Part 7). */
  siteInfoFunction: string;
  authenticationMode: MoodleAuthenticationMode;
  administratorApprovalRequired: boolean;
  /** Env var NAME only — never a value. */
  tokenEnvVar: string;
  supportedCapabilities: string[];
  unsupportedCapabilities: string[];
  calendarExportSupport: "student-self-service-ics-or-webcal" | "unknown" | "unsupported";
  lastVerificationDate: string;
  verificationEvidence: string[];
  knownLimitations: string[];
}

function deriveEndpoints(moodleBaseUrl: string) {
  return {
    loginUrl: `${moodleBaseUrl}/login/index.php`,
    webServiceEndpoint: `${moodleBaseUrl}/webservice/rest/server.php`,
  };
}

function envVarName(institutionId: string): string {
  const upper = institutionId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `MOODLE_${upper}_SERVICE_TOKEN`;
}

export const MOODLE_INSTITUTION_REGISTRY: MoodleInstitutionDefinition[] = [
  {
    institutionId: "latrobe",
    displayName: "La Trobe University",
    lmsKind: "moodle",
    moodleBaseUrl: "https://lms.latrobe.edu.au",
    ...deriveEndpoints("https://lms.latrobe.edu.au"),
    siteInfoFunction: "core_webservice_get_site_info",
    authenticationMode: "unconfigured",
    administratorApprovalRequired: true,
    tokenEnvVar: envVarName("latrobe"),
    supportedCapabilities: ["calendar-ics-fallback", "official-subject-discovery-fallback"],
    unsupportedCapabilities: ["oauth-connect", "web-service-token-self-service", "live-course-api"],
    calendarExportSupport: "student-self-service-ics-or-webcal",
    lastVerificationDate: "2026-07-23",
    verificationEvidence: [
      "La Trobe current-student FAQ: LMS described directly as \"Moodle (Modular Object-Oriented Dynamic Learning Environment)\".",
      "La Trobe current-student FAQ \"LMS Calendar\": describes \"Import or export calendars\", recommends the URL/webcal export method, confirms iCal/Google Calendar compatibility, and notes \"Student IT does not support the usability of this — use this at your discretion.\"",
      "Moodle developer docs (docs.moodle.org): token creation requires the moodle/webservice:createtoken capability, normally granted only via admin-issued tokens (Site Administration > Plugins > Web services > Manage tokens), not student self-service by default.",
      "Moodle developer docs: core OAuth 2 subsystem is Moodle acting as an OAuth2 CLIENT for inbound SSO login, not a third-party-app-facing OAuth provider role — unlike Canvas's core Developer Key system.",
    ],
    knownLimitations: [
      "moodleBaseUrl is an unverified, plausible default sourced from third-party citations, not confirmed against an official La Trobe technical document.",
      "No student-self-service, password-free Moodle API or OAuth connection path was confirmed available — see docs/PHASE_18F_LATROBE_MOODLE_INTEGRATION.md §3.",
      "Enabling the live token path requires a La Trobe Moodle administrator to manually issue a web-service token — an external prerequisite this codebase cannot self-provision.",
    ],
  },
];

export function findMoodleInstitution(id: string): MoodleInstitutionDefinition | null {
  return MOODLE_INSTITUTION_REGISTRY.find((inst) => inst.institutionId === id) ?? null;
}

// A client-safe id/displayName/lmsKind-only list lives in its OWN file
// (moodleInstitutionPublicList.ts, zero imports) — never re-exported from
// here, so no client bundle can pull in this file's env-var name/endpoint
// URLs even transitively. See that file's header for why.

/** Reads process.env fresh every call — never cache this at module load (see file header). True only when a real institution-issued token is actually set. */
export function isMoodleInstitutionConfigured(id: string): boolean {
  const institution = findMoodleInstitution(id);
  if (!institution) return false;
  return Boolean(process.env[institution.tokenEnvVar]);
}
