/**
 * Imports La Trobe University's public 2026 Handbook (handbook.latrobe.edu.au): every subject,
 * course and area of study (majors, minors, specialisations).
 *
 * Run (from the repo root):
 *   npx tsx scripts/import-latrobe-handbook.ts                  full import (resumes from the cache)
 *   npx tsx scripts/import-latrobe-handbook.ts --pilot          about 50 subjects plus the owner's four, a few courses and majors
 *   npx tsx scripts/import-latrobe-handbook.ts --codes=CSE2UI,CSE3PM   only these subjects
 *   npx tsx scripts/import-latrobe-handbook.ts --offline        rebuild the processed files from the cache only (no network)
 *   options: --limit=N (per kind), --only=subjects,courses,majors, --delay=ms (min 300), --refresh-lists
 *
 * How the Handbook works: it is a CourseLoop (Next.js) site. robots.txt allows everything and lists
 * a sitemap. The sitemap gives every /subjects/2026/<code>, /courses/2026/<code> and /aos/2026/<code>
 * page. Each page's data comes from the site's own JSON endpoint:
 *   GET /api/content/academic-item-content?siteId=ltu-prod-pres&path=/subjects/2026/CSE2UI
 * Assessments and class hours are per offering (the "Select Offering" switcher on the page), fetched with
 *   ...&offering=<offering display name>, e.g. "Melbourne (Bundoora) - Semester 2 - Face to Face".
 *
 * Politeness: one request at a time, a pause between requests (default 500 ms), a clear User-Agent,
 * every response cached in data-cache/handbook/ (outside the app bundle) so re-runs never re-download.
 * Stops on 403 or repeated 429 instead of working around a block.
 *
 * Output (compact JSON, JsonUtility-friendly: no nulls, "" and -1 for unknowns, no arrays of arrays):
 *   src/data/latrobe-handbook/subjects.json, courses.json, majors.json, meta.json
 * These files are NOT imported by the client bundle. Load them lazily or use them for the Unity export.
 * Text is stored as the Handbook states it (HTML turned into plain text, broken character encoding
 * repaired). Nothing is added that the Handbook doesn't say.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const HOST = "https://handbook.latrobe.edu.au";
const SITE_ID = "ltu-prod-pres";
const YEAR = "2026";
const USER_AGENT = "UniGame study game, student project (La Trobe student; polite, cached, one request at a time)";
const CACHE = join(ROOT, "data-cache", "handbook");
const OUT = join(ROOT, "src", "data", "latrobe-handbook");

/** The owner's four subjects: always included, even in a pilot. */
const OWNER_SUBJECTS = ["CSE2UI", "CSE3CWA", "CSE3PM", "CSE3PPE"];

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1], m[2] ?? "true");
}
const OFFLINE = args.has("offline");
const PILOT = args.has("pilot");
const LIMIT = args.has("limit") ? Number(args.get("limit")) : PILOT ? 50 : Infinity;
const ONLY = new Set((args.get("only") ?? "subjects,courses,majors").split(",").map((s) => s.trim()));
const CODES = args.has("codes") ? new Set(args.get("codes")!.split(",").map((s) => s.trim().toUpperCase())) : null;
const DELAY = Math.max(300, Number(args.get("delay") ?? 500));
const REFRESH_LISTS = args.has("refresh-lists");

// ---------------------------------------------------------------------------
// Polite cached fetching
// ---------------------------------------------------------------------------

interface CacheRecord {
  url: string;
  fetchedAt: string;
  status: number;
  body: string;
}

let lastRequest = 0;
let requests = 0;
let cacheHits = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cacheFile(key: string): string {
  // "subjects/CSE2UI/offering/<name>" is stored as subjects/CSE2UI__offering__<name>.json
  const [folder, ...rest] = key.split("/");
  const safe = (rest.length ? rest.join("__") : folder).replace(/[^A-Za-z0-9._-]+/g, "_");
  return rest.length ? join(CACHE, folder, `${safe}.json`) : join(CACHE, `${safe}.json`);
}

function readCache(key: string): CacheRecord | null {
  const f = cacheFile(key);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf-8")) as CacheRecord;
  } catch {
    return null;
  }
}

class BlockedError extends Error {}

