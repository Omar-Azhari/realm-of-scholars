/**
 * The harbour's sailing chart, and the dorm noticeboard.
 */

import { Window } from "./Window";
import { useRealm } from "../state/store";
import { dailyChallenges, isRested, liveStreak } from "../state/actions";
import { dueCards } from "../state/grimoire";
import { comfort, comfortFocusBonus } from "../dorm/dorm";
import { dueLabel, upcomingQuests } from "../dialogues";
import { sailCost, type IslandSpec } from "../world/islands";
import { classesOn } from "../curriculum/timetable";
import { Icon } from "./icons";

const TIER_LABEL = ["Gentle", "Rough", "Wild"] as const;

export function SailWindow({ islands, here, onSail, onClose }: { islands: IslandSpec[]; here: string; onSail: (island: IslandSpec) => void; onClose: () => void }) {
  const focus = useRealm((s) => s.progress.focus);
  const stamps = useRealm((s) => s.progress.voyages.stamps);
  const rivals = useRealm((s) => s.progress.voyages.rivals);
  const visited = islands.filter((i) => i.kind !== "home" && stamps[i.id]).length;
  const total = islands.filter((i) => i.kind !== "home").length;
  return (
    <Window title="Sailing chart" onClose={onClose} width={680} className="sail-window">
      <p className="muted">
        Sailing out costs Focus (you have <b>{focus}</b>). The trip home is free. Further islands have tougher monsters, richer ore, fish and timber, and a stronger rival
        scholar. Passport: {visited}/{total} stamped.
      </p>
      {total === 0 ? <p>No other campuses or nearby universities are known for your university yet.</p> : null}
      <ul className="sail-list">
        {islands.map((island) => {
          const cost = sailCost(island);
          const isHere = island.id === here;
          return (
            <li key={island.id} className={isHere ? "here" : ""}>
              <span className="flag" aria-hidden="true">
                <Icon name={island.kind === "home" ? "home" : island.kind === "campus" ? "cap" : "castle"} />
              </span>
              <span className="text">
                <b>{island.kind === "home" ? "Home" : island.name}</b>
                <small>
                  {island.kind === "home"
                    ? "Your campus: subjects, dorm, games hall."
                    : `${TIER_LABEL[island.tier]} waters · rival: ${island.rival}${rivals[island.id] ? " (beaten)" : ""}${stamps[island.id] ? " · stamped" : ""}`}
                </small>
              </span>
              {isHere ? (
                <span className="muted small">You are here</span>
              ) : (
                <button type="button" className="rs-button small" disabled={focus < cost} onClick={() => onSail(island)}>
                  {cost > 0 ? `Sail · ${cost} Focus` : "Sail home"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Window>
  );
}

export function NoticeboardWindow({ onClose, onOpenQuest, onDaily, onGrimoire }: { onClose: () => void; onOpenQuest: (id: string) => void; onDaily: () => void; onGrimoire: () => void }) {
  const state = useRealm((s) => s);
  const quests = upcomingQuests(state, state.curriculum?.subjects ?? []).slice(0, 5);
  const daily = dailyChallenges(state);
  const reviews = dueCards(state).length;
  const rested = isRested(state);
  const streak = liveStreak(state);
  const room = comfort(state.progress.dorm);
  const classes = classesOn(state.progress.timetable, new Date());
  return (
    <Window title="Noticeboard" onClose={onClose} width={560} className="noticeboard-window">
      <div className="notes">
        <section className="note pin-red">
          <h3>Due soon</h3>
          {quests.length === 0 ? (
            <p className="muted small">Nothing outstanding. Well done.</p>
          ) : (
            <ul>
              {quests.map(({ subject, assessment }) => (
                <li key={assessment.id}>
                  <button type="button" className="link" onClick={() => onOpenQuest(assessment.id)}>
                    {assessment.title}
                  </button>
                  <small>
                    {" "}
                    · {subject.code || subject.name} · {dueLabel(assessment, state.curriculum)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="note pin-blue">
          <h3>Today</h3>
          <ul>
            {daily.items.map((item) => (
              <li key={item.label}>
                <Icon name={item.done ? "check" : "minus"} className={item.done ? "ok" : "todo"} /> {item.label}
              </li>
            ))}
          </ul>
          <button type="button" className="link" onClick={onDaily}>
            {daily.claimed ? "Daily reward claimed" : daily.complete ? "Claim at the fountain" : "Daily challenges"} <Icon name="arrowRight" />
          </button>
        </section>
        {classes.length ? (
          <section className="note pin-yellow">
            <h3>Classes today</h3>
            <ul>
              {classes.map((c) => (
                <li key={c.key}>
                  {c.start}–{c.end} {c.title}
                  {c.location ? <small> · {c.location}</small> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="note pin-green">
          <h3>Me</h3>
          <ul>
            <li>
              <Icon name="flame" /> Streak: {streak} day{streak === 1 ? "" : "s"}
            </li>
            <li>
              <Icon name="book" /> Grimoire:{" "}
              <button type="button" className="link" onClick={onGrimoire}>
                {reviews} to review
              </button>
            </li>
            <li>
              <Icon name={rested ? "moon" : "bed"} /> {rested ? "Well rested (+10% study XP)" : "Sleep in your bed for +10% study XP"}
            </li>
            <li>
              <Icon name="sofa" /> Room comfort {room}: +{comfortFocusBonus(state.progress.dorm)} Focus with the daily reward
            </li>
          </ul>
        </section>
      </div>
    </Window>
  );
}
