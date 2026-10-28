/**
 * Path resolution for `public/assets/v2/` — the exact same convention as
 * `src/engine/manifestTypes.ts`'s `assetUrl()`, mirrored rather than
 * duplicated with a conflicting scheme, per V2 Phase 2's own instruction to
 * stay consistent with the existing manifest philosophy.
 */

export function v2AssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${normalizedBase}assets/v2/${normalizedPath}`;
}
