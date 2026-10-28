# UniGame — Deployment Guide

One SPA plus optional serverless functions (`api/`). Realm of Scholars curriculum research needs `ANTHROPIC_API_KEY` (see .env.example and docs/REALM_OF_SCHOLARS.md); without it the game still works. Any static host works for the SPA;
the only two hard requirements everywhere are:

1. **SPA fallback** — every unknown path must serve `index.html` (deep links
   like `/collections` or `/subjects/...` are client-routed).
2. **Split cache rules** — hashed bundles immutable; *unhashed game art*
   (`assets/manifest.json`, `assets/scenes/`, `assets/sprites/`) short-lived.
   Details in `planning/PRODUCTION_BUILD.md`.

Build once, deploy the `dist/` folder:

```bash
npm ci
npm run lint && npm run typecheck
npm run build        # → dist/
```

## Environment variables

There are none. All build metadata (version/commit/timestamp) is injected at
build time from package.json and git. The only build-time knob is Vite's
`base` for subpath hosting (see GitHub Pages).

---

## Vercel

Zero-config plus the repo's `vercel.json` (already contains the rewrite +
cache headers).

- Framework preset: **Vite** · Build: `npm run build` · Output: `dist`
- SPA fallback: handled by the `rewrites` entry in `vercel.json`.
- Cache invalidation: hashed files are immutable; art files max-age 300 —
  nothing to purge manually.
- **Rollback**: Vercel dashboard → Deployments → previous deployment →
  *Promote to Production* (instant, atomic). Tester saves live client-side
  and are unaffected by rollbacks.

## Netlify

- Build: `npm run build` · Publish directory: `dist`
- SPA fallback: `public/_redirects` (already in the repo) ships into `dist`
  → `/* /index.html 200`.
- Cache headers: add a `public/_headers` file if you want the split rules
  (Netlify's defaults are safe-but-conservative):

  ```
  /assets/*.js
    Cache-Control: public, max-age=31536000, immutable
  /assets/*.css
    Cache-Control: public, max-age=31536000, immutable
  /assets/manifest.json
    Cache-Control: public, max-age=300, must-revalidate
  /assets/scenes/*
    Cache-Control: public, max-age=300, must-revalidate
  /assets/sprites/*
    Cache-Control: public, max-age=300, must-revalidate
  ```
- **Rollback**: Deploys → pick an earlier deploy → *Publish deploy*.

## GitHub Pages

Two extra wrinkles: a subpath base and no native SPA fallback.

1. Build with the repo subpath (skip if using a custom apex domain):
   ```bash
   npm run build -- --base=/<repo-name>/
   ```
   `assetUrl()` and index.html links already respect `BASE_URL` — this was
   designed in from the start.
2. SPA fallback: copy `index.html` to `404.html` in the artifact
   (`cp dist/index.html dist/404.html`). GH Pages serves 404.html for
   unknown paths, which boots the router. (Query-string redirect hacks are
   not needed for this app.)
3. Deploy `dist/` to the `gh-pages` branch or via the *actions/deploy-pages*
   workflow.
4. Cache invalidation: GH Pages sets ~10-minute max-age on everything —
   suboptimal for hashed files but safe; nothing to configure.
5. **Rollback**: re-deploy the previous tag (`git checkout v1.0.0-rc.1 &&
   npm ci && npm run build ... `) or revert the gh-pages branch commit.

## Generic static hosting (nginx example)

```nginx
server {
  root /var/www/unigame/dist;
  gzip on; gzip_types text/css application/javascript application/json image/svg+xml;

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    # unhashed game art overrides:
    location ~ ^/assets/(manifest\.json|scenes/|sprites/|audio/) {
      add_header Cache-Control "public, max-age=300, must-revalidate";
    }
  }

  location / {
    try_files $uri /index.html;   # SPA fallback
  }
}
```

Rollback on plain hosting: keep each release in a versioned directory
(`/var/www/unigame/releases/v1.0.0-rc.1/`) and point a `current` symlink at
it; rolling back is re-pointing the symlink.

---

## Post-deploy smoke test (any host, 2 minutes)

1. Open the root URL — HQ renders, no console errors.
2. Open `/collections` **directly** (fresh tab) — must load, not 404.
3. Settings → About shows the version you just deployed.
4. Enter a room, sit at the desk, start/cancel a sprint.
5. Reload — progress persisted.

## Save-data note for every deploy

Saves are in the visitors' browsers, keyed `unigame:saveData:v1` per-origin.
Deploys and rollbacks never touch them — but **changing the hosting domain
does** (different origin = fresh save). Pick the playtest URL once and keep
it; if a domain move is ever unavoidable, have testers use Settings → Export
first (see BACKUP_GUIDE.md).
