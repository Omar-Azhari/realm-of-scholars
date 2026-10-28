/**
 * Ready-made lectures for the lecture theatre: real teaching for every week
 * of the La Trobe subjects UniGame ships with, so the professor can teach
 * without an API key. Check-in questions are not stored here; they come from
 * the week's questions in the question bank (banks/latrobeBanks.ts).
 */

/**
 * An animated diagram shown on the theatre screen while a segment is taught.
 * Parts appear one at a time as the professor talks (see scene/lectureVisuals.ts).
 * Keep every label short: 1-6 words (definitions and formula steps up to ~14 words).
 */
export type LectureVisual =
  /** 2-6 boxes left to right joined by arrows: a process or pipeline. */
  | { kind: "flow"; title?: string; steps: string[] }
  /** 3-6 steps around a circle: an iterative loop (e.g. PDCA, a sprint). */
  | { kind: "cycle"; title?: string; steps: string[] }
  /** Two columns side by side: X versus Y, 2-4 items each. */
  | { kind: "compare"; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  /** 2-6 stacked layers, top first: an architecture or hierarchy of layers. */
  | { kind: "stack"; title?: string; layers: string[] }
  /** 2-6 events left to right, each with a short detail. */
  | { kind: "timeline"; title?: string; events: Array<{ label: string; detail: string }> }
  /** A formula, then 2-5 worked lines revealed one by one (real numbers, checked). */
  | { kind: "formula"; formula: string; steps: string[] }
  /** A grid (2-3 rows x 2-3 cols) with axis labels: e.g. probability x impact, Eisenhower. */
  | { kind: "matrix"; title?: string; rowLabel: string; colLabel: string; rows: string[]; cols: string[]; cells: string[][] }
  /** A root with 2-5 children, each with up to 4 sub-items: e.g. a WBS. */
  | { kind: "tree"; root: string; children: Array<{ label: string; children?: string[] }> }
  /** 2-6 labelled bars (values >= 0) for comparing amounts. */
  | { kind: "bars"; title?: string; unit?: string; items: Array<{ label: string; value: number }> }
  /** One key term and its definition as a big card. */
  | { kind: "definition"; term: string; definition: string };

export interface BankSegment {
  /** Slide title. */
  heading: string;
  /** What the professor says, in their own voice: explains, doesn't list. 130-220 words. */
  narration: string;
  /** 3-4 short slide bullets. */
  points: string[];
  /** A concrete worked example or real case (1-3 sentences), or "". */
  example: string;
  /** The animated diagram for this segment (most segments should have one). */
  visual?: LectureVisual;
}

/** A real explainer video shown on the screen at the end of a lecture (verified to exist). */
export interface LectureVideo {
  /** The 11-character YouTube video id. */
  youtubeId: string;
  title: string;
  channel: string;
  /** Optional start time in seconds. */
  start?: number;
  /** One sentence the professor says to introduce it. */
  intro: string;
}

export interface BankLecture {
  title: string;
  /** One or two spoken sentences on why this week matters. */
  hook: string;
  /** 3-4 things the student can do afterwards. */
  objectives: string[];
  /** 6-8 segments in teaching order. */
  segments: BankSegment[];
  /** 4-6 one-sentence summary points. */
  takeaways: string[];
  /** A short real video to finish with, when a good one exists. */
  video?: LectureVideo;
}

/** The (fictional) professor who teaches the subject. */
export interface Professor {
  name: string;
  /** e.g. "Professor of Interaction Design". */
  title: string;
  /** One line on their teaching personality, shown on the setup screen. */
  style: string;
}

export interface SubjectLectures {
  match: (code: string, name: string) => boolean;
  professor?: Professor;
  /** Week number -> lecture. */
  weeks: Record<number, BankLecture>;
}
