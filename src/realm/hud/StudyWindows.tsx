/**
 * Windows for the study tools: the Grimoire of Mistakes (spaced review),
 * the tutor chat, the Moodle calendar import, the Agora bazaar and the
 * study group.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Window } from "./Window";
import { HouseFeed } from "./HouseFeed";
import { realmStore, todayIso, useRealm } from "../state/store";
import { chat } from "../state/events";
import { answerReview, dueCards, finishReviewSession, nextReviewDate, REVIEW_INTERVALS } from "../state/grimoire";
import { buyItem, equipItem, shopItems, type ShopItem, type ShopSlot } from "../state/shop";
import { addGroupMember, makeShareCode, memberFromState, removeGroupMember, subjectLeaderboard } from "../state/group";
import { currentTeachingWeek, liveStreak } from "../state/actions";
import { askTutor, CurriculumFetchError, fetchMoodleCalendar } from "../curriculum/curriculumClient";
import { applyCalendarMatches, cleanTitle, matchCalendar, parseCalendar, type CalendarMatch } from "../curriculum/calendarImport";
import { isLaTrobe } from "../world/worldGen";
import { shuffle } from "../curriculum/questionBank";
import type { RealmQuestion, RealmSubject } from "../types";
import { Icon } from "./icons";

// ---------------------------------------------------------------------------
// Grimoire of Mistakes
// ---------------------------------------------------------------------------

/** Shuffles the choices so a remembered position doesn't give the answer away. */
function shuffled(question: RealmQuestion): { choices: string[]; answerIndex: number } {
  const order = shuffle([0, 1, 2, 3]);
  return { choices: order.map((i) => question.choices[i]), answerIndex: order.indexOf(question.answerIndex) };
}

export function GrimoireWindow({ onClose }: { onClose: () => void }) {
  // The session is fixed when the window opens; answering reschedules cards out of today's list.
  const [session] = useState(() => dueCards(realmStore.get()));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<string>("");
  const [stats, setStats] = useState({ reviewed: 0, mastered: 0 });
  const subjects = useRealm((s) => s.curriculum?.subjects) ?? [];
  const nextDate = useRealm((s) => nextReviewDate(s));
  const total = useRealm((s) => Object.keys(s.progress.mistakes).length);
  const card = session[index];
  const view = useMemo(() => (card ? shuffled(card.entry.question) : null), [card]);

  const close = () => {
    finishReviewSession(stats.reviewed, stats.mastered);
    onClose();
  };

  if (!card || !view) {
    return (
      <Window title="Grimoire of Mistakes" onClose={close} width={560}>
        {stats.reviewed > 0 ? (
          <p>
            Review complete: {stats.reviewed} answered{stats.mastered ? `, ${stats.mastered} mastered` : ""}.
          </p>
        ) : null}
        <p>
          Every question you get wrong in a trial, exam duel or boss fight is written here. It asks you again{" "}
          {REVIEW_INTERVALS.map((d) => `${d}`).join(", ")} days later; answer it right each time and it is struck from the book.
        </p>
        <p className="muted small">
          {total === 0 ? "The book is empty. No mistakes to review." : `${total} question${total === 1 ? "" : "s"} in the book. Next review: ${nextDate === todayIso() ? "today" : nextDate}.`}
        </p>
        <button type="button" className="rs-button" onClick={close}>
          Close the book
        </button>
      </Window>
    );
  }

  const subject = subjects.find((s) => s.id === card.entry.subjectId);
  const answer = (choice: number) => {
    if (picked !== null) return;
    setPicked(choice);
    const result = answerReview(card.key, choice === view.answerIndex);
    setStats((s) => ({ reviewed: s.reviewed + 1, mastered: s.mastered + (result === "mastered" ? 1 : 0) }));
    setOutcome(
      result === "mastered"
        ? "Mastered. Struck from the Grimoire."
        : result === "promoted"
          ? `Correct. Next review in ${REVIEW_INTERVALS[Math.min(REVIEW_INTERVALS.length - 1, card.entry.box + 1)]} days.`
          : "Not yet. It will ask again tomorrow.",
    );
  };

  return (
    <Window title="Grimoire of Mistakes" onClose={close} width={620}>
      <div className="duel-question">
        <p className="muted small">
          Card {index + 1} of {session.length} · {subject ? subject.name : ""}
          {card.entry.question.week ? ` · Week ${card.entry.question.week}` : ""} · missed {card.entry.misses}×
        </p>
        <p className="prompt">{card.entry.question.prompt}</p>
        <div className="choices">
          {view.choices.map((choice, i) => {
            const state = picked === null ? "" : i === view.answerIndex ? "right" : i === picked ? "wrong" : "dim";
            return (
              <button key={i} type="button" className={`choice ${state}`} onClick={() => answer(i)} disabled={picked !== null}>
                <span className="key">{i + 1}</span> {choice}
              </button>
            );
          })}
        </div>
        {picked !== null ? (
          <div className="explain">
            <p>
              <strong>{outcome}</strong> {card.entry.question.explanation}
            </p>
            <button
              type="button"
              className="rs-button"
              onClick={() => {
                setPicked(null);
                setIndex((i) => i + 1);
              }}
            >
              {index + 1 < session.length ? "Next card" : "Finish"}
            </button>
          </div>
        ) : null}
      </div>
    </Window>
  );
}

