/**
 * Sky and light for the real local time: warm dawn and dusk, bright day,
 * moonlit night. Pure (no React), so it can be tested.
 */

import * as THREE from "three";

export const SUN_OFFSET = new THREE.Vector3(20, 15, 10);
const FOG = "#cddbe6";

export interface SkyState {
  /** Direction × distance of the main light (sun by day, moon by night). */
  light: THREE.Vector3;
  /** Where the sky shader's sun is (below the horizon at night). */
  sun: THREE.Vector3;
  lightColor: string;
  lightIntensity: number;
  hemiSky: string;
  hemiIntensity: number;
  fog: string;
  env: number;
  night: boolean;
}

/** Late-afternoon light for the fixed sky: lower and warmer than noon, so buildings cast long shadows and read in depth. */
const AFTERNOON = new THREE.Vector3(24, 12, 15);
export const DAY_SKY: SkyState = { light: AFTERNOON, sun: AFTERNOON, lightColor: "#ffdcb0", lightIntensity: 2.9, hemiSky: "#dbe7ff", hemiIntensity: 0.5, fog: FOG, env: 0.45, night: false };

/** Sky for a local time (hours, 0-24). Sunrise ~6, sunset ~18; dusk and dawn are warm, night is moonlit blue. */
export function skyAt(hours: number): SkyState {
  const elevation = Math.sin(((hours - 6) / 12) * Math.PI); // 1 at noon, <0 at night
  const azimuth = ((hours - 6) / 12) * Math.PI;
  const sun = new THREE.Vector3(Math.cos(azimuth) * 25, Math.max(-12, elevation * 22), 10);
  if (elevation > 0.12) {
    const warm = Math.max(0, 1 - (elevation - 0.12) / 0.35); // golden near the horizon
    const c = new THREE.Color("#fff3e0").lerp(new THREE.Color("#ffb070"), warm);
    return { ...DAY_SKY, light: sun, sun, lightColor: `#${c.getHexString()}`, lightIntensity: 1.6 + elevation * 1.2, fog: `#${new THREE.Color(FOG).lerp(new THREE.Color("#f0c49a"), warm * 0.6).getHexString()}` };
  }
  if (elevation > -0.15) {
    // Twilight: fading to night.
    const t = (0.12 - elevation) / 0.27;
    return {
      light: new THREE.Vector3(sun.x, Math.max(4, sun.y + 6), sun.z),
      sun,
      lightColor: `#${new THREE.Color("#ff9a5a").lerp(new THREE.Color("#8aa0d8"), t).getHexString()}`,
      lightIntensity: 1.5 - t * 0.9,
      hemiSky: `#${new THREE.Color("#e4efff").lerp(new THREE.Color("#4a5a8a"), t).getHexString()}`,
      hemiIntensity: 0.45 - t * 0.2,
      fog: `#${new THREE.Color("#d8a07a").lerp(new THREE.Color("#1c2440"), t).getHexString()}`,
      env: 0.4 - t * 0.25,
      night: t > 0.6,
    };
  }
  // Night: a high, cool moon.
  return { light: new THREE.Vector3(-14, 18, -8), sun, lightColor: "#a8bcff", lightIntensity: 0.75, hemiSky: "#4a5a8a", hemiIntensity: 0.32, fog: "#18203a", env: 0.16, night: true };
}

