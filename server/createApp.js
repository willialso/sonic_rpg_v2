import express from "express";
import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import cors from "cors";
import { validateDialogueRequest } from "./llm/validators.js";

function setStaticCacheHeaders(res, filePath) {
  const normalizedPath = String(filePath || "").replace(/\\/g, "/");
  if (normalizedPath.endsWith("/index.html")) {
    res.setHeader("Cache-Control", "no-cache");
    return;
  }

  // Vite build assets are content-hashed; they are safe to cache aggressively.
  if (/\/assets\/.+-[A-Za-z0-9_-]{6,}\.(js|css)$/.test(normalizedPath)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }

  // Character/background images are large and dominate first-interaction latency.
  if (/\/assets\/images\/.+\.(webp|png|jpe?g|gif|svg)$/i.test(normalizedPath)) {
    res.setHeader("Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
    return;
  }

  if (/\/content\/.+\.json$/i.test(normalizedPath)) {
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=3600");
}

function buildApiCorsOptions() {
  const configured = String(
    process.env.CORS_ALLOWED_ORIGINS
    || process.env.FRONTEND_ORIGIN
    || ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowAll = configured.length === 0;
  const allowed = new Set(configured);

  return {
    origin(origin, callback) {
      if (!origin || allowAll || allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS policy"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400
  };
}

export function createApp(orchestrator) {
  const app = express();
  const distDir = path.join(process.cwd(), "dist");
  const indexHtmlPath = path.join(distDir, "index.html");
  const apiCorsOptions = buildApiCorsOptions();
  app.use(compression());
  app.use("/api", cors(apiCorsOptions));
  app.options(/^\/api(?:\/.*)?$/, cors(apiCorsOptions));
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
    app.use(express.static(distDir, { setHeaders: setStaticCacheHeaders }));
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
