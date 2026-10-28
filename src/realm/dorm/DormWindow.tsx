/**
 * Your dorm room: a 3D room to furnish. Pick something from storage (or buy
 * it), hover the floor to see where it goes, click to place. Click a placed
 * piece to turn it, move it or put it away. R turns, Esc cancels.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Window } from "../hud/Window";
import { useRealm } from "../state/store";
import { findShopItem } from "../state/shop";
import { ModelCharacter, WithFallback, type HatId } from "../scene/models";
import { v2AssetUrl } from "../../game3d/assets/assetUrl";
import { dyeTints } from "../customise/outfit";
import {
  availableCount,
  buyFurniture,
  comfort,
  comfortFocusBonus,
  footprint,
  furniture,
  FURNITURE,
  MAX_COMFORT,
  moveFurniture,
  moveIn,
  pickUp,
  placeBlocker,
  placeFurniture,
  ROOM_COLS,
  ROOM_ROWS,
  standHeight,
  turnFurniture,
  surfaceAt,
  type Furniture,
} from "./dorm";
import type { Dorm, PlacedFurniture } from "../types";
import { furnitureIcon, Icon } from "../hud/icons";

export const furnitureUrl = (id: string) => v2AssetUrl(`models/kaykit/furniture/${id}.glb`);
const HALF_W = ROOM_COLS / 2;
const HALF_D = ROOM_ROWS / 2;
const WALL_H = 3;

type Mode = { kind: "idle" } | { kind: "place"; id: string; rot: 0 | 1 | 2 | 3; uid?: string };

/** The footprint corner that puts the piece's middle under the cursor. */
function anchor(id: string, rot: number, cell: { c: number; r: number }): { c: number; r: number } {
  const item = furniture(id);
  if (!item) return cell;
  const { w, d } = footprint(item, rot);
  return { c: cell.c - Math.floor((w - 1) / 2), r: item.layer === "wall" ? 0 : cell.r - Math.floor((d - 1) / 2) };
}

/** World position of a footprint's centre. */
function centreOf(item: Furniture, c: number, r: number, rot: number): [number, number] {
  const { w, d } = footprint(item, rot);
  if (item.layer === "wall") return [c + w / 2 - HALF_W, -HALF_D + 0.02];
  return [c + w / 2 - HALF_W, r + d / 2 - HALF_D];
}

/** A furniture model. `ghost` tints it see-through green or red while it's being placed. */
export function FurnitureModel({ id, ghost }: { id: string; ghost?: string }) {
  const { scene } = useGLTF(furnitureUrl(id));
  const object = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = !ghost;
      mesh.receiveShadow = true;
      if (ghost) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone();
        m.transparent = true;
        m.opacity = 0.75;
        m.emissive = new THREE.Color(ghost);
        m.emissiveIntensity = 0.45;
        mesh.material = m;
      }
    });
    return copy;
  }, [scene, ghost]);
  return <primitive object={object} />;
}