async function get(key: string, url: string, refresh = false): Promise<CacheRecord | null> {
  const cached = refresh ? null : readCache(key);
  if (cached) {
    cacheHits++;
    return cached;
  }
  if (OFFLINE) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastRequest + DELAY - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    requests++;
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/xml, */*" } });
    } catch (e) {
      console.warn(`  network error (${(e as Error).message}), retrying: ${url}`);
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (res.status === 403) throw new BlockedError(`403 Forbidden from ${url}. The site is refusing automated access, so the import stops here.`);
    if (res.status === 429 || res.status >= 500) {
      const backoff = [5000, 20000, 60000][attempt] ?? 60000;
      console.warn(`  HTTP ${res.status}, waiting ${backoff / 1000}s: ${url}`);
      if (res.status === 429 && attempt === 3) throw new BlockedError(`Repeated 429 (rate limited) from ${url}. Stopping.`);
      await sleep(backoff);
      continue;
    }
    const body = await res.text();
    const rec: CacheRecord = { url, fetchedAt: new Date().toISOString(), status: res.status, body };
    const f = cacheFile(key);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, JSON.stringify(rec), "utf-8");
    return rec;
  }
  console.warn(`  gave up after retries: ${url}`);
  return null;
}

function apiUrl(path: string, offering?: string): string {
  const q = new URLSearchParams({ siteId: SITE_ID, path });
  if (offering) q.set("offering", offering);
  return `${HOST}/api/content/academic-item-content?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// Listing (sitemap)
// ---------------------------------------------------------------------------

async function listPaths(): Promise<{ subjects: string[]; courses: string[]; aos: string[] }> {
  const index = await get("sitemap/index", `${HOST}/sitemap.xml`, REFRESH_LISTS);
  if (!index || index.status !== 200) throw new Error("Could not read the Handbook sitemap.");
  const subMaps = [...index.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const paths = new Set<string>();
  for (const sm of subMaps) {
    const name = sm.split("/").pop() ?? sm;
    const rec = await get(`sitemap/${name}`, sm, REFRESH_LISTS);
    if (!rec || rec.status !== 200) continue;
    for (const m of rec.body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const p = decodeXml(m[1]).replace(HOST, "");
      if (p.startsWith(`/subjects/${YEAR}/`) || p.startsWith(`/courses/${YEAR}/`) || p.startsWith(`/aos/${YEAR}/`)) paths.add(p);
    }
  }
  const sorted = [...paths].sort();
  return {
    subjects: sorted.filter((p) => p.startsWith("/subjects/")),
    courses: sorted.filter((p) => p.startsWith("/courses/")),
    aos: sorted.filter((p) => p.startsWith("/aos/")),
  };
}

const codeOf = (path: string) => decodeURIComponent(path.split("/").pop() ?? "").trim();

// ---------------------------------------------------------------------------
// Text clean-up (the Handbook's HTML and its broken UTF-8)
// ---------------------------------------------------------------------------

const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

/** Repairs UTF-8 text that was decoded as Windows-1252 (e.g. "â€™" back to "’", "Â " back to a space). */
function fixMojibake(s: string): string {
  return s.replace(/[Â-ô](?:[\u0080-¿]|[€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]){1,3}/g, (seq) => {
    const bytes: number[] = [];
    for (const ch of seq) {
      const code = ch.charCodeAt(0);
      if (code < 0x100) bytes.push(code);
      else if (CP1252[ch] !== undefined) bytes.push(CP1252[ch]);
      else return seq;
    }
    try {
      return UTF8_DECODER.decode(new Uint8Array(bytes));
    } catch {
      return seq;
    }
  });
}

function decodeXml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", bull: "•" };

/** Handbook HTML to plain text: paragraphs become new lines, list items become "- " lines. */
function htmlToText(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  let s = fixMojibake(html);
  s = s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

const str = (v: unknown): string => (typeof v === "string" ? htmlToText(v) : typeof v === "number" ? String(v) : "");
const val = (v: unknown): string => (v && typeof v === "object" ? str((v as { value?: unknown }).value) : "");
const label = (v: unknown): string => (v && typeof v === "object" ? str((v as { label?: unknown }).label) : "");
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : -1;
};
const arr = <T = Record<string, unknown>>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const day = (iso: string) => iso.slice(0, 10);

// ---------------------------------------------------------------------------
// Curriculum structures (courses and majors) and requisites
// ---------------------------------------------------------------------------

interface StructureItem {
  code: string;
  name: string;
  kind: string;
  creditPoints: number;
  url: string;
}
interface StructureGroup {
  /** e.g. "Level two > Core" */
  path: string;
  title: string;
  /** 1-5 when the group sits under a "Level one" to "Level five" heading, else -1. */
  yearLevel: number;
  creditPoints: number;
  description: string;
  items: StructureItem[];
}

const LEVEL_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 };
function yearLevelOf(title: string): number {
  const m = /\b(?:level|year)\s+(one|two|three|four|five|[1-5])\b/i.exec(title);
  return m ? LEVEL_WORDS[m[1].toLowerCase()] : -1;
}

