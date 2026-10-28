/**
 * The Arena: ranked, skill-based study games against AI rivals, with a
 * leaderboard that mixes you, your classmates (from share codes) and the
 * rivals. Every game uses the subject's real content.
 */

import { useMemo, useState } from "react";
import "../../styles/arena.css";
import { Window } from "../hud/Window";
import { realmStore, todayIso, useRealm } from "../state/store";
import { addGroupMember, makeShareCode } from "../state/group";
import type { ArenaGameId, RealmSubject } from "../types";
import { ARENA_GAME_IDS } from "./save";
import { ARENA_GAMES, ARENA_REWARDS, arenaLeaderboard, rankFor, rivalChoices, seasonDaysLeft, seasonId, viewRecord, type ArenaRival } from "./rating";
import { dailyPlayed } from "./record";
import { RankBadge } from "./ArenaShared";
import { BuzzerDuel } from "./BuzzerDuel";
import { BlitzGame } from "./BlitzGame";
import { LexiconGame } from "./LexiconGame";
import { ConnectionsGame } from "./ConnectionsGame";
import { SequenceGame } from "./SequenceGame";
import { arenaIcon, Icon } from "../hud/icons";

interface ArenaWindowProps {
  subjects: RealmSubject[];
  initialGame?: ArenaGameId;
  onClose: () => void;
  /** Back to the games hall. */
  onBack?: () => void;
}

interface Match {
  game: ArenaGameId;
  subjectId: string;
  rival: ArenaRival;
  /** Bumped for a rematch so the game remounts fresh. */
  n: number;
}

export function ArenaWindow({ subjects, initialGame, onClose, onBack }: ArenaWindowProps) {
  const arena = useRealm((s) => s.progress.arena);
  const group = useRealm((s) => s.progress.group);
  const playerName = useRealm((s) => s.player?.name ?? "You");
  const [game, setGame] = useState<ArenaGameId>(initialGame ?? "buzzer");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [view, setView] = useState<"games" | "board">("games");
  const [match, setMatch] = useState<Match | null>(null);
  const season = seasonId();
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0];

  if (match) {
    const s = subjects.find((x) => x.id === match.subjectId);
    const props = {
      subject: s ?? subjects[0],
      rival: match.rival,
      onBack: () => setMatch(null),
      onAgain: () => setMatch({ ...match, n: match.n + 1 }),
    };
    const info = ARENA_GAMES[match.game];
    return (
      <Window title={`${info.name} · ${props.subject.code || props.subject.name}`} onClose={onClose} width={720} className="arena-window">
        {match.game === "buzzer" ? <BuzzerDuel key={match.n} {...props} /> : null}
        {match.game === "blitz" ? <BlitzGame key={match.n} {...props} /> : null}
        {match.game === "lexicon" ? <LexiconGame key={match.n} {...props} /> : null}
        {match.game === "connections" ? <ConnectionsGame key={match.n} {...props} /> : null}
        {match.game === "sequence" ? <SequenceGame key={match.n} {...props} /> : null}
      </Window>
    );
  }

  const today = arena.daily.date === todayIso() ? arena.daily : { xp: 0, coins: 0, focus: 0 };
  const days = seasonDaysLeft();

  return (
    <Window title="The Arena" onClose={onClose} width={760} className="arena-window">
      <div className="arena-top">
        <span className="arena-chip season">
          Season {season.replace("-W", " · week ")} · {days === 0 ? "ends tonight" : `${days} day${days === 1 ? "" : "s"} left`}
        </span>
        <span className="arena-chip" title="Arena rewards are capped each day so real study always pays more">
          Today: {today.xp}/{ARENA_REWARDS.dailyXpCap} XP · {today.coins}/{ARENA_REWARDS.dailyCoinCap} coins · {today.focus}/{ARENA_REWARDS.dailyFocusCap} Focus
        </span>
        <span className="arena-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === "games"} className={view === "games" ? "on" : ""} onClick={() => setView("games")}>
            Games
          </button>
          <button type="button" role="tab" aria-selected={view === "board"} className={view === "board" ? "on" : ""} onClick={() => setView("board")}>
            Leaderboard
          </button>
        </span>
      </div>

      <div className="arena-gamebar" role="tablist" aria-label="Arena games">
        {ARENA_GAME_IDS.map((id) => {
          const r = viewRecord(arena, id, season);
          return (
            <button key={id} type="button" role="tab" aria-selected={game === id} className={`arena-gametab ${game === id ? "on" : ""}`} onClick={() => setGame(id)}>
              <span className="icon" aria-hidden="true">
                <Icon name={arenaIcon(id)} />
              </span>
              <span className="name">{ARENA_GAMES[id].name}</span>
              <span className="rating">{r.games ? r.rating : "unranked"}</span>
            </button>
          );
        })}
      </div>

      {view === "games" ? (
        subject ? (
          <GamePanel game={game} subject={subject} subjects={subjects} onSubject={setSubjectId} onPlay={(rival) => setMatch({ game, subjectId: subject.id, rival, n: 0 })} />
        ) : (
          <p className="muted">Enrol in a subject first.</p>
        )
      ) : (
        <Leaderboard game={game} season={season} playerName={playerName} groupSize={Object.keys(group).length} />
      )}

      {onBack ? (
        <div className="row">
          <button type="button" className="rs-button secondary" onClick={onBack}>
            <Icon name="arrowLeft" /> Games hall
          </button>
        </div>
      ) : null}
    </Window>
  );
}

