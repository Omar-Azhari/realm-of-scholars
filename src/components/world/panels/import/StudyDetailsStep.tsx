/**
 * Step 1 — Study details (Phase 18A, Part 7; university/subjects added
 * Phase 18B, Part 5). Every field is optional except that `academicYear`, if
 * given, becomes the ONLY source a date parser is ever allowed to use to
 * resolve a year-less date — never inferred, always this explicit value
 * (see extraction/dates.ts).
 *
 * `universityId` + `subjectCodes` are optional and additive: leaving
 * university unset skips automatic discovery entirely and the flow behaves
 * exactly as it did before Phase 18B (straight to Import sources).
 */

import { UNIVERSITY_REGISTRY } from "../../../../import/universityRegistry";

export interface StudyDetails {
  institution: string;
  degree: string;
  major: string;
  academicYear: string;
  semesterName: string;
  campus: string;
  universityId: string;
  subjectCodes: string;
}

export function StudyDetailsStep({
  details,
  onChange,
  onContinue,
  onSkip,
}: {
  details: StudyDetails;
  onChange: (details: StudyDetails) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const set = (patch: Partial<StudyDetails>) => onChange({ ...details, ...patch });
  const selectedUniversity = UNIVERSITY_REGISTRY.find((u) => u.id === details.universityId) ?? null;

  return (
    <div className="setup-step">
      <p className="setup-lede">
        Tell us what you study, then add whatever documents you have. UniGame will build as much of
        the semester as it can.
      </p>

      <div className="setup-form-grid">
        <label>
          Institution
          <input
            type="text"
            value={details.institution}
            onChange={(e) => set({ institution: e.target.value })}
            placeholder="e.g. La Trobe University"
          />
        </label>
        <label>
          Degree
          <input type="text" value={details.degree} onChange={(e) => set({ degree: e.target.value })} placeholder="e.g. Bachelor of IT" />
        </label>
        <label>
          Major
          <input type="text" value={details.major} onChange={(e) => set({ major: e.target.value })} />
        </label>
        <label>
          Academic year
          <input
            type="text"
            inputMode="numeric"
            value={details.academicYear}
            onChange={(e) => set({ academicYear: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
            placeholder="e.g. 2026"
          />
        </label>
        <label>
          Semester / teaching period
          <input
            type="text"
            value={details.semesterName}
            onChange={(e) => set({ semesterName: e.target.value })}
            placeholder="e.g. Semester 2"
          />
        </label>
        <label>
          Campus <span className="setup-optional">(optional)</span>
          <input type="text" value={details.campus} onChange={(e) => set({ campus: e.target.value })} />
        </label>
      </div>

      <p className="setup-hint">
        The academic year you enter here is the only year UniGame will ever use to resolve a date
        that has no year of its own — it never guesses one.
      </p>

      <div className="setup-university-search">
        <label>
          Search your university's public handbook <span className="setup-optional">(optional)</span>
          <select value={details.universityId} onChange={(e) => set({ universityId: e.target.value })}>
            <option value="">Don't search automatically</option>
            {UNIVERSITY_REGISTRY.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        {selectedUniversity ? (
          <>
            <label>
              Subjects <span className="setup-optional">(one per line — a code like {selectedUniversity.unitTerm === "unit" ? "FIT1045" : "CSE2UI"}, or a full subject name)</span>
              <textarea
                rows={3}
                value={details.subjectCodes}
                onChange={(e) => set({ subjectCodes: e.target.value })}
                placeholder={`One ${selectedUniversity.unitTerm} code or name per line, e.g.\n${selectedUniversity.unitTerm === "unit" ? "FIT1045" : "CSE2UI"}\nUser Interface Design`}
              />
            </label>
            <p className="setup-hint">
              {selectedUniversity.verified
                ? `UniGame can read ${selectedUniversity.name}'s public handbook directly for these ${selectedUniversity.unitTerm}s, by code or by name.`
                : `UniGame will try ${selectedUniversity.name}'s public handbook, but this university hasn't been fully verified yet — some or all ${selectedUniversity.unitTerm}s may need an uploaded guide instead.`}
            </p>
          </>
        ) : null}
      </div>

      <div className="setup-actions">
        <button type="button" className="button--primary" onClick={onContinue}>
          Continue
        </button>
        <button type="button" onClick={onSkip}>
          Not now
        </button>
      </div>
    </div>
  );
}
