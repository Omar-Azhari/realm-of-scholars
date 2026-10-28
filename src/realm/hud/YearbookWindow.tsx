/**
 * The yearbook page: a portrait of your character (rendered live) next to
 * your semester in numbers. "Download" saves it as a PNG.
 */

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Window } from "./Window";
import { useRealm } from "../state/store";
import { yearbookFor, type Yearbook } from "../state/yearbook";
import { HumanCharacter } from "../scene/HumanCharacter";
import { usePlayerAppearance } from "../customise/usePlayerAppearance";
import { findShopItem } from "../state/shop";
import type { HatId } from "../scene/models";
import { Icon } from "./icons";

const W = 1000;
const H = 1400;

function drawPage(book: Yearbook, portrait: HTMLCanvasElement | null): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const [field, trim] = book.houseColours ?? ["#4a3a2a", "#d6a419"];
  g.fillStyle = "#f3e6c8";
  g.fillRect(0, 0, W, H);
  g.fillStyle = field;
  g.fillRect(0, 0, W, 230);
  g.fillStyle = trim;
  g.fillRect(0, 230, W, 10);
  g.fillStyle = "#fff8e8";
  g.font = "bold 64px Georgia, serif";
  g.fillText("Yearbook", 60, 110);
  g.font = "28px Georgia, serif";
  g.fillText(`${book.university} · ${book.period}`, 60, 165);
  if (portrait) {
    g.fillStyle = "#2a1d14";
    g.fillRect(60, 280, 400, 560);
    g.drawImage(portrait, 60, 280, 400, 560);
  }
  g.strokeStyle = trim;
  g.lineWidth = 8;
  g.strokeRect(60, 280, 400, 560);
  g.fillStyle = "#2a1d10";
  g.font = "bold 52px Georgia, serif";
  g.fillText(book.name, 500, 340);
  g.font = "28px Georgia, serif";
  g.fillText(book.house ? `of House ${book.house}` : "", 500, 385);
  const stats: Array<[string, string]> = [
    ["Total level", String(book.totalLevel)],
    ["Quests", `${book.questsDone} / ${book.questsTotal}`],
    ["Bosses beaten", String(book.bosses)],
    ["Best streak", `${book.bestStreak} days`],
    ["Focused study", `${book.focusHours} h`],
    ["Spells learned", String(book.spells)],
    ["Secret doors", `${book.secrets} / 3`],
    ["Passport stamps", String(book.stamps)],
    ["Duelling rank", book.ladderBest ? `#${book.ladderBest}` : "None yet"],
  ];
  g.font = "26px Georgia, serif";
  stats.forEach(([k, v], i) => {
    const y = 460 + i * 44;
    g.fillStyle = "#6b4a2e";
    g.fillText(k, 500, y);
    g.fillStyle = "#2a1d10";
    g.font = "bold 26px Georgia, serif";
    g.fillText(v, 800, y);
    g.font = "26px Georgia, serif";
  });
  g.fillStyle = "#2a1d10";
  g.font = "bold 34px Georgia, serif";
  g.fillText("Subjects", 60, 920);
  g.font = "26px Georgia, serif";
  book.levels.forEach((l, i) => g.fillText(`${l.subject}: level ${l.level}`, 60 + (i % 2) * 460, 970 + Math.floor(i / 2) * 40));
  const yNotes = 1080 + Math.ceil(book.levels.length / 2) * 10;
  g.font = "bold 34px Georgia, serif";
  g.fillText("Highlights", 60, yNotes);
  g.font = "26px Georgia, serif";
  if (book.best) g.fillText(`Strongest: ${book.best.subject} week ${book.best.week}, ${Math.round(book.best.accuracy * 100)}% right`, 60, yNotes + 50);
  if (book.worst) g.fillText(`To revisit: ${book.worst.subject} week ${book.worst.week}, ${Math.round(book.worst.accuracy * 100)}% right`, 60, yNotes + 92);
  if (!book.best) g.fillText("Answer more questions to see your strongest and weakest weeks.", 60, yNotes + 50);
  g.fillStyle = "#6b4a2e";
  g.font = "italic 22px Georgia, serif";
  g.fillText(`Realm of Scholars · ${new Date().toLocaleDateString()}`, 60, H - 50);
  return c;
}

export function YearbookWindow({ onClose }: { onClose: () => void }) {
  const state = useRealm((s) => s);
  const appearance = usePlayerAppearance();
  const hat = useRealm((s) => (findShopItem(s, s.progress.wardrobe.hat)?.look as HatId | undefined) ?? null);
  const cape = useRealm((s) => findShopItem(s, s.progress.wardrobe.cape)?.look ?? null);
  const book = yearbookFor(state);
  const portrait = useRef<HTMLCanvasElement | null>(null);
  const download = () => {
    const page = drawPage(book, portrait.current);
    const a = document.createElement("a");
    a.href = page.toDataURL("image/png");
    a.download = `yearbook-${book.name.replace(/\W+/g, "-").toLowerCase()}-${book.period.replace(/\W+/g, "-").toLowerCase()}.png`;
    a.click();
  };
  return (
    <Window title="Semester yearbook" onClose={onClose} width={760} className="yearbook-window">
      <div className="yearbook">
        <div className="portrait">
          <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [0, 0.25, 2.9], fov: 34 }} onCreated={({ gl }) => (portrait.current = gl.domElement)}>
            <color attach="background" args={[book.houseColours?.[0] ?? "#3a2a1c"]} />
            <hemisphereLight args={["#fff4e0", "#3a2a1c", 1.2]} />
            <directionalLight position={[2, 3, 3]} intensity={2} />
            <group position={[0, -0.9, 0]}>
              <Suspense fallback={null}>
                <HumanCharacter appearance={appearance} height={1.75} hat={hat} capeColor={cape} />
              </Suspense>
            </group>
          </Canvas>
        </div>
        <div className="facts">
          <h3>{book.name}</h3>
          <p className="muted">{book.house ? `House ${book.house} · ` : ""}{book.university} · {book.period}</p>
          <ul>
            <li>Total level {book.totalLevel} · {book.questsDone}/{book.questsTotal} quests · {book.bosses} bosses</li>
            <li>Best streak {book.bestStreak} days · {book.focusHours} h focused</li>
            <li>{book.spells} spells · {book.secrets}/3 secret doors · {book.stamps} stamps{book.ladderBest ? ` · duelling #${book.ladderBest}` : ""}</li>
            {book.best ? <li>Strongest: {book.best.subject} week {book.best.week} ({Math.round(book.best.accuracy * 100)}%)</li> : null}
            {book.worst ? <li>To revisit: {book.worst.subject} week {book.worst.week} ({Math.round(book.worst.accuracy * 100)}%)</li> : null}
          </ul>
          <button type="button" className="rs-button" onClick={download}>
            <Icon name="download" /> Download page (PNG)
          </button>
        </div>
      </div>
    </Window>
  );
}
