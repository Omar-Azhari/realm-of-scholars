/**
 * Lexicon UI: guess the key term from its definition in six tries.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emit } from "../state/events";
import { realmStore, todayIso, useRealm } from "../state/store";
import type { RealmQuestion, RealmSubject } from "../types";
import { dailyLexicon, keyboardMarks, lettersOf, lexiconFeedback, lexiconScore, lexiconTerms, LEXICON_MAX_GUESSES, practiceLexicon, rivalLexicon, type LexiconPuzzle } from "./lexicon";
import { arenaAnswer, dailyPlayed, finishArenaMatch, type MatchReport } from "./record";
import { seededRng, shuffleWith } from "./rng";
import { compareScores, formatSeconds, isControl, MatchHeader, MatchResult, NotEnough, useForfeit, useNow, type ArenaGameProps } from "./ArenaShared";
import type { MatchOutcome } from "./rating";
import { Icon } from "../hud/icons";

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

/** The missed term as a multiple-choice card, so the Grimoire can bring it back. */
function termQuestion(subject: RealmSubject, puzzle: LexiconPuzzle): RealmQuestion | null {
  const others = lexiconTerms(subject).filter((t) => lettersOf(t.term) !== puzzle.letters);
  if (others.length < 3) return null;
  const rng = seededRng(`${subject.id}|${puzzle.letters}`);
  const choices = shuffleWith([puzzle.term, ...shuffleWith(others, rng).slice(0, 3).map((t) => t.term)], rng);
  return {
    id: `${subject.id}-lex-${puzzle.letters}`,
    prompt: `Which term matches this definition? "${puzzle.clue}"`,
    choices,
    answerIndex: choices.indexOf(puzzle.term),
    explanation: `${puzzle.term}: ${puzzle.clue.replace(/▁▁▁/g, puzzle.term)}`,
    week: null,
    difficulty: 1,
  };
}

