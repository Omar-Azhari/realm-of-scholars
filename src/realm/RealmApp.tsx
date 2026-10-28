/** Realm of Scholars root: enrolment until a curriculum exists, then the game. */

import { useEffect } from "react";
import { Enrolment } from "./enrol/Enrolment";
import { ExpoWelcome } from "./enrol/ExpoWelcome";
import { isExpo } from "./expo";
import { enrichWithBank, needsBank } from "./curriculum/enrich";
import { withLaTrobeDates } from "./curriculum/latrobeCalendar";
import { chat } from "./state/events";
import { realmStore } from "./state/store";
import { RealmGame } from "./RealmGame";
import { useRealm } from "./state/store";
import "../styles/realm.css";

export default function RealmApp() {
  const player = useRealm((s) => s.player);
  const curriculum = useRealm((s) => s.curriculum);

  // Realms forged before the built-in question banks existed get them now (progress untouched).
  useEffect(() => {
    if (!curriculum || !curriculum.subjects.some(needsBank)) return;
    realmStore.set((s) => (s.curriculum ? { ...s, curriculum: { ...s.curriculum, subjects: s.curriculum.subjects.map(enrichWithBank) } } : s));
  }, [curriculum]);
  // La Trobe realms without a semester start get the official dates (start, mid-semester break, exams).
  useEffect(() => {
    if (!curriculum) return;
    const dated = withLaTrobeDates(curriculum.enrolment);
    if (dated === curriculum.enrolment) return;
    realmStore.set((s) => (s.curriculum ? { ...s, curriculum: { ...s.curriculum, enrolment: dated } } : s));
    window.setTimeout(() => chat(`Semester dates set from La Trobe's calendar: teaching started ${dated.startDate}, with the mid-semester break and exam period included.`, "quest"), 1500);
  }, [curriculum]);
  if (!player || !curriculum) return isExpo() ? <ExpoWelcome /> : <Enrolment existingPlayer={player} />;
  return <RealmGame key={curriculum.createdAt} player={player} curriculum={curriculum} />;
}
