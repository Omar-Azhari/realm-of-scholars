# UniGame asset pipeline

Everything visual in the game world — backgrounds, characters, furniture,
lights, particles, decorations, animations — is loaded from this directory at
runtime. The application is a rendering engine; it draws whatever these files
describe. **Replacing artwork never requires an application code change.**

The current files are placeholders (hand-built SVG and pixel-grid JSON) that
hold each slot open until professionally produced assets replace them.

## Layout

```
assets/
  manifest.json        ← the master index: scenes, geometry, colours, file paths
  sprites/             ← one JSON per character
  scenes/
    hq/                ← Campus HQ hall artwork
    room-<subjectId>/  ← one folder per subject room
```

## How to replace artwork

### A scene background
Drop the new file in the scene's folder and point the scene's `background`
field in `manifest.json` at it (any `<img>`-loadable format: SVG, PNG, WebP).
Backgrounds are authored at the scene's `width × height` (currently 1600×760)
and stretched to fill the stage, so keep that aspect ratio.

**Anchor rule:** door recesses, furniture, and shelves in the background must
stay aligned with the manifest's `doors[].x` / `hotspots[].rect` / widget
coordinates — or update those coordinates to match the new art. The engine
positions everything in the same 1600×760 coordinate space.

**Mentor placement rule:** a room's `mentor` stand position must not overlap
any `hotspots[].rect` — the mentor is hover-interactive and would otherwise
swallow clicks meant for the furniture beneath it.

### A character
Each entry under `"sprites"` in the manifest points at a sprite JSON.
Two formats are supported:

1. **`pixel-grid`** (current placeholders): frames as character grids plus a
   palette. Good for quick edits — change a hex in `palette` to re-dress a
   character.
2. **`spritesheet`** (intended for final art): a PNG/WebP sheet of fixed-size
   frames, row-major from the top-left:

```json
{
  "type": "spritesheet",
  "image": "sprites/player.png",
  "frameWidth": 32,
  "frameHeight": 48,
  "animations": {
    "idle":      { "fps": 4, "loop": true, "frames": [0, 1, 2, 1] },
    "walk":      { "fps": 10, "loop": true, "frames": [3, 4, 5, 6] },
    "celebrate": { "fps": 6, "loop": true, "frames": [7, 8] },
    "stressed":  { "fps": 2, "loop": true, "frames": [9, 10] },
    "wave":      { "fps": 3, "loop": true, "frames": [11, 12] }
  }
}
```

The engine expects the animation names `idle`, `walk`, `celebrate`,
`stressed`, and `wave` (it falls back to `idle` for anything missing).
Characters render at the height given by the scene (`playerHeight`,
`mentorHeight`, …) in scene units — frame size can be anything.

### Furniture, decorations, skins
- Skinnable widget images (trophies, pinned notes, door panels) are listed by
  path in the manifest (`litSrc`, `lockedSrc`, `srcs`, `panelSrc`) — replace
  the file or repoint the path.
- Additional static props can be layered over any background via the scene's
  `images` array (`{ id, src, x, y, width, height }`).
- Hall doors render a placeholder gradient panel until a door's `panelSrc`
  is set, at which point the artist image is used (and slides open in halves).

### Lights
Each scene's `lights` array places light cones (`type: "cone"`) and elliptical
glows (`type: "glow"`) with colour/opacity. Physical lamp fixtures belong in
the background art; the light they cast belongs here. A light may carry
`"phases": ["evening", "night"]` to only shine in certain day phases.

### Atmosphere (time of day)
A scene's optional `atmosphere` object grades the whole stage per Melbourne
day phase (`day` 07–17, `evening` 17–21, `night` 21–07): a `tint` colour +
`tintOpacity` overlay, a `lightScale` multiplier on every light, and a
`particleScale` multiplier on ambient motes. Append `?phase=night` (or
`day`/`evening`) to the URL to preview a phase.
Placeholder limitation: the window city art is painted as night — daytime is
currently expressed through grading only, until day/night background variants
exist.

### Ambience (looping movement)
A scene's optional `ambience` array composes small looping effects, all
skipped under reduced motion: `pulse-dot` (blinking LED), `glow-breathe`
(breathing glow), `scan-line` (a dot travelling between two points — network
pulses, chart traces), `flicker-rect` (screen flicker / board updates), and
`sway` (a hanging fixture swinging around its anchor).

### Transition timing
`transitions` on a scene tunes walk/door/veil durations in milliseconds
(hall: `turnMs`, `walkBaseMs`, `walkMsPerUnit`, `doorOpenMs`, `veilMs`;
rooms: `walkBaseMs`, `walkMsPerUnit`, `veilMs`) — no code changes needed to
re-pace the choreography.

### Particles
Each scene's `particles` object sets count, colour, size range, opacity, and
drift speed of the ambient motes. Set it to `null` for none. Particles are
disabled automatically under reduced motion.

### Audio (sound-ready, no files yet)
Gameplay emits these sound events: `footsteps`, `hover`, `door-open`,
`door-close`, `room-enter`, `module-complete`, `xp-gain`,
`achievement-unlock`, `warning`, `celebration`. Dropping an
`audio/<event>.mp3` file into this directory makes that event audible —
but only for users who enable "Sound effects" in Settings (off by default).
Missing files are silent no-ops.

## What the engine adds on top (not artwork)

Live data displays are drawn by the engine and *positioned/skinned* by the
manifest `widgets` array: the module grid, progress readouts, pinned-note
count, trophy states, and the holo projection. They exist so real study data
can light up inside static artwork. Their colours, coordinates, and skin
images are all manifest values.

## Rules

- Never invent academic content in artwork (subject names, dates, weights) —
  all real data is injected by the app.
- Keep every scene readable in both large (desktop) and small (mobile,
  side-scrolling) sizes.
- Placeholder files stay until a replacement exists — delete nothing without
  a substitute, or the slot renders empty.
