/**
 * Duel a Knowledge Wraith: answer correctly to strike, answer wrong and it
 * strikes you. Questions come from the subject's curriculum.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Window } from "../hud/Window";
import { buildQuestionPool } from "../curriculum/questionBank";
import { recordMinigameWin, spendCoins } from "../state/actions";
import { recordMistake } from "../state/grimoire";
import { recordAnswer } from "../state/stats";
import { BOSS_XP, bossName, bossWeeks, defeatBoss } from "../state/bosses";
import { useRealm } from "../state/store";
import { emit } from "../state/events";
import { XP_REWARDS } from "../xp";
import { rivalStrength } from "../world/islands";

/** A named opponent (an island's exchange scholar, a duelling-club rival): a longer, harder exam duel. */
export interface DuelRival {
  name: string;
  tier: 0 | 1 | 2;
  /** Shown in the title, e.g. "Exchange duel" or "Duelling club, rank 4". */
  label: string;
  onWin: () => void;
}
import type { RealmAssessment, RealmQuestion, RealmSubject } from "../types";
import { Icon, type IconName } from "../hud/icons";

const ENEMY_NAMES = ["Knowledge Wraith", "Forgetful Ghoul", "Confusion Imp", "Cramming Golem", "Procrastination Shade"];
const HINT_COST = 25;

interface QuizDuelProps {
  subject: RealmSubject;
  week: number | null;
  /** Deadline boss fight: hard questions on every week the assessment covers. */
  boss?: RealmAssessment;
  /** An island's rival scholar: longer, harder exam duel with a purse for winning. */
  rival?: DuelRival;
  onClose: () => void;
}

const BOSS_QUESTIONS = 12;

/** Boss pool: the assessment's weeks (plus whole-subject questions), hardest first. */
function bossPool(subject: RealmSubject, assessment: RealmAssessment): RealmQuestion[] {
  const weeks = new Set(bossWeeks(subject, assessment));
  const pool = buildQuestionPool(subject, null).filter((q) => q.week === null || weeks.has(q.week));
  return pool.length >= 6 ? pool : buildQuestionPool(subject, null);
}

interface Splat {
  id: number;
  target: "enemy" | "player";
  amount: number;
}

