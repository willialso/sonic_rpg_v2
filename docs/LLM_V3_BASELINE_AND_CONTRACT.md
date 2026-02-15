# LLM v3 Contract Freeze and Baseline

This file freezes the `POST /api/dialogue` contract and tracks baseline quality/latency metrics for migration validation.

## Frozen request contract

```json
{
  "character_id": "sonic",
  "player_input": "Where is the fastest route?",
  "fallback_text": "Optional fallback line",
  "intent": "HELP_ROUTE",
  "function_id": "HELP_ROUTE",
  "intent_context": {
    "goal": "Help player move Sonic to stadium",
    "must_include": ["route", "stadium"],
    "avoid": ["question ending"],
    "character_contract": {}
  },
  "game_context": {
    "location": "quad",
    "time_remaining_sec": 420,
    "pressure": "tight",
    "sonic_drunk_level": 2,
    "sonic_following": false,
    "npc_encounter_count": 3,
    "npc_intent_state": {},
    "route_flags": {},
    "action_affordances": {},
    "inventory": [],
    "recent_turns": [],
    "progressive_context": {}
  }
}
```

## Frozen response contract

```json
{
  "npc_text": "Move now. Take route B and keep pressure.",
  "intent": "HELP_ROUTE",
  "time_cost_seconds": 0,
  "suggested_state_effects": {},
  "source": "llm",
  "style_score": 78,
  "provider": "openai",
  "display_speaker": "Diesel",
  "latency_ms": 312
}
```

## Baseline capture

- Run: `npm run llm:baseline`
- Output file: `data/logs/llm_baseline_v2.json`
- Metrics captured: source distribution, p50/p95 latency, average latency, correction rows.

## Migration parity gates

- P95 latency within 10% of baseline.
- Fallback/cooldown rate within 5% of baseline.
- Average style score does not regress beyond 5%.