// ---------------------------------------------------------------------------
// Tutor chat
// ---------------------------------------------------------------------------

interface ChatLine {
  role: "student" | "tutor";
  text: string;
}

/** Without the AI server, the tutor still looks things up in the subject's own codex. */
function offlineAnswer(subject: RealmSubject, question: string): string {
  const words = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  const score = (text: string) => words.reduce((n, w) => (text.toLowerCase().includes(w) ? n + 1 : n), 0);
  const terms = subject.keyTerms
    .map((t) => ({ t, s: score(t.term) * 3 + score(t.definition) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2);
  const weeks = subject.weeks
    .map((w) => ({ w, s: score(`${w.title} ${w.topics.join(" ")} ${w.summary}`) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2);
  if (terms.length === 0 && weeks.length === 0) {
    return "I can't find that in this subject's codex. Try the key word itself (for example a term from the lecture), or open the Codex to browse every week.";
  }
  const parts = [
    ...terms.map(({ t }) => `${t.term}: ${t.definition}`),
    ...weeks.map(({ w }) => `It's covered in Week ${w.week}: ${w.title}${w.topics.length ? ` (${w.topics.slice(0, 4).join(", ")})` : ""}.`),
  ];
  return parts.join(" ");
}

export function TutorChatWindow({ subject, tutorName, aiAvailable, onClose }: { subject: RealmSubject; tutorName: string; aiAvailable: boolean; onClose: () => void }) {
  const curriculum = useRealm((s) => s.curriculum);
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: "tutor",
      text: aiAvailable
        ? `Ask me anything about ${subject.name}. I'll explain the ideas and point you to the right week, but I won't write your assessments for you.`
        : `My voice is faint today (the realm's AI server isn't set up), but I can still look things up in the ${subject.name} codex. Ask about a term or topic.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines, busy]);

  const send = async () => {
    const question = draft.trim();
    if (!question || busy) return;
    setDraft("");
    const history = lines.slice(1);
    setLines((l) => [...l, { role: "student", text: question }]);
    if (!aiAvailable) {
      setLines((l) => [...l, { role: "tutor", text: offlineAnswer(subject, question) }]);
      return;
    }
    setBusy(true);
    abort.current = new AbortController();
    try {
      const reply = await askTutor(
        {
          university: curriculum?.enrolment.university ?? "",
          tutorName,
          subject: {
            code: subject.code,
            name: subject.name,
            summary: subject.summary,
            learningOutcomes: subject.learningOutcomes,
            weeks: subject.weeks.map((w) => ({ week: w.week, title: w.title, topics: w.topics })),
            keyTerms: subject.keyTerms,
            assessments: subject.assessments.map((a) => `${a.title}${a.weightPercent !== null ? ` (${a.weightPercent}%)` : ""}`),
          },
          currentWeek: currentTeachingWeek(curriculum),
          history,
          question,
        },
        abort.current.signal,
      );
      setLines((l) => [...l, { role: "tutor", text: reply }]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof CurriculumFetchError && error.failure.kind === "ai-unavailable" ? offlineAnswer(subject, question) : `(${error instanceof Error ? error.message : "The tutor couldn't answer."})`;
      setLines((l) => [...l, { role: "tutor", text: message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Window title={`Ask ${tutorName}`} onClose={onClose} width={620} className="tutor-chat">
      <div className="tutor-log" ref={log} aria-live="polite">
        {lines.map((line, i) => (
          <p key={i} className={line.role}>
            <strong>{line.role === "tutor" ? tutorName : "You"}:</strong> {line.text}
          </p>
        ))}
        {busy ? <p className="tutor muted">{tutorName} is thinking…</p> : null}
      </div>
      <form
        className="tutor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`e.g. "Explain ${subject.keyTerms[0]?.term ?? "this week's main idea"}"`} maxLength={2000} aria-label="Your question" autoFocus />
        <button type="submit" className="rs-button" disabled={busy || !draft.trim()}>
          Ask
        </button>
      </form>
    </Window>
  );
}

// ---------------------------------------------------------------------------
// Moodle calendar import
// ---------------------------------------------------------------------------

export function CalendarImportWindow({ onClose }: { onClose: () => void }) {
  const curriculum = useRealm((s) => s.curriculum);
  const subjects = curriculum?.subjects ?? [];
  const laTrobe = isLaTrobe(curriculum?.enrolment.university);
  const [matches, setMatches] = useState<CalendarMatch[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = (text: string) => {
    try {
      const events = parseCalendar(text);
      const found = matchCalendar(events, subjects);
      setMatches(found);
      setChosen(Object.fromEntries(found.map((m) => [m.event.uid, m.subjectId !== null])));
      setError(found.length === 0 ? `The calendar had ${events.length} events but none looked like a deadline.` : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that calendar.");
    }
  };

  const fromUrl = async () => {
    setBusy(true);
    setError("");
    try {
      load(await fetchMoodleCalendar(url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The link didn't work.");
    } finally {
      setBusy(false);
    }
  };

  const setMatch = (uid: string, patch: Partial<CalendarMatch>) => setMatches((list) => list?.map((m) => (m.event.uid === uid ? { ...m, ...patch } : m)) ?? null);

  const apply = () => {
    if (!matches || !curriculum) return;
    const selected = matches.filter((m) => chosen[m.event.uid] && m.subjectId);
    const result = applyCalendarMatches(curriculum.subjects, selected);
    realmStore.set((s) => (s.curriculum ? { ...s, curriculum: { ...s.curriculum, subjects: result.subjects } } : s));
    chat(`Calendar imported: ${result.updated} quest${result.updated === 1 ? "" : "s"} got real due dates${result.added ? `, ${result.added} new quest${result.added === 1 ? "" : "s"} added` : ""}.`, "quest");
    onClose();
  };

  return (
    <Window title="Import deadlines from Moodle" onClose={onClose} width={720}>
      {!matches ? (
        <>
          <p>Bring your real due dates into the realm. Quests then show the right dates, the "Due next" list is accurate, and deadline bosses rise on time.</p>
          <ol className="howto">
            <li>In Moodle, open the <strong>Calendar</strong>, then <strong>Import or export calendars</strong>, then <strong>Export calendar</strong>.</li>
            <li>Choose <strong>All courses</strong> and a time period covering the semester.</li>
            <li>Either <strong>Export</strong> to download a .ics file and upload it here{laTrobe ? ", or click Get calendar URL and paste the link" : ""}.</li>
          </ol>
          <div className="row">
            <button type="button" className="rs-button" onClick={() => fileInput.current?.click()}>
              Upload .ics file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".ics,text/calendar"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) load(await file.text());
              }}
            />
          </div>
          {laTrobe ? (
            <div className="row calendar-url">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://lms.latrobe.edu.au/calendar/export_execute.php?…" aria-label="Moodle calendar link" />
              <button type="button" className="rs-button secondary" disabled={!url.trim() || busy} onClick={() => void fromUrl()}>
                {busy ? "Fetching…" : "Fetch"}
              </button>
            </div>
          ) : null}
          {laTrobe ? <p className="muted small">The link contains your private calendar key. It's used once to fetch the calendar and is never saved.</p> : null}
        </>
      ) : (
        <>
          <p className="muted small">Tick the deadlines to bring in. Each is matched to a quest by subject code and title. Change any match before importing.</p>
          <ul className="calendar-matches">
            {matches.map((m) => {
              const subject = subjects.find((s) => s.id === m.subjectId);
              return (
                <li key={m.event.uid} className={m.subjectId ? "" : "unmatched"}>
                  <label>
                    <input type="checkbox" checked={Boolean(chosen[m.event.uid])} disabled={!m.subjectId} onChange={(e) => setChosen((c) => ({ ...c, [m.event.uid]: e.target.checked }))} />
                    <span className="date">{new Date(`${m.event.date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                    <span className="summary">{m.event.summary}</span>
                  </label>
                  {subject ? (
                    <select value={m.assessmentId ?? "__new"} onChange={(e) => setMatch(m.event.uid, { assessmentId: e.target.value === "__new" ? null : e.target.value })} aria-label="Quest for this deadline">
                      {subject.assessments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {subject.code}: {a.title}
                        </option>
                      ))}
                      <option value="__new">New quest: “{cleanTitle(m.event.summary)}”</option>
                    </select>
                  ) : (
                    <span className="muted small">No subject code found, skipped</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="row">
            <button type="button" className="rs-button" onClick={apply} disabled={!matches.some((m) => chosen[m.event.uid] && m.subjectId)}>
              Import {matches.filter((m) => chosen[m.event.uid] && m.subjectId).length} deadline(s)
            </button>
            <button type="button" className="rs-button secondary" onClick={() => setMatches(null)}>
              Back
            </button>
          </div>
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
    </Window>
  );
}

// ---------------------------------------------------------------------------
// Bazaar
// ---------------------------------------------------------------------------

const SLOT_LABEL: Record<ShopSlot, string> = { cape: "Cloaks", hat: "Hats", pet: "Familiars" };

export function ShopWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const items = shopItems(state);
  const wardrobe = state.progress.wardrobe;
  const swatch = (item: ShopItem) =>
    item.slot === "cape" ? <span className="swatch" style={{ background: item.look }} /> : <span className="swatch icon">
          <Icon name={item.slot === "hat" ? (item.look === "laurel" ? "leaf" : item.look === "wizard" ? "wand" : "cap") : item.look === "wisp" ? "star" : "skull"} />
        </span>;
  return (
    <Window title="Agora bazaar" onClose={onClose} width={640}>
      <p>
        “Coins earned by honest study spend just as well here.” You have <strong>{state.progress.coins}</strong> coins.
      </p>
      {(["cape", "hat", "pet"] as const).map((slot) => (
        <section key={slot} className="shop-section">
          <h3>
            {SLOT_LABEL[slot]}
            {wardrobe[slot] ? (
              <button type="button" className="link" onClick={() => equipItem(slot, null)}>
                take off
              </button>
            ) : null}
          </h3>
          <ul className="shop-list">
            {items
              .filter((item) => item.slot === slot)
              .map((item) => {
                const owned = wardrobe.owned.includes(item.id);
                const worn = wardrobe[slot] === item.id;
                const lock = owned ? null : item.locked?.(state) ?? null;
                return (
                  <li key={item.id} className={worn ? "worn" : ""}>
                    {swatch(item)}
                    <span className="text">
                      <strong>{item.name}</strong>
                      <span className="muted small">{lock ?? item.blurb}</span>
                    </span>
                    {owned ? (
                      <button type="button" className="rs-button secondary" disabled={worn} onClick={() => equipItem(slot, item.id)}>
                        {worn ? "Wearing" : "Wear"}
                      </button>
                    ) : (
                      <button type="button" className="rs-button" disabled={Boolean(lock) || state.progress.coins < item.price} onClick={() => buyItem(item.id)}>
                        {item.price === 0 ? "Claim" : `${item.price} coins`}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </Window>
  );
}

// ---------------------------------------------------------------------------
// Study group
// ---------------------------------------------------------------------------

export function GroupWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const own = memberFromState(state);
  const code = useMemo(() => makeShareCode(state), [state]);
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);
  const members = Object.entries(state.progress.group);
  const codes = own ? Object.keys(own.levels) : [];

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      chat("Couldn't copy automatically. Select the code and copy it.");
    }
  };

  return (
    <Window title="Study group" onClose={onClose} width={680}>
      <p>Swap codes with classmates to compare levels in the subjects you share. No account needed: a code is a snapshot of your levels, quest points and streak, and nothing else.</p>
      <HouseFeed />
      <h3>Your code</h3>
      <div className="row share-code">
        <input readOnly value={code ?? ""} aria-label="Your share code" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="rs-button" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <h3>Add a classmate</h3>
      <form
        className="row share-code"
        onSubmit={(e) => {
          e.preventDefault();
          if (addGroupMember(paste)) setPaste("");
        }}
      >
        <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste their SCHOLAR1-… code" aria-label="Classmate's code" />
        <button type="submit" className="rs-button secondary" disabled={!paste.trim()}>
          Add
        </button>
      </form>
      {members.length > 0 ? (
        <>
          <h3>Leaderboards</h3>
          <div className="leaderboards">
            {codes.map((subjectCode) => {
              const rows = subjectLeaderboard(state, subjectCode);
              if (rows.length < 2) return null;
              return (
                <div key={subjectCode} className="leaderboard">
                  <p className="name">{subjectCode}</p>
                  <ol>
                    {rows.map((row) => (
                      <li key={row.name} className={row.you ? "you" : ""}>
                        <span>{row.name}</span> <strong>{row.level}</strong>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
          <table className="group-table">
            <thead>
              <tr>
                <th>Scholar</th>
                <th>Total level</th>
                <th>Quest points</th>
                <th>Streak</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {own ? (
                <tr className="you">
                  <td>{own.name} (you)</td>
                  <td>{own.totalLevel}</td>
                  <td>{own.questPoints}</td>
                  <td>{liveStreak(state)}</td>
                  <td />
                </tr>
              ) : null}
              {members.map(([key, m]) => (
                <tr key={key}>
                  <td>
                    {m.name}
                    <span className="muted small"> · code from {new Date(m.sharedAt).toLocaleDateString()}</span>
                  </td>
                  <td>{m.totalLevel}</td>
                  <td>{m.questPoints}</td>
                  <td>{m.streak}</td>
                  <td>
                    <button type="button" className="link" onClick={() => removeGroupMember(key)}>
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="muted small">No classmates yet. Send them your code and paste theirs here.</p>
      )}
    </Window>
  );
}