export function QuizDuel({ subject, week, boss, rival, onClose }: QuizDuelProps) {
  const exam = week === null;
  const strength = rival ? rivalStrength(rival.tier) : null;
  const questions = useMemo(
    () =>
      boss
        ? bossPool(subject, boss).slice(0, BOSS_QUESTIONS)
        : rival
          ? buildQuestionPool(subject, null).slice(0, rivalStrength(rival.tier).questions)
          : buildQuestionPool(subject, week).slice(0, exam ? 10 : 6),
    [subject, week, exam, boss, rival],
  );
  const enemyName = useMemo(
    () => (rival ? rival.name : boss ? bossName(boss) : exam ? "Examiner Wraith" : ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)]),
    [exam, boss, rival],
  );
  const enemyMax = strength
    ? Math.min(strength.hp, Math.max(40, questions.length * 9))
    : boss
      ? Math.min(120, Math.max(40, questions.length * 10))
      : Math.min(exam ? 80 : 50, Math.max(20, questions.length * 8));
  const [mistakes, setMistakes] = useState(0);
  const coins = useRealm((st) => st.progress.coins);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const playerMax = boss ? 40 : 30;
  const [index, setIndex] = useState(0);
  const [enemyHp, setEnemyHp] = useState(enemyMax);
  const [playerHp, setPlayerHp] = useState(playerMax);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [splats, setSplats] = useState<Splat[]>([]);
  const [result, setResult] = useState<{ won: boolean; xp: number } | null>(null);
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (questions.length < 3) {
    return (
      <Window title="Duel Arena" onClose={onClose}>
        <p>The arena is quiet. This subject needs more curriculum material (key terms or weekly topics) before wraiths can be summoned.</p>
        <p className="muted">Add weekly topics in the Codex, or re-run curriculum research.</p>
      </Window>
    );
  }

  const question = questions[index % questions.length];

  const splat = (target: "enemy" | "player", amount: number) => {
    const s = { id: Date.now() + Math.random(), target, amount };
    setSplats((list) => [...list, s]);
    window.setTimeout(() => setSplats((list) => list.filter((x) => x.id !== s.id)), 900);
  };

  const finish = (won: boolean, correct: number) => {
    if (won && boss) {
      emit({ type: "sound", name: "victory" });
      defeatBoss(boss.id);
      setResult({ won: true, xp: BOSS_XP });
    } else if (won && rival) {
      emit({ type: "sound", name: "victory" });
      const xp = recordMinigameWin(subject.id, XP_REWARDS.quizDuelWin + correct * XP_REWARDS.quizDuelPerCorrect, null, `the duel against ${rival.name}`);
      rival.onWin();
      setResult({ won: true, xp });
    } else if (won) {
      emit({ type: "sound", name: "victory" });
      const xp = recordMinigameWin(subject.id, XP_REWARDS.quizDuelWin + correct * XP_REWARDS.quizDuelPerCorrect, week, `the duel against the ${enemyName}`);
      setResult({ won: true, xp });
    } else {
      emit({ type: "sound", name: "defeat" });
      setResult({ won: false, xp: 0 });
    }
  };

  const answer = (choice: number) => {
    if (picked !== null || result) return;
    setPicked(choice);
    const right = choice === question.answerIndex;
    recordAnswer(subject.id, question, right);
    let nextEnemy = enemyHp;
    let nextPlayer = playerHp;
    let nextCorrect = correctCount;
    if (right) {
      const damage = 10 + Math.floor(Math.random() * 7);
      nextEnemy = Math.max(0, enemyHp - damage);
      nextCorrect++;
      setEnemyHp(nextEnemy);
      setCorrectCount(nextCorrect);
      splat("enemy", damage);
      emit({ type: "sound", name: "hit" });
    } else {
      const damage = (strength ? strength.hit : boss ? 9 : 7) + Math.floor(Math.random() * 6);
      nextPlayer = Math.max(0, playerHp - damage);
      recordMistake(subject.id, question);
      setMistakes((m) => m + 1);
      setPlayerHp(nextPlayer);
      splat("player", damage);
      emit({ type: "sound", name: "miss" });
    }
    window.setTimeout(() => {
      if (nextEnemy <= 0) finish(true, nextCorrect);
      else if (nextPlayer <= 0 || index + 1 >= questions.length) finish(nextEnemy <= 0, nextCorrect);
    }, 350);
  };

  const next = () => {
    setPicked(null);
    setEliminated([]);
    setIndex((i) => i + 1);
  };

  const hint = () => {
    if (picked !== null || eliminated.length > 0) return;
    if (!spendCoins(HINT_COST)) return;
    const wrong = question.choices.map((_, i) => i).filter((i) => i !== question.answerIndex);
    setEliminated(wrong.sort(() => Math.random() - 0.5).slice(0, 2));
  };

  keyHandler.current = (e: KeyboardEvent) => {
    if (result) return;
    if (picked === null && /^[1-4]$/.test(e.key) && !eliminated.includes(Number(e.key) - 1)) answer(Number(e.key) - 1);
    else if (picked !== null && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      next();
    }
  };

  const title = rival ? `${rival.label}: ${rival.name} · ${subject.name}` : boss ? `Boss: ${enemyName} · ${boss.title}` : week !== null ? `Trial of Week ${week} · ${subject.name}` : `Exam Duel · ${subject.name}`;
  const stars = <Difficulty level={question.difficulty ?? 2} />;

  return (
    <Window title={title} onClose={onClose} width={620}>
      <div className="duel-field">
        <Combatant name="You" hp={playerHp} max={playerMax} splats={splats.filter((s) => s.target === "player")} side="player" />
        <span className="duel-vs">VS</span>
        <Combatant name={enemyName} hp={enemyHp} max={enemyMax} splats={splats.filter((s) => s.target === "enemy")} side="enemy" icon={rival ? "user" : boss ? "skull" : "skull"} />
      </div>

      {result ? (
        <div className={`duel-result ${result.won ? "won" : "lost"}`}>
          {result.won ? (
            <>
              <p className="big">{rival ? `${enemyName} concedes. You win.` : `${enemyName} defeated.`}</p>
              <p>
                You answered {correctCount} correctly and gained <strong>{result.xp} {subject.name} XP</strong>.
              </p>
            </>
          ) : (
            <>
              <p className="big">Defeated</p>
              <p>Review the explanations, study the waystones and try again. No XP is lost.</p>
            </>
          )}
          {mistakes > 0 ? (
            <p className="muted small">
              {mistakes} question{mistakes === 1 ? "" : "s"} you missed {mistakes === 1 ? "was" : "were"} written into your Grimoire of Mistakes to review tomorrow.
            </p>
          ) : null}
          <button type="button" className="rs-button" onClick={onClose}>
            Leave the arena
          </button>
        </div>
      ) : (
        <div className="duel-question">
          <p className="muted small">
            Question {(index % questions.length) + 1} of {questions.length}
            {question.week ? ` · Week ${question.week}` : ""}
            <span className="difficulty" title="Difficulty">
              {stars}
            </span>
          </p>
          <p className="prompt">{question.prompt}</p>
          <div className="choices">
            {question.choices.map((choice, i) => {
              const gone = eliminated.includes(i);
              const state = picked === null ? (gone ? "eliminated" : "") : i === question.answerIndex ? "right" : i === picked ? "wrong" : "dim";
              return (
                <button key={i} type="button" className={`choice ${state}`} onClick={() => answer(i)} disabled={picked !== null || gone}>
                  <span className="key">{i + 1}</span> {choice}
                </button>
              );
            })}
          </div>
          {picked === null ? (
            <div className="duel-tools">
              <button type="button" className="rs-button secondary" onClick={hint} disabled={eliminated.length > 0 || coins < HINT_COST}>
                Hint: remove two wrong answers ({HINT_COST} coins)
              </button>
              <span className="muted small">You have {coins} coins.</span>
            </div>
          ) : null}
          {picked !== null ? (
            <div className="explain">
              <p>
                {picked === question.answerIndex ? "Correct. " : "Not quite. "}
                {question.explanation}
              </p>
              <button type="button" className="rs-button" onClick={next}>
                Next strike
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Window>
  );
}

/** Question difficulty as one to three stars. */
export function Difficulty({ level }: { level: number }) {
  return (
    <span className="rs-difficulty" title={`Difficulty ${level} of 3`} aria-label={`Difficulty ${level} of 3`}>
      {[1, 2, 3].map((n) => (
        <Icon key={n} name="star" className={n <= level ? "on" : ""} />
      ))}
    </span>
  );
}

function Combatant({ name, hp, max, splats, side, icon = "skull" }: { name: string; hp: number; max: number; splats: Splat[]; side: "player" | "enemy"; icon?: IconName }) {
  return (
    <div className={`combatant ${side}`}>
      <div className="avatar" aria-hidden="true">
        <Icon name={side === "player" ? "wand" : icon} />
        {splats.map((s) => (
          <span key={s.id} className={`hitsplat ${s.amount > 0 ? "hit" : "zero"}`}>
            {s.amount}
          </span>
        ))}
      </div>
      <p className="name">{name}</p>
      <div className="hpbar" aria-label={`${name} health ${hp} of ${max}`}>
        <span style={{ width: `${(hp / max) * 100}%` }} />
      </div>
      <p className="hp">
        {hp}/{max}
      </p>
    </div>
  );
}
