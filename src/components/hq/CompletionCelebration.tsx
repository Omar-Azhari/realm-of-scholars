/**
 * Semester completion sequence (Phase 11 Part 7).
 *
 * Shown over the HQ exactly once: when the derived completion check says the
 * semester is 100% done and `completionCelebratedAt` hasn't been stamped
 * yet. All four mentors gather, each says their completed-semester line, and
 * a summary of REAL saved statistics is presented. Dismissing it stamps the
 * timestamp and returns to normal gameplay — the save is never locked, and
 * everything on campus stays fully playable afterwards.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Medal, Timer, Users, Zap } from "lucide-react";
import { useSaveData } from "../../state/SaveDataContext";
import { useSprite } from "../../engine/AssetContext";
import { SpriteView } from "../../engine/SpriteView";
import { useMotionPreference } from "../../hooks/useMotionPreference";
import { getCountedSessions, getTotalFocusSeconds } from "../../lib/focusSession";
import { getAchievementStatuses } from "../../lib/achievements";
import { computeMentorRelationship, formatMinutes, LEVEL_NAMES } from "../../lib/mentorRelationship";
import { getCompletionLine } from "../../lib/mentorDialogue";
import { getSubjectAccentVar } from "../../lib/subjectTheme";
import { emitSound } from "../../lib/sound";

function MentorFigure({ subjectId, name }: { subjectId: string; name: string }) {
  const sprite = useSprite(`mentor-${subjectId}`);
  if (!sprite) return null;
  return (
    <div className="completion-mentor" style={{ ["--mentor-accent" as string]: `var(${getSubjectAccentVar(subjectId)})` }}>
      <div className="completion-mentor-sprite">
        <SpriteView sprite={sprite} animation="celebrate" label="" />
      </div>
      <p className="completion-mentor-line">“{getCompletionLine(subjectId, 0)}”</p>
      <p className="completion-mentor-name">{name}</p>
    </div>
  );
}

export function CompletionCelebration() {
  const { saveData, markCompletionCelebrated } = useSaveData();
  const reduceMotion = useMotionPreference();
  const subjects = saveData.semester.subjects;

  const stats = useMemo(() => {
    const achievements = getAchievementStatuses(saveData);
    return {
      focusMinutes: Math.floor(getTotalFocusSeconds(saveData) / 60),
      sprints: getCountedSessions(saveData).length,
      xp: saveData.userProgress.xp,
      level: saveData.userProgress.level,
      achievementsUnlocked: achievements.filter((a) => a.unlocked).length,
      achievementsTotal: achievements.length,
      bonds: subjects.map((subject) => ({
        subject,
        relationship: computeMentorRelationship(saveData, subject),
      })),
    };
  }, [saveData, subjects]);

  const dismiss = () => {
    emitSound("celebration");
    markCompletionCelebrated();
  };

  return (
    <motion.div
      className="completion-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Semester complete celebration"
      data-testid="completion-celebration"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="completion-card"
        initial={reduceMotion ? false : { y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
      >
        <h2 className="completion-title">
          <GraduationCap size={22} aria-hidden="true" /> Semester Complete!
        </h2>
        <p className="completion-lede">
          Every module completed, every assessment submitted. The whole campus came out to
          celebrate you.
        </p>

        <div className="completion-mentor-row">
          {subjects.map((subject, index) => (
            <motion.div
              key={subject.id}
              initial={reduceMotion ? false : { y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 + index * 0.18, duration: 0.4, ease: "easeOut" }}
            >
              <MentorFigure subjectId={subject.id} name={subject.characterConcept} />
            </motion.div>
          ))}
        </div>

        <dl className="completion-stats">
          <div>
            <dt>
              <Timer size={14} aria-hidden="true" /> Total study time
            </dt>
            <dd>{formatMinutes(stats.focusMinutes)}</dd>
          </div>
          <div>
            <dt>
              <Zap size={14} aria-hidden="true" /> Focus Sprints
            </dt>
            <dd>{stats.sprints}</dd>
          </div>
          <div>
            <dt>
              <Zap size={14} aria-hidden="true" /> XP earned
            </dt>
            <dd>
              {stats.xp} XP · level {stats.level}
            </dd>
          </div>
          <div>
            <dt>
              <Medal size={14} aria-hidden="true" /> Achievements
            </dt>
            <dd>
              {stats.achievementsUnlocked}/{stats.achievementsTotal}
            </dd>
          </div>
          <div className="completion-stats-wide">
            <dt>
              <Users size={14} aria-hidden="true" /> Mentor bonds
            </dt>
            <dd>
              {stats.bonds
                .map(
                  ({ subject, relationship }) =>
                    `${subject.name}: Lv ${relationship.level} (${LEVEL_NAMES[relationship.level - 1]})`
                )
                .join(" · ")}
            </dd>
          </div>
        </dl>

        <button type="button" className="button--primary completion-dismiss" onClick={dismiss} autoFocus>
          Back to campus
        </button>
        <p className="completion-footnote">
          Nothing gets locked — keep studying, revisiting rooms, and collecting whatever's left.
        </p>
      </motion.div>
    </motion.div>
  );
}