function PlacedPiece({ dorm, p, selected, onSelect }: { dorm: Dorm; p: PlacedFurniture; selected: boolean; onSelect: (uid: string) => void }) {
  const item = furniture(p.id);
  if (!item) return null;
  const [x, z] = centreOf(item, p.c, p.r, p.rot);
  const y = standHeight(dorm, p);
  const { w, d } = footprint(item, p.rot);
  return (
    <group
      position={[x, y, z]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(p.uid);
      }}
    >
      <group rotation={[0, item.layer === "wall" ? 0 : -p.rot * (Math.PI / 2), 0]}>
        <Suspense fallback={null}>
          <FurnitureModel id={p.id} />
        </Suspense>
      </group>
      {item.light ? <pointLight position={[0, item.layer === "top" ? 0.8 : 2.2, 0]} color="#ffcf8a" intensity={4} distance={5} decay={1.6} /> : null}
      {selected ? (
        <mesh position={[0, item.layer === "wall" ? -0.9 : 0.03, item.layer === "wall" ? 0.3 : 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.1, (item.layer === "wall" ? 0.6 : d) + 0.1]} />
          <meshBasicMaterial color="#ffd45a" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function Ghost({ dorm, mode, cell: hovered }: { dorm: Dorm; mode: Extract<Mode, { kind: "place" }>; cell: { c: number; r: number } }) {
  const item = furniture(mode.id)!;
  const cell = anchor(mode.id, mode.rot, hovered);
  const blocker = placeBlocker(dorm, mode.id, cell.c, cell.r, mode.rot, mode.uid);
  const [x, z] = centreOf(item, cell.c, cell.r, mode.rot);
  const { w, d } = footprint(item, mode.rot);
  const y = item.layer === "wall" ? item.mount ?? 1.6 : item.layer === "top" ? surfaceAt(dorm, cell.c, cell.r) : 0;
  const colour = blocker ? "#ff5a4a" : "#6fe38a";
  return (
    <group position={[x, y, z]}>
      <group rotation={[0, item.layer === "wall" ? 0 : -mode.rot * (Math.PI / 2), 0]}>
        <Suspense fallback={null}>
          <FurnitureModel id={mode.id} ghost={colour} />
        </Suspense>
      </group>
      {item.layer === "wall" ? (
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[w, 1.2]} />
          <meshBasicMaterial color={colour} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      ) : (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color={colour} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function plankTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    const shade = 120 + ((i * 37) % 30);
    g.fillStyle = `rgb(${shade + 40}, ${shade}, ${shade - 50})`;
    g.fillRect(0, i * 32, 256, 32);
    g.fillStyle = "rgba(60,35,15,0.6)";
    g.fillRect(0, i * 32 + 30, 256, 2);
    g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ROOM_COLS / 4, ROOM_ROWS / 4);
  return t;
}

function Room({ onFloor, onWall, onFloorClick, onLeave }: { onFloor: (c: number, r: number) => void; onWall: (c: number) => void; onFloorClick: () => void; onLeave: () => void }) {
  const planks = useMemo(plankTexture, []);
  const cellFrom = (e: ThreeEvent<PointerEvent | MouseEvent>) => ({ c: Math.floor(e.point.x + HALF_W), r: Math.floor(e.point.z + HALF_D) });
  return (
    <group>
      {/* Floor. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerMove={(e) => {
          const { c, r } = cellFrom(e);
          onFloor(c, r);
        }}
        onPointerOut={onLeave}
        onClick={(e) => {
          e.stopPropagation();
          onFloorClick();
        }}
      >
        <planeGeometry args={[ROOM_COLS, ROOM_ROWS]} />
        <meshStandardMaterial map={planks} roughness={0.85} />
      </mesh>
      {/* Back wall (wall items hang here). */}
      <mesh
        position={[0, WALL_H / 2, -HALF_D]}
        receiveShadow
        onPointerMove={(e) => onWall(Math.floor(e.point.x + HALF_W))}
        onPointerOut={onLeave}
        onClick={(e) => {
          e.stopPropagation();
          onFloorClick();
        }}
      >
        <planeGeometry args={[ROOM_COLS, WALL_H]} />
        <meshStandardMaterial color="#e9dcc4" roughness={0.95} />
      </mesh>
      {/* Left wall with a window. */}
      <mesh position={[-HALF_W, WALL_H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_ROWS, WALL_H]} />
        <meshStandardMaterial color="#dccdb2" roughness={0.95} />
      </mesh>
      <mesh position={[-HALF_W + 0.02, 1.7, -0.4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.6, 1.1]} />
        <meshBasicMaterial color="#bfe3ff" toneMapped={false} />
      </mesh>
      <mesh position={[-HALF_W + 0.04, 1.7, -0.4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.75, 0.08]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      <mesh position={[-HALF_W + 0.04, 1.7, -0.4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.08, 1.25]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      {/* Skirting boards. */}
      <mesh position={[0, 0.08, -HALF_D + 0.03]}>
        <boxGeometry args={[ROOM_COLS, 0.16, 0.06]} />
        <meshStandardMaterial color="#7a5434" />
      </mesh>
      <mesh position={[-HALF_W + 0.03, 0.08, 0]}>
        <boxGeometry args={[0.06, 0.16, ROOM_ROWS]} />
        <meshStandardMaterial color="#7a5434" />
      </mesh>
      {/* Daylight through the window. */}
      <directionalLight position={[-6, 6, -1]} intensity={1.6} color="#fff1d6" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}>
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.5, 20]} />
      </directionalLight>
    </group>
  );
}

function Resident() {
  const avatar = useRealm((s) => s.player?.avatar ?? "knight");
  const outfit = useRealm((s) => s.progress.wardrobe.outfit);
  const dyeIds = useRealm((s) => s.progress.wardrobe.dyes);
  const capeColor = useRealm((s) => findShopItem(s, s.progress.wardrobe.cape)?.look ?? null);
  const hat = useRealm((s) => (findShopItem(s, s.progress.wardrobe.hat)?.look as HatId | undefined) ?? null);
  const dyes = useMemo(() => dyeTints(dyeIds), [dyeIds]);
  // Standing in the doorway (the cell kept clear), facing into the room.
  return (
    <group position={[ROOM_COLS - 0.5 - HALF_W, 0, ROOM_ROWS - 0.5 - HALF_D]} rotation={[0, Math.PI + Math.PI / 5, 0]}>
      <WithFallback fallback={null}>
        <ModelCharacter avatar={avatar} height={1.7} outfit={outfit} dyes={dyes} capeColor={capeColor} hat={hat} />
      </WithFallback>
    </group>
  );
}

export function DormWindow({ onClose, onWardrobe }: { onClose: () => void; onWardrobe: () => void }) {
  const dorm = useRealm((s) => s.progress.dorm);
  const coins = useRealm((s) => s.progress.coins);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [hover, setHover] = useState<{ c: number; r: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"storage" | "shop">("storage");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    moveIn();
  }, []);

  // R turns the piece being placed; Esc cancels placing before it closes the window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode.kind !== "place") return;
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setMode({ kind: "idle" });
      } else if (e.key.toLowerCase() === "r") {
        setMode({ ...mode, rot: ((mode.rot + 1) % 4) as 0 | 1 | 2 | 3 });
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [mode]);

  const startPlacing = (id: string) => {
    setSelected(null);
    setNote(null);
    setMode({ kind: "place", id, rot: 0 });
  };

  const commit = () => {
    if (mode.kind !== "place" || !hover) {
      setSelected(null);
      return;
    }
    const at = anchor(mode.id, mode.rot, hover);
    const blocker = placeBlocker(dorm, mode.id, at.c, at.r, mode.rot, mode.uid);
    if (blocker) {
      setNote(blocker);
      return;
    }
    if (mode.uid) moveFurniture(mode.uid, at.c, at.r, mode.rot);
    else placeFurniture(mode.id, at.c, at.r, mode.rot);
    setNote(null);
    // Keep placing copies while there are more in storage.
    if (!mode.uid && availableCount({ ...dorm, placed: [...dorm.placed, { uid: "x", id: mode.id, c: 0, r: 0, rot: 0 }] }, mode.id) > 0) return;
    setMode({ kind: "idle" });
  };

  const selectedPiece = dorm.placed.find((p) => p.uid === selected);
  const selectedItem = selectedPiece ? furniture(selectedPiece.id) : undefined;
  const score = comfort(dorm);
  const stored = FURNITURE.filter((f) => availableCount(dorm, f.id) > 0);

  return (
    <Window title="Your dorm room" onClose={onClose} width={980} className="dorm-window">
      <div className="dorm">
        <div className={`dorm-view ${mode.kind === "place" ? "placing" : ""}`}>
          <Canvas shadows camera={{ position: [-2.2, 8.4, 8.6], fov: 40 }} dpr={[1, 2]} onCreated={({ camera }) => camera.lookAt(0.3, 0.3, 0.4)}>
            <color attach="background" args={["#1d140e"]} />
            <hemisphereLight args={["#fff2dc", "#4a3424", 0.9]} />
            <ambientLight intensity={0.25} />
            <Room
              onFloor={(c, r) => mode.kind === "place" && furniture(mode.id)?.layer !== "wall" && setHover((h) => (h && h.c === c && h.r === r ? h : { c, r }))}
              onWall={(c) => mode.kind === "place" && furniture(mode.id)?.layer === "wall" && setHover((h) => (h && h.c === c ? h : { c, r: 0 }))}
              onFloorClick={commit}
              onLeave={() => setHover(null)}
            />
            {dorm.placed
              .filter((p) => p.uid !== (mode.kind === "place" ? mode.uid : undefined))
              .map((p) => (
                <PlacedPiece
                  key={p.uid}
                  dorm={dorm}
                  p={p}
                  selected={p.uid === selected}
                  onSelect={(uid) => {
                    if (mode.kind === "place") commit();
                    else setSelected(uid === selected ? null : uid);
                  }}
                />
              ))}
            {mode.kind === "place" && hover ? <Ghost dorm={dorm} mode={mode} cell={hover} /> : null}
            <Resident />
          </Canvas>
          {mode.kind === "place" ? (
            <div className="dorm-hint">
              Placing: <b>{furniture(mode.id)?.name}</b> · click to place · <kbd>R</kbd> turn · <kbd>Esc</kbd> cancel
              {note ? <span className="bad"> · {note}</span> : null}
            </div>
          ) : selectedPiece && selectedItem ? (
            <div className="dorm-hint">
              <b>{selectedItem.name}</b>
              {selectedItem.layer !== "wall" && selectedItem.layer !== "top" ? (
                <button type="button" className="rs-button small" onClick={() => (turnFurniture(selectedPiece.uid) ? setNote(null) : setNote("No room to turn it there."))}>
                  ⟳ Turn
                </button>
              ) : null}
              <button type="button" className="rs-button small" onClick={() => setMode({ kind: "place", id: selectedPiece.id, rot: selectedPiece.rot, uid: selectedPiece.uid })}>
                <Icon name="arrowRight" /> Move
              </button>
              <button
                type="button"
                className="rs-button secondary small"
                onClick={() => {
                  pickUp(selectedPiece.uid);
                  setSelected(null);
                }}
              >
                Store
              </button>
              {note ? <span className="bad"> {note}</span> : null}
            </div>
          ) : (
            <div className="dorm-hint muted">Click a piece to turn, move or store it. Pick something from storage to place it.</div>
          )}
        </div>
        <aside className="dorm-side">
          <div className="comfort">
            <div className="label">
              Comfort <b>{score}</b>/{MAX_COMFORT}
            </div>
            <div className="bar">
              <span style={{ width: `${(score / MAX_COMFORT) * 100}%` }} />
            </div>
            <p className="small">
              Daily challenge bonus: <b>+{comfortFocusBonus(dorm)} Focus</b>
            </p>
          </div>
          <button type="button" className="rs-button" onClick={onWardrobe}>
            <Icon name="palette" /> Wardrobe &amp; dyes
          </button>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "storage"} className={tab === "storage" ? "on" : ""} onClick={() => setTab("storage")}>
              Storage ({stored.length})
            </button>
            <button type="button" role="tab" aria-selected={tab === "shop"} className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")}>
              Furniture shop
            </button>
          </div>
          {tab === "storage" ? (
            stored.length === 0 ? (
              <p className="muted small">Everything you own is in the room. Buy more in the furniture shop.</p>
            ) : (
              <ul className="dorm-list">
                {stored.map((f) => (
                  <li key={f.id}>
                    <span className="ico">
                      <Icon name={furnitureIcon(f.id)} />
                    </span>
                    <span className="text">
                      <b>{f.name}</b>
                      <small>
                        ×{availableCount(dorm, f.id)} · +{f.comfort} comfort
                      </small>
                    </span>
                    <button type="button" className="rs-button small" onClick={() => startPlacing(f.id)}>
                      Place
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              <p className="muted small">You have {coins} coins.</p>
              <ul className="dorm-list">
                {FURNITURE.map((f) => (
                  <li key={f.id}>
                    <span className="ico">
                      <Icon name={furnitureIcon(f.id)} />
                    </span>
                    <span className="text">
                      <b>{f.name}</b>
                      <small>
                        +{f.comfort} comfort · {f.layer === "top" ? "goes on a table" : f.layer === "wall" ? "hangs on the wall" : f.layer === "rug" ? "rug" : `${f.w}×${f.d}`}
                        {dorm.owned[f.id] ? ` · own ${dorm.owned[f.id]}` : ""}
                      </small>
                    </span>
                    <button type="button" className="rs-button small" disabled={coins < f.price} onClick={() => buyFurniture(f.id) && startPlacing(f.id)}>
                      {f.price}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </Window>
  );
}
