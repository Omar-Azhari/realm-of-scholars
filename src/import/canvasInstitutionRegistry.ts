/**
 * Canvas institution registry (Phase 18E, Part 2). Parallel to, but
 * deliberately SEPARATE from, `universityRegistry.ts` (Phase 18B's public
 * discovery registry) — Canvas OAuth fields (client id/secret env-var
 * names, redirect URIs, authorize/token endpoints) have nothing to do with
 * public handbook discovery, and an institution can be listed here with no
 * entry there (or vice versa).
 *
 * No secret ever lives in this file — only environment-variable NAMES.
 * `isCanvasInstitutionConfigured()` reads `process.env` fresh on every call
 * (never cached at module load — the exact bug Phase 18C found and fixed in
 * `ssrfGuard.ts`'s localhost-allow flag).
 *
 * Every institution below is listed with `configured: false` in the sense
 * that matters (no real Developer Key has been registered for any of them —
 * see docs/PHASE_18E_CANVAS_INTEGRATION.md §3). `canvasBaseUrl` uses the
 * common `<institution>.instructure.com` pattern as a reasonable STARTING
 * POINT for whoever eventually configures a real Developer Key — it is
 * explicitly marked unverified, never presented as a confirmed-working
 * Canvas hostname the way `universityRegistry.ts`'s verified handbook URLs
 * are. An admin onboarding a real institution corrects this field before
 * anything is used (see the deployment doc's onboarding checklist).
 */

export interface CanvasInstitutionDefinition {
  id: string;
  displayName: string;
  /** The institution's own Canvas instance root — NOT verified against a live Canvas instance this phase (see verificationNote). Never accepted from a single request; only ever read from this registry. */
  canvasBaseUrl: string;
  /** Derived from canvasBaseUrl per Canvas's documented OAuth2 paths — not independently configurable, so there is no way for a request to redirect the authorize step to an arbitrary host. */
  authorizeEndpoint: string;
  tokenEndpoint: string;
  revokeEndpoint: string;
  apiBaseUrl: string;
  /** Env var NAMES only — never a value. */
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  redirectUriEnvVar: string;
  /** Free-text notes on what's actually known about this institution's Canvas setup. */
  supportNotes: string;
  verificationNote: string;
  lastVerificationDate: string;
}

function deriveEndpoints(canvasBaseUrl: string) {
  return {
    authorizeEndpoint: `${canvasBaseUrl}/login/oauth2/auth`,
    tokenEndpoint: `${canvasBaseUrl}/login/oauth2/token`,
    revokeEndpoint: `${canvasBaseUrl}/login/oauth2/token`, // Canvas uses DELETE on the same token endpoint to revoke
    apiBaseUrl: `${canvasBaseUrl}/api/v1`,
  };
}

function envVarNames(institutionId: string) {
  const upper = institutionId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return {
    clientIdEnvVar: `CANVAS_${upper}_CLIENT_ID`,
    clientSecretEnvVar: `CANVAS_${upper}_CLIENT_SECRET`,
    redirectUriEnvVar: `CANVAS_${upper}_REDIRECT_URI`,
  };
}

function makeInstitution(
  id: string,
  displayName: string,
  canvasBaseUrl: string,
  supportNotes: string
): CanvasInstitutionDefinition {
  return {
    id,
    displayName,
    canvasBaseUrl,
    ...deriveEndpoints(canvasBaseUrl),
    ...envVarNames(id),
    supportNotes,
    verificationNote:
      "canvasBaseUrl is an unverified, plausible default (the common <institution>.instructure.com pattern) — no live Canvas instance was reachable/tested this phase, and no institution has a real Developer Key registered. Correct this field during real onboarding, not before.",
    lastVerificationDate: "2026-07-23",
  };
}

export const CANVAS_INSTITUTION_REGISTRY: CanvasInstitutionDefinition[] = [
  makeInstitution("unimelb", "University of Melbourne", "https://canvas.lms.unimelb.edu.au", "Melbourne is known to run a custom-domain Canvas instance rather than the default *.instructure.com pattern — this base URL reflects that, but is still unverified this phase."),
  makeInstitution("monash", "Monash University", "https://learning.monash.edu", "Monash is known to run a custom-domain Canvas instance — reflected here, unverified."),
  makeInstitution("rmit", "RMIT University", "https://rmit.instructure.com", "Default instructure.com pattern assumed — not independently confirmed."),
  makeInstitution("latrobe", "La Trobe University", "https://latrobe.instructure.com", "Default instructure.com pattern assumed — not independently confirmed."),
  makeInstitution("deakin", "Deakin University", "https://deakin.instructure.com", "Default instructure.com pattern assumed — not independently confirmed."),
  makeInstitution("swinburne", "Swinburne University of Technology", "https://swinburne.instructure.com", "Default instructure.com pattern assumed — not independently confirmed."),
  makeInstitution("vu", "Victoria University", "https://vu.instructure.com", "Default instructure.com pattern assumed — not independently confirmed."),
];

export function findCanvasInstitution(id: string): CanvasInstitutionDefinition | null {
  return CANVAS_INSTITUTION_REGISTRY.find((inst) => inst.id === id) ?? null;
}

// A client-safe id/displayName-only list lives in its OWN file
// (canvasInstitutionPublicList.ts, zero imports) — never re-exported from
// here, so no client bundle can pull in this file's env-var names/endpoint
// URLs even transitively. See that file's header for why.

/** Reads process.env fresh every call — never cache this at module load (see file header). True only when BOTH a client id and client secret are actually set for this institution. */
export function isCanvasInstitutionConfigured(id: string): boolean {
  const institution = findCanvasInstitution(id);
  if (!institution) return false;
  return Boolean(process.env[institution.clientIdEnvVar]) && Boolean(process.env[institution.clientSecretEnvVar]);
}

/** The redirect URI actually configured for this institution's Developer Key — read fresh, never assumed. Null when unconfigured. */
export function getConfiguredRedirectUri(id: string): string | null {
  const institution = findCanvasInstitution(id);
  if (!institution) return null;
  return process.env[institution.redirectUriEnvVar] ?? null;
}
