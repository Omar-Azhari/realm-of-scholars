import { useMemo } from "react";
import { useMotionPreference } from "../../hooks/useMotionPreference";

interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
}

/**
 * Decorative, non-interactive background particle drift. Positions are
 * randomised once per mount (not on every render) via useMemo. Renders
 * nothing at all under reduced motion — there's no static fallback because a
 * field of motionless dots adds visual noise without the effect it exists for.
 */
export function ParticleField({ count = 24 }: { count?: number }) {
  const reduceMotion = useMotionPreference();

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, (_, id) => ({
        id,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 3,
        delay: Math.random() * 6,
        duration: 10 + Math.random() * 10,
      })),
    [count]
  );

  if (reduceMotion) return null;

  return (
    <div className="particle-field" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="particle"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
