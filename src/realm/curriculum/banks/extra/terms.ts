/**
 * Week-tagged key terms for the built-in banks: the original 18 per subject (in latrobeBanks.ts, tagged here
 * by week) followed by the extra terms in extra/{ui,cwa,pm,ppe}.ts, deduplicated by term (case-insensitive).
 */

import type { RealmKeyTerm } from "../../../types";
import { EXTRA_UI_TERMS } from "./ui";
import { EXTRA_CWA_TERMS } from "./cwa";
import { EXTRA_PM_TERMS } from "./pm";
import { EXTRA_PPE_TERMS } from "./ppe";

const EXTRA_TERMS: Record<string, RealmKeyTerm[]> = { ui: EXTRA_UI_TERMS, cwa: EXTRA_CWA_TERMS, pm: EXTRA_PM_TERMS, ppe: EXTRA_PPE_TERMS };

/** Teaching week of each original bank term, from the lecture that teaches it. */
const BASE_TERM_WEEKS: Record<string, Record<string, number>> = {
  ui: {
    "Usability": 1, "Human-centred design": 2, "Double Diamond": 3, "Contextual inquiry": 3, "Persona": 4, "Affinity diagram": 4,
    "Prototype fidelity": 6, "Wizard of Oz prototype": 6, "Think-aloud protocol": 7, "Heuristic evaluation": 7,
    "System Usability Scale": 8, "Thematic analysis": 8, "Affordance": 9, "Signifier": 9, "Mental model": 10,
    "Gulf of execution": 10, "Curb-cut effect": 11, "Fitts's law": 12,
  },
  cwa: {
    "IaaS": 1, "PaaS": 1, "SaaS": 1, "Horizontal scaling": 1, "Middleware": 2, "CORS": 2, "Parameterised query": 3,
    "OAuth 2.0": 5, "JWT": 5, "bcrypt": 5, "Passkey": 5, "React Server Component": 6, "MQTT": 7, "Dependency injection": 8,
    "Microsoft Graph": 9, "Security group": 10, "Amazon S3": 10, "CI/CD": 11,
  },
  pm: {
    "Triple constraint": 1, "Product Owner": 3, "Sprint Retrospective": 3, "Project charter": 4, "Work breakdown structure": 5,
    "Work package": 5, "Gold plating": 5, "Critical path": 6, "Total float": 6, "Fast tracking": 6, "Crashing": 6,
    "Earned value": 7, "CPI": 7, "SPI": 7, "Risk register": 8, "Expected monetary value": 8, "PRINCE2": 10,
    "Incident vs problem (ITIL)": 11,
  },
  ppe: {
    "MVP": 3, "TAM / SAM / SOM": 3, "Value proposition": 4, "Business Model Canvas": 5, "Lean Canvas": 5, "LTV:CAC": 5,
    "Utilitarianism": 7, "Deontology": 7, "Virtue ethics": 7, "Primacy of the public interest": 7, "GDPR": 8,
    "Notifiable Data Breaches scheme": 8, "Data minimisation": 8, "Algorithmic bias": 9, "Copyleft": 10,
    "Permissive licence": 10, "STAR": 11, "BATNA": 12,
  },
};

/** The bank's own terms (given their week) followed by the extra terms, deduplicated by term, case-insensitive. */
export function withExtraTerms(key: string, base: RealmKeyTerm[]): RealmKeyTerm[] {
  const weeks = BASE_TERM_WEEKS[key] ?? {};
  const seen = new Set<string>();
  const out: RealmKeyTerm[] = [];
  for (const term of [...base, ...(EXTRA_TERMS[key] ?? [])]) {
    const id = term.term.trim().toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const week = term.week ?? weeks[term.term];
    out.push(week === undefined || term.week === week ? term : { ...term, week });
  }
  return out;
}