function GamePanel({ game, subject, subjects, onSubject, onPlay }: { game: ArenaGameId; subject: RealmSubject; subjects: RealmSubject[]; onSubject: (id: string) => void; onPlay: (rival: ArenaRival) => void }) {
  const arena = useRealm((s) => s.progress.arena);
  const season = seasonId();
  const record = viewRecord(arena, game, season);
  const rank = rankFor(record.rating);
  const picks = useMemo(() => rivalChoices(record.rating, game, season), [record.rating, game, season]);
  const info = ARENA_GAMES[game];
  const lexiconDone = game === "lexicon" && dailyPlayed(arena, "lexicon", subject.id);

  return (
    <div className="arena-panel">
      <div className="arena-subjects" role="group" aria-label="Subject">
        {subjects.map((s) => (
          <button key={s.id} type="button" className={`arena-pill ${s.id === subject.id ? "on" : ""}`} onClick={() => onSubject(s.id)} title={s.name}>
            {s.code || s.name}
          </button>
        ))}
      </div>
      <div className="arena-detail">
        <div className="arena-detail-main">
          <h3>{info.name}</h3>
          <p>{info.blurb}</p>
          {game === "lexicon" ? (
            <p className="arena-note">{lexiconDone ? `Today's ${subject.code || subject.name} daily is done. Play practice puzzles (unranked), or try another subject's daily.` : `Today's ${subject.code || subject.name} daily is ranked: one attempt.`}</p>
          ) : null}
          <p className="muted small">Leaving a ranked match after it starts counts as a loss. Misses go to your Grimoire.</p>
        </div>
        <div className="arena-detail-stats">
          <RankBadge rating={record.rating} />
          <div className="arena-big-rating">{record.rating}</div>
          {rank.next ? (
            <div className="arena-bar rank" title={`${rank.next - record.rating} to the next division`}>
              <span style={{ width: `${rank.progress * 100}%` }} />
            </div>
          ) : null}
          <dl className="arena-stats">
            <dt>Record</dt>
            <dd>
              {record.wins}W {record.losses}L{record.draws ? ` ${record.draws}D` : ""}
            </dd>
            <dt>Streak</dt>
            <dd>
              {record.streak} (best {record.bestStreak})
            </dd>
            <dt>Best</dt>
            <dd>
              {record.best.toLocaleString()} {info.scoreLabel}
            </dd>
            <dt>Peak</dt>
            <dd>{record.peak}</dd>
            <dt>Season</dt>
            <dd>
              {record.seasonWins} wins · peak {record.seasonPeak}
            </dd>
          </dl>
        </div>
      </div>
      <h4 className="arena-h">{game === "lexicon" && lexiconDone ? "Practice against" : "Choose your rival"}</h4>
      <div className="arena-rivals">
        {picks.map((p) => (
          <button key={p.rival.id} type="button" className={`arena-rival ${p.label === "Stretch" ? "stretch" : p.label === "Warm-up" ? "warm" : "even"}`} onClick={() => onPlay(p.rival)}>
            <span className="label">{p.label}</span>
            <span className="name">{p.rival.name}</span>
            <span className="title muted small">{p.rival.title}</span>
            <span className="meta">
              <RankBadge rating={p.rival.rating} compact /> {p.rival.rating}
            </span>
            <span className="odds muted small">{Math.round(p.winChance * 100)}% expected</span>
          </button>
        ))}
      </div>
      <p className="muted small">Rewards: XP to {subject.name} for every ranked game; coins for wins; Focus only for beating a stronger rival. Daily caps keep real study ahead.</p>
    </div>
  );
}

function Leaderboard({ game, season, playerName, groupSize }: { game: ArenaGameId; season: string; playerName: string; groupSize: number }) {
  const arena = useRealm((s) => s.progress.arena);
  const group = useRealm((s) => s.progress.group);
  const rows = useMemo(() => arenaLeaderboard({ playerName, arena, group }, game, season), [game, season, arena, group, playerName]);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const mine = makeShareCode(realmStore.get());
    if (!mine) return;
    try {
      await navigator.clipboard.writeText(mine);
      setCopied(true);
    } catch {
      setCode(mine);
    }
  };

  return (
    <div className="arena-panel">
      <ol className="arena-board">
        {rows.map((r, i) => (
          <li key={r.key} className={`arena-row ${r.kind}`}>
            <span className="pos">{i + 1}</span>
            <span className="name">
              {r.name}
              {r.kind === "classmate" ? <span className="tag">classmate</span> : r.kind === "rival" ? <span className="tag ai">AI</span> : <span className="tag you">you</span>}
              {r.note ? <span className="muted small"> {r.note}</span> : null}
            </span>
            <RankBadge rating={r.rating} compact />
            <span className="rating">{r.rating}</span>
            <span className="best muted small">{r.best !== null && r.best > 0 ? `best ${r.best.toLocaleString()}` : ""}</span>
          </li>
        ))}
      </ol>
      <div className="arena-share">
        <p className="muted small">
          {groupSize === 0 ? "No classmates yet. " : `${groupSize} classmate${groupSize === 1 ? "" : "s"} in your study group. `}
          Share codes carry your arena ratings and bests. Swap new codes to update the board.
        </p>
        <div className="row wrap">
          <button type="button" className="rs-button secondary" onClick={copy}>
            {copied ? "Copied your code" : "Copy my share code"}
          </button>
          <input className="arena-input" placeholder="Paste a classmate's SCHOLAR1-… code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Classmate's share code" />
          <button
            type="button"
            className="rs-button"
            disabled={!code.trim().startsWith("SCHOLAR1-")}
            onClick={() => {
              if (addGroupMember(code)) setCode("");
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
