# Orientation Video Integration Spec

## Goal
Replace the hard-gated Dean intake opener with an orientation cinematic that clearly sets mission intent while preserving challenge.

## Current integration points
- Landing close flow: `src/App.tsx` (`closeLandingPage`)
- Orientation modal placeholder: `src/App.tsx` (`orientationIntroOpen` render block)
- Mission/ID issuance action: `src/app/useGameController.ts` (`COMPLETE_ORIENTATION_INTRO`)

## Asset contract (placeholder phase)
- Recommended file path: `public/media/orientation_intro.mp4`
- Aspect ratio target: `16:9` (mobile-safe center framing)
- Duration target: `45-75s`
- Audio: normalized VO + light underscore
- Captions: optional VTT sidecar (`orientation_intro.vtt`)

## Required speech beats
1. **Premise:** Console University mission intake.
2. **Primary objective:** Get Sonic to Stadium before the clock expires.
3. **Player pathways:** booze route, handcuffs route, trick/social route.
4. **Constraints:** Student ID must stay valid; warnings and bans can kill the run.
5. **Immediate next step:** gather clues, search smart, commit to one route.

## Post-video gameplay state requirements
- Student ID granted
- Mission objective/sub-objective set
- Phase transitions to hunt
- Player relocated to Quad
- Core search lanes unlocked for early momentum

## UX requirements
- Single clear CTA: **Issue ID and Start Mission**
- Skip/close should still complete mission intake (avoid dead-end onboarding)
- Overlay must block underlying interaction while active