export function LexiconGame({ subject, rival, onBack, onAgain }: ArenaGameProps) {
  const playerName = useRealm((s) => s.player?.name ?? "You");
  const [setup] = useState(() => {
    const today = todayIso();
    const daily = dailyLexicon(subject, today);
    const ranked = Boolean(daily) && !dailyPlayed(realmStore.get().progress.arena, "lexicon", subject.id);
    return { today, ranked, puzzle: ranked ? daily : practiceLexicon(subject, Math.random, daily?.letters) };
  });
  const { puzzle, ranked, today } = setup;
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(0);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [report, setReport] = useState<MatchReport | null>(null);
  const [showResult, setShowResult] = useState(false);
  const rivalRun = useMemo(() => rivalLexicon(rival.rating, `${today}|${subject.id}|${rival.id}`), [rival.rating, rival.id, today, subject.id]);
  const now = useNow(status === "playing", 250);
  const seconds = ((endedAt || now) - startedAt) / 1000;

  useForfeit(ranked && guesses.length > 0 && status === "playing", () => {
    finishArenaMatch({ game: "lexicon", subjectId: subject.id, rival, outcome: "loss", score: 0, daily: true });
  });

  const submit = useCallback(() => {
    if (!puzzle || status !== "playing") return;
    if (current.length !== puzzle.letters.length) {
      setMessage(`The term has ${puzzle.letters.length} letters.`);
      setShake((n) => n + 1);
      emit({ type: "sound", name: "miss" });
      return;
    }
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent("");
    setMessage("");
    const won = current === puzzle.letters;
    if (!won && next.length < LEXICON_MAX_GUESSES) {
      emit({ type: "sound", name: "click" });
      return;
    }
    const end = Date.now();
    setEndedAt(end);
    setStatus(won ? "won" : "lost");
    emit({ type: "sound", name: won ? "hit" : "miss" });
    const q = termQuestion(subject, puzzle);
    if (q) arenaAnswer(subject.id, q, won);
    const score = lexiconScore(won ? next.length : null, (end - startedAt) / 1000);
    if (ranked) {
      const result = compareScores(score, rivalRun.score);
      setOutcome(result);
      setReport(finishArenaMatch({ game: "lexicon", subjectId: subject.id, rival, outcome: result, score, daily: true }));
    }
    window.setTimeout(() => setShowResult(true), 1400);
  }, [puzzle, status, current, guesses, subject, startedAt, ranked, rivalRun.score, rival]);

  const press = useCallback(
    (key: string) => {
      if (!puzzle || status !== "playing") return;
      if (key === "ENTER") submit();
      else if (key === "BACK") setCurrent((c) => c.slice(0, -1));
      else if (/^[A-Z]$/.test(key)) setCurrent((c) => (c.length < puzzle.letters.length ? c + key : c));
    },
    [puzzle, status, submit],
  );

  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") {
        if (isControl(e.target)) return;
        e.preventDefault();
        press("ENTER");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        press("BACK");
      } else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!puzzle) {
    return <NotEnough onBack={onBack}>Lexicon needs key terms (plain words of 4-14 letters) for {subject.name}. Add them in the Codex or study more weeks.</NotEnough>;
  }

  const score = lexiconScore(status === "won" ? guesses.length : null, seconds);
  if (showResult) {
    return (
      <MatchResult report={report} outcome={outcome} rival={ranked ? rival : null} yourScore={score} rivalScore={ranked ? rivalRun.score : null} onAgain={onAgain} onBack={onBack} againLabel="Practice puzzle">
        <p className="arena-answer">
          The term was <b>{puzzle.term}</b>
          {status === "won" ? `, solved in ${guesses.length} guess${guesses.length === 1 ? "" : "es"}, ${formatSeconds(seconds * 1000)}.` : "."}
        </p>
        {ranked ? (
          <p className="muted small">
            {rival.name} {rivalRun.solvedIn ? `solved it in ${rivalRun.solvedIn} (${formatSeconds(rivalRun.seconds * 1000)})` : "didn't get it"}. Tomorrow brings a new daily term.
          </p>
        ) : null}
        {status === "lost" ? <p className="muted small">It's in your Grimoire for review tomorrow.</p> : null}
      </MatchResult>
    );
  }

  const marks = keyboardMarks(puzzle.letters, guesses);
  // Gap after these letter positions (word boundaries).
  const gaps = new Set<number>();
  puzzle.words.reduce((at, n) => {
    gaps.add(at + n - 1);
    return at + n;
  }, 0);
  const rows = Array.from({ length: LEXICON_MAX_GUESSES }, (_, r) => (r < guesses.length ? guesses[r] : r === guesses.length ? current : ""));

  return (
    <div className="arena-game arena-lexicon">
      <MatchHeader
        you={playerName}
        rival={rival}
        yourScore={`${guesses.length}/${LEXICON_MAX_GUESSES}`}
        rivalScore={ranked ? "?" : "-"}
        middle={<span className="arena-timer">{formatSeconds(seconds * 1000)}</span>}
      />
      <p className="arena-mode muted small">{ranked ? `Ranked daily puzzle · ${today}` : "Practice puzzle · unranked"}</p>
      <p className="arena-clue">
        <span className="label">Definition</span>
        {puzzle.clue}
      </p>
      <div className={`lex-board ${shake ? `shake-${shake % 2}` : ""}`}>
        {rows.map((word, r) => {
          const done = r < guesses.length;
          const fb = done ? lexiconFeedback(puzzle.letters, word) : null;
          return (
            <div key={r} className={`lex-row ${done && r === guesses.length - 1 ? "reveal" : ""}`}>
              {Array.from({ length: puzzle.letters.length }, (_, i) => (
                <span key={i} className={`lex-cell ${fb ? fb[i] : word[i] ? "typed" : ""} ${gaps.has(i) && i < puzzle.letters.length - 1 ? "gap" : ""}`} style={{ ["--i" as string]: i }}>
                  {word[i] ?? ""}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      <p className="arena-note" aria-live="polite">
        {message || (status === "won" ? "Solved." : status === "lost" ? `Out of guesses. It was ${puzzle.term}.` : `${puzzle.words.length > 1 ? `${puzzle.words.length} words, ` : ""}${puzzle.letters.length} letters. Type and press Enter.`)}
      </p>
      <div className="lex-keys">
        {KEY_ROWS.map((row, r) => (
          <div key={r} className="lex-key-row">
            {r === 2 ? (
              <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} className="lex-key wide" onClick={() => press("ENTER")}>
                Enter
              </button>
            ) : null}
            {row.split("").map((k) => (
              <button key={k} type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} className={`lex-key ${marks[k] ?? ""}`} onClick={() => press(k)}>
                {k}
              </button>
            ))}
            {r === 2 ? (
              <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} className="lex-key wide" onClick={() => press("BACK")} aria-label="Delete letter">
                <Icon name="backspace" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
