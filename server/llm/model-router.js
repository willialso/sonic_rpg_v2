import { config } from "./config.js";
import { sleep } from "./shared.js";

function isTransientStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(Number(status || 0));
}

function normalizeErrorReason(err) {
  const status = Number(err?.status || 0);
  if (status === 429) return "quota_429";
  if (status > 0) return `http_${status}`;
  const message = String(err?.message || "").toLowerCase();
  if (message.includes("aborted")) return "transport_timeout_abort";
  if (message.includes("terminated")) return "transport_terminated";
  if (message.includes("fetch failed")) return "transport_fetch_failed";
  if (message.includes("econnreset")) return "transport_conn_reset";
  if (message.includes("etimedout")) return "transport_timeout";
  if (message.includes("enotfound")) return "transport_dns_not_found";
  if (err?.code) return String(err.code).toLowerCase();
  return "unknown_error";
}

function isTransientTransportError(err) {
  const status = Number(err?.status || 0);
  if (isTransientStatus(status)) return true;
  const reason = normalizeErrorReason(err);
  return [
    "transport_timeout_abort",
    "transport_terminated",
    "transport_fetch_failed",
    "transport_conn_reset",
    "transport_timeout",
    "transport_dns_not_found"
  ].includes(reason);
}

export class ModelRouter {
  constructor({ openaiAdapter, geminiAdapter }) {
    this.openai = openaiAdapter;
    this.gemini = geminiAdapter;
  }

  async callWithRetry(adapter, prompt) {
    let lastError = null;
    for (let attempt = 0; attempt <= config.transientRetries; attempt += 1) {
      try {
        return await adapter.complete(prompt);
      } catch (err) {
        lastError = err;
        if (!isTransientTransportError(err) || attempt >= config.transientRetries) {
          throw err;
        }
        const backoff = Math.min(1800, 250 * (2 ** attempt));
        await sleep(backoff);
      }
    }
    throw lastError || new Error("provider_retry_exhausted");
  }

  providerOrder(options = {}) {
    const primary = config.primaryProvider === "gemini" ? "gemini" : "openai";
    const ordered = primary === "openai"
      ? [this.openai, this.gemini]
      : [this.gemini, this.openai];
    if (options.criticalPath) return ordered;
    return ordered.slice(0, 1);
  }

  async complete(prompt, options = {}) {
    let firstError = null;
    let lastError = null;
    for (const adapter of this.providerOrder(options)) {
      if (!adapter?.isConfigured?.()) continue;
      try {
        if (options.fastPath) {
          return await adapter.complete(prompt);
        }
        return await this.callWithRetry(adapter, prompt);
      } catch (err) {
        if (!firstError) firstError = err;
        lastError = err;
      }
    }
    throw firstError || lastError || new Error("NO_PROVIDER_AVAILABLE");
  }

  normalizeErrorReason(err) {
    return normalizeErrorReason(err);
  }
}
