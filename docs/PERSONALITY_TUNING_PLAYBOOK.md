# Personality Tuning Playbook

Use this workflow to refine character traits without destabilizing dialogue quality.

## Principle

Tune personality through structured contracts and regression checks, not ad-hoc prompt edits.

## Files that matter

- `src/dialogue/CharacterContracts.ts`: source of truth for persona/tone/styleMarkers.
- `data/personality_test_cases.baseline.json`: gated regression prompts (release gate).
- `data/personality_test_cases.experimental.json`: generated/experimental prompts (advisory).
- `data/character_contracts.test.json`: runtime contract snapshot used by tuning harness.
- `scripts/personality_tune_harness.js`: test runner that evaluates trait compliance.
- `data/logs/personality_tuning_report.json`: generated score/failure report.

## Safe tuning workflow

1. Pick one character and one dimension only (for example: Sonic sarcasm sharpness).
2. Update `CharacterContracts.ts`.
3. Mirror the same trait changes in `data/character_contracts.test.json`.
4. Run personality harness:
   - `npm run tune:personality -- --character sonic`
5. Inspect report in `data/logs/personality_tuning_report.json`.
6. If pass rate or average score regresses, revert and retune smaller.

## Harness commands

- Live API mode (requires `npm run dev:api` running):
  - `npm run tune:personality`
- Gate mode (must pass):
  - `npm run tune:personality:gate`
- Experimental mode (advisory, non-blocking):
  - `npm run tune:personality:exp`
- Single character:
  - `npm run tune:personality -- --character tails`
- Custom threshold:
  - `npm run tune:personality -- --threshold 64`
- Fixture mode (no API call):
  - `npm run tune:personality:fixture`
- Auto-generate new cases from recent logs:
  - `npm run tune:cases:update`
  - Optional controls:
    - `npm run tune:cases:update -- --minStyle 80 --maxPerCharacter 3 --logLimit 3000`
    - dry run: `npm run tune:cases:update -- --write false`

## Reading failures

Common reason categories:

- `missing_character_markers`: reply drifted from style markers.
- `missing_intent_*`: must-include intent guidance not reflected.
- `weak_location_anchor`: line ignored scene/location cues.
- `missing_required_pattern:*`: failed character-specific personality regex check.
- `hit_forbidden_pattern:*`: used banned phrase/tone.

Prioritize fixing repeated top reasons instead of tweaking many traits at once.

## Log-derived case generation

`tune:cases:update` scans `data/logs/interaction_log.jsonl` and appends new cases to `data/personality_test_cases.experimental.json` with dedupe safeguards:

- uses only high-quality rows (`llm`, `llm_regen`, `cache`) above `minStyle`
- skips synthetic greeting probes
- dedupes by `character_id + player_input`
- caps generated cases per character

This keeps your regression suite aligned with real gameplay behavior over time.

### Promotion rule

- Keep `baseline` stable and strict.
- Generate into `experimental`.
- Promote only selected high-signal cases from `experimental` into `baseline` after review.

## Recommended tuning cadence

- Target >= 85% pass rate on selected character before broad rollout.
- Keep score threshold between 60-68.
- Land one character per PR to reduce regression risk.
