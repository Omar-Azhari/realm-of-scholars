import { execSync } from "node:child_process";
import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

/** Commit hash when a git repo is present; "local" otherwise (RC1 metadata). */
function commitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Serves api/realm/curriculum.ts during `npm run dev`, so curriculum
 * research works locally without `vercel dev`. Production uses the same
 * file as a Vercel function.
 */
function realmApiDev(): Plugin {
  return {
    name: "realm-api-dev",
    configureServer(server) {
      for (const route of ["curriculum", "study", "calendar", "lecture", "assessment-feedback"]) server.middlewares.use(`/api/realm/${route}`, async (req, res) => {
        try {
          const mod = (await server.ssrLoadModule(`/api/realm/${route}.ts`)) as {
            GET?: () => Promise<Response>;
            POST: (request: Request) => Promise<Response>;
          };
          let response: Response;
          if (req.method === "POST") {
            const body = await readBody(req);
            const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": req.socket.remoteAddress ?? "local" });
            response = await mod.POST(new Request(`http://localhost/api/realm/${route}`, { method: "POST", headers, body }));
          } else if (mod.GET) {
            response = await mod.GET();
          } else {
            response = new Response(JSON.stringify({ error: "method" }), { status: 405, headers: { "content-type": "application/json" } });
          }
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "upstream", message: error instanceof Error ? error.message : "Dev API error" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make ANTHROPIC_API_KEY from .env / .env.local visible to the dev API.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

  return {
    plugins: [react(), realmApiDev()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __COMMIT_HASH__: JSON.stringify(commitHash()),
    },
  };
});
