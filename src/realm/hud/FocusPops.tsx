/** Floating "+20 Focus" popups whenever studying earns Focus (or playing spends it). */

import { useEffect, useState } from "react";
import { onGameEvent } from "../state/events";
import { Icon } from "./icons";

interface Pop {
  id: number;
  amount: number;
  reason: string;
}

export function FocusPops() {
  const [pops, setPops] = useState<Pop[]>([]);
  useEffect(() => {
    let id = 0;
    return onGameEvent((event) => {
      if (event.type !== "focus" || event.amount <= 0) return;
      const pop = { id: ++id, amount: event.amount, reason: event.reason };
      setPops((list) => [...list.slice(-3), pop]);
      window.setTimeout(() => setPops((list) => list.filter((p) => p.id !== pop.id)), 2600);
    });
  }, []);
  return (
    <div className="rs-focus-pops" aria-live="polite">
      {pops.map((p) => (
        <div key={p.id} className="rs-focus-pop">
          <strong>
            <Icon name="focus" /> +{p.amount} Focus
          </strong>
          <span>for {p.reason}</span>
        </div>
      ))}
    </div>
  );
}
