/**
 * The interface icon set: one consistent family of monochrome line icons.
 *
 * Every icon is drawn on a 24 x 24 grid as stroked path data (round caps and
 * joins, 1.75 stroke by default) and takes its colour from `currentColor`.
 * Dots are zero-length strokes, so they stay round at any size. The same
 * path data can be drawn on a canvas with `drawIcon` (Path2D).
 *
 * Use these everywhere the interface needs a pictogram. Emoji are not used in
 * the interface (see docs/REALM_OF_SCHOLARS.md, "Art direction").
 */

import type { CSSProperties } from "react";
import type { RegionTheme } from "../types";

/** A circle as path data (two arcs), so icons stay a single path. */
const c = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const PATHS = {
  // Interface
  close: "M6 6l12 12M18 6L6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  chevronRight: "M9 5l7 7-7 7",
  chevronLeft: "M15 5l-7 7 7 7",
  chevronDown: "M5 9l7 7 7-7",
  chevronUp: "M5 15l7-7 7 7",
  arrowRight: "M4 12h15M13 6l6 6-6 6",
  arrowLeft: "M20 12H5M11 6l-6 6 6 6",
  arrowUp: "M12 20V5M6 11l6-6 6 6",
  arrowDown: "M12 4v15M6 13l6 6 6-6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  eye: `M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z${c(12, 12, 3)}`,
  home: "M4 11l8-7 8 7M6 9.5V20h4.5v-5.5h3V20H18V9.5",
  help: `${c(12, 12, 9)}M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01`,
  info: `${c(12, 12, 9)}M12 11v6M12 7.5v.01`,
  warning: "M12 4L2.8 19.5h18.4L12 4zM12 10v4.5M12 17v.01",
  mail: "M3.5 6.5h17v11h-17zM3.5 7l8.5 6.5L20.5 7",
  chat: "M4 5.5h16v10H10l-4.5 3.5v-3.5H4z",
  emote: `${c(12, 12, 9)}M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5v.01M15 9.5v.01`,
  settings: `M4 7h9M17 7h3M4 17h3M11 17h9${c(15, 7, 2)}${c(9, 17, 2)}`,
  search: `${c(11, 11, 6.5)}M16 16l4.5 4.5`,
  pencil: "M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM13.5 7l3 3",
  trash: "M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14",
  download: "M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15",
  upload: "M12 16V5M7 9.5l5-5 5 5M4.5 19.5h15",
  attach: "M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7",
  file: "M6 3.5h8l4.5 4.5v12.5H6zM14 3.5V8h4.5",
  image: `M4 5h16v14H4zM4 16l4.5-4.5L13 16l2.5-2.5L20 18${c(15, 9.5, 1.5)}`,
  video: "M3.5 6h12v12h-12zM15.5 10l5-3v10l-5-3",
  backspace: "M8.5 5.5H20v13H8.5L3 12zM11.5 9.5l5 5M16.5 9.5l-5 5",
  copy: "M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4",
  // Media
  play: "M7 4.5v15l12.5-7.5z",
  pause: "M8 5v14M16 5v14",
  replay: "M4 4.5v5h5M4.6 9.5A8 8 0 1 1 4 13",
  next: "M5 5l10 7-10 7zM18.5 5v14",
  previous: "M19 5L9 12l10 7zM5.5 5v14",
  fast: "M3.5 6l8 6-8 6zM12.5 6l8 6-8 6z",
  volume: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  music: `M9 18V5.5l11-2V16${c(6.5, 18, 2.5)}${c(17.5, 16, 2.5)}`,
  // Economy and status
  focus: "M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z",
  coin: `${c(12, 12, 8.5)}${c(12, 12, 5)}`,
  candle: "M9.5 10h5v10.5h-5zM12 10V8M12 3.5c1.3 1.4 1.6 2.4 0 4-1.6-1.6-1.3-2.6 0-4zM7 20.5h10",
  flame: "M12 3c3.5 3.8 6 6.8 6 10.5a6 6 0 0 1-12 0c0-2.2 1-3.8 2.5-5.3.3 1.8 1.2 2.9 2.5 3.3C10.5 9 10.8 6 12 3z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z",
  shield: "M12 3l7.5 3v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6z",
  timer: `${c(12, 13, 8)}M12 9v4l2.5 2.5M9.5 3h5`,
  clock: `${c(12, 12, 9)}M12 7v5l3.5 2`,
  hourglass: "M6.5 3.5h11M6.5 20.5h11M8 3.5v3.2c0 1.6 1.3 2.9 4 5.3 2.7-2.4 4-3.7 4-5.3V3.5M8 20.5v-3.2c0-1.6 1.3-2.9 4-5.3 2.7 2.4 4 3.7 4 5.3v3.2",
  medal: `${c(12, 15, 5)}M8.5 3.5l2 7M15.5 3.5l-2 7M8 3.5h8`,
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3.2 3M16 6h3v1a3 3 0 0 1-3.2 3M12 13v4.5M8 20h8M9.5 17.5h5",
  flag: "M5 21V4M5 4.5h12l-2.5 4 2.5 4H5",
  target: `${c(12, 12, 8.5)}${c(12, 12, 4.5)}M12 12v.01`,
  key: `${c(8, 15, 4)}M11 12l8.5-8.5M16 7l2.5 2.5M18.5 4.5L21 7`,
  lock: "M5.5 11h13v9.5h-13zM8 11V8a4 4 0 0 1 8 0v3",
  bell: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2.2 2.2 0 0 0 4 0",
  // Menu sections
  skills: "M4 20.5h16M7 17.5v-6M12 17.5V6.5M17 17.5v-9",
  quests: "M8 4h10.5v12.5M8 4a2.5 2.5 0 0 0-2.5 2.5V8H8M8 4a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 0 2.5 2.5h5.5a2 2 0 0 0 2-2v-1.5H13M13 20a2.5 2.5 0 0 1-2.5-2.5M13.5 9h2.5M13.5 12.5h2.5",
  book: "M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h11M9 4.5v6l2-1.5 2 1.5v-6",
  bookOpen: "M12 7c-1.8-1.6-4.3-2.3-8-2.3v13c3.7 0 6.2.7 8 2.3 1.8-1.6 4.3-2.3 8-2.3v-13c-3.7 0-6.2.7-8 2.3zM12 7v13",
  bag: "M6 9a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v10.5H6zM9.5 5V3.5h5V5M6 13h12M10 13v2.5h4V13",
  map: "M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13",
  compass: `${c(12, 12, 9)}M15.5 8.5l-2 5-5 2 2-5z`,
  calendar: "M4 6h16v14H4zM4 10h16M8 3.5V7M16 3.5V7",
  cap: "M2.5 9.5L12 5l9.5 4.5L12 14zM6.5 11.5V16c1.5 1.3 3.4 2 5.5 2s4-.7 5.5-2v-4.5M21.5 9.5v5",
  library: "M4 4.5h4v15H4zM8 6.5h4v13H8zM13 5.8l3.8-1 3.7 14-3.8 1z",
  user: `${c(12, 8, 3.8)}M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6`,
  users: `${c(9, 8.5, 3.3)}M3 20c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2M15.5 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14.9c1.9.6 3.2 2.3 3.5 5`,
  dice: "M4.5 4.5h15v15h-15zM8.5 8.5v.01M15.5 8.5v.01M12 12v.01M8.5 15.5v.01M15.5 15.5v.01",
  palette: "M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.7 1.8-1.7h2.3a3.8 3.8 0 0 0 3.8-3.8c0-3.9-3.8-7-8.5-7zM7.5 11.5v.01M9.5 7.5v.01M14 7v.01M17 10v.01",
  // Places
  castle: "M4 20.5V8h2.5v2H9V8h2v2h2V8h2v2h2.5V8H20v12.5zM10 20.5V16a2 2 0 0 1 4 0v4.5",
  tower: "M8.5 20.5V10l3.5-6.5 3.5 6.5v10.5M6.5 20.5h11M8.5 13.5h7M12 16.5v.01",
  anchor: `${c(12, 5.5, 2)}M12 7.5V21M7.5 11h9M4.5 13.5A7.5 7.5 0 0 0 12 21a7.5 7.5 0 0 0 7.5-7.5`,
  door: "M6 20.5V4h12v16.5M3.5 20.5h17M14.5 12v.01",
  bed: `M3 6v13M21 19v-5a3 3 0 0 0-3-3h-8v5M3 16h18${c(6.5, 12.5, 1.6)}`,
  island: "M3 19.5c3-1.5 6-1.5 9 0s6 1.5 9 0M6 16.5c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5M12 12V5.5M12 5.5c-1.5-1.5-3.5-1.8-5-1M12 5.5c1.5-1.5 3.5-1.8 5-1",
  pin: `M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z${c(12, 10, 2.2)}`,
  // Combat and magic
  swords: "M5 5l9.5 9.5M5 5v3l8 8M19 5l-9.5 9.5M19 5v3l-8 8M8.7 15.3L5 19M15.3 15.3L19 19",
  wand: "M4 20l11-11M13.5 7.5l3 3M17 3v3M15.5 4.5h3M20 8v2.5M18.75 9.25h2.5",
  skull: "M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.3 1 4 2.5 5v3.5h10v-3.5c1.5-1 2.5-2.7 2.5-5 0-4-3.1-7-7.5-7zM9 11.5v.01M15 11.5v.01M10.5 19v-2M13.5 19v-2",
  burst: "M12 3l1.8 5.2L19 6l-2.2 5 5.2 1.5-5.2 1.5 1.7 5-5-2.5L12 21l-1.5-4.5-5 2.5 1.7-5L2 12.5 7.2 11 5 6l5.2 2.2z",
  web: `${c(12, 12, 8.5)}${c(12, 12, 4.2)}M12 3.5v17M3.5 12h17`,
  mend: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10zM12 10.5v5M9.5 13h5",
  flask: "M9.5 3.5h5M10 3.5V9l-5.2 9a1.7 1.7 0 0 0 1.5 2.5h11.4a1.7 1.7 0 0 0 1.5-2.5L14 9V3.5M7.2 14.5h9.6",
  cauldron: "M4.5 9.5h15M5.5 9.5c0 5 2.5 8.5 6.5 8.5s6.5-3.5 6.5-8.5M8 18l-1.5 2.5M16 18l1.5 2.5M10 6.5v.01M13.5 4.5v.01",
  broom: "M20 4l-8.5 8.5M11.5 12.5c-2.5-1-4.5-.2-6 1.5L3 20.5l6.5-2.5c1.7-1.5 2.5-3.5 1.5-6M6 16l2 2",
  // Life skills and materials
  fish: "M2.5 7.5L6 12l-3.5 4.5M6 12c2.4-3.4 5.3-5 8.5-5 3 0 5.3 1.7 7 5-1.7 3.3-4 5-7 5-3.2 0-6.1-1.6-8.5-5zM16.5 10.5v.01",
  pickaxe: "M4 8.5c4-4 10-4.5 15.5-2M11.5 7.5L4 20M14.5 9.5l2-2",
  axe: "M13.5 3.5L5 20.5M12.5 5c2.6-1.4 5.6-.8 7.5 1.2-.8 3.2-3.6 5.3-7.6 5.3",
  ore: "M3.5 17.5L6 9.5l5-4 6.5 2 3 6.5-3.5 5H7zM11 5.5l1 6-5.5 7M12 11.5l8.5 2.5",
  log: `${c(17.5, 12, 3.5)}M17.5 8.5H6a3.5 3.5 0 0 0 0 7h11.5M17.5 12v.01`,
  bowl: "M3.5 11h17a8.5 8.5 0 0 1-17 0zM8 20.5h8M9 4.5c-1 1.2-1 2.3 0 3.5M13 3.5c-1 1.2-1 2.3 0 3.5",
  hammer: "M13.5 9.5L4 19a1.4 1.4 0 0 0 2 2l9.5-9.5M11.5 6.5l4-3.5 5.5 5.5-3.5 4z",
  leaf: "M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7",
  scales: "M12 4v16.5M7.5 20.5h9M4.5 7h15M7 7l-3 6.5a3 3 0 0 0 6 0zM17 7l-3 6.5a3 3 0 0 0 6 0z",
  gear: `${c(12, 12, 3)}${c(12, 12, 6.5)}M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1`,
  gem: "M6.5 4h11l3 5-8.5 11.5L3.5 9zM3.5 9h17M9.5 4L12 9l2.5-5",
  ring: `${c(12, 14.5, 6)}M9.5 8.5L8 5h8l-1.5 3.5`,
  lamp: "M3.5 12.5H15a4 4 0 0 0 3.6-2.3L20.5 7M8 12.5a3.5 3.5 0 0 1 7 0M7 16.5h8.5M11.5 12.5v4M11.5 7V5.5",
  cape: "M8 4h8l2.5 16.5-6.5-2-6.5 2zM9.5 4c.5 1.6 1.4 2.5 2.5 2.5s2-.9 2.5-2.5",
  // Furniture
  chair: "M7.5 3.5v17M7.5 13h9.5v7.5M17 13v-3",
  table: "M3 9h18M5.5 9v10.5M18.5 9v10.5M3 9V7.5h18V9",
  sofa: "M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M2.5 13a1.5 1.5 0 0 1 3 0v1.5h13V13a1.5 1.5 0 0 1 3 0v5h-19zM5 18v2M19 18v2",
  cabinet: "M5 3.5h14v17H5zM5 12h14M10.5 7.5h3M10.5 16h3",
  floorLamp: "M8 3.5h8l3 7H5zM12 10.5v8M8 20.5h8",
  plant: "M7.5 14.5h9l-1.2 6H8.7zM12 14.5V8M12 11c-2.5 0-4.5-1.8-4.5-4.5 2.5 0 4.5 1.8 4.5 4.5zM12 8.5c0-2.5 2-4.5 4.5-4.5 0 2.5-2 4.5-4.5 4.5z",
  rug: "M5.5 5h13v14h-13zM8.5 8h7v8h-7zM3.5 7v.01M3.5 12v.01M3.5 17v.01M20.5 7v.01M20.5 12v.01M20.5 17v.01",
  shelf: "M3.5 8h17M3.5 16h17M6 8V4.5M9 8V5.5M13 16v-4M16 16v-3",
  // Games
  letters: `M3.5 18.5L8 6l4.5 12.5M5.2 14h5.6${c(16.5, 15.5, 3)}M19.5 11.5v7`,
  grid: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6v.01M4.5 12v.01M4.5 18v.01",
  phone: "M7.5 3h9v18h-9zM11 18h2",
  moon: "M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z",
  tomato: `${c(12, 13.5, 7)}M9.5 6.5L12 8l2.5-1.5M12 8V4.5`,
  // Gestures (emotes)
  hand: "M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6 7-2.7 0-4.3-1.5-5.8-4L3.5 12.8a1.4 1.4 0 0 1 2.2-1.7L8 13.5",
  point: "M10 13V4.5a1.5 1.5 0 0 1 3 0V11l4.5.8c1.6.3 2.5 1.6 2.3 3.2l-.6 3.5a2.5 2.5 0 0 1-2.5 2h-5.2c-1 0-1.9-.5-2.4-1.3L5.6 14a1.5 1.5 0 0 1 2.4-1.8l2 1.8",
  roll: "M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5",
  kick: `${c(14, 4.5, 1.8)}M8 21l3-6 3 2v4.5M11 15l-1-4.5 4-2 3 3h3M6 11.5l4-1`,
  // Weather
  sun: `${c(12, 12, 4)}M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4`,
  cloud: "M7 18.5h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1A4.5 4.5 0 0 0 7 18.5z",
  rain: "M7 15.5h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1A4.5 4.5 0 0 0 7 15.5zM8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2",
  fog: "M4 9h16M6 13h14M4 17h12",
  storm: "M7 14.5h1.5M15.5 14.5h1.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1A4.5 4.5 0 0 0 7 14.5M12.5 11l-2 4.5h3l-2 4.5",
} as const;

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];

