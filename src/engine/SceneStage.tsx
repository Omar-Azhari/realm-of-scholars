import type { ReactNode } from "react";
import { assetUrl } from "./manifestTypes";
import type { AtmosphereDef, DayPhase, LightDef, ParticleDef, SceneBase } from "./manifestTypes";
import { AmbientLayer } from "./AmbientLayer";
import { useDayPhase } from "./dayPhase";
import { useMotionPreference } from "../hooks/useMotionPreference";

/**
 * The generic scene renderer: background artwork, static prop images,
 * time-of-day atmosphere grading, light sources, ambient movement, and
 * particles — all read from the asset manifest. Dynamic, data-bound content
 * (doors, widgets, actors, hotspots) is layered on top by the scene
 * component via `children`.
 */
export function SceneStage({
  scene,
  children,
}: {
  scene: SceneBase;
  children?: ReactNode;
}) {
  const phase = useDayPhase();
  const atmosphere = scene.atmosphere?.[phase];

  return (
    <div className="hq-stage" style={{ aspectRatio: `${scene.width} / ${scene.height}` }} data-day-phase={phase}>
      <img
        className="scene-background"
        src={assetUrl(scene.background)}
        alt=""
        draggable={false}
      />

      {/* Time-of-day grading tint, over the art but under every dynamic layer */}
      {atmosphere ? (
        <div
          className="scene-atmosphere"
          style={{ background: atmosphere.tint, opacity: atmosphere.tintOpacity }}
          aria-hidden="true"
        />
      ) : null}

      {scene.images.map((image) => (
        <img
          key={image.id}
          className="scene-prop"
          src={assetUrl(image.src)}
          alt=""
          draggable={false}
          style={{
            left: `${(image.x / scene.width) * 100}%`,
            top: `${(image.y / scene.height) * 100}%`,
            width: `${(image.width / scene.width) * 100}%`,
            height: `${(image.height / scene.height) * 100}%`,
            opacity: image.opacity ?? 1,
          }}
        />
      ))}

      <LightLayer
        lights={scene.lights}
        width={scene.width}
        height={scene.height}
        phase={phase}
        atmosphere={atmosphere}
      />
      <AmbientLayer ambience={scene.ambience ?? []} width={scene.width} height={scene.height} />
      {scene.particles ? (
        <ParticleLayer particles={scene.particles} scale={atmosphere?.particleScale ?? 1} />
      ) : null}

      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lights                                                              */
/* ------------------------------------------------------------------ */

function LightLayer({
  lights,
  width,
  height,
  phase,
  atmosphere,
}: {
  lights: LightDef[];
  width: number;
  height: number;
  phase: DayPhase;
  atmosphere: AtmosphereDef | undefined;
}) {
  const active = lights.filter((light) => !light.phases || light.phases.includes(phase));
  if (active.length === 0) return null;
  const lightScale = atmosphere?.lightScale ?? 1;
  const opacityOf = (light: LightDef) => Math.min(1, light.opacity * lightScale);

  return (
    <svg
      className="scene-overlay-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {active.map((light) =>
          light.type === "cone" ? (
            <linearGradient key={light.id} id={`light-${light.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={light.color} stopOpacity={opacityOf(light)} />
              <stop offset="100%" stopColor={light.color} stopOpacity="0" />
            </linearGradient>
          ) : (
            <radialGradient key={light.id} id={`light-${light.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={light.color} stopOpacity={opacityOf(light)} />
              <stop offset="100%" stopColor={light.color} stopOpacity="0" />
            </radialGradient>
          )
        )}
      </defs>
      {active.map((light) =>
        light.type === "cone" ? (
          <polygon
            key={light.id}
            points={`${light.x - light.spreadTop},${light.y} ${light.x + light.spreadTop},${light.y} ${light.x + light.spreadBottom},${light.bottomY} ${light.x - light.spreadBottom},${light.bottomY}`}
            fill={`url(#light-${light.id})`}
          />
        ) : (
          <ellipse
            key={light.id}
            cx={light.x}
            cy={light.y}
            rx={light.rx}
            ry={light.ry}
            fill={`url(#light-${light.id})`}
          />
        )
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */

/** Deterministic pseudo-random in [0, 1) — stable across renders, no stored state. */
function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function ParticleLayer({ particles, scale }: { particles: ParticleDef; scale: number }) {
  const reduceMotion = useMotionPreference();
  if (reduceMotion) return null;
  const count = Math.round(particles.count * scale);
  if (count <= 0) return null;

  return (
    <div className="scene-particles" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const size = particles.minSize + hash01(i * 3 + 1) * (particles.maxSize - particles.minSize);
        return (
          <span
            key={i}
            className="scene-particle"
            style={{
              left: `${hash01(i * 3) * 100}%`,
              top: `${10 + hash01(i * 3 + 2) * 80}%`,
              width: size,
              height: size,
              background: particles.color,
              opacity: particles.opacity,
              animationDuration: `${particles.driftSeconds * (0.7 + hash01(i * 7) * 0.6)}s`,
              animationDelay: `${-hash01(i * 11) * particles.driftSeconds}s`,
            }}
          />
        );
      })}
    </div>
  );
}
