import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { assetUrl } from "./manifestTypes";
import type { AssetManifest, SceneDef, SpriteAsset } from "./manifestTypes";

/**
 * Loads public/assets/manifest.json plus every sprite asset it references,
 * and exposes them to the scene components. This is the only place the app
 * touches asset files — everything below it renders from the loaded data.
 */

export type AssetStatus = "loading" | "ready" | "error";

interface AssetStore {
  status: AssetStatus;
  manifest: AssetManifest | null;
  sprites: Record<string, SpriteAsset>;
  error: string | null;
}

const AssetContext = createContext<AssetStore>({
  status: "loading",
  manifest: null,
  sprites: {},
  error: null,
});

export function AssetProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AssetStore>({
    status: "loading",
    manifest: null,
    sprites: {},
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const manifestResponse = await fetch(assetUrl("manifest.json"));
        if (!manifestResponse.ok) {
          throw new Error(`manifest.json: HTTP ${manifestResponse.status}`);
        }
        const manifest = (await manifestResponse.json()) as AssetManifest;

        const spriteEntries = Object.entries(manifest.sprites ?? {});
        const spritePairs = await Promise.all(
          spriteEntries.map(async ([id, path]) => {
            const response = await fetch(assetUrl(path));
            if (!response.ok) {
              throw new Error(`${path}: HTTP ${response.status}`);
            }
            return [id, (await response.json()) as SpriteAsset] as const;
          })
        );

        if (!cancelled) {
          setStore({
            status: "ready",
            manifest,
            sprites: Object.fromEntries(spritePairs),
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setStore({
            status: "error",
            manifest: null,
            sprites: {},
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Friendly full-screen recovery when the art manifest can't load — without
  // it every scene would skeleton forever (RC1 Part 6). No technical details
  // shown; the specific failure is logged for developers.
  if (store.status === "error") {
    console.error("UniGame asset loading failed:", store.error);
    return (
      <div className="app-error-panel" role="alert">
        <h1>UniGame couldn't load its artwork</h1>
        <p>
          The campus art files didn't arrive — usually a connection hiccup or an interrupted
          update. Your saved progress is safe on this device.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  return <AssetContext.Provider value={store}>{children}</AssetContext.Provider>;
}

export function useAssets(): AssetStore {
  return useContext(AssetContext);
}

export function useSceneDef<T extends SceneDef>(sceneId: string): T | null {
  const { manifest } = useAssets();
  const scene = manifest?.scenes?.[sceneId];
  return (scene as T | undefined) ?? null;
}

export function useSprite(spriteId: string): SpriteAsset | null {
  const { sprites } = useAssets();
  return sprites[spriteId] ?? null;
}
