/**
 * Cleans assessment weights for the Unity export using the La Trobe Handbook 2026 (the official weights):
 * - unknown weights are filled from the Handbook when both list the same number of assessments (matched in order);
 * - a placeholder list ("Assessment structure not confirmed") is replaced by the Handbook's assessments;
 * - when the weights add to more than 100%, the parts of a larger assessment ("Assessment 3 - Part 1") stop
 *   counting on their own (weight -1, noted in the description), so the parent isn't counted twice.
 * Nothing is invented: every weight comes from the subject's own data or its Handbook entry.
 */

interface ExportAssessment {
  id: string;
  title: string;
  kind: string;
  weightPercent: number;
  dueWeek: number;
  dueDate: string;
  description?: string;
  steps?: string[];
}

interface HandbookAssessment {
  name: string;
  type: string;
  description: string;
  weightPercent: number;
}

const PLACEHOLDER = /not confirmed|to be confirmed|tbc/i;
const PART = /\bpart\s*\d+\b/i;
const PARENT = /\bparts?\b|three-part|two-part|multi-part|total/i;

function kindOf(type: string): string {
  const t = type.toLowerCase();
  if (/exam/.test(t)) return "exam";
  if (/quiz|test/.test(t)) return "quiz";
  if (/portfolio/.test(t)) return "portfolio";
  if (/present|demonstration/.test(t)) return "presentation";
  if (/report/.test(t)) return "report";
  if (/essay/.test(t)) return "essay";
  return "assignment";
}

export function cleanWeights(subjectId: string, list: ExportAssessment[], handbook: HandbookAssessment[] | null): ExportAssessment[] {
  let out = list.map((a) => ({ ...a }));
  const hb = (handbook ?? []).filter((h) => h && typeof h.weightPercent === "number" && h.weightPercent >= 0);

  if (hb.length > 0 && (out.length === 0 || (out.length === 1 && PLACEHOLDER.test(out[0].title)))) {
    out = hb.map((h, i) => ({
      id: `${subjectId}-hb${i + 1}`,
      title: h.name && h.name.toLowerCase() !== h.type.toLowerCase() ? h.name : `${h.type} ${i + 1}`,
      kind: kindOf(h.type),
      weightPercent: h.weightPercent,
      dueWeek: -1,
      dueDate: "",
      description: (h.description ?? "").trim(),
      steps: [],
    }));
    return out;
  }

  if (hb.length > 0 && hb.length === out.length) {
    out.forEach((a, i) => {
      if (a.weightPercent < 0) a.weightPercent = hb[i].weightPercent;
    });
  }

  const total = out.reduce((sum, a) => sum + Math.max(0, a.weightPercent), 0);
  if (total > 100) {
    for (const a of out) {
      if (!PART.test(a.title) || a.weightPercent < 0) continue;
      const parent = out.find((p) => p !== a && PARENT.test(p.title) && !PART.test(p.title) && p.weightPercent >= a.weightPercent);
      if (!parent) continue;
      a.description = `Part of "${parent.title}" (${a.weightPercent}% of its ${parent.weightPercent}%). ${a.description ?? ""}`.trim();
      a.weightPercent = -1;
    }
  }
  return out;
}
