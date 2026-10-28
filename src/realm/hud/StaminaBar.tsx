/** The Shift running boost's stamina: a slim bar that shows only while sprinting or refilling. */

import { useEffect, useRef } from "react";
import { runtime } from "../scene/runtime";

export function StaminaBar() {
  const bar = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const { stamina, sprinting } = runtime.player;
      if (!bar.current || !fill.current) return;
      const show = sprinting || stamina < 0.995;
      bar.current.classList.toggle("on", show);
      bar.current.classList.toggle("low", stamina < 0.15 && !sprinting);
      fill.current.style.transform = `scaleX(${stamina.toFixed(3)})`;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={bar} className="rs-stamina" aria-hidden>
      <span ref={fill} />
    </div>
  );
}