type Raw = Record<string, unknown>;

function relItem(r: Raw): StructureItem {
  const kindRaw = r.academic_item_type;
  const kind = kindRaw && typeof kindRaw === "object" ? val(kindRaw) || label(kindRaw) : str(kindRaw);
  return {
    code: str(r.academic_item_code),
    name: str(r.academic_item_name),
    kind: kind.toLowerCase(),
    creditPoints: num(r.academic_item_credit_points),
    url: str(r.academic_item_url) ? `${HOST}${str(r.academic_item_url)}` : "",
  };
}

const byOrder = (a: Raw, b: Raw) => num(a.order) - num(b.order);

function flattenStructure(cs: unknown): StructureGroup[] {
  const groups: StructureGroup[] = [];
  const walk = (c: Raw, trail: string[], level: number) => {
    const title = str(c.title);
    const path = [...trail, title].filter(Boolean);
    const lvl = yearLevelOf(title) > 0 ? yearLevelOf(title) : level;
    const rels = arr(c.relationship).sort(byOrder).map(relItem);
    const description = [str(c.preface), str(c.description), str(c.footnote)].filter(Boolean).join("\n");
    groups.push({ path: path.join(" > "), title, yearLevel: lvl, creditPoints: num(c.credit_points), description, items: rels });
    for (const child of arr(c.container).sort(byOrder)) walk(child, path, lvl);
  };
  if (cs && typeof cs === "object") for (const c of arr((cs as Raw).container).sort(byOrder)) walk(c, [], -1);
  return groups;
}

interface Requisite {
  /** As the Handbook labels it: Prerequisite, Corequisite, Incompatible, Equivalent, ... */
  type: string;
  /** The rule as a readable string, e.g. "CSE1OOF AND (CSE1PE OR CSE1IIT)". */
  rule: string;
  description: string;
  subjects: string[];
}

function requisiteRule(container: Raw, codes: string[]): string {
  const parts: string[] = [];
  const rels = arr(container.relationships).sort(byOrder);
  for (const r of rels) {
    const code = str(r.academic_item_code) || val(r.academic_item).replace(/^[A-Za-z ]+:\s*/, "");
    if (code) {
      parts.push(code);
      codes.push(code);
    }
  }
  for (const child of arr(container.containers).sort(byOrder)) {
    const inner = requisiteRule(child, codes);
    if (inner) parts.push(arr(child.containers).length + arr(child.relationships).length > 1 ? `(${inner})` : inner);
  }
  const connector = label(container.parent_connector) || "AND";
  return parts.join(` ${connector} `);
}

