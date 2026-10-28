# UniGame V2 — Blender Export Contract

Audience: an artist working in Blender who has **never seen this
codebase**. Follow this document exactly and your file will drop into the
game with zero code changes, per `public/assets/v2/README.md`'s
replacement workflow. If anything here is ambiguous for a specific asset,
ask before exporting — a wrong scale or pivot is much cheaper to fix in
Blender than after it has shipped inside a dozen placed instances.

## 1. Software

- **Blender 4.2 LTS** or newer. Do not use the legacy Blender 2.8x glTF
  exporter — its export options differ from what's specified below.
- Export format: **glTF Binary (.glb)** — a single self-contained file
  (mesh + materials + embedded or referenced textures + animations). Do
  not export `.gltf` + loose `.bin`/texture files; the pipeline expects one
  `.glb` per asset.

## 2. Units and scale

- Set Blender's Scene Properties → Units → **Metric**, Unit Scale **1.0**.
- **1 Blender unit = 1 metre = 1 in-game unit.** The game's 3D world is
  metre-scaled directly (`src/game3d/types/coordinates.ts`'s
  `SCENE_UNITS_PER_METRE` constant converts the legacy 2D movement grid
  into these same metres — you never need to apply a scale factor).
- Reference dimensions already established by the existing Art Bible /
  procedural kit (match these unless the brief for a specific asset says
  otherwise):
  - Adult character height: **~1.75-1.85 m**
  - Standard doorway: **~1.2 m wide × 2.4 m tall**
  - Standard ceiling height (halls/corridors): **~4-6 m**
  - Standard column height: **~4-5 m**
  - Standard table height: **~0.75 m**

## 3. Coordinate orientation

- Model in Blender's normal **Z-up** orientation — do not manually rotate
  your mesh to "pre-convert" to Y-up. The glTF exporter's standard
  `+Y Up` option (**on by default, leave it on**) performs the Z-up →
  Y-up conversion automatically on export. A model rotated by hand AND
  exported with `+Y Up` on will end up rotated twice.
- Forward-facing convention: an asset's front (the side a player
  approaches or faces) should point toward **-Y in Blender** (which
  becomes **+Z, "toward the camera/player" in-engine** after the standard
  conversion).

## 4. Origin and pivot rules

- **Object origin = the asset's placement anchor.** The engine positions
  every asset by its origin — get this wrong and the manifest's
  `position`/`rotation` placement data (see `docs/V2_PHASE2_ASSET_PIPELINE.md`
  §12, level placement format) will look correct in Blender but wrong
  in-game.
- **Floor-standing assets** (columns, furniture, statues, props): origin
  at the **centre of the base**, sitting exactly at Z=0 in Blender (so the
  object's lowest point touches the origin's ground plane).
- **Wall-mounted assets** (windows, banners, sconces, wall-hung
  decorations): origin at the **centre of the back face** (the face that
  meets the wall), so placement code can position it flush against a wall
  plane with zero offset.
- **Doors**: origin at the **hinge point**, floor level — this is required
  even for the current static (non-swinging) doors, since animated
  opening is planned (`docs/V2_PHASE2_ASSET_AUDIT.md`'s `arch-grand-door`
  entry notes "opening animation is currently absent").
- **Ceiling-mounted assets** (vault segments, hanging fixtures): origin at
  the centre of the **top face**, matching the ceiling plane it attaches to.
- Apply all transforms before export (Object → Apply → All Transforms in
  Blender) — scale must be 1.0, rotation must be 0 on all axes, at the
  object level, in the final file. An asset exported with un-applied scale
  will load at the wrong size regardless of what looked correct in the
  Blender viewport.

## 5. Naming conventions

Two independent naming schemes apply: the **file name** (maps to the
manifest's `id`) and **internal object/mesh names** (used for named-node
lookups, collision detection, and material slot overrides — see
`src/game3d/assets/assetLoaderCore.ts`'s `findNamedNode`/
`applyMaterialOverride`).

### File names

`<PREFIX>_<descriptive-name>_<variant-letter>.glb`

| Prefix | Category | Example |
|---|---|---|
| `ARCH_` | Architecture (walls, arches, ceilings, roofs, stairs) | `ARCH_wall_gothic_A.glb` |
| `COL_` | A standalone collision-only mesh (see §7) | `COL_wall_gothic_A.glb` |
| `PROP_` | Furniture, fixtures, decorations | `PROP_long_table.glb` |
| `CHAR_` | Character base meshes | `CHAR_base_male_A.glb` |
| `CLOTH_` | Clothing/wardrobe pieces | `CLOTH_scholar_robe_A.glb` |

