# V2 Phase 2 — Complete Visual Asset Audit

Gate document, per the brief's own rule #1 ("complete the audit before
implementation"). Every visual element currently reachable through
`settings.worldRenderer === "prestige-v2"` is inventoried below. Nothing
in `experimental-3d`/`legacy-2d` is in scope — those renderers are
untouched by V2 work and keep their own, already-documented asset
conventions (`public/assets/manifest.json` + `src/engine/manifestTypes.ts`
for the 2D world; see that system's own README for its parallel, already-
working "manifest is the source of truth" precedent, which this audit's
recommendations deliberately mirror).

**Method**: every component in `src/game3d/prestige/architecture/
ArchitectureKit.tsx`, `src/game3d/prestige/prestigeNpcs.ts`, and all 5
scene files was read in full. Polygon counts below are **computed
estimates from each mesh's actual Three.js geometry constructor
arguments** (radial/height segment counts, etc.) — not measured via a
profiler (none was available in this pass) — and are labelled as
estimates throughout. Confirmed via direct filesystem check: **zero**
`.glb`/`.gltf`/`.png`/`.jpg`/`.webp`/`.ktx2` files exist anywhere under
`public/` for the 3D renderers, and `public/assets/audio/` does not exist
at all. Everything the Prestige renderer draws is code-generated geometry
or a `meshStandardMaterial` flat/emissive colour.

## Summary totals

| Classification | Count (distinct component/asset types) |
|---|---|
| Production-ready | **0** |
| Acceptable temporary asset | **0** |
| Procedural prototype | **26** (every ArchitectureKit/scene-local mesh component) |
| Placeholder | **0** (nothing stands in for a not-yet-built final asset with a *marked* placeholder — see Known Gaps below) |
| Missing | **7** (audio files, all textures, all normal/roughness maps, LODs, authored collision, real character models, UI icon/texture assets) |
| Must be replaced | **26** (same set as "procedural prototype" — everything visual is a replacement candidate for the full Master Design vision) |
| Collision-only | **0** (no dedicated collision geometry exists yet — see §Collision below; obstacles are AABB rects in `SceneWorld`, not meshes) |
| Fallback-only | **0** (nothing has both a real asset AND a fallback yet — there is no real asset to fall back FROM) |

## 1. Architecture meshes

