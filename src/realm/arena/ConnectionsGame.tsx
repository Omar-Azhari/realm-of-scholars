/**
 * Connections UI: sort sixteen lecture ideas into the four weeks they come from.
 */

import { useMemo, useState } from "react";
import { emit } from "../state/events";
import { useRealm } from "../state/store";
import { buildConnections, checkGroup, connectionsScore, CONNECTIONS_GROUP_SIZE, CONNECTIONS_GROUPS, CONNECTIONS_MAX_MISTAKES, rivalConnections } from "./connections";
import { arenaWeekResult, finishArenaMatch, type MatchReport } from "./record";
import { shuffleWith } from "./rng";
import { compareScores, formatSeconds, MatchHeader, MatchResult, NotEnough, useForfeit, useNow, type ArenaGameProps } from "./ArenaShared";
import type { MatchOutcome } from "./rating";

export function ConnectionsGame({ subject, rival, onBack, onAgain }: ArenaGameProps) {
  const playerName = useRealm((s) => s.player?.name ?? "You");
  const [puzzle] = useState(() => buildConnections(subject, Math.random));
  const [seed] = useState(() => `${Date.now()}-${Math.random()}`);
  const rivalRun = useMemo(() => rivalConnections(rival.rating, seed), [rival.rating, seed]);
  const [order, setOrder] = useState<string[]>(() => puzzle?.tiles.map((t) => t.id) ?? []);
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [shake, setShake] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState(0);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [report, setReport] = useState<MatchReport | null>(null);
  const [showResult, setShowResult] = useState(false);
  const playing = !endedAt;
  const now = useNow(playing, 250);
  const elapsedMs = (endedAt || now) - startedAt;
  const started = solved.length > 0 || mistakes > 0;

  useForfeit(playing && started, () => {
    finishArenaMatch({ game: "connections", subjectId: subject.id, rival, outcome: "loss", score: 0 });
  });

  if (!puzzle) {
    return (
      <NotEnough onBack={onBack}>
        Connections needs four weeks of {subject.name} with at least four distinct ideas each (lecture slides, weekly topics or key terms). Add topics in the Codex.
      </NotEnough>
    );
  }

  const finish = (found: number[], misses: number) => {
    const end = Date.now();
    setEndedAt(end);
    puzzle.groups.forEach((g, i) => {
      if (!found.includes(i)) arenaWeekResult(subject.id, g.week, false);
    });
    const score = connectionsScore(found.length, misses, (end - startedAt) / 1000);
    const result = compareScores(score, rivalRun.score);
    setOutcome(result);
    setReport(finishArenaMatch({ game: "connections", subjectId: subject.id, rival, outcome: result, score }));
    window.setTimeout(() => setShowResult(true), found.length === CONNECTIONS_GROUPS ? 900 : 2200);
  };

  const toggle = (id: string) => {
    if (!playing) return;
    setNote("");
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < CONNECTIONS_GROUP_SIZE ? [...s, id] : s));
    emit({ type: "sound", name: "click" });
  };

  const submit = () => {
    if (selected.length !== CONNECTIONS_GROUP_SIZE || !playing) return;
    const key = [...selected].sort().join("|");
    if (tried.includes(key)) {
      setNote("You've already tried that group.");
      return;
    }
    const { group, best } = checkGroup(puzzle, selected);
    if (group !== null) {
      const found = [...solved, group];
      setSolved(found);
      setSelected([]);
      arenaWeekResult(subject.id, puzzle.groups[group].week, true);
      emit({ type: "sound", name: found.length === CONNECTIONS_GROUPS ? "quest" : "hit" });
      setNote(`Week ${puzzle.groups[group].week}.`);
      if (found.length === CONNECTIONS_GROUPS) finish(found, mistakes);
      return;
    }
    const misses = mistakes + 1;
    setTried((t) => [...t, key]);
    setMistakes(misses);
    setShake((n) => n + 1);
    emit({ type: "sound", name: "miss" });
    setNote(best === CONNECTIONS_GROUP_SIZE - 1 ? "One away…" : "Not a group.");
    if (misses >= CONNECTIONS_MAX_MISTAKES) {
      setSelected([]);
      finish(solved, misses);
    }
  };

  // The rival's live progress: groups found so far on its own clock.
  const rivalFound = Math.min(rivalRun.solved, Math.floor((elapsedMs / 1000 / Math.max(1, rivalRun.seconds)) * rivalRun.solved));
  const remaining = order.filter((id) => !solved.includes(puzzle.tiles.find((t) => t.id === id)!.group));
  const shownGroups = playing ? solved : [...solved, ...puzzle.groups.map((_, i) => i).filter((i) => !solved.includes(i))];

  if (showResult && outcome) {
    return (
      <MatchResult report={report} outcome={outcome} rival={rival} yourScore={connectionsScore(solved.length, mistakes, elapsedMs / 1000)} rivalScore={rivalRun.score} onAgain={onAgain} onBack={onBack}>
        <p className="muted small">
          You found {solved.length}/4 with {mistakes} mistake{mistakes === 1 ? "" : "s"} in {formatSeconds(elapsedMs)}. {rival.name} found {rivalRun.solved}/4 with {rivalRun.mistakes} in {formatSeconds(rivalRun.seconds * 1000)}.
        </p>
        <ul className="arena-groups-review">
          {puzzle.groups.map((g, i) => (
            <li key={g.week} className={`g${i} ${solved.includes(i) ? "" : "missed"}`}>
              <b>{g.label}</b>
              <span>
                {puzzle.tiles
                  .filter((t) => t.group === i)
                  .map((t) => t.text)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </MatchResult>
    );
  }

  return (
    <div className="arena-game arena-connections">
      <MatchHeader
        you={playerName}
        rival={rival}
        yourScore={`${solved.length}/4`}
        rivalScore={`${rivalFound}/4`}
        middle={<span className="arena-timer">{formatSeconds(elapsedMs)}</span>}
      />
      <p className="muted small">Find four groups of four. Each group is one week of {subject.name}.</p>
      <div className="conn-solved">
        {shownGroups.map((g) => (
          <div key={g} className={`conn-group g${g} ${solved.includes(g) ? "" : "missed"}`}>
            <b>{puzzle.groups[g].label}</b>
            <span>
              {puzzle.tiles
                .filter((t) => t.group === g)
                .map((t) => t.text)
                .join(" · ")}
            </span>
          </div>
        ))}
      </div>
      {playing ? (
        <div className={`conn-grid ${shake ? `shake-${shake % 2}` : ""}`}>
          {remaining.map((id) => {
            const tile = puzzle.tiles.find((t) => t.id === id)!;
            return (
              <button key={id} type="button" className={`conn-tile ${selected.includes(id) ? "on" : ""}`} onClick={() => toggle(id)} aria-pressed={selected.includes(id)}>
                {tile.text}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="conn-foot">
        <span className="arena-lives" aria-label={`${CONNECTIONS_MAX_MISTAKES - mistakes} mistakes left`}>
          Mistakes left:
          {Array.from({ length: CONNECTIONS_MAX_MISTAKES }, (_, i) => (
            <span key={i} className={i < CONNECTIONS_MAX_MISTAKES - mistakes ? "on" : ""} />
          ))}
        </span>
        <span className="arena-note" aria-live="polite">
          {note}
        </span>
      </div>
      {playing ? (
        <div className="row">
          <button type="button" className="rs-button secondary" onClick={() => setOrder((o) => shuffleWith(o, Math.random))}>
            Shuffle
          </button>
          <button type="button" className="rs-button secondary" onClick={() => setSelected([])} disabled={selected.length === 0}>
            Deselect
          </button>
          <button type="button" className="rs-button" onClick={submit} disabled={selected.length !== CONNECTIONS_GROUP_SIZE}>
            Submit
          </button>
        </div>
      ) : null}
    </div>
  );
}
