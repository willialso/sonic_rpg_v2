import "dotenv/config";
import http from "node:http";
import { config } from "./llm/config.js";
import { DialogueOrchestrator } from "./llm/orchestrator.js";
import { validateDialogueRequest } from "./llm/validators.js";

process.on("uncaughtException", (err) => console.error("Uncaught API exception:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled API rejection:", err));

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

async function main() {
  console.log("Initializing dialogue orchestrator...");
  const orchestrator = new DialogueOrchestrator();
  await orchestrator.init();
  console.log("Dialogue orchestrator ready.");

  const host = process.env.API_HOST || "127.0.0.1";
  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const url = new URL(req.url || "/", `http://${host}:${config.apiPort}`);

    if (method === "POST" && url.pathname === "/api/dialogue") {
      try {
        const body = await readJsonBody(req);
        const validation = validateDialogueRequest(body || {});
        if (!validation.ok) {
          sendJson(res, 400, { ok: false, error: "invalid_request", issues: validation.issues });
          return;
        }
        try {
          const payload = await orchestrator.execute(validation.value);
          sendJson(res, 200, payload);
        } catch (err) {
          console.error("Dialogue execution failed:", err);
          sendJson(res, 200, {
            npc_text: String(validation.value?.fallback_text || "Stay sharp."),
            intent: String(validation.value?.intent || "flavor"),
            time_cost_seconds: 0,
            suggested_state_effects: { fallback_reason: "server_execution_failed" },
            source: "fallback"
          });
        }
      } catch (err) {
        const message = String(err?.message || "");
        if (message === "invalid_json") {
          sendJson(res, 400, { ok: false, error: "invalid_json" });
          return;
        }
        if (message === "body_too_large") {
          sendJson(res, 413, { ok: false, error: "payload_too_large" });
          return;
        }
        sendJson(res, 500, { ok: false, error: "request_processing_failed" });
      }
      return;
    }

    if (method === "GET" && url.pathname === "/api/dialogue/health") {
      sendJson(res, 200, orchestrator.health());
      return;
    }

    if (method === "GET" && (url.pathname === "/api/dialogue/quality" || url.pathname === "/api/dialogue/metrics")) {
      const limit = Number(url.searchParams.get("limit") || 2000);
      const payload = await orchestrator.quality(limit);
      sendJson(res, 200, payload);
      return;
    }

    if (method === "POST" && url.pathname === "/api/dialogue/refresh") {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { ok: false, error: "invalid_json" });
        return;
      }
      const characterId = String(body?.character_id || "").trim().toLowerCase();
      if (!characterId) {
        sendJson(res, 400, { ok: false, error: "invalid_request", message: "character_id is required" });
        return;
      }
      const cleared = orchestrator.clearCharacterCache(characterId);
      sendJson(res, 200, { ok: true, character_id: characterId, cleared });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  });

  server.on("error", (err) => {
    console.error("V2 API server failed to start:", err);
    process.exit(1);
  });

  server.listen(config.apiPort, host, () => {
    console.log(`V2 API server running on ${host}:${config.apiPort} with pipeline ${config.llmPipelineVersion}`);
  });
}

main().catch((err) => {
  console.error("Fatal API bootstrap error:", err);
  process.exit(1);
});
