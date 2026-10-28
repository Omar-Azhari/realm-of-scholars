/**
 * The menu drawer: Skills, Quests, Grimoire, Achievements, Bag, Codex and
 * Options, plus quick actions (owl post, emotes, home, help). It hides behind
 * one Menu button (or the M key) and slides in from the right.
 */

import { isExpo } from "../expo";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { FAMILIAR_PERKS, familiarGrowth, familiarLevel, nextFamiliarLevelAt } from "../customise/familiar";
import { useRealm } from "../state/store";
import { levelForXp, levelProgress, xpToNextLevel, MAX_LEVEL, questPointsFor } from "../xp";
import { THEME_STYLES } from "../world/themes";
import { graduationStatus, liveStreak, questProgress } from "../state/actions";
import { dueCards } from "../state/grimoire";
import { unreadCount } from "../state/mail";
import { todayIso } from "../state/store";
import { dueLabel, soonestQuest } from "../dialogues";
import { AVATARS } from "../scene/models";
import { setFirstPerson } from "../scene/runtime";
import { useFirstPerson, ViewButton } from "./ViewButton";
import { AchievementsPanel } from "./ProgressWindows";
import { openEmoteWheel } from "./EmoteWheel";
import { FOODS, LIFE_SKILLS, RESOURCES, WEAPONS } from "../life/catalog";
import type { InventoryItem, ItemId, RealmSettings, RealmSubject } from "../types";
import { Icon, itemIcon, lifeSkillIcon, themeIcon, type IconName } from "./icons";

export type PanelTab = "skills" | "quests" | "grimoire" | "achievements" | "inventory" | "codex" | "options";

const TABS: Array<{ id: PanelTab; icon: IconName; label: string; short: string }> = [
  { id: "skills", icon: "skills", label: "Skills", short: "Skills" },
  { id: "quests", icon: "quests", label: "Quest journal", short: "Quests" },
  { id: "grimoire", icon: "book", label: "Grimoire of Mistakes", short: "Grimoire" },
  { id: "achievements", icon: "trophy", label: "Achievements", short: "Feats" },
  { id: "inventory", icon: "bag", label: "Inventory and bag", short: "Bag" },
  { id: "codex", icon: "bookOpen", label: "Codex", short: "Codex" },
  { id: "options", icon: "settings", label: "Options", short: "Options" },
];

const TAB_KEY = "realm.menuTab";

/** Inventory item pictograms (see icons.tsx). */
export const ITEM_ICONS: Record<ItemId, IconName> = {
  tome: "book",
  "xp-lamp": "lamp",
  "quest-scroll": "quests",
  "focus-candle": "candle",
  "graduation-cape": "cape",
  "scholar-ring": "ring",
  "rune-shard": "gem",
};

export interface SidePanelActions {
  openSkill: (subjectId: string) => void;
  openQuest: (assessmentId: string) => void;
  openCodex: (subjectId: string) => void;
  useItem: (index: number, item: InventoryItem) => void;
  examineItem: (item: InventoryItem) => void;
  dropItem: (index: number) => void;
  toggleSound: () => void;
  toggleGraphics: () => void;
  openWardrobe: () => void;
  exportSave: () => void;
  importSave: () => void;
  reEnrol: () => void;
  openClassic: () => void;
  showControls: () => void;
  openGrimoire: () => void;
  openSpellbook: () => void;
  openCalendar: () => void;
  openGroup: () => void;
  toggleMusic: () => void;
  openGrades: () => void;
  toggleReminders: () => void;
  setSetting: (patch: Partial<RealmSettings>) => void;
  /** Owl post (letters). */
  openMail?: () => void;
  /** Teleport back to the plaza fountain. */
  goHome?: () => void;
}

function readTab(): PanelTab {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved && TABS.some((t) => t.id === saved)) return saved as PanelTab;
  } catch {
    // Storage can be blocked; the Skills tab is a fine default.
  }
  return "skills";
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

