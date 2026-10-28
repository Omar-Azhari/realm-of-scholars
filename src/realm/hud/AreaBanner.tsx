/**
 * RuneScape-style area titles: entering a district, a subject region, the
 * plaza or the wilds shows the place's name across the top of the screen,
 * with the same emblem (colour and pictogram) as its sign and its minimap
 * marker.
 */

import { cinematicProgress } from "../scene/cinematic";
import { roomAt } from "../world/rooms";
import { useEffect, useRef, useState } from "react";
import { runtime } from "../scene/runtime";
import { drawEmblem, type SignColours } from "../scene/Signage";
import { PURPOSE_STYLE, TILE, type PlaceIcon, type SceneryKind, type World } from "../world/worldGen";
import { THEME_STYLES } from "../world/themes";
import type { RealmSubject } from "../types";

interface Area {
  name: string;
  sub: string;
  /** Emblem and label, when the area has a purpose. */
  icon?: PlaceIcon;
  colours?: SignColours;
  label?: string;
}

/** What each scenic landmark is for, under its title. */
const SCENERY_SUB: Record<SceneryKind, string> = {
  lookout: "Look out over the campus and head anywhere",
  picnic: "Sit by the water and read your notes",
  windmill: "Read the plaque by the door",
  ruins: "Study the runes to review your mistakes",
  "bell-tower": "Check what's due and today's challenges",
};

function areaAt(world: World, subjects: RealmSubject[], x: number, z: number): Area {
  const room = roomAt(world.rooms, x, z)?.kind ?? (world.interior ?? (world.mode === "interior" ? "dorm" : null));
  if (room === "theatre") return { name: "Lecture theatre", sub: "Relive any week's lecture at the lectern", icon: "lectern", colours: PURPOSE_STYLE.study, label: PURPOSE_STYLE.study.label };
  if (room === "dorm") return { name: "Your dorm room", sub: "Sleep, study, dress up, decorate", icon: "bed", colours: PURPOSE_STYLE.home, label: PURPOSE_STYLE.home.label };
  const p = world.plaza;
  const onPlaza = x >= p.x0 && x < p.x1 && z >= p.z0 && z < p.z1;
  for (const d of world.districts) {
    if (!onPlaza && Math.hypot(x - (d.x + 0.5), z - (d.z + 0.5)) <= d.half) {
      const style = PURPOSE_STYLE[d.purpose];
      return { name: d.name, sub: d.blurb, icon: d.icon, colours: style, label: style.label };
    }
  }
  if (onPlaza) {
    return {
      name: world.hub.plazaName,
      sub: world.islandId === "home" ? "The heart of campus. Follow the roads out to study, play, sport, home and crafts" : "The exchange hall stands here",
      icon: "castle",
      colours: PURPOSE_STYLE.hall,
    };
  }
  // Scenic landmarks out in the country get their own title as you walk up to them.
  for (const o of world.objects) {
    if (o.kind !== "scenery") continue;
    if (Math.hypot(x - (o.x + o.w / 2), z - (o.z + o.d / 2)) <= Math.max(o.w, o.d) / 2 + 5) {
      return { name: o.name, sub: o.scenery ? SCENERY_SUB[o.scenery] : "" };
    }
  }
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  const region = tx >= 0 && tz >= 0 && tx < world.size && tz < world.size ? world.regionOf[tz * world.size + tx] : 0;
  if (region > 0) {
    const r = world.regions[region - 1];
    const subject = subjects.find((s) => s.id === r?.subjectId);
    const theme = THEME_STYLES[r?.theme ?? "arcane"];
    return {
      name: r?.name ?? "A subject region",
      sub: subject ? `${subject.code ? `${subject.code} · ` : ""}${subject.name}` : "",
      icon: "books",
      colours: { main: theme.roof, dark: theme.robe, accent: theme.glow },
      label: "Subject",
    };
  }
  // Paved ground just off the Agora still counts as the Agora; the long roads out are open country.
  const kind = tx >= 0 && tz >= 0 && tx < world.size && tz < world.size ? world.kinds[tz * world.size + tx] : -1;
  const nearPlaza = x >= p.x0 - 6 && x < p.x1 + 6 && z >= p.z0 - 6 && z < p.z1 + 6;
  if ((kind === TILE.path || kind === TILE.plaza) && nearPlaza) {
    return { name: world.hub.plazaName, sub: "The heart of campus. Follow the roads out to study, play, sport, home and crafts", icon: "castle", colours: PURPOSE_STYLE.hall };
  }
  return {
    name: world.hub.wildsName,
    sub: world.hub.wildsName === "The Bushland" ? "Native bush around the campus: gathering spots, monster camps, secrets" : "Gathering spots, monster camps and secrets",
  };
}

function Emblem({ icon, colours }: { icon: PlaceIcon; colours: SignColours }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawEmblem(ctx, icon, colours, canvas.width / 2, canvas.height / 2, canvas.width / 2 - 2);
  }, [icon, colours]);
  return <canvas ref={ref} width={96} height={96} style={{ width: 48, height: 48, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))" }} aria-hidden="true" />;
}

export function AreaBanner({ world, subjects }: { world: World; subjects: RealmSubject[] }) {
  const [shown, setShown] = useState<(Area & { key: number }) | null>(null);
  useEffect(() => {
    let last = "";
    let hideTimer = 0;
    const tick = () => {
      // Not over the fly-over: its own captions name the places.
      if (cinematicProgress() !== null) return;
      const area = areaAt(world, subjects, runtime.player.x, runtime.player.z);
      if (area.name === last) return;
      last = area.name;
      setShown({ ...area, key: Date.now() });
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setShown(null), 3600);
    };
    const id = window.setInterval(tick, 400);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(hideTimer);
    };
  }, [world, subjects]);
  if (!shown) return null;
  return (
    <div key={shown.key} className="rs-area-banner" role="status">
      {shown.icon && shown.colours ? <Emblem icon={shown.icon} colours={shown.colours} /> : null}
      <strong>{shown.name}</strong>
      {shown.label && shown.colours ? (
        <small
          style={{
            padding: "2px 10px",
            borderRadius: 999,
            background: shown.colours.main,
            color: "#fffaf0",
            border: `1px solid ${shown.colours.accent}`,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
          }}
        >
          {shown.label}
        </small>
      ) : null}
      {shown.sub ? <span>{shown.sub}</span> : null}
    </div>
  );
}