Variant letters (`_A`, `_B`, ...) distinguish alternate versions of the
same conceptual asset (e.g. a clean vs. weathered wall run) — a new
variant is a new file and a new manifest entry, not an in-place edit of
an existing one (existing entries stay until a replacement is registered,
per the README's "delete nothing without a substitute" rule).

### LOD variants

Prefix the LOD tier ahead of the category prefix:
`LOD0_ARCH_column_01.glb`, `LOD1_ARCH_column_01.glb`,
`LOD2_ARCH_column_01.glb`. `LOD0` is always the highest-detail tier
(closest camera distance); higher numbers are progressively simpler. See
`src/game3d/assets/assetManifestTypes.ts`'s `LodVariant.minDistanceM` —
the manifest entry, not the filename, is what actually drives the
distance thresholds; the filename only needs to be unambiguous to a human
sorting files in a folder.

### Animation clip names

One Action per clip in Blender's Action Editor/NLA, named
`ANIM_<verb>_<qualifier>` — e.g. `ANIM_walk_forward`, `ANIM_walk_backward`,
`ANIM_idle_breathe`, `ANIM_door_open`, `ANIM_door_close`,
`ANIM_sit_down`, `ANIM_wave`. These names become `THREE.AnimationClip.name`
values on export and are exactly what
`src/game3d/assets/useAnimatedCharacter.ts`'s `play(clipName)` looks up —
get the name wrong and the clip silently isn't found (the hook logs a
dev-only warning listing the clip names it actually found, rather than
failing silently in production).

### Internal object/mesh names (material slots, named nodes, collision)

- Give every **material** a stable, descriptive name matching the
  material system's IDs where applicable (see
  `docs/V2_PHASE2_ASSET_PIPELINE.md` §6 for the authoritative list —
  e.g. `limestone`, `aged-oak`, `wrought-iron`, `stained-glass`). A
  material named to match an in-game material ID can be overridden by
  `applyMaterialOverride(root, materialSlotName, material)` without a new
  export.
- Name any **attachment point** empties (a socket for a held prop, a
  door's swing pivot, a light's mount point) `ATTACH_<purpose>` — e.g.
  `ATTACH_right_hand`, `ATTACH_torch`. Looked up in-engine via
  `findNamedNode(root, "ATTACH_right_hand")`.
- Name a **built-in low-poly collision proxy** mesh (see §7)
  `COLLISION_<shape>` — e.g. `COLLISION_box`, `COLLISION_capsule`. Mark
  it non-renderable in the export settings (§6) so it never draws, only
  collides.

## 6. Export settings (glTF 2.0 exporter panel)

- **Format**: glTF Binary (.glb)
- **Include → Selected Objects only** (export exactly the asset, nothing
  stray left in the scene)
- **Transform → +Y Up**: ON (default — see §3)
- **Geometry → Apply Modifiers**: ON
- **Geometry → UVs / Normals / Tangents**: ON (tangents are required for
  normal-mapped materials to render correctly)
- **Geometry → Materials**: Export (do not select "No export" even for a
  temporary/placeholder asset — an untextured material still needs a
  named slot, see §5)