export function SidePanel({ actions }: { actions: SidePanelActions }) {
  const [open, setOpen] = useState(false);
  const [tab, setTabState] = useState<PanelTab>(readTab);
  const due = useRealm((s) => dueCards(s).length);
  const unread = useRealm((s) => unreadCount(s));
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const openedWith = useRef<"button" | "key">("button");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const setTab = (next: PanelTab) => {
    setTabState(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // ignore
    }
  };

  // M toggles the menu; Escape closes it (windows and conversations take Escape first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "m") {
        if (document.querySelector(".rs-window-backdrop, .rs-dialogue")) return;
        openedWith.current = "key";
        setOpen((v) => !v);
      } else if (k === "escape" && open && !document.querySelector(".rs-window-backdrop, .rs-dialogue, .rs-menu, .rs-emote-wheel")) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Opening a window (from the menu or anywhere else) tucks the menu away, so they never stack up.
  useEffect(() => {
    if (!open) return;
    const check = () => {
      if (document.querySelector(".rs-window-backdrop")) setOpen(false);
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  // Focus moves into the drawer when it opens and back to the Menu button when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) drawer.current?.focus({ preventScroll: true });
    else if (wasOpen.current) {
      const active = document.activeElement as HTMLElement | null;
      if (openedWith.current === "button") menuButton.current?.focus({ preventScroll: true });
      else if (active && drawer.current?.contains(active)) active.blur();
    }
    wasOpen.current = open;
  }, [open]);

  const close = () => setOpen(false);
  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <ViewButton />
      <button
        ref={menuButton}
        type="button"
        className={`rs-menu-button ${open ? "on" : ""}`}
        aria-expanded={open}
        aria-controls="rs-drawer"
        aria-keyshortcuts="M"
        aria-label={`Menu (M)${unread ? `, ${unread} unread letter${unread === 1 ? "" : "s"}` : ""}`}
        title="Menu (M)"
        onClick={() => {
          openedWith.current = "button";
          setOpen((v) => !v);
        }}
      >
        <span className="glyph" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="label">Menu</span>
        {unread ? (
          <span className="rs-badge" aria-hidden="true">
            {unread}
          </span>
        ) : null}
      </button>
      <aside
        ref={drawer}
        id="rs-drawer"
        className={`rs-drawer ${open ? "open" : ""}`}
        aria-label="Menu"
        aria-hidden={!open}
        tabIndex={-1}
        onContextMenu={(e) => e.preventDefault()}
      >
        <DrawerHead onClose={close} />
        <div className="rs-quick" role="group" aria-label="Quick actions">
          {actions.openMail ? (
            <button type="button" className="rs-quick-btn" onClick={actions.openMail} aria-label={`Owl post${unread ? `, ${unread} unread` : ""}`}>
              <span className="ico" aria-hidden="true">
                <Icon name="mail" />
              </span>
              <span className="text">Owl post</span>
              {unread ? (
                <span className="rs-badge" aria-hidden="true">
                  {unread}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            className="rs-quick-btn"
            aria-keyshortcuts="G"
            onClick={() => {
              close();
              openEmoteWheel();
            }}
          >
            <span className="ico" aria-hidden="true">
              <Icon name="emote" />
            </span>
            <span className="text">Emotes</span>
          </button>
          {actions.goHome ? (
            <button
              type="button"
              className="rs-quick-btn"
              title="Teleport back to the plaza fountain"
              onClick={() => {
                close();
                actions.goHome?.();
              }}
            >
              <span className="ico" aria-hidden="true">
                <Icon name="home" />
              </span>
              <span className="text">Home</span>
            </button>
          ) : null}
          <button type="button" className="rs-quick-btn" onClick={actions.showControls}>
            <span className="ico" aria-hidden="true">
              <Icon name="help" />
            </span>
            <span className="text">Help</span>
          </button>
        </div>
        <div className="rs-tabs" role="tablist" aria-label="Menu sections">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`rs-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="rs-drawer-body"
              aria-label={t.label}
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? "active" : ""}
              title={t.label}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className="ico" aria-hidden="true">
                <Icon name={t.icon} />
              </span>
              <span className="text" aria-hidden="true">
                {t.short}
              </span>
              {t.id === "grimoire" && due > 0 ? (
                <span className="rs-badge" aria-hidden="true">
                  {due}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="rs-drawer-body" id="rs-drawer-body" role="tabpanel" aria-labelledby={`rs-tab-${tab}`}>
          {tab === "skills" ? <SkillsTab actions={actions} /> : null}
          {tab === "quests" ? <QuestsTab actions={actions} /> : null}
          {tab === "grimoire" ? <GrimoireTab actions={actions} /> : null}
          {tab === "achievements" ? <AchievementsPanel /> : null}
          {tab === "inventory" ? <InventoryTab actions={actions} /> : null}
          {tab === "codex" ? <CodexTab actions={actions} /> : null}
          {tab === "options" ? <OptionsTab actions={actions} /> : null}
        </div>
      </aside>
    </>
  );
}

/** Who you are at a glance: name, total level, quest points and streak. */
function DrawerHead({ onClose }: { onClose: () => void }) {
  const name = useRealm((s) => s.player?.name ?? "Scholar");
  const subjects = useRealm((s) => s.curriculum?.subjects);
  const skillXp = useRealm((s) => s.progress.skillXp);
  const questPoints = useRealm((s) => s.progress.questPoints);
  const streak = useRealm((s) => liveStreak(s));
  const total = (subjects ?? []).reduce((sum, subject) => sum + levelForXp(skillXp[subject.id] ?? 0), 0);
  return (
    <header className="rs-drawer-head">
      <span className="avatar" aria-hidden="true">
        {name.trim().charAt(0).toUpperCase() || "S"}
      </span>
      <div className="who">
        <strong>{name}</strong>
        <span className="stats">
          <span title="Total level across your subjects">Total Lv {total}</span>
          <span title="Quest points">{questPoints} QP</span>
          <span title="Study streak (days in a row)">
            <Icon name="flame" /> {streak}
          </span>
        </span>
      </div>
      <button type="button" className="rs-icon-button" onClick={onClose} aria-label="Close menu" title="Close (M or Esc)">
        <Icon name="close" />
      </button>
    </header>
  );
}

function SkillsTab({ actions }: { actions: SidePanelActions }) {
  const subjects = useRealm((s) => s.curriculum?.subjects) ?? [];
  const skillXp = useRealm((s) => s.progress.skillXp);
  const total = subjects.reduce((sum, subject) => sum + levelForXp(skillXp[subject.id] ?? 0), 0);
  const totalXp = subjects.reduce((sum, subject) => sum + (skillXp[subject.id] ?? 0), 0);
  const streak = useRealm((s) => liveStreak(s));
  const best = useRealm((s) => s.progress.streak.best);
  const lifeXp = useRealm((s) => s.progress.lifeXp);
  return (
    <div className="rs-skills">
      <p className="rs-section-label">Subjects</p>
      <div className="rs-skill-list">
        {subjects.map((subject) => {
          const xp = skillXp[subject.id] ?? 0;
          const level = levelForXp(xp);
          return (
            <button
              key={subject.id}
              type="button"
              className="rs-skill"
              onClick={() => actions.openSkill(subject.id)}
              title={`${subject.name}\nXP: ${xp.toLocaleString()}${level < MAX_LEVEL ? `\nNext level in: ${xpToNextLevel(xp).toLocaleString()} XP` : ""}`}
            >
              <span className="icon" style={{ color: THEME_STYLES[subject.theme].glow }} aria-hidden="true">
                <Icon name={themeIcon(subject.theme)} />
              </span>
              <span className="name">
                <strong>{subject.code || subject.name}</strong>
                {subject.code ? <small>{subject.name}</small> : null}
              </span>
              <span className="lvl">Lv {level}</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${Math.round(levelProgress(xp) * 100)}%` }} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="rs-stat-row">
        <p>
          <span>Total level</span>
          <strong>{total}</strong>
        </p>
        <p>
          <span>Total XP</span>
          <strong>{totalXp.toLocaleString()}</strong>
        </p>
        <p
          className="rs-streak"
          title="Days in a row with real study: a waystone, a quest step, a trial win, a meditation or a Grimoire review. Every 7th day pays a bonus."
        >
          <span>Streak · best {best}</span>
          <strong>
            <Icon name="flame" /> {streak} day{streak === 1 ? "" : "s"}
          </strong>
        </p>
      </div>
      <p className="rs-section-label">Life skills</p>
      <div className="rs-skill-grid life">
        {LIFE_SKILLS.map((l) => {
          const xp = lifeXp[l.id] ?? 0;
          const level = levelForXp(xp);
          return (
            <div key={l.id} className="rs-skill" title={`${l.name}: ${l.blurb}\nXP: ${xp.toLocaleString()}`}>
              <span className="icon" aria-hidden="true">
                <Icon name={lifeSkillIcon(l.id)} />
              </span>
              <span className="name">
                <strong>{l.name}</strong>
              </span>
              <span className="lvl">Lv {level}</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${Math.round(levelProgress(xp) * 100)}%` }} />
              </span>
            </div>
          );
        })}
      </div>
      <FamiliarLine />
      <button type="button" className="rs-import" onClick={actions.openSpellbook}>
        <Icon name="wand" /> Spellbook: spells from the weeks you have studied
      </button>
    </div>
  );
}

/** Your familiar's level and current perk (pets grow as you study). */
function FamiliarLine() {
  const level = useRealm((s) => familiarLevel(s));
  const pet = useRealm((s) => s.progress.wardrobe.pet);
  const nextAt = useRealm((s) => nextFamiliarLevelAt(s));
  const growth = useRealm((s) => familiarGrowth(s));
  if (!pet) return null;
  return (
    <p className="rs-familiar" title={FAMILIAR_PERKS.slice(0, level).join("\n")}>
      Familiar level <strong>{level}</strong>/5: {FAMILIAR_PERKS[level - 1]}
      {nextAt ? <span className="muted small"> · next level at {nextAt} study points ({growth} now)</span> : null}
    </p>
  );
}

function QuestsTab({ actions }: { actions: SidePanelActions }) {
  const state = useRealm((s) => s);
  const subjects = state.curriculum?.subjects ?? [];
  const status = graduationStatus(state);
  const maxPoints = subjects.reduce((sum, s) => sum + s.assessments.reduce((a, x) => a + questPointsFor(x.weightPercent), 0), 0);
  const next = soonestQuest(state, subjects);
  return (
    <div className="rs-quests">
      {next ? (
        <button type="button" className="rs-next-quest" onClick={() => actions.openQuest(next.assessment.id)}>
          <span className="label">Due next</span>
          <strong>{next.assessment.title}</strong>
          <span className="muted small">
            {next.subject.name} · {dueLabel(next.assessment, state.curriculum)}
          </span>
        </button>
      ) : null}
      <div className="rs-stat-row">
        <p className="rs-qp">
          <span>Quest points</span>
          <strong>
            {state.progress.questPoints} / {maxPoints}
          </strong>
        </p>
        <p className="rs-grad">
          <span>Graduation</span>
          <strong>
            {status.done}/{status.total} {state.progress.graduatedAt ? "· Graduated" : ""}
          </strong>
        </p>
      </div>
      <div className="rs-button-row">
        {isExpo() ? null : (
          <button type="button" className="rs-import" onClick={actions.openCalendar}>
            <Icon name="calendar" /> Import deadlines from Moodle
          </button>
        )}
        <button type="button" className="rs-import" onClick={actions.openGrades}>
          <Icon name="cap" /> Grades, WAM &amp; study plan
        </button>
      </div>
      {subjects.map((subject) => (
        <div key={subject.id} className="rs-quest-group">
          <p className="rs-quest-subject">{subject.name}</p>
          {subject.assessments.length === 0 ? <p className="muted small">No assessments found. Study every waystone instead.</p> : null}
          {subject.assessments.map((assessment) => {
            const progress = questProgress(state, assessment);
            const label = progress.status === "complete" ? "Complete" : progress.status === "in-progress" ? "In progress" : "Not started";
            return (
              <button key={assessment.id} type="button" className={`rs-quest ${progress.status}`} onClick={() => actions.openQuest(assessment.id)}>
                <span className="dot" aria-hidden="true" />
                <span className="title">{assessment.title}</span>
                <span className="state">{label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function GrimoireTab({ actions }: { actions: SidePanelActions }) {
  const mistakes = useRealm((s) => s.progress.mistakes);
  const subjects = useRealm((s) => s.curriculum?.subjects) ?? [];
  const due = useRealm((s) => dueCards(s).length);
  const entries = Object.values(mistakes).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const today = todayIso();
  return (
    <div className="rs-grimoire">
      <p className="small muted">Questions you got wrong come back 1, 3 and 7 days later until you&apos;ve mastered them.</p>
      <button type="button" className="rs-next-quest" onClick={actions.openGrimoire} disabled={due === 0}>
        <span className="label">{due > 0 ? "Review now" : "Nothing due"}</span>
        <strong>
          {due} card{due === 1 ? "" : "s"} due today
        </strong>
        <span className="muted small">{entries.length} in the book</span>
      </button>
      <ul className="grimoire-list">
        {entries.slice(0, 30).map((entry) => {
          const subject = subjects.find((s) => s.id === entry.subjectId);
          return (
            <li key={`${entry.subjectId}-${entry.addedAt}-${entry.question.prompt.slice(0, 20)}`} title={entry.question.prompt}>
              <span className="icon" aria-hidden="true">
                <Icon name={subject ? themeIcon(subject.theme) : "help"} />
              </span>
              <span className="prompt">{entry.question.prompt}</span>
              <span className="when muted small">{entry.dueOn <= today ? "due" : entry.dueOn.slice(5)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InventoryTab({ actions }: { actions: SidePanelActions }) {
  const inventory = useRealm((s) => s.progress.inventory);
  const [selected, setSelected] = useState<number | null>(null);
  const slots = Array.from({ length: 28 }, (_, i) => inventory[i] ?? null);
  const verb = (item: InventoryItem) => (item.id === "xp-lamp" ? "Rub" : item.id === "tome" ? "Read" : item.id === "graduation-cape" ? "Wear" : "Use");
  return (
    <div className="rs-inventory">
      <p className="rs-section-label">Inventory</p>
      <div className="rs-inv-grid">
        {slots.map((item, i) => (
          <button
            key={i}
            type="button"
            className={`rs-slot ${selected === i ? "selected" : ""}`}
            disabled={!item}
            aria-pressed={item ? selected === i : undefined}
            aria-label={item ? `${item.name}${item.quantity > 1 ? `, ${item.quantity}` : ""}` : `Empty slot ${i + 1}`}
            title={item ? `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}` : undefined}
            onClick={() => item && setSelected(selected === i ? null : i)}
          >
            {item ? (
              <>
                <span className="icon" aria-hidden="true">
                  <Icon name={ITEM_ICONS[item.id] ?? itemIcon(item.id)} />
                </span>
                {item.quantity > 1 ? <span className="qty">{item.quantity}</span> : null}
              </>
            ) : null}
          </button>
        ))}
      </div>
      {selected !== null && inventory[selected] ? (
        <div className="rs-item-actions">
          <p className="name">{inventory[selected].name}</p>
          <button type="button" className="rs-button small" onClick={() => actions.useItem(selected, inventory[selected])}>
            {verb(inventory[selected])}
          </button>
          <button type="button" className="rs-button secondary small" onClick={() => actions.examineItem(inventory[selected])}>
            Examine
          </button>
          <button
            type="button"
            className="rs-button danger small"
            onClick={() => {
              actions.dropItem(selected);
              setSelected(null);
            }}
          >
            Drop
          </button>
        </div>
      ) : (
        <p className="muted small">Select an item to use it.</p>
      )}
      <Materials />
    </div>
  );
}

/** The adventurer's bag: gathered materials, cooked food and crafted arms. */
function Materials() {
  const materials = useRealm((s) => s.progress.materials);
  const weapon = useRealm((s) => s.progress.weapon);
  const entries = [
    ...RESOURCES.map((r) => ({ id: r.id, icon: itemIcon(r.id), name: r.name })),
    ...FOODS.map((f) => ({ id: f.id, icon: itemIcon(f.id), name: f.name })),
  ].filter((e) => (materials[e.id] ?? 0) > 0);
  return (
    <div className="rs-materials">
      <p className="rs-section-label">Bag</p>
      {entries.length === 0 ? (
        <p className="muted small">Empty. Fish, mine and chop in the wilds (each try costs 1 Focus).</p>
      ) : (
        <div className="mat-grid">
          {entries.map((e) => (
            <span key={e.id} className="mat" title={e.name} aria-label={`${e.name}: ${materials[e.id]}`}>
              <span className="icon" aria-hidden="true">
                <Icon name={e.icon} />
              </span>
              <span className="qty">{materials[e.id]}</span>
            </span>
          ))}
        </div>
      )}
      {weapon ? (
        <p className="small">
          <Icon name="swords" /> Carrying {WEAPONS.find((w) => w.id === weapon)?.name.toLowerCase()}
        </p>
      ) : null}
    </div>
  );
}

function CodexTab({ actions }: { actions: SidePanelActions }) {
  const subjects = useRealm((s) => s.curriculum?.subjects) ?? [];
  const weeks = useRealm((s) => s.progress.weeks);
  const enrolment = useRealm((s) => s.curriculum?.enrolment);
  return (
    <div className="rs-codex">
      {enrolment ? (
        <p className="rs-enrolment">
          <strong>
            {enrolment.course ? `${enrolment.course}, ` : ""}
            {enrolment.university}
          </strong>
          <span className="muted">
            {enrolment.teachingPeriod} {enrolment.year}
          </span>
        </p>
      ) : null}
      {subjects.map((subject: RealmSubject) => {
        const studied = subject.weeks.filter((w) => weeks[`${subject.id}:${w.week}`]?.studiedAt).length;
        return (
          <button key={subject.id} type="button" className="rs-codex-entry" onClick={() => actions.openCodex(subject.id)}>
            <span className="icon" style={{ color: THEME_STYLES[subject.theme].glow }} aria-hidden="true">
              <Icon name={themeIcon(subject.theme)} />
            </span>
            <span className="text">
              <strong>{subject.name}</strong>
              <span className="muted small">
                {studied}/{subject.weeks.length} weeks studied · {confidenceLabel(subject.confidence)}
              </span>
            </span>
            <span className="chev" aria-hidden="true">
              <Icon name="chevronRight" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function confidenceLabel(confidence: RealmSubject["confidence"]): string {
  switch (confidence) {
    case "official":
      return "official source";
    case "document":
      return "from your documents";
    case "manual":
      return "entered by you";
    default:
      return "partly inferred, please verify";
  }
}

/** One settings row: a label on the left, the current value as a pill on the right. */
function Setting({ label, value, on, onClick, hint }: { label: string; value: string; on?: boolean; onClick: () => void; hint?: string }) {
  return (
    <button type="button" className="rs-setting" onClick={onClick} aria-pressed={on} title={hint}>
      <span className="label">{label}</span>
      <span className={`value ${on === undefined ? "" : on ? "on" : "off"}`}>{value}</span>
    </button>
  );
}

function OptionsTab({ actions }: { actions: SidePanelActions }) {
  const firstPerson = useFirstPerson();
  const sound = useRealm((s) => s.settings.sound);
  const music = useRealm((s) => s.settings.music);
  const settings = useRealm((s) => s.settings);
  const graphics = useRealm((s) => s.settings.graphics);
  const avatar = useRealm((s) => s.player?.avatar ?? "knight");
  return (
    <div className="rs-options">
      <p className="rs-section-label">Sound</p>
      <div className="rs-setting-group">
        <Setting label="Sound effects" value={sound ? "On" : "Off"} on={sound} onClick={actions.toggleSound} />
        <Setting label="Music" value={music ? "On" : "Off"} on={music} onClick={actions.toggleMusic} />
      </div>
      <p className="rs-section-label">Display</p>
      <div className="rs-setting-group">
        <Setting label="Camera view" value={firstPerson ? "First person" : "Third person"} onClick={() => setFirstPerson(!firstPerson)} />
        <Setting
          label="Graphics"
          value={graphics === "ultra" ? "Ultra" : graphics === "high" ? "High" : "Low"}
          hint={graphics === "ultra" ? "Ultra: ambient occlusion" : graphics === "high" ? "High: detailed" : "Low: fastest"}
          onClick={actions.toggleGraphics}
        />
        <Setting label="Sky" value={settings.realTimeSky ? "Follows your clock" : "Always day"} onClick={() => actions.setSetting({ realTimeSky: !settings.realTimeSky })} />
        <Setting
          label="Text size"
          value={settings.textScale === 1 ? "Normal" : settings.textScale === 1.15 ? "Large" : "Larger"}
          onClick={() => actions.setSetting({ textScale: settings.textScale === 1 ? 1.15 : settings.textScale === 1.15 ? 1.3 : 1 })}
        />
        <Setting label="Colour-blind mode" value={settings.colorblind ? "On" : "Off"} on={settings.colorblind} onClick={() => actions.setSetting({ colorblind: !settings.colorblind })} />
        <Setting label="Reduce motion" value={settings.reduceMotion ? "On" : "Off"} on={settings.reduceMotion} onClick={() => actions.setSetting({ reduceMotion: !settings.reduceMotion })} />
      </div>
      <p className="rs-section-label">Study</p>
      <div className="rs-setting-group">
        {isExpo() ? null : <Setting label="Reminders" value={settings.reminders ? "On" : "Off"} on={settings.reminders} onClick={actions.toggleReminders} />}
        {isExpo() ? null : <Setting label="Import Moodle deadlines" value="Open" onClick={actions.openCalendar} />}
        <Setting label="Study group" value="Open" onClick={actions.openGroup} />
      </div>
      <p className="rs-section-label">Character</p>
      <div className="rs-setting-group">
        <Setting label="Wardrobe" value={AVATARS.find((a) => a.id === avatar)?.label ?? "Knight"} onClick={actions.openWardrobe} />
        <Setting label="Controls & help" value="Open" onClick={actions.showControls} />
      </div>
      {/* At the expo stand nothing downloads, imports or replaces the demo (see expo.ts). */}
      {isExpo() ? null : (
        <>
          <p className="rs-section-label">Save</p>
          <div className="rs-setting-group">
            <Setting label="Export save" value="Download" onClick={actions.exportSave} />
            <Setting label="Import save" value="Choose file" onClick={actions.importSave} />
            <Setting label="Re-enrol (new semester / subjects)" value="Start" onClick={actions.reEnrol} />
            <Setting label="Open classic campus" value="Switch" onClick={actions.openClassic} />
          </div>
        </>
      )}
    </div>
  );
}
