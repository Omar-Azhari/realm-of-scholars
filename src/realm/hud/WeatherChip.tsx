import { useEffect, useRef } from "react";
import { useWeather } from "../scene/useWeather";
import { seasonOf, WEATHER_LABEL } from "../scene/weather";
import { chat } from "../state/events";
import { Icon, weatherIcon } from "./icons";

/** Weather and season chip at the end of the top bar; announces changes as a message. */
export function WeatherChip() {
  const weather = useWeather();
  const last = useRef(weather);
  useEffect(() => {
    if (last.current !== weather) {
      chat(weather === "rain" ? "Rain begins to fall." : weather === "fog" ? "A fog rolls in from the water." : weather === "storm" ? "Thunder rolls. The exam-week storm is here." : weather === "cloudy" ? "Clouds gather overhead." : "The sky clears.");
      last.current = weather;
    }
  }, [weather]);
  const season = seasonOf(new Date());
  return (
    <span className="rs-weather" title={`${WEATHER_LABEL[weather].label} · ${season}`}>
      <Icon name={weatherIcon(weather)} /> <span className="label">{WEATHER_LABEL[weather].label}</span>
    </span>
  );
}
