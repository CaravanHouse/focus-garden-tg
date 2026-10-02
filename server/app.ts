import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { authMiddleware } from "./auth";
import type { Garden } from "./garden";
import { DURATIONS, KINDS } from "../shared/constants";

export function createApp(garden: Garden, botToken: string, devNoAuth: boolean, distDir: string) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));
  app.get("/health", (_q, r) => { r.json({ ok: true }); });

  const api = express.Router();
  api.use(authMiddleware(botToken, devNoAuth));

  api.post("/session/start", (req, res) => {
    const { seconds, kind } = req.body ?? {};
    if (!(DURATIONS as readonly number[]).includes(seconds) || !(KINDS as readonly string[]).includes(kind)) {
      res.status(400).json({ error: "bad_request" }); return;
    }
    const s = garden.start(res.locals.user, seconds, kind);
    res.json({ endsAt: s.endsAt });
  });

  api.post("/session/finish", (_req, res) => {
    const r = garden.finish(res.locals.user);
    if (!r.ok) { res.status(409).json({ error: r.reason }); return; }
    res.json({ trees: r.stat.trees, minutes: r.stat.minutes });
  });

  api.post("/session/abandon", (_req, res) => {
    garden.abandon(res.locals.user);
    res.json({ ok: true });
  });

  api.get("/top", (_req, res) => {
    res.json({ meId: res.locals.user.id, top: garden.top(10).map((s) => ({ id: s.id, name: s.name, trees: s.trees, minutes: s.minutes })) });
  });

  app.use("/api", api);

  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get("*", (_q, r) => { r.sendFile(join(distDir, "index.html")); });
  }
  return app;
}
