import "dotenv/config";
import { config } from "./llm/config.js";
import { DialogueOrchestrator } from "./llm/orchestrator.js";
import { createApp } from "./createApp.js";

async function main() {
  console.log("Initializing dialogue orchestrator...");
  const orchestrator = new DialogueOrchestrator();
  await orchestrator.init();
  console.log("Dialogue orchestrator ready.");

  // Render and other PaaS runtimes require binding to 0.0.0.0.
  const host = process.env.API_HOST || "0.0.0.0";
  const app = createApp(orchestrator);

  const server = app.listen(config.apiPort, host, () => {
    console.log(`V2 API server running on ${host}:${config.apiPort} with pipeline ${config.llmPipelineVersion}`);
  });

  server.on("error", (err) => {
    console.error("V2 API server failed to start:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Fatal API bootstrap error:", err);
  process.exit(1);
});
