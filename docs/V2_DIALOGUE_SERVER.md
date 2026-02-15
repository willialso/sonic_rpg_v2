# V2 Dialogue Server (LLM Pipeline v3)

This server powers `DYNAMIC_FLAVOR` dialogue in `sonic_rpg_v2` while keeping critical gameplay dialogue deterministic.
The runtime now uses a modular provider-agnostic orchestration stack in `server/llm/`.

## Run

- Copy `.env.example` to `.env` and set API keys.
- Build retrieval index once:
  - `npm run build:index`
- Start API server:
  - `npm run dev:api`
- Start full local stack:
  - `npm run dev:full`

## Routing model

- `SYSTEM_SAFETY` -> hard abort (scripted)
- `CRITICAL_SCRIPTED` -> deterministic scripted graph
- `HINT_PRIORITY` -> deterministic scripted hint lines
- `DYNAMIC_FLAVOR` -> `/api/dialogue` LLM path with fallback

## Reliability controls

- Request throttle: `LLM_THROTTLE_MS`
- Response cache (TTL): `LLM_CACHE_TTL_MS`
- Exponential cooldown after provider `429`: `LLM_MAX_BACKOFF_MS`
- One-pass style regeneration under `LLM_STYLE_THRESHOLD`
- Provider failover via adapter router (`PRIMARY_PROVIDER`)
- Interaction and correction dataset logging:
  - `data/logs/interaction_log.jsonl`
  - `data/training/voice_correction_candidates.jsonl`

## API endpoints

- `POST /api/dialogue` -> returns `{ npc_text, intent, time_cost_seconds, suggested_state_effects, source }`
- `GET /api/dialogue/health` -> provider/config/cache/cooldown status
- `GET /api/dialogue/quality` -> source rates, style metrics, correction signals
- `GET /api/dialogue/metrics` -> alias of quality endpoint for dashboards
