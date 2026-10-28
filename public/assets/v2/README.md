# UniGame V2 asset pipeline (`public/assets/v2/`)

This directory is the **production asset tree** for the `prestige-v2`
renderer (`src/game3d/prestige/`), the 3D counterpart to the legacy 2D
pipeline documented at [`public/assets/README.md`](../README.md). Same
philosophy, restated for 3D: **the engine assembles, loads, and manages
authored artwork — it does not generate final artwork in code.** Nothing
under `src/game3d/` should hardcode a model/texture/audio file path;
every reference goes through the typed manifest at
`src/game3d/assets/assetManifest.ts`. See that file, and
`src/game3d/assets/assetManifestTypes.ts`, for the schema every entry below
must satisfy.

As of V2 Phase 2, **no production art has been sourced yet** — see
`docs/V2_PHASE2_ASSET_AUDIT.md`. Every manifest entry today points either
at an existing procedural component (`status: "procedural"`) or, for the
Phase 2 vertical-slice proof (Part 11), a small number of self-authored
placeholder `.glb` files under `models/_pipeline-proof/` explicitly marked
`status: "placeholder"` and never claimed as final art. This README
describes the STRUCTURE the directory is built to hold; it is not a
claim that every folder below is already populated.

## Layout

```
assets/v2/
  models/
    architecture/   ← walls, columns, arches, doors, windows, roofs, stairs
    props/          ← furniture, fixtures, statues, banners, decorations
    characters/     ← rigged humanoid base mesh(es) + mentor-specific heads
    clothing/       ← interchangeable wardrobe pieces for ModularCharacter
    _pipeline-proof/← temporary self-authored .glb samples proving the
                      loader end-to-end (Phase 2, Part 11) — NOT final art
  textures/
    materials/      ← one folder per material in the Art Bible's material
                      list (limestone/, aged-oak/, wrought-iron/, ...),
                      each holding albedo/normal/roughness/metalness/ao/
                      emissive maps per the naming convention below
    ui/             ← manuscript/leather UI frame textures (if/when the
                      diegetic UI direction in the Master Design is pursued)
  audio/
    ambience/       ← looping district atmosphere (wind, fountain, hall)
    sfx/             ← one-shot interaction sounds (door, footstep, page)
    music/           ← none planned yet; reserved
  licences/
    ASSET_LICENCES.md ← per-asset attribution ledger for every externally
                        sourced file (see docs/V2_PHASE2_ASSET_PIPELINE.md §17)
```

## Naming convention

Texture sets: `<material-id>_<map>.<ext>` — e.g. `limestone_albedo.ktx2`,
`limestone_normal.ktx2`, `limestone_roughness.ktx2`. Models: see
`docs/V2_BLENDER_EXPORT_GUIDE.md` for the full naming contract
(`ARCH_`/`COL_`/`PROP_`/`ANIM_` prefixes, LOD suffixes, etc.).

## How to replace a procedural placeholder with real art

1. Drop the new file(s) under the matching folder above.
2. Add or update the corresponding entry in
   `src/game3d/assets/assetManifest.ts` — set `format` to `"glb"`, `filePath`
   to the new file's path (relative to this directory), and `status` to
   `"production"` (or `"temporary"` if it is an approved stand-in, not yet
   final). Fill in `licence`/`author`/`sourceAttribution` per
   `public/assets/v2/licences/ASSET_LICENCES.md` if the file was not
   self-authored in-house.
3. **No scene file needs to change.** Scene code resolves assets by ID
   through `useGameAsset()`/`loadAsset()` (see
   `src/game3d/assets/assetLoader.tsx`), never by importing a path
   directly — flipping the manifest entry is the entire replacement.
4. Run `npm run assets:validate` (see `docs/V2_PHASE2_ASSET_PIPELINE.md`
   §10) to confirm the new entry is well-formed before relying on it.

Placeholder and procedural entries stay in the manifest until a real
replacement exists — never delete an entry without a substitute, or every
scene referencing that asset ID falls back to the manifest's declared
`fallbackAssetId` (or, if none, the built-in procedural renderer) rather
than rendering nothing.
