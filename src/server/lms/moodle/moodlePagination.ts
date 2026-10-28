/**
 * Moodle pagination bounds (Phase 18F, Part 6). Unlike Canvas's Link-header
 * pagination, Moodle web-service list functions generally return a flat
 * JSON array in one response; where a function DOES support paging (via
 * explicit `options[limitfrom]`/`options[limitnum]` parameters — e.g. some
 * forum/discussion listing functions), this app still bounds the number of
 * pages and the page size to the same conservative discipline Canvas's
 * client already uses, even though the common case is a single page.
 */

export const MAX_PAGES_PER_REQUEST = 10;
export const PAGE_SIZE = 100;
