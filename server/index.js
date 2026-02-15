import "dotenv/config";
import { config } from "./llm/config.js";
import { DialogueOrchestrator } from "./llm/orchestrator.js";
import { createApp } from "./createApp.js";

const orchestrator = new DialogueOrchestrator();
await orchestrator.init();
const app = createApp(orchestrator);

app.listen(config.apiPort, () => {
  console.log(`V2 API server running on port ${config.apiPort} with pipeline ${config.llmPipelineVersion}`);
});