function requisitesOf(raw: unknown): Requisite[] {
  return arr(raw)
    .filter((r) => str(r.active) !== "false")
    .sort(byOrder)
    .map((r) => {
      const codes: string[] = [];
      const tops = arr(r.containers).sort(byOrder);
      const pieces = tops.map((c) => requisiteRule(c, codes)).filter(Boolean);
      const rule = pieces.length > 1 ? pieces.map((p) => `(${p})`).join(" AND ") : (pieces[0] ?? "");
      return { type: label(r.requisite_type), rule, description: str(r.description), subjects: [...new Set(codes)] };
    });
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

interface Assessment {
  name: string;
  type: string;
  description: string;
  /** Percent, or -1 if the Handbook gives none. */
  weightPercent: number;
  contribution: string;
  hurdle: string;
  earlyAssessment: string;
  learningOutcomes: string;
  /** Offering names this applies to; empty means all offerings. */
  offerings: string[];
}
interface ClassHours {
  activity: string;
  method: string;
  duration: string;
  frequency: string;
  days: string;
  additionalInformation: string;
  offerings: string[];
}
interface Offering {
  name: string;
  campus: string;
  teachingPeriod: string;
  mode: string;
  note: string;
}
interface Subject {
  code: string;
  name: string;
  creditPoints: number;
  yearLevel: number;
  levelLabel: string;
  studyLevel: string;
  aqfLevel: string;
  school: string;
  college: string;
  status: string;
  discontinued: boolean;
  suspended: boolean;
  phasingOut: boolean;
  campuses: string[];
  teachingPeriods: string[];
  offerings: Offering[];
  overview: string;
  learningActivities: string;
  /** Weekly topics or a content section if the Handbook gives one ("" when it doesn't, which is the norm). */
  content: string;
  learningOutcomes: { code: string; text: string }[];
  assessments: Assessment[];
  classHours: ClassHours[];
  requisites: Requisite[];
  enrolmentNotes: string[];
  tags: string;
  sourceUrl: string;
  fetchedAt: string;
}

function teachingPeriodOf(displayName: string, campus: string, mode: string): string {
  let s = displayName;
  if (campus && s.startsWith(campus)) s = s.slice(campus.length);
  if (mode && s.endsWith(mode)) s = s.slice(0, -mode.length);
  return s.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "").trim();
}

function offeringsOf(raw: unknown): Offering[] {
  return arr(raw)
    .filter((o) => str(o.publish) !== "false" && str(o.offered) !== "false")
    .sort(byOrder)
    .map((o) => {
      const name = str(o.display_name);
      const campus = val(o.location);
      const mode = val(o.mode);
      return { name, campus, mode, teachingPeriod: teachingPeriodOf(name, campus, mode), note: str(o.clarification_to_appear_in_handbook) };
    });
}

