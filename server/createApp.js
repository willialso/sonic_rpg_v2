import express from "express";
import fs from "node:fs";
import path from "node:path";
import { validateDialogueRequest } from "./llm/validators.js";

export function createApp(orchestrator) {
  const app = express();
  const distDir = path.join(process.cwd(), "dist");
  const indexHtmlPath = path.join(distDir, "index.html");
  app.use(express.json({ limit: "1mb" }));

  // Silence browser default favicon probe when no .ico is packaged.
  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });

  app.post("/api/dialogue", async (req, res) => {
    const validation = validateDialogueRequest(req.body || {});
    if (!validation.ok) {
      res.status(400).json({
        ok: false,
        error: "invalid_request",
        issues: validation.issues
      });
      return;
    }
    try {
      const payload = await orchestrator.execute(validation.value);
      res.json(payload);
    } catch (err) {
      // Keep dialogue lane resilient: return safe fallback instead of surfacing 500 to client.
      console.error("Dialogue execution failed:", err);
      res.json({
        npc_text: String(validation.value?.fallback_text || "Stay sharp."),
        intent: String(validation.value?.intent || "flavor"),
        time_cost_seconds: 0,
        suggested_state_effects: { fallback_reason: "server_execution_failed" },
        source: "fallback"
      });
    }
  });

  app.get("/api/dialogue/health", (req, res) => {
    res.json(orchestrator.health());
  });

  app.get("/api/dialogue/quality", async (req, res) => {
    const limit = Number(req.query.limit || 2000);
    res.json(await orchestrator.quality(limit));
  });

  app.post("/api/dialogue/refresh", (req, res) => {
    const characterId = String(req.body?.character_id || "").trim().toLowerCase();
    if (!characterId) {
      res.status(400).json({
        ok: false,
        error: "invalid_request",
        message: "character_id is required"
      });
      return;
    }
    const cleared = orchestrator.clearCharacterCache(characterId);
    res.json({
      ok: true,
      character_id: characterId,
      cleared
    });
  });

  app.get("/api/dialogue/metrics", async (req, res) => {
    const limit = Number(req.query.limit || 2000);
    res.json(await orchestrator.quality(limit));
  });

  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(indexHtmlPath);
    });
  }
  return app;
}
