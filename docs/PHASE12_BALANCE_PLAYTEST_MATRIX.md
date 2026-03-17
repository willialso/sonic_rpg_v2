# Phase 1/2 Balance Playtest Matrix

## Scope
Constants/messages-only tuning pass after orientation-first flow and route-gating fixes.

## Tuned values (current patch)
- Frat full-match time cost: `50s -> 45s`
- Beer pong shot costs:
  - `safe: 30s -> 28s`
  - `bank: 40s -> 38s`
  - `hero: 55s -> 50s`
- Hint cost: `8s -> 6s`
- Trick route (Security Schedule in Dorm Room) time cost: `10s -> 14s`
- Under-threshold handcuffs:
  - failure time penalty: `28s -> 22s`
  - fail threshold: `0.55 -> 0.48` (higher success chance while still risky)

## Message polish goals
- Stadium entry failure now states missing setup explicitly:
  - not following
  - missing escort-readiness/alternate mode
  - generic security block fallback
- Handcuffs failure now suggests concrete fallback options.

## Playtest runs (recommended)
1. **Golden route (booze)**
   - Goal: verify baseline win remains reliable and fast.
2. **Alternate A (handcuffs)**
   - Goal: verify high-risk viability without feeling pure RNG punishment.
3. **Alternate B (VIP schedule trick)**
   - Goal: verify non-booze route is valid but not trivial.
4. **Pressure run (low-time)**
   - Goal: ensure hints and recommendation strip support clutch decisions.
5. **Failure-learning run**
   - Goal: verify fail messages clearly explain recovery path.

## QA telemetry to capture per run
- Win/loss
- Route used
- Time remaining at resolution
- Warning totals at resolution
- Confusion points (where player guessed instead of deciding)
- “Felt fair?” quick rating (1-5)

## Export workflow
- End each run, then open **Menu -> Utilities**.
- Use **Export Run Log** for single-run JSON.
- Use **Export All Logs** after all 5 runs to get one combined JSON bundle.
