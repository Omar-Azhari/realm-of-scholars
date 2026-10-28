/**
 * Bundles a verification harness script for plain Node execution. Not part
 * of the app build — see the target script's own header comment for why.
 *
 * Usage: node scripts/build-verify-harness.mjs <entry.ts> <outfile.cjs>
 * Defaults to the Phase 18A harness if no args are given.
 */
import * as esbuild from "esbuild";

const entry = process.argv[2] ?? "scripts/verify-phase18a-import.ts";
const outfile = process.argv[3] ?? ".tmp/verify-phase18a-import.cjs";

/** Stubs Vite's `?url` asset-import syntax, which only pdfExtract.ts uses (for its worker URL) — the harness never executes that real code path, so an empty string is a safe stand-in purely to satisfy bundling. */
const viteUrlAssetStub = {
  name: "vite-url-stub",
  setup(build) {
    build.onResolve({ filter: /\?url$/ }, (args) => ({ path: args.path, namespace: "vite-url-stub" }));
    build.onLoad({ filter: /.*/, namespace: "vite-url-stub" }, () => ({
      contents: "export default '';",
      loader: "js",
    }));
  },
};

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  // Bundle only our own relative-path source; leave every npm package
  // (mammoth, jszip, pdfjs-dist) to Node's real require/resolve at runtime.
  // Inlining pdfjs-dist in particular breaks its own Node-environment
  // self-polyfilling (DOMMatrix/Path2D) once bundled alongside everything
  // else — it needs to run as a genuine, unbundled Node module.
  packages: "external",
  outfile,
  plugins: [viteUrlAssetStub],
  logLevel: "info",
});
