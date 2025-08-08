# Indie Game Plan — "Minute Mage"

A compact, juicy, replayable arena survival game with a unique time-slow dash. Each run lasts ~60–120 seconds, aiming for tight flow, snappy feedback, and strong retention.

## Vision & Hook
- One-more-try loops: fast rounds, escalating tension, visible skill growth.
- Core hook: A satisfying dash that briefly slow-mo’s the world, enabling clutch dodges. Dashing builds a score multiplier but risks cooldown windows.
- Feel: Tactile, responsive, juicy effects (screenshake, particles, poppy SFX).

## Core Loop
1) Move to dodge and collect orbs.
2) Time-slow dash through tight spaces; earn multiplier.
3) Survive waves to push score and difficulty.
4) Die -> instant restart.

## Pillars
- Flow > complexity
- Clarity: readable threats, telegraphed danger
- Juice: constant micro-rewards (sound/particles/multipliers)

## Audience & Platform
- Web desktop first (HTML5 Canvas, keyboard input). Portable to desktop later.

## Scope v1.0 (2–3 weeks)
- Player: movement + dash + brief global slow-mo + cooldown UI.
- Enemies: homing blobs, spawner with difficulty ramp.
- Orbs (score pickups) and multiplier system.
- Game states: title, playing, game over; instant restart.
- Juice: particles, screenshake, hit/collect feedback.
- Minimal art (shapes) and placeholder SFX.

## Stretch (post v1.0)
- Second enemy type (ranged telegraph).
- Upgrades between runs; basic meta-progression.
- Gamepad support and mobile controls.
- Save best score.

## Tech Stack
- HTML5 Canvas 2D, Vanilla JS, no build; runs from a file:// open or a simple static server.
- Optional: Live Server for hot-reload.

## Architecture
- index.html: canvas + scripts.
- src/
  - main.js: bootstraps Game.
  - game.js: loop, states, world update/render.
  - input.js: keyboard state.
  - entities/player.js
  - utils.js: math/helpers.
- assets/: placeholders for sfx/img.

## Milestones & Steps
- M0 — Project setup (Today)
  - [x] Repo structure, base loop, input, player move, basic render.
- M1 — Core mechanic (Time-slow Dash)
  - [x] Implement dash with global timeScale and cooldown UI.
- M2 — Enemies & Scoring
  - [ ] Homing enemies, spawner, collisions, score, multiplier.
- M3 — Juice & UX
  - [ ] Particles, screenshake, hit/collect feedback, simple UI, instant restart.
- M4 — Polish
  - [ ] Difficulty ramp tuning, bugfix, performance pass.

## Risks & Mitigation
- Feel not juicy: bake in timeScale, hitstop, screenshake early; tune frequently.
- Scope creep: lock v1.0 scope to one enemy type.
- Performance: keep draw calls simple; pool objects if needed.

## Definition of Done (v1.0)
- 60–120 sec runs; clear lose condition; replay loop in <2 sec.
- Dash feels powerful and readable; cooldown/multiplier visible.
- Stable 60 FPS on mid-tier laptop in browser.

## Next Actions (up next)
- Implement M2: enemy tuning, collision scoring, multiplier and pickups.