interface IconProps {
  name: IconName;
  /** Pixel size (square). Defaults to 1em, so the icon follows the font size. */
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  /** An accessible name. Without one the icon is decorative (hidden from screen readers). */
  title?: string;
  style?: CSSProperties;
}

/** One line icon. */
export function Icon({ name, size = "1em", strokeWidth = 1.75, className, title, style }: IconProps) {
  return (
    <svg
      className={`rs-icon${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={style}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Draws an icon on a 2D canvas, centred on (x, y). */
export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number, color: string, strokeWidth = 1.9): void {
  const scale = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(PATHS[name]));
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Lookups from game data to icons. The data files keep their own `icon`
// fields; the interface draws from this set instead.
// ---------------------------------------------------------------------------

const THEME_ICON: Record<RegionTheme, IconName> = {
  arcane: "tower",
  forge: "hammer",
  grove: "leaf",
  archive: "quests",
  guild: "scales",
  tide: "anchor",
  foundry: "gear",
  alchemy: "flask",
};

/** The pictogram for a subject region's theme. */
export function themeIcon(theme: RegionTheme): IconName {
  return THEME_ICON[theme] ?? "star";
}

const LIFE_SKILL_ICON: Record<string, IconName> = {
  fishing: "fish",
  mining: "pickaxe",
  woodcutting: "axe",
  cooking: "bowl",
  crafting: "wand",
  combat: "swords",
};

export function lifeSkillIcon(id: string): IconName {
  return LIFE_SKILL_ICON[id] ?? "star";
}

const ITEM_ICON: Record<string, IconName> = {
  tome: "book",
  "xp-lamp": "lamp",
  "quest-scroll": "quests",
  "focus-candle": "candle",
  "graduation-cape": "cape",
  "scholar-ring": "ring",
  "rune-shard": "gem",
};

/** Inventory items, gathered materials, cooked food and brewed potions. */
export function itemIcon(id: string): IconName {
  if (ITEM_ICON[id]) return ITEM_ICON[id];
  if (id.startsWith("cooked-")) return "bowl";
  if (id.startsWith("potion-")) return "flask";
  if (["minnow", "trout", "salmon", "goldfin"].includes(id)) return "fish";
  if (["copper", "iron", "silver", "gold"].includes(id)) return "ore";
  if (["oak", "willow", "maple", "yew"].includes(id)) return "log";
  return "gem";
}

/** Dorm furniture, by catalogue id. */
export function furnitureIcon(id: string): IconName {
  if (id.startsWith("bed")) return "bed";
  if (id.startsWith("armchair") || id.startsWith("couch")) return "sofa";
  if (id.startsWith("chair")) return "chair";
  if (id.startsWith("table")) return "table";
  if (id.startsWith("cabinet")) return "cabinet";
  if (id.startsWith("lamp")) return "floorLamp";
  if (id.startsWith("cactus") || id.startsWith("plant")) return "plant";
  if (id.startsWith("rug")) return "rug";
  if (id.startsWith("book") || id.startsWith("shelf-b")) return "library";
  if (id.startsWith("shelf")) return "shelf";
  if (id.startsWith("picture")) return "image";
  return "cabinet";
}

const SPELL_ICON: Record<string, IconName> = { bolt: "focus", blast: "burst", mend: "mend", ward: "shield", snare: "web" };
export function spellIcon(kind: string): IconName {
  return SPELL_ICON[kind] ?? "wand";
}

const ARENA_ICON: Record<string, IconName> = { buzzer: "bell", blitz: "timer", lexicon: "letters", connections: "grid", sequence: "list" };
export function arenaIcon(id: string): IconName {
  return ARENA_ICON[id] ?? "swords";
}

const EMOTE_ICON: Record<string, IconName> = { wave: "hand", cast: "wand", point: "point", roll: "roll", bow: "user", kick: "kick" };
export function emoteIcon(id: string): IconName {
  return EMOTE_ICON[id] ?? "emote";
}

const HOUSE_ICON: Record<string, IconName> = { emberhold: "flame", tidewater: "anchor", oakhaven: "leaf", duskmere: "moon" };
export function houseIcon(id: string): IconName {
  return HOUSE_ICON[id] ?? "shield";
}

const TD_ICON: Record<string, IconName> = { ping: "bell", scroll: "phone", nap: "moon", panic: "warning", lamp: "floorLamp", pomodoro: "tomato", planner: "calendar" };
/** Siege of Procrastination enemies and towers. */
export function siegeIcon(id: string): IconName {
  return TD_ICON[id] ?? "target";
}

const WEATHER_ICON: Record<string, IconName> = { clear: "sun", cloudy: "cloud", rain: "rain", fog: "fog", storm: "storm" };
export function weatherIcon(kind: string): IconName {
  return WEATHER_ICON[kind] ?? "cloud";
}
