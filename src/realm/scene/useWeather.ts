import { useEffect, useState } from "react";
import { realmStore, todayIso, useRealm } from "../state/store";
import { inExamPeriod } from "../state/actions";
import { weatherAt, type Weather } from "./weather";

/** The current weather (rechecked every few minutes). Clear when the real-time sky is off. */
export function useWeather(): Weather {
  const realTime = useRealm((s) => s.settings.realTimeSky);
  const compute = () => (realTime ? weatherAt(new Date(), inExamPeriod(realmStore.get().curriculum, todayIso())) : "clear");
  const [weather, setWeather] = useState<Weather>(compute);
  useEffect(() => {
    setWeather(compute());
    const id = window.setInterval(() => setWeather(compute()), 5 * 60_000);
    return () => window.clearInterval(id);
    // compute only depends on realTime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realTime]);
  return weather;
}
