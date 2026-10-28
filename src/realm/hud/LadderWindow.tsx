/**
 * The duelling club board: this month's ten duellists with you slotted in,
 * and a challenge button for the one above you.
 */

import { Window } from "./Window";
import { useRealm } from "../state/store";
import { currentSeason, ladderBoard, LADDER_SIZE, nextOpponent, opponentTier, yourRank } from "../state/ladder";

export function LadderWindow({ onChallenge, onClose }: { onChallenge: () => void; onClose: () => void }) {
  const state = useRealm((s) => s);
  const rank = yourRank(state);
  const board = ladderBoard();
  const next = nextOpponent(state);
  const best = state.progress.ladder.season === currentSeason() ? state.progress.ladder.best : null;
  // Others shift down one place below you.
  const rows: Array<{ rank: number; name: string; house: string; you?: boolean }> = [];
  let r = 1;
  for (const d of board) {
    if (r === rank) rows.push({ rank: r++, name: "You", house: "", you: true });
    if (rows.length >= LADDER_SIZE + 1) break;
    rows.push({ rank: r++, name: d.name, house: d.house });
  }
  if (rank > LADDER_SIZE) rows.push({ rank: LADDER_SIZE + 1, name: "You", house: "", you: true });
  return (
    <Window title={`Duelling club · season ${currentSeason()}`} onClose={onClose} width={560} className="ladder-window">
      <p className="muted small">
        Challenge the duellist one place above you. Duels are hard questions from your own subjects; the top three are the toughest. The board resets each month.
        {best ? ` Your best this season: rank ${best}.` : ""}
      </p>
      <ol className="ladder">
        {rows.slice(0, LADDER_SIZE + 1).map((row) => (
          <li key={`${row.rank}-${row.name}`} className={row.you ? "you" : next && row.name === next.name ? "next" : ""}>
            <span className="rank">{row.rank}</span>
            <b>{row.name}</b>
            {row.house ? <small className="muted"> · {row.house}</small> : null}
            {next && row.name === next.name ? <span className="tag">next</span> : null}
          </li>
        ))}
      </ol>
      {next ? (
        <button type="button" className="rs-button" onClick={onChallenge}>
          Challenge {next.name} ({["easier", "tough", "toughest"][opponentTier(next.rank)]})
        </button>
      ) : (
        <p>You are this season&apos;s champion. Defend the title next month.</p>
      )}
    </Window>
  );
}
