# Phase 1/2 Balance Playtest Matrix

## Scope
Constants/messages-only tuning pass after orientation-first flow and route-gating fixes.

## Tuned values (current patch)
- Frat full-match time cost: `50s -> 40s`
- Beer pong shot costs:
  - `safe: 30s -> 28s`
  - `bank: 40s -> 38s`
  - `hero: 55s -> 50s`
- Hint cost: `8s -> 6s`
- Trick route (Security Schedule in Dorm Room) time cost: `10s -> 12s`
- Under-threshold handcuffs:
  - failure time penalty: `28s -> 18s`
  - fail threshold: `0.55 -> 0.48` (higher success chance while still risky)
- Move cost:
  - no map: `15s -> 12s`
  - with map: `10s -> 8s`
- Campus map read cost: `8s -> 6s`
- Escort sobering trigger chance per move while following:
  - `38% -> 22%` (less random slip-away churn)

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
- End each run, then open **Menu -> Telemetry & Logs**.
- Use **Export Run Log** for single-run JSON.
- Use **Export All Logs** after all 5 runs to get one combined JSON bundle.
- The bundle now includes `tuningSnapshot` for the latest 5 runs (win rate, unresolved setup count, average time left, most common route mode).