- **Compression**: leave **Draco OFF** unless a specific asset has been
  explicitly approved for Draco compression AND the project's decoder
  files exist under `public/draco/` (they do not, as of V2 Phase 2 — see
  `src/game3d/assets/assetLoaderCore.ts`'s own header comment). Exporting
  with Draco on when the decoder isn't deployed will make the asset fail
  to load with no silent fallback available.
- **Animation**: ON, "Export all Actions", **Sampling Rate**: leave at
  Blender's default (the exporter bakes to keyframes automatically) —
  only export the specific `ANIM_*` actions actually intended for this
  asset; delete stray test/reference actions from the file first.
- **Collision proxy objects** (any `COLLISION_*` mesh, §5): mark them
  non-renderable in Blender (disable in Render, keep enabled in Viewport)
  — the glTF exporter respects the render-visibility flag, so a
  collision-only mesh exports as geometry without ever being drawn.

## 7. Collision

Per Implementation Rule #13 ("do not use high-poly visual meshes as
default collision"), do not rely on your visual mesh being used as
collision. Choose one:

- **No collision needed** (decorative, wall-mounted, ceiling props):
  export nothing extra — the manifest's `collisionSource: "none"`.
- **Primitive collision** (most floor-standing props/furniture): export
  nothing extra either — the manifest/placement data declares a simple
  box/cylinder primitive at load time (`collisionSource: "primitive"`),
  no Blender work required.
- **Authored collision** (an irregular shape a primitive can't
  approximate well — e.g. a fountain basin, a statue's plinth): model a
  separate, deliberately low-poly (single digit to low dozens of
  triangles) `COLLISION_*` mesh alongside the visual mesh in the same
  file, non-renderable per §6.

## 8. Textures and materials

- **PBR workflow**: Principled BSDF only. Supply, where the asset calls
  for it: Base Color (albedo), Normal (OpenGL/+Y convention — Blender's
  default; do NOT supply a DirectX/-Y normal map), Roughness, Metalness,
  Ambient Occlusion, Emissive.
- **Resolution tiers** (see `docs/V2_PHASE2_ASSET_PIPELINE.md` §7 for the
  authoritative policy):
  - Hero/close-up assets (player, main NPCs, centrepiece props): 2K-4K
  - Standard architecture (walls, columns, arches): 1K-2K
  - Small props (candles, books, sconces): 512-1K
  - Background/distant-only assets: 256-1K
- **Texel density**: keep consistent density across an asset — avoid
  mixing a 4K hero texture on one face with a stretched 256px texture on
  an adjacent face of the same object.
- **Tiling materials** (stone floors, wall runs): design the UV so the
  texture repeats cleanly at the modular grid size (§9) — a wall segment
  that doesn't tile seamlessly against its neighbour will show a visible
  seam once placed edge-to-edge in-engine.
- Pack textures into the `.glb` (embedded) rather than referencing
  external files, unless a specific asset is explicitly part of a shared
  trim-sheet/atlas strategy agreed with the team beforehand.

## 9. Modular kit grid (walls, columns, arches, floor tiles)

Architecture pieces meant to tile/snap together must share a common grid
so they align without manual nudging in the placement data:

- Base module width: **2 m** (a wall segment, floor tile, or arch span is
  a multiple of 2 m — 2 m, 4 m, 6 m, ...)
- Base module height: **4 m** per storey (matches the standard ceiling
  height in §2)
- Column/pilaster spacing: multiples of the 2 m module width
- Doorway width: **1.2 m**, centred within its containing module

## 10. Prohibited

- No baked lighting/shadows into the albedo texture (the engine is
  real-time lit — a baked shadow will look wrong once dynamic light
  moves).
- No non-uniform scale left un-applied on export (§4).
- No stray cameras, lights, or reference/blockout objects left in the
  exported selection.
- No embedded video textures, no procedural node setups the Principled
  BSDF export can't bake (e.g. raw noise-texture-driven color with no
  baked equivalent) — bake procedural material effects to image textures
  before export.
- No assets modelled from or directly copied from an existing commercial
  game's files/reference (RuneScape, Hogwarts Legacy, Guild Wars 2, etc.)
  — those are quality references only, never asset sources (Implementation
  Rules #10/#11, see `public/assets/v2/licences/ASSET_LICENCES.md`).

## 11. Pre-delivery testing checklist

Before handing off a `.glb`, confirm:

- [ ] Opens cleanly in [gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com/) (or Blender's own glTF re-import) with correct scale, orientation, and materials
- [ ] Object origin is at the correct anchor point per §4 (test by placing a temporary ground-plane cube at world origin in Blender and confirming the asset's base sits flush at Z=0 before export)
- [ ] All transforms applied (scale 1.0, rotation 0,0,0 at the object level)
- [ ] Every material has a distinct, descriptive name (no "Material.001")
- [ ] Any `COLLISION_*`/`ATTACH_*` helper objects are named per §5 and non-renderable per §6
- [ ] Animation actions (if any) are named `ANIM_*` and only the intended clips are present
- [ ] File size is reasonable for its resolution tier (§8) — a 50 MB file for a small background prop signals an unpacked/uncompressed texture mistake
- [ ] Triangle count is proportionate to the asset's importance (a hero prop can afford more; a background prop should stay lean) — there is no hard per-asset cap yet (see `docs/V2_PHASE2_ASSET_PIPELINE.md` §19 for current whole-scene budgets), but an outlier triangle count is worth flagging before delivery
