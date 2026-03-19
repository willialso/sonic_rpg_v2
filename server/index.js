async function bootstrapEnv() {
  try {
    await import("dotenv/config");
  } catch (error) {
    const missingDotenv = (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "ERR_MODULE_NOT_FOUND"
      && String(error?.url || error?.message || "").includes("dotenv")
    );
    if (missingDotenv) {
      console.warn("dotenv not found. Starting API without .env preload.");
      return;
    }
    throw error;
  }
}

async function main() {
  await bootstrapEnv();
  const [{ config }, { DialogueOrchestrator }, { createApp }] = await Promise.all([
    import("./llm/config.js"),
    import("./llm/orchestrator.js"),
    import("./createApp.js")
  ]);
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