async function importSubject(path: string): Promise<Subject | null> {
  const code = codeOf(path);
  const rec = await get(`subjects/${code}`, apiUrl(path));
  if (!rec || rec.status !== 200) return null;
  const d = (JSON.parse(rec.body) as { data?: Raw }).data;
  if (!d) return null;
  const offerings = offeringsOf(d.offering);

  // Per-offering details: assessments and class hours.
  const assessments = new Map<string, Assessment>();
  const hours = new Map<string, ClassHours>();
  for (const o of offerings) {
    if (!o.name) continue;
    const r = await get(`subjects/${code}/offering/${o.name}`, apiUrl(path, o.name));
    if (!r || r.status !== 200) continue;
    const od = (JSON.parse(r.body) as { data?: Raw }).data ?? {};
    for (const a of arr(od.assessments)) {
      const id = str(a.cl_id) || JSON.stringify(a);
      const prev = assessments.get(id);
      if (prev) {
        if (prev.offerings.length) prev.offerings.push(o.name);
        continue;
      }
      assessments.set(id, {
        name: str(a.assessment_header) || label(a.assessment_type),
        type: label(a.assessment_type),
        description: str(a.description),
        weightPercent: num(a.weight),
        contribution: label(a.contribution),
        hurdle: str(a.hurdle_task),
        earlyAssessment: str(a.early_assessment),
        learningOutcomes: str(a.intended_learning_outcome),
        offerings: str(a.applies_to_all_offerings) === "true" ? [] : [o.name],
      });
    }
    for (const c of arr(od.class_requirements)) {
      const id = str(c.cl_id) || JSON.stringify(c);
      const prev = hours.get(id);
      if (prev) {
        if (prev.offerings.length) prev.offerings.push(o.name);
        continue;
      }
      hours.set(id, {
        activity: label(c.activity_type),
        method: label(c.method),
        duration: str(c.duration_display),
        frequency: label(c.frequency),
        days: str(c.days),
        additionalInformation: str(c.additional_information),
        offerings: str(c.applies_to_all_offerings) === "true" ? [] : [o.name],
      });
    }
  }

  const content = [str(d.content), str(d.learning_materials), str(d.learning_and_teaching_resources)].filter(Boolean).join("\n\n");
  return {
    code: str(d.code) || code,
    name: str(d.title),
    creditPoints: num(d.credit_points),
    yearLevel: num(val(d.level)),
    levelLabel: label(d.level),
    studyLevel: arr(d.study_level).map((s) => str(s.value)).join(", "),
    aqfLevel: label(d.aqf_level),
    school: val(d.academic_org) || val(d.school),
    college: val(d.college),
    status: label(d.status),
    discontinued: d.is_discontinued === true,
    suspended: d.is_suspended === true,
    phasingOut: d.is_phasing_out === true,
    campuses: [...new Set(offerings.map((o) => o.campus).filter(Boolean))],
    teachingPeriods: [...new Set(offerings.map((o) => o.teachingPeriod).filter(Boolean))],
    offerings,
    overview: str(d.description) || str(d.overview),
    learningActivities: str(d.learning_experiences),
    content,
    learningOutcomes: arr(d.unit_learning_outcomes)
      .sort(byOrder)
      .map((lo) => ({ code: str(lo.code), text: str(lo.description) })),
    assessments: [...assessments.values()],
    classHours: [...hours.values()],
    requisites: requisitesOf(d.requisites),
    enrolmentNotes: arr(d.enrolment_rules).map((r) => str(r.description)).filter(Boolean),
    tags: str(d.cs_tags),
    sourceUrl: `${HOST}${path}`,
    fetchedAt: day(rec.fetchedAt),
  };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

interface Course {
  code: string;
  name: string;
  title: string;
  level: string;
  aqfLevel: string;
  creditPoints: number;
  durationFullTime: string;
  school: string;
  status: string;
  discontinued: boolean;
  suspended: boolean;
  campuses: string[];
  offerings: Offering[];
  otherCampusVersions: { code: string; campus: string; url: string }[];
  overview: string;
  completionRequirements: string;
  professionalRecognition: string;
  majors: StructureItem[];
  coreSubjects: StructureItem[];
  structure: StructureGroup[];
  sourceUrl: string;
  fetchedAt: string;
}

const AOS_KINDS = /major|minor|specialisation|specialization|stream|aos/i;

async function importCourse(path: string): Promise<Course | null> {
  const code = codeOf(path);
  const rec = await get(`courses/${code}`, apiUrl(path));
  if (!rec || rec.status !== 200) return null;
  const d = (JSON.parse(rec.body) as { data?: Raw }).data;
  if (!d) return null;
  const structure = flattenStructure(d.curriculumStructure);
  const all = structure.flatMap((g) => g.items);
  const majors = all.filter((i) => AOS_KINDS.test(i.kind) || i.url.includes("/aos/"));
  const core = structure.filter((g) => /\bcore\b/i.test(g.title)).flatMap((g) => g.items.filter((i) => i.kind === "subject"));
  const dedupe = (items: StructureItem[]) => [...new Map(items.map((i) => [i.code, i])).values()];
  const title = str(d.title);
  const locations = str(d.location_names);
  const offerings = offeringsOf(d.offering);
  const other = (d.other_instances && typeof d.other_instances === "object" ? arr((d.other_instances as Raw).instances) : []).map((i) => ({
    code: str(i.assoc_code),
    campus: str(i.assoc_location_names),
    url: str(i.assoc_url) ? `${HOST}${str(i.assoc_url)}` : "",
  }));
  return {
    code: str(d.code) || code,
    name: (other[0] && str(arr<Raw>((d.other_instances as Raw).instances)[0]?.assoc_ai_title)) || (locations && title.endsWith(` - ${locations}`) ? title.slice(0, -(locations.length + 3)) : title),
    title,
    level: str(d.study_level),
    aqfLevel: str(d.aqf_level),
    creditPoints: num(d.credit_points),
    durationFullTime: str(d.duration_full_time),
    school: val(d.academic_org) || val(d.school),
    status: label(d.status),
    discontinued: d.is_discontinued === true,
    suspended: d.is_suspended === true,
    campuses: [...new Set([...locations.split(/\s*,\s*/), ...offerings.map((o) => o.campus)].filter(Boolean))],
    offerings,
    otherCampusVersions: other,
    overview: str(d.description) || str(d.overview),
    completionRequirements: str(d.completion_requirements),
    professionalRecognition: str(d.professional_recognition),
    majors: dedupe(majors),
    coreSubjects: dedupe(core),
    structure,
    sourceUrl: `${HOST}${path}`,
    fetchedAt: day(rec.fetchedAt),
  };
}

// ---------------------------------------------------------------------------
// Areas of study (majors, minors, specialisations)
// ---------------------------------------------------------------------------

interface Major {
  code: string;
  name: string;
  kind: string;
  creditPoints: number;
  school: string;
  status: string;
  discontinued: boolean;
  suspended: boolean;
  offerings: Offering[];
  overview: string;
  structureNotes: string;
  careers: string;
  availableInCourses: { code: string; title: string }[];
  /** All subjects, each with the year level of the group it sits in. */
  subjects: { code: string; name: string; yearLevel: number; group: string; creditPoints: number }[];
  structure: StructureGroup[];
  sourceUrl: string;
  fetchedAt: string;
}

async function importAos(path: string): Promise<Major | null> {
  const code = codeOf(path);
  const rec = await get(`aos/${code}`, apiUrl(path));
  if (!rec || rec.status !== 200) return null;
  const d = (JSON.parse(rec.body) as { data?: Raw }).data;
  if (!d) return null;
  const structure = flattenStructure(d.curriculumStructure);
  return {
    code: str(d.code) || code,
    name: str(d.title),
    kind: str(d.contentTypeLabel) || str(d.academic_item_type),
    creditPoints: num(d.credit_points),
    school: val(d.academic_org) || val(d.school),
    status: label(d.status),
    discontinued: d.is_discontinued === true,
    suspended: d.is_suspended === true,
    offerings: offeringsOf(d.aos_offering ?? d.location_and_mode),
    overview: str(d.description),
    structureNotes: str(d.structure_info),
    careers: str(d.areas_of_employment_handbook),
    availableInCourses: arr(d.available_in_courses).map((c) => ({ code: str(c.assoc_code), title: str(c.short_title) || str(c.assoc_title) })),
    subjects: structure.flatMap((g) =>
      g.items.filter((i) => i.kind === "subject").map((i) => ({ code: i.code, name: i.name, yearLevel: g.yearLevel, group: g.path, creditPoints: i.creditPoints })),
    ),
    structure,
    sourceUrl: `${HOST}${path}`,
    fetchedAt: day(rec.fetchedAt),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function pickPilot(paths: string[], n: number): string[] {
  // Spread across the alphabet (and so across faculties' code prefixes), plus the owner's four.
  const owner = paths.filter((p) => OWNER_SUBJECTS.includes(codeOf(p).toUpperCase()));
  const step = Math.max(1, Math.floor(paths.length / n));
  const spread = paths.filter((_, i) => i % step === 0).slice(0, n);
  return [...new Set([...owner, ...spread])];
}

function select(paths: string[], kind: "subjects" | "courses" | "aos"): string[] {
  if (CODES) {
    const chosen = paths.filter((p) => CODES.has(codeOf(p).toUpperCase()));
    return kind === "subjects" ? chosen : [];
  }
  if (PILOT) {
    if (kind === "subjects") return pickPilot(paths, LIMIT);
    const want = kind === "courses" ? ["SBIT", "SBCS"] : ["MJR-CSE001", "MAJOR-DATA"];
    const extra = paths.filter((p) => want.includes(codeOf(p)));
    return [...new Set([...extra, ...paths.filter((_, i) => i % Math.max(1, Math.floor(paths.length / 5)) === 0).slice(0, 5)])];
  }
  return Number.isFinite(LIMIT) ? paths.slice(0, LIMIT) : paths;
}

async function run<T>(label: string, paths: string[], fn: (p: string) => Promise<T | null>): Promise<T[]> {
  const out: T[] = [];
  const started = Date.now();
  for (let i = 0; i < paths.length; i++) {
    try {
      const r = await fn(paths[i]);
      if (r) out.push(r);
      else console.warn(`  ${label}: no record for ${paths[i]}`);
    } catch (e) {
      if (e instanceof BlockedError) throw e;
      console.warn(`  ${label}: failed ${paths[i]}: ${(e as Error).message}`);
    }
    if ((i + 1) % 25 === 0 || i === paths.length - 1) {
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`${label} ${i + 1}/${paths.length}  (${requests} requests, ${cacheHits} from cache, ${mins} min)`);
    }
  }
  return out;
}

function writeOut(name: string, data: unknown): number {
  mkdirSync(OUT, { recursive: true });
  const text = JSON.stringify(data);
  writeFileSync(join(OUT, name), text, "utf-8");
  console.log(`wrote src/data/latrobe-handbook/${name}  ${(text.length / 1024).toFixed(0)} KB`);
  return text.length;
}

/** Records already in the processed file are kept when a partial run (--codes, --limit) adds more. */
function merge<T extends { code: string }>(name: string, key: string, fresh: T[]): T[] {
  const f = join(OUT, name);
  if (!existsSync(f) || (!CODES && !Number.isFinite(LIMIT) && !PILOT)) return fresh.sort((a, b) => a.code.localeCompare(b.code));
  try {
    const old = (JSON.parse(readFileSync(f, "utf-8")) as Record<string, T[]>)[key] ?? [];
    const map = new Map(old.map((r) => [r.code, r]));
    for (const r of fresh) map.set(r.code, r);
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    return fresh;
  }
}

async function main() {
  console.log(`La Trobe Handbook ${YEAR} import${OFFLINE ? " (offline, cache only)" : ""}. Delay ${DELAY} ms. Cache: data-cache/handbook/`);
  if (!OFFLINE) {
    const robots = await get("robots", `${HOST}/robots.txt`, true);
    if (!robots || robots.status !== 200 || /Disallow:\s*\/\s*$/m.test(robots.body)) {
      console.error("robots.txt is missing or disallows crawling. Stopping.");
      process.exit(2);
    }
  }
  const lists = await listPaths();
  console.log(`Handbook lists ${lists.subjects.length} subjects, ${lists.courses.length} courses, ${lists.aos.length} areas of study for ${YEAR}.`);

  const fetchedOn = day(new Date().toISOString());
  const meta: Record<string, unknown> = {
    source: `${HOST} (La Trobe University Handbook ${YEAR})`,
    endpoint: `${HOST}/api/content/academic-item-content?siteId=${SITE_ID}&path=<page path>[&offering=<offering name>]`,
    year: YEAR,
    builtOn: fetchedOn,
    listed: { subjects: lists.subjects.length, courses: lists.courses.length, majors: lists.aos.length },
    note: "Text as stated in the Handbook. Unknown numbers are -1, unknown text is an empty string. Weekly topics are not published in the Handbook.",
  };

  try {
    if (ONLY.has("subjects")) {
      const subjects = merge("subjects.json", "subjects", await run("subjects", select(lists.subjects, "subjects"), importSubject));
      meta.subjects = subjects.length;
      meta.subjectsWithContent = subjects.filter((s) => s.content).length;
      meta.subjectsWithAssessments = subjects.filter((s) => s.assessments.length).length;
      writeOut("subjects.json", { year: YEAR, source: meta.source, subjects });
    }
    if (ONLY.has("courses")) {
      const courses = merge("courses.json", "courses", await run("courses", select(lists.courses, "courses"), importCourse));
      meta.courses = courses.length;
      writeOut("courses.json", { year: YEAR, source: meta.source, courses });
    }
    if (ONLY.has("majors")) {
      const majors = merge("majors.json", "majors", await run("majors", select(lists.aos, "aos"), importAos));
      meta.majors = majors.length;
      writeOut("majors.json", { year: YEAR, source: meta.source, majors });
    }
  } catch (e) {
    if (e instanceof BlockedError) {
      console.error(`STOPPED: ${e.message}`);
      process.exit(3);
    }
    throw e;
  }

  // Keep the counts of files not rebuilt this run.
  const metaFile = join(OUT, "meta.json");
  if (existsSync(metaFile)) {
    try {
      const old = JSON.parse(readFileSync(metaFile, "utf-8")) as Record<string, unknown>;
      for (const k of ["subjects", "courses", "majors", "subjectsWithContent", "subjectsWithAssessments"]) if (meta[k] === undefined && old[k] !== undefined) meta[k] = old[k];
    } catch {
      /* ignore */
    }
  }
  writeOut("meta.json", meta);
  const cached = existsSync(CACHE) ? readdirSync(CACHE).length : 0;
  console.log(`Done. ${requests} network requests, ${cacheHits} cache hits, ${cached} cache folders/files at the top level.`);
}

await main();