| Item | Component / file | Format | Est. triangles | Texture | Licence | Renderer usage | Visual quality | Perf risk | Replace priority | Intended final source | LOD needed | Collision needed | Animation needed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Stone column | `StoneColumn` (ArchitectureKit.tsx:39) | Code (3× `cylinderGeometry`, 8/12/12 radial segs) | ~120 (28+44+44) | None — flat `meshStandardMaterial` | N/A (code, self-authored) | Main Gate towers, Grand Courtyard colonnade, Great Hall nave, ComingSoonGate | Procedural prototype — reads as "a column" at a distance, no fluting/carving detail | Low (cheap primitive, used ~14× across all scenes) | High | Blender-modelled column, 1 LOD chain | Yes (used at range in Great Hall nave) | Yes (currently NONE — see §Collision) | No |
| Pointed arch | `PointedArch` (ArchitectureKit.tsx:63) | Code (5× `boxGeometry`) | ~60 (12×5) | None | N/A | Main Gate gate arch | Reads as an arch silhouette; flat slab construction, no true curved voussoirs | Low | High | Blender-modelled Gothic arch w/ real curvature | No (single hero instance) | Yes (currently none) | No |
| Vaulted ceiling bay | `VaultedCeilingBay` (ArchitectureKit.tsx:97) | Code (3× `boxGeometry`) | ~36 | None | N/A | Great Hall (×6, repeated along nave) | Reads as a ribbed vault from below at the current camera distance; flat panels, no true rib profile | Low | Medium (6 instances, still cheap) | Blender-modelled vault segment, tileable | No | No (ceiling, above player headroom) | No |
| Stained-glass window | `StainedGlassWindow` (ArchitectureKit.tsx:126) | Code (1 box + up to 6 emissive planes + mullion bars) | ~90 (12 + 6×2 + mullions×12) | None (flat emissive colour per cell, no real glass texture/refraction) | N/A | Great Hall (×12), Hall of Artisans (×6), Dormitory preview (×1) | The single most convincing procedural element (emissive jewel tones read well) but flat, no glass material/refraction | Low | Medium | Blender-modelled frame + real stained-glass texture/shader | No | No (wall-mounted, above obstacle height) | No |
| Great Hall / Main Gate / Grand Courtyard / Hall of Artisans / Dorm Preview floor slabs | `PrestigeSceneShell.tsx` (inline `<mesh><planeGeometry/>`) | Code (1 plane per scene) | 2 each (10 total) | None — flat colour per district | N/A | All 5 scenes | Functional but completely flat; no ground texture/normal detail at all | Low | Low | Tileable stone/wood floor material + normal map | No | N/A (floor collision is the `walkable` band, not a mesh) | No |
| Walls | **None exist as dedicated wall meshes.** Each scene's "walls" are actually the gatehouse towers (`GateTower`, MainGateScene.tsx), or simply absent (Grand Courtyard is open-air by design, per the Master Design; Great Hall/Hall of Artisans have NO side-wall mesh at all today — only columns + windows implying a wall plane that isn't actually drawn) | — | 0 | — | — | — | **Gap, not just low quality** — see Known Gaps §5 | — | Highest (nothing to look at between columns) | Blender-modelled modular wall run | Yes | Yes | No |
| Doors (real, walkable) | `GrandDoor` (ArchitectureKit.tsx:431) | Code (2 leaves × (1 box + 2 boxes)) | ~36 | None | N/A | Grand Courtyard (×4, decorative — see Phase 1's own note that these are visual-only, the real interaction hitbox is a separate invisible mesh) | Reads as a door silhouette; flat panels, no hinge/handle detail | Low | Medium | Blender-modelled door w/ hinge pivot per the upcoming Blender contract | No | No (decorative; real collision is the invisible interactable hitbox) | Yes (opening animation is currently absent — doors are static) |
| Doors (locked "Coming Soon") | `ComingSoonGate` (ArchitectureKit.tsx:384) | Code (2 columns + several boxes/torus) | ~180 | None | N/A | Grand Courtyard (×3), Great Hall (×2) | Reads clearly as "locked gate," the strongest non-window prop visually | Low | Medium | Blender-modelled portcullis/gate | No | No | No |
| Roofs / towers | Gatehouse towers (`GateTower`, MainGateScene.tsx, scene-local) | Code (2× box + crenellation boxes) | ~60 | None | N/A | Main Gate only | Reads as a simple tower block; crenellations are literal boxes, no real merlon profile | Low | Low (2 instances) | Blender-modelled tower + roof | No | Yes (currently a plain AABB obstacle rect, not a mesh) | No |
| Stairs | **None exist anywhere in the Prestige renderer.** No scene currently has a change in floor level. | — | — | — | — | — | Missing entirely | — | Medium (no scene needs one yet, but the Master Design's towers will) | Blender-modelled modular stair run | Yes | Yes | No |
| Bridges | **None exist.** (The Master Design's "The Bridge" district is not built in Phase 1/2.) | — | — | — | — | — | Missing entirely | — | Low (out of scope until that district is built) | Blender-modelled bridge span | Yes | Yes | No |

## 2. Fixtures, furniture, and props

| Item | Component | Format | Est. triangles | Texture | Licence | Usage | Quality | Perf risk | Priority | Final source | LOD | Collision | Animation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fireplace | `Fireplace` (ArchitectureKit.tsx:164) | Code (4 boxes + 3 cylinders + 1 emissive plane) | ~140 | None | N/A | Great Hall (×2), Dorm Preview (×1) | The flicker light sells it; the mesh itself is a simple box hearth, no real masonry detail | Low (flicker is 1 `useFrame` per instance, cheap) | High (a hero prop, very visible) | Blender-modelled fireplace + real fire VFX (particles, not a flat plane) | No | Yes (currently none — a fireplace is walkably "through" today, a real gap) | No |
| Long refectory table | `LongTable` (ArchitectureKit.tsx:341) | Code (1 `RoundedBox` top + 4 `RoundedBox` bench tops + several boxes) | ~250–400 (RoundedBox tri count varies with drei's default smoothness, not explicitly set here — see §Materials/Known Gaps) | None | N/A | Great Hall (×2, at `lengthM=26`, an extreme stretch of the base 5.5m design) | Functional at a glance; up close the stretched proportions and lack of grain texture are obvious | Low–Medium (RoundedBox is pricier than a plain box; 2 instances at this size is still cheap) | High | Blender-modelled table, tileable/segmented for long runs rather than one stretched mesh | Yes (currently drawn at full detail regardless of distance) | Yes (currently none) | No |
| Bench | Built into `LongTable` (not a separate component) | — | (included above) | — | — | Great Hall | Same as table | — | High | Should become its own reusable `PROP_bench` per the modular kit (Part 5) | No | Yes (none today) | No |
| Bookshelf | `Bookshelf` (`src/game3d/rooms/furniturePieces.tsx`, REUSED from the legacy 3D room-customisation system, not new to Prestige) | Code (`RoundedBox` + boxes + a `PotPlant`) | ~180–250 | None | N/A | Hall of Artisans (×2), Dorm Preview (×1) | Already-established, reasonably detailed prop for a code-built piece (book spines are individually coloured) | Low | Medium | Blender-modelled bookshelf w/ real book textures | No | Yes (none today) | No |
| Pot plant | `PotPlant` (`furniturePieces.tsx`, reused) | Code (cylinder + 2 spheres) | ~50 | None | N/A | Hall of Artisans (×2), Dorm Preview (×2) | Adequate silhouette, no leaf detail | Low | Low | Blender-modelled plant, alpha-carded foliage | No | No (decorative, small) | No |
| Rug | `Rug` (`furniturePieces.tsx`, reused) | Code (2 planes) | 4 | None | N/A | Dorm Preview (×1) | Flat colour, no weave/pattern | Low | Low | Tileable rug texture on a plane | No | No | No |
| Candle cluster | `CandleCluster` (ArchitectureKit.tsx:307) | Code (1 cylinder base + N×(cylinder+cone)) | ~90 (3 candles) | None | N/A | Great Hall (×6, 3 per table), Dorm Preview (×1, on the desk) | The flicker light is convincing; the wax/wick geometry is minimal | Low | Medium (6+ instances, still cheap primitives) | Blender-modelled candles + real wax drip texture | No | No | No |
| Torch sconce | `TorchSconce` (ArchitectureKit.tsx:283) | Code (1 box + 1 cone) | ~22 | None | N/A | Main Gate (×2), ComingSoonGate (×2 per gate ×5 gates = 10) | Functional, reads as "a torch" mainly via its light | Low | Low | Blender-modelled iron sconce | No | No | No |
| Statue | `StatueFigure` (ArchitectureKit.tsx:228) | Code (cylinder + cone + sphere + box) | ~330 (44+18+220+12 — the sphere "head" dominates the count) | None | N/A | Grand Courtyard (×4), Great Hall (×2) | The most obviously "placeholder-looking" prop in the whole kit — an abstract cone-and-sphere figure, deliberately NOT attempting a human form (disclosed honestly in the component's own doc comment) | Low | High (visually the weakest link — a real statue needs a real sculpted mesh, this cannot be improved procedurally) | **Highest** | Commissioned/Blender-sculpted statue mesh | Yes | Yes (none today) | No |
| Fountain | `Fountain` (ArchitectureKit.tsx:253) | Code (2 cylinders + 1 circle + 1 sphere) | ~200 | None (water is a flat emissive-pulsing circle, no ripple shader) | N/A | Grand Courtyard (×1, centrepiece) | The centrepiece prop; the pulsing emissive water is a reasonable cheap stand-in but has no real ripple/reflection | Low | High (a hero prop) | Blender-modelled basin + a real water shader/shader-graph material | No (single hero instance) | Yes (currently an AABB obstacle rect, not shaped like the fountain) | No |
| Banner | `Banner` (ArchitectureKit.tsx:206) | Code (1 cylinder rod + 1 plane) | ~20 | None (flat colour, no cloth texture/emblem) | N/A | Main Gate (×2), Grand Courtyard (×3), Great Hall (×4), Hall of Artisans (×2) | The idle sway sells motion; the cloth itself is a flat plane, no emblem/heraldry | Low | Low | Blender or texture-based banner with a real cloth/emblem texture | No | No | No |
| Design board | `DesignBoard` (HallOfArtisansScene.tsx, scene-local) | Code (1 box + 1 plane + 6 planes) | ~30 | None | N/A | Hall of Artisans (×1) | Reads as a corkboard with pinned swatches; no real sketch imagery | Low | Low | Real reference-sketch textures pinned to a board mesh | No | No | No |
| Maquette | `Maquette` (HallOfArtisansScene.tsx, scene-local) | Code (cylinder + cone) | ~24 | None | N/A | Hall of Artisans (×1) | Explicitly a placeholder abstract shape standing in for "a small sculptural model" | Low | Low | Blender-modelled maquette | No | No | No |
| Easel | `Easel` (ArchitectureKit.tsx:452) | Code (3 cylinders + 1 box + 1 plane) | ~50 | None | N/A | Hall of Artisans (×2) | Adequate silhouette | Low | Low | Blender-modelled easel | No | No | No |
| Drafting table | `DraftingTable` (ArchitectureKit.tsx:480) | Code (1 `RoundedBox` + 4 boxes + 2 planes) | ~150–250 | None | N/A | Hall of Artisans (×3) | Adequate; angled tabletop is a nice touch, no material variation | Low | Low | Blender-modelled drafting table | No | No | No |
| Dormitory bed | `DormBed` (DormPreviewScene.tsx, scene-local) | Code (4 `RoundedBox`) | ~400–800 (4× RoundedBox, default smoothness — see Known Gaps) | None | N/A | Dorm Preview (×1) | Reasonable silhouette for a preview room | Low–Medium | Low (single instance, preview-only scene) | Blender-modelled bed | No | Yes (none today, but Dorm Preview's whole floor is open — low real risk) | No |
| Dormitory desk | `DormDesk` (DormPreviewScene.tsx, scene-local) | Code (1 `RoundedBox` + 4 boxes + 1 plane) | ~150–250 | None | N/A | Dorm Preview (×1) | Adequate | Low | Low | Blender-modelled desk | No | No | No |
| Study desk (Hall of Artisans) | Inline `<mesh><boxGeometry>` (HallOfArtisansScene.tsx) | Code (1 box) | 12 | None | N/A | Hall of Artisans (×1) | The single flattest, most obviously prototype-grade prop in the whole renderer — a bare untextured box | Low | Low | Should be replaced by a real `PROP_desk` from the modular kit | No | Yes (none today) | No |

## 3. Characters, clothing, and animation

| Item | Component / file | Format | Est. triangles | Texture | Licence | Usage | Quality | Perf risk | Priority | Final source | LOD | Collision | Animation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Player model | `ModularCharacter` → `PlaceholderCharacter` (`src/game3d/characters/`, REUSED verbatim from `experimental-3d`, not new to Prestige) | Code (sphere head, RoundedBox torso, boxes/cylinders for limbs, layered clothing meshes from `appearanceCatalogue.ts`) | ~400–700 depending on equipped clothing/hair options | None (flat-coloured per catalogue option) | N/A (self-authored) | All 5 scenes | Already-established "stylised procedural silhouette" from Phase 20B — explicitly NOT modelled architecture, a shared decision this audit doesn't relitigate | Low (1 instance) | Highest (the player IS the camera's subject every frame) | Rigged, Blender-modelled humanoid w/ real skeleton — see Part 15's readiness doc, not implemented this phase | No | N/A (player uses `useWorldMovement`'s AABB collision, not mesh collision) | Yes — procedural pose system (`characterRig.ts`) already exists, real skinned animation clips are future work |
| NPC models (all 12 NPCs across 5 scenes: 1 guard, 3 courtyard scholars, 4 hall diners, Iris + 2 apprentices) | Same `ModularCharacter`, driven by `NpcCharacter` + `npcSchedule.ts` | Code (same as player) | ~400–700 each | None | N/A | 12 total instances | Same procedural-silhouette quality as the player; wardrobe approximates "scholar robes" from EXISTING catalogue options (tunics/cardigans), disclosed in `prestigeNpcs.ts`'s own header comment as a stopgap, not a real medieval wardrobe | Low individually; **12 simultaneous skinned-equivalent characters is the single largest aggregate triangle/draw-call cost in the whole renderer** (~5,000–8,400 triangles just for NPCs across a scene, before any architecture) | Highest (visual quality gap is obvious up close — modern casual/smart-casual clothing shapes on "medieval scholars") | Real medieval-fantasy wardrobe catalogue (new content, not yet started) + eventually real character meshes | Yes (12 simultaneous full-detail humanoids is exactly the LOD foundation's first real use case) | N/A (NPCs don't collide with the player physically) | Same as player — pose system exists, real clips don't |
| Clothing | `appearanceCatalogue.ts` options (REUSED, not new) | Code (flat-coloured geometry per clothing "shape") | (included in character counts above) | None | N/A | All characters | No medieval wardrobe options exist — see Known Gaps §2 | Low | Highest | New wardrobe catalogue | N/A | N/A | N/A |
| Animation clips | `characterRig.ts`'s `computePose`/`createPoseBlender` (REUSED) | Procedural math (sine/cosine per joint), NOT skeletal/clip-based | N/A | N/A | N/A | All characters, all poses (idle/walk/talk/read/write/think/coffee/stretch/lookAround/wave/sit) | A genuinely well-built procedural system for what it is, but it is NOT the "rigged GLB + animation clips" the Master Design's animation philosophy (§8) describes | Low (cheap trig per frame) | Highest (the single biggest gap between "what exists" and "what the Master Design describes") | Real skinned animation clips per Part 15's readiness contract | N/A | N/A | This IS the current animation system — see Part 15 for the readiness gap, not a replacement, this phase |

## 4. Environment, lighting, materials, textures, audio, UI

| Item | Current state | Format | Licence | Usage | Quality | Perf risk | Priority | Final source |
|---|---|---|---|---|---|---|---|---|
| Sky | **None.** No skybox/sky shader exists; the void beyond the fog is whatever `PrestigeCamera.tsx`'s `THREE.Fog` colour is (`#c9b98a`), read as a flat haze, not a sky | — | N/A | All outdoor scenes (Main Gate, Grand Courtyard) | Missing entirely | Low cost (nothing to render) but a visible gap the moment a player looks up | High | A real sky (gradient shader, HDRI, or a skybox mesh) |
| Lighting helpers | `ambientLight`/`hemisphereLight`/`directionalLight` per scene (`PrestigeSceneShell.tsx`), `pointLight` per fireplace/torch/candle | Code (Three.js built-in lights, no baked lightmaps/GI) | N/A | All scenes | Reasonable for real-time-only lighting; no bounce/GI, no baked shadows beyond the one directional shadow map per scene | Medium (each scene has 1 shadow-casting directional light + several small point lights — within the existing quality-tier budget, not measured against a NEW budget until Part 19) | Medium | Real-time only is an acceptable long-term choice; baked lightmaps are explicitly out of scope unless a future phase decides otherwise |
| Materials | `meshStandardMaterial` per mesh, flat hex colours from named constants (`STONE`, `OAK`, `IRON`, `BRASS`, etc. in ArchitectureKit.tsx) | Code, `roughness`/`metalness` set per-mesh but **no texture maps of any kind** (no albedo, normal, roughness, or AO textures anywhere) | N/A (self-authored colour values) | Every mesh in the renderer | This is the single largest, most consequential gap the whole phase exists to close — see Part 6 | Low perf cost today (flat colours are cheap) but a hard visual ceiling | **Highest** | Real PBR texture sets per material, see Part 6/7 |
| Textures | **None exist.** | — | — | — | Missing entirely | N/A | Highest | Real texture sourcing per Part 17/18 |
| Particle effects | **None exist** in the Prestige renderer (the legacy `experimental-3d`/`legacy-2d` renderers have their own separate ambience-particle systems, untouched and out of scope here) | — | N/A | — | Missing (fire/dust/candle-smoke would all read as "temporary lighting only" without particles) | — | Medium | A lightweight particle system for fire/dust/candle smoke |
| Audio assets | `src/lib/sound.ts`'s `SoundEvent` union includes the 6 new Phase 1 ambience events (`main-gate-wind`, `courtyard-fountain`, `great-hall-ambience`, `artisans-workshop-ambience`, `fireplace-crackle`, `bell-toll`) — **but zero actual audio files exist** (`public/assets/audio/` doesn't exist at all); every one of these events is a real, wired, silent no-op today (confirmed — `emitSound` fails silently on a missing file, by design, per the existing contract) | mp3 (expected, none present) | N/A | All 5 scenes | Missing entirely (functionally silent) | None (no file = no decode cost) | High (the brief explicitly says "no silent environments" — the CODE satisfies that intent but the actual EXPERIENCE today is silent) | Licensed/CC0 ambience loops per event |
| UI textures/icons | **None** — the Prestige-specific UI (`src/styles/prestige.css`, `MentorNotification`/`MentorCheckInPrompt`/`MentorConversationPanel`) uses `lucide-react` vector icon components and CSS-only styling (gradients, borders), no raster icon/frame images | SVG (via `lucide-react`, a code dependency, not an asset file) | MIT (lucide-react's own licence, already an existing project dependency, not newly introduced) | All Prestige UI overlays | Functional, consistent with the rest of the app's existing icon usage (lucide-react is used everywhere already, not Prestige-specific) | None | Low (this is arguably ALREADY acceptable — see Known Gaps §6) | A "journal/manuscript frame" texture set per the Master Design's diegetic-UI philosophy (§14), if that visual direction is pursued for Prestige specifically |

## 5. Known gaps this audit surfaces (beyond simple "replace the geometry")

1. **Walls are largely absent, not just low-quality.** The Great Hall and
   Hall of Artisans have columns and windows implying an enclosing wall,
   but no wall mesh is actually drawn between them — the "wall" is
   currently just empty space (fog eventually occludes the view). This is
   a genuine content gap the modular kit (Part 5) must close, not a
   texture-quality problem.
2. **No medieval wardrobe exists.** Every NPC (and the player) wears
   clothing shapes from the pre-existing casual/smart-casual/formal
   catalogue (`appearanceCatalogue.ts`) — "scholar robes" are an honest
   best-effort composition of existing options (long tunics + cardigans),
   disclosed as a stopgap in Phase 1's own completion doc, not fixed here.
3. **Nothing has real collision geometry.** Every obstacle in the game is
   an axis-aligned rectangle in `SceneWorld.obstacles` (scene-unit space,
   2D, used by `useWorldMovement`'s collision-sliding) — there is no 3D
   collision mesh anywhere, authored or generated. Statues, the fountain,
   fireplaces, and tables mostly have NO matching obstacle rect at all
   today (a player can walk through a fireplace) — this is a real,
   previously-undiscovered gap this audit surfaces, not something Phase 1
   claimed to solve.
4. **RoundedBox triangle counts are undisclosed/default.** Every
   `RoundedBox` call in `ArchitectureKit.tsx`/`DormPreviewScene.tsx`
   (tables, desks, the bed) omits drei's `smoothness` prop, meaning it
   silently uses drei's library default rather than a value this codebase
   chose deliberately — worth an explicit decision once real budgets
   (Part 19) are measured.
5. **No sky.** Both outdoor scenes (Main Gate, Grand Courtyard) have nothing
   above the fog line — looking up shows nothing.
6. **The "UI textures/icons" gap is arguably not a real gap yet.** Lucide
   icons + CSS are a reasonable, already-consistent choice for THIS
   phase's scope; a "diegetic manuscript-frame" UI redesign is Master
   Design §14 aspiration, not a Phase 2 asset-pipeline requirement — flagged
   here for completeness, not elevated to "must fix."

## 6. What this audit means for Phase 2's implementation

Every single visual element in the Prestige renderer is **procedural
prototype** — there is no "acceptable temporary asset" tier today because
nothing has ever been sourced from outside the codebase. This means Phase
2's manifest (Part 2) will, honestly, describe a system that is 100%
ready to receive real assets but currently has **zero** production or
approved-temporary entries — every manifest entry created this phase will
be `status: "procedural"` pointing at one of the components audited above,
proving the abstraction works while disclosing, accurately, that no real
art has been acquired yet. This is the correct, honest state for this
audit to describe — see `docs/V2_PHASE2_ASSET_PIPELINE.md` §19 ("Remaining
procedural assets") for the full list carried forward.
