/**
 * The games hall menu: the Arena (ranked study games, free) and the arcade
 * games. Arcade games cost a little Focus, so the way to play more is to
 * study more.
 */

import { Window } from "../hud/Window";
import { useRealm } from "../state/store";
import { FOCUS } from "../life/catalog";
import { WAVE_PLAN } from "./td";
import { GATE_COUNT } from "./race";
import { broomUnlocked, weeksToBroom } from "../life/broom";
import "../../styles/arena.css";
import type { ArenaGameId } from "../types";
import { ARENA_GAME_IDS } from "../arena/save";
import { ARENA_GAMES, rankFor } from "../arena/rating";
import { arenaIcon, Icon } from "../hud/icons";

interface ArcadeWindowProps {
  onClose: () => void;
  onTowerDefence: () => void;
  onRace: () => void;
  onSkyRace: () => void;
  /** Opens the Arena (optionally on one game). */
  onArena: (game?: ArenaGameId) => void;
}

/** Your best arena rating as "rating|game" (a primitive, so the selector stays stable). */
function bestArena(games: Partial<Record<ArenaGameId, { rating: number; games: number }>>): string {
  let best: ArenaGameId | null = null;
  for (const id of ARENA_GAME_IDS) {
    const r = games[id];
    if (r && r.games > 0 && (best === null || r.rating > (games[best]?.rating ?? 0))) best = id;
  }
  return best ? `${games[best]!.rating}|${best}` : "";
}

export function ArcadeWindow({ onClose, onTowerDefence, onRace, onSkyRace, onArena }: ArcadeWindowProps) {
  const arenaBest = useRealm((s) => bestArena(s.progress.arena.games));
  const [arenaRating, arenaGame] = arenaBest ? [Number(arenaBest.split("|")[0]), arenaBest.split("|")[1] as ArenaGameId] : [0, null];
  const broom = useRealm((s) => broomUnlocked(s));
  const toBroomKey = useRealm((s) => {
    const w = weeksToBroom(s);
    return w ? `${w.left}|${w.subject}` : "";
  });
  const toBroom = toBroomKey ? { left: Number(toBroomKey.split("|")[0]), subject: toBroomKey.slice(toBroomKey.indexOf("|") + 1) } : null;
  const skyBest = useRealm((s) => s.progress.counters.skyRaceBest ?? 0);
  const focus = useRealm((s) => s.progress.focus);
  const tdBest = useRealm((s) => s.progress.counters.tdBestWave ?? 0);
  const tdWins = useRealm((s) => s.progress.counters.tdWins ?? 0);
  const raceBest = useRealm((s) => s.progress.counters.raceBest ?? 0);
  const raceGold = useRealm((s) => s.progress.counters.raceGold ?? 0);

  return (
    <Window title="Games hall" onClose={onClose} width={680} className="arcade-window">
      <article className="arena-feature">
        <div className="arena-feature-head">
          <h3>The Arena</h3>
          <span className="arena-chip">Ranked · free to play</span>
        </div>
        <p>
          Competitive study games on your own subjects: climb from Bronze to Grandmaster against named rivals, and compare ratings with classmates through share codes.
        </p>
        <div className="arena-feature-games">
          {ARENA_GAME_IDS.map((id) => (
            <button key={id} type="button" className="arena-pill" onClick={() => onArena(id)} title={ARENA_GAMES[id].blurb}>
              <Icon name={arenaIcon(id)} /> {ARENA_GAMES[id].name}
            </button>
          ))}
        </div>
        <div className="row">
          <button type="button" className="rs-button" onClick={() => onArena()}>
            Enter the Arena
          </button>
          <span className="muted small">{arenaGame ? `Best: ${rankFor(arenaRating).label} (${arenaRating}) in ${ARENA_GAMES[arenaGame].name}` : "Unranked: play a match to get your rank."}</span>
        </div>
      </article>
      <p className="muted">
        The arcade games below cost Focus. You have <b>{focus}</b>. Study a waystone, finish a quest step or review your Grimoire to earn more.
      </p>
      <div className="arcade-cards">
        <article className="arcade-card td">
          <div className="art" aria-hidden="true">
            <Icon name="bell" />
            <Icon name="phone" />
            <Icon name="arrowRight" className="to" />
            <Icon name="library" />
          </div>
          <h3>Siege of Procrastination</h3>
          <p>
            Tower defence. Notifications, doomscrolling and naps march on your desk. Build Focus Lamps, Pomodoros and Planners to hold all {WAVE_PLAN.length} waves.
            Study breaks between waves pay extra gold.
          </p>
          <p className="muted small">
            Best: {tdBest} wave{tdBest === 1 ? "" : "s"}
            {tdWins ? ` · won ${tdWins}×` : ""}
          </p>
          <button type="button" className="rs-button" onClick={onTowerDefence}>
            Play · {FOCUS.cost.arcade} Focus
          </button>
        </article>
        <article className="arcade-card race">
          <div className="art" aria-hidden="true">
            <Icon name="flag" />
            <Icon name="replay" className="to" />
            <Icon name="island" />
          </div>
          <h3>Island Race</h3>
          <p>
            Sprint a lap of the island through {GATE_COUNT} glowing gates and back here. Beat the clock for bronze, silver or gold. You run faster while racing.
          </p>
          <p className="muted small">
            Best: {raceBest ? `${raceBest}s` : "none yet"}
            {raceGold ? ` · ${raceGold} gold medal${raceGold === 1 ? "" : "s"}` : ""}
          </p>
          <button type="button" className="rs-button" onClick={onRace} disabled={focus < FOCUS.cost.race}>
            Race · {FOCUS.cost.race} Focus
          </button>
        </article>
        <article className="arcade-card race sky">
          <div className="art" aria-hidden="true">
            <Icon name="broom" />
            <Icon name="cloud" className="to" />
            <Icon name="flag" />
          </div>
          <h3>Sky Race</h3>
          <p>The same lap, flown on your broom through gates hanging in the air. Fast and reckless.</p>
          <p className="muted small">
            {broom ? `Best: ${skyBest ? `${skyBest}s` : "none yet"}` : toBroom ? `Locked: study every week of ${toBroom.subject} for a broom (${toBroom.left} to go).` : "Locked: master a subject for a broom."}
          </p>
          <button type="button" className="rs-button" onClick={onSkyRace} disabled={!broom || focus < FOCUS.cost.race}>
            Fly · {FOCUS.cost.race} Focus
          </button>
        </article>
      </div>
    </Window>
  );
}
