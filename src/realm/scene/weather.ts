/**
 * Weather and seasons. The weather changes every few hours, the same for
 * everyone at the same time (it's seeded by the date and hour). Seasons follow
 * the Southern Hemisphere calendar; winter brings more rain and fog. During the
 * exam period a storm hangs over the island. Pure, so it can be tested.
 */

export type Weather = "clear" | "cloudy" | "rain" | "fog" | "storm";
export type Season = "summer" | "autumn" | "winter" | "spring";

export function seasonOf(date: Date): Season {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return "summer";
  if (m <= 4) return "autumn";
  if (m <= 7) return "winter";
  return "spring";
}

function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The weather for a local time. Each 3-hour block has one weather. */
export function weatherAt(date: Date, examPeriod = false): Weather {
  if (examPeriod) return "storm";
  const block = Math.floor(date.getHours() / 3);
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const r = rand(seed * 8 + block);
  const season = seasonOf(date);
  const wet = season === "winter" ? 0.18 : season === "autumn" || season === "spring" ? 0.08 : 0;
  if (r < 0.15 + wet) return "rain";
  if (r < 0.24 + wet * 1.6) return "fog";
  if (r < 0.46 + wet) return "cloudy";
  return "clear";
}

export const WEATHER_LABEL: Record<Weather, { icon: string; label: string }> = {
  clear: { icon: "☀️", label: "Clear" },
  cloudy: { icon: "☁️", label: "Cloudy" },
  rain: { icon: "🌧", label: "Rain" },
  fog: { icon: "🌫", label: "Fog" },
  storm: { icon: "⛈", label: "Exam-week storm" },
};

/** How much the weather pulls the fog in and dims the light (0 clear … 1 thick). */
export function weatherGloom(w: Weather): { fog: number; light: number } {
  switch (w) {
    case "cloudy":
      return { fog: 0.15, light: 0.8 };
    case "rain":
      return { fog: 0.35, light: 0.65 };
    case "fog":
      return { fog: 0.7, light: 0.75 };
    case "storm":
      return { fog: 0.45, light: 0.45 };
    default:
      return { fog: 0, light: 1 };
  }
}
