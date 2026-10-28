/**
 * Canvas Link-header pagination (Phase 18E, Part 6). Canvas paginates every
 * list endpoint via a standard `Link` response header
 * (`<url>; rel="next", <url>; rel="last", ...`), never a page-number query
 * param this app invents itself — parsing the actual header is the only
 * correct way to know if there's a next page.
 */

export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = /<([^>]+)>\s*;\s*rel="([^"]+)"/.exec(part.trim());
    if (match && match[2] === "next") return match[1];
  }
  return null;
}

export const MAX_PAGES_PER_REQUEST = 10;
export const PAGE_SIZE = 100;
