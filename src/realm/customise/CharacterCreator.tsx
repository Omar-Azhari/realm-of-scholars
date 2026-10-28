/**
 * Character creator: body type, mixed outfit parts, body sliders (height,
 * build, muscle) and colours, with a live 3D preview you can turn by
 * dragging. Used at enrolment and in the dorm wardrobe.
 */

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { HumanCharacter } from "../scene/HumanCharacter";
import type { HatId, OneShot } from "../scene/models";
import { HOUSES } from "./houses";
import { BASE_OUTFIT, defaultAppearance, HAIR_COLOURS, OUTFITS, PART_SLOTS, SKIN_TONES } from "./humans";
import type { Appearance, BodyType } from "../types";
import { emoteIcon, houseIcon, Icon } from "../hud/icons";

export const OUTFIT_COLOURS = ["#2b2b3a", "#5e2a84", "#1f4f8a", "#2e6b34", "#a3172b", "#b8860b", "#6b4a2e", "#7a7a88"];

function Spinner({ appearance, oneShot, angle, hat, capeColor }: { appearance: Appearance; oneShot: React.MutableRefObject<OneShot | null>; angle: React.MutableRefObject<number>; hat: HatId | null; capeColor: string | null }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += (angle.current - group.current.rotation.y) * Math.min(1, delta * 8);
  });
  return (
    <group ref={group} position={[0, -0.95, 0]}>
      <Suspense fallback={null}>
        <HumanCharacter appearance={appearance} oneShotRef={oneShot} height={1.75} hat={hat} capeColor={capeColor} />
      </Suspense>
      {/* A dark stone plinth with a thin gold ring. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.7, 48]} />
        <meshStandardMaterial color="#232a40" roughness={0.75} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[0.66, 0.7, 48]} />
        <meshStandardMaterial color="#d9b04a" metalness={0.7} roughness={0.35} emissive="#5a4210" />
      </mesh>
    </group>
  );
}

interface CharacterCreatorProps {
  value: Appearance;
  onChange: (a: Appearance) => void;
  /** Extra outfit colours unlocked with dyes (hex). */
  extraColours?: string[];
  hat?: HatId | null;
  capeColor?: string | null;
  /** The player's academy house, and how to change it (omit both to hide the picker). */
  house?: string | null;
  onHouse?: (id: string) => void;
}

export function CharacterCreator({ value, onChange, extraColours = [], hat = null, capeColor = null, house = null, onHouse }: CharacterCreatorProps) {
  const oneShot = useRef<OneShot | null>(null);
  const angle = useRef(0);
  const drag = useRef<number | null>(null);
  const set = (patch: Partial<Appearance>) => onChange({ ...value, ...patch });
  const setBody = (body: BodyType) => {
    if (body === value.body) return;
    const fresh = defaultAppearance(body);
    onChange({ ...value, body, parts: fresh.parts });
  };
  const slider = (label: string, key: "height" | "build" | "muscle", min: number, max: number, left: string, right: string) => (
    <label className="slider">
      <span>
        {label}{" "}
        <small className="muted">
          {left} to {right}
        </small>
      </span>
      <input type="range" min={min} max={max} step={0.05} value={value[key]} onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<Appearance>)} />
    </label>
  );
  const swatches = (colours: string[], current: string | null, pick: (c: string | null) => void, allowNone = false) => (
    <div className="swatches">
      {allowNone ? (
        <button type="button" className={`swatch-chip ${current === null ? "on" : ""}`} onClick={() => pick(null)} title="Original colours" aria-label="Original colours">
          <Icon name="close" />
        </button>
      ) : null}
      {colours.map((c) => (
        <button key={c} type="button" className={`swatch-chip ${current === c ? "on" : ""}`} style={{ background: c }} onClick={() => pick(c)} aria-label={`Colour ${c}`} />
      ))}
    </div>
  );

  const randomise = () => {
    const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
    const body: BodyType = Math.random() < 0.5 ? "female" : "male";
    const ids = OUTFITS[body].map((o) => o.id);
    onChange({
      body,
      parts: { head: pick(ids), body: pick(ids), legs: pick(ids), feet: pick(ids) },
      height: Math.round((Math.random() * 2 - 1) * 20) / 20,
      build: Math.round((Math.random() * 2 - 1) * 20) / 20,
      muscle: Math.round(Math.random() * 20) / 20,
      skin: pick(SKIN_TONES),
      hair: pick(HAIR_COLOURS),
      outfitColour: Math.random() < 0.5 ? null : pick(OUTFIT_COLOURS),
    });
  };

  return (
    <div className="creator">
      <div
        className="creator-preview"
        onPointerDown={(e) => {
          drag.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          angle.current += (e.clientX - drag.current) * 0.012;
          drag.current = e.clientX;
        }}
        onPointerUp={() => (drag.current = null)}
        title="Drag to turn"
      >
        <Canvas shadows camera={{ position: [0, 0.2, 3.1], fov: 36 }} dpr={[1, 2]}>
          {/* A studio stage: soft key light, warm fill, and a cool rim so the silhouette reads against the dark. */}
          <color attach="background" args={["#121729"]} />
          <hemisphereLight args={["#f2f4ff", "#2a2f45", 1.0]} />
          <directionalLight position={[2, 4, 3]} intensity={2.4} castShadow />
          <pointLight position={[-2.2, 1.4, 1.2]} intensity={4} color="#ffcf9a" distance={6} />
          <pointLight position={[0.6, 2.2, -2.2]} intensity={9} color="#8fb0ff" distance={7} />
          <Spinner appearance={value} oneShot={oneShot} angle={angle} hat={hat} capeColor={capeColor} />
        </Canvas>
        <div className="emote-row" onPointerDown={(e) => e.stopPropagation()}>
          {["Wave", "Cast", "Roll", "Point"].map((clip) => (
            <button key={clip} type="button" title={clip} aria-label={`Preview: ${clip}`} onClick={() => (oneShot.current = clip)}>
              <Icon name={emoteIcon(clip.toLowerCase())} />
            </button>
          ))}
        </div>
      </div>
      <div className="creator-controls">
        <div className="row">
          <span className="muted small">Body</span>
          {(["female", "male"] as const).map((b) => (
            <button key={b} type="button" className={`chip ${value.body === b ? "on" : ""}`} onClick={() => setBody(b)}>
              {b === "female" ? "Feminine" : "Masculine"}
            </button>
          ))}
          <span className="grow" />
          <button type="button" className="rs-button secondary small" onClick={randomise}>
            <Icon name="dice" /> Randomise
          </button>
        </div>
        {onHouse ? (
          <div className="field house-pick">
            <span>House</span>
            <div className="houses" role="radiogroup" aria-label="Academy house">
              {HOUSES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="radio"
                  aria-checked={house === h.id}
                  className={`house ${house === h.id ? "on" : ""}`}
                  style={{ borderColor: h.colours[0], background: house === h.id ? h.colours[0] : undefined }}
                  onClick={() => onHouse(h.id)}
                  title={`${h.trait}. “${h.motto}”`}
                >
                  <span className="crest">
                    <Icon name={houseIcon(h.id)} />
                  </span>
                  <b>{h.name}</b>
                  <small>{h.trait}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {slider("Height", "height", -1, 1, "short", "tall")}
        {slider("Build", "build", -1, 1, "slim", "heavy")}
        {slider("Muscle", "muscle", 0, 1, "soft", "muscular")}
        <div className="field">
          <span>Skin</span>
          {swatches(SKIN_TONES, value.skin, (c) => c && set({ skin: c }))}
        </div>
        <div className="field">
          <span>Hair</span>
          {swatches(HAIR_COLOURS, value.hair, (c) => c && set({ hair: c }))}
        </div>
        <table className="outfit-table">
          <tbody>
            {PART_SLOTS.map((slot) => (
              <tr key={slot.id}>
                <th>{slot.label}</th>
                <td>
                  <select value={value.parts[slot.id]} onChange={(e) => set({ parts: { ...value.parts, [slot.id]: e.target.value } })} aria-label={slot.label}>
                    {OUTFITS[value.body].map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                        {o.id === BASE_OUTFIT[value.body] ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="field">
          <span>Outfit colour</span>
          {swatches([...OUTFIT_COLOURS, ...extraColours.filter((c) => !OUTFIT_COLOURS.includes(c))], value.outfitColour, (c) => set({ outfitColour: c }), true)}
        </div>
      </div>
    </div>
  );
}
