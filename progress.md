# ORBITAL — Parallax Earth / Satellite Showcase

## What this is
A cinematic single-page scroll experience: a spinning 3D Earth, coloured orbit
lines, and a procedural satellite (AL-01) that zooms in and explodes into its
individual components as you scroll. Content theme: satellites, space, and
aluminium in spacecraft. Fully static site — no build step, deploys anywhere
(Vercel-ready as-is).

## Status: v1 complete and verified (2026-07-06)

### Journey (scroll phases)
1. **Hero** — Earth horizon fills the bottom, slow spin, headline over stars.
2. **Mission** — pull back to full globe; three coloured orbit lines fade in
   (PREVENTION purple / REMOVAL orange / REUSE green, dots travelling along).
3. **Spacecraft** — Earth steps aside; AL-01 rises and the camera zooms in;
   glass HUD cards (speed / altitude / targets / intercept).
4. **Anatomy** — satellite centres, then explodes outward: 6 bus plates,
   solar wings, dish, tank, reaction wheels, thruster, radiators, internal
   electronics. Floating glass labels track each part in 3D.
5. **Materials** — bento grid: aluminium stats, two AI-generated images
   (satellite photo + honeycomb macro via fal.ai GPT-Image), alloy manifest.
6. **Outro** — satellite departs, Earth rises again. "Look up."

### Tech
- Three.js r160 + GSAP 3.12 (ScrollTrigger only for text reveals) — all
  vendored locally in `js/vendor/`, textures in `assets/textures/` (NASA
  Blue Marble + night lights + clouds).
- Scroll → 3D driven by a **custom stateless phase system** in `js/main.js`
  (`phase()` / `applyPhases()`): ranges measured from element offsets,
  full state recomputed every frame, eased in the render loop.
  *Deliberately NOT GSAP scrub — scrub + immediateRender broke on
  load-at-scroll-position; CSS `scroll-behavior: smooth` also removed
  because it corrupts ScrollTrigger measurements (JS smooth anchors instead).*
- Fonts: Space Grotesk + IBM Plex Mono (Google Fonts).
- Palette: deep navy `#020609`, cyan `#7fd8e8`, glass borders
  `rgba(169,224,255,.14)`, accents purple/orange/green.

### Verified
- All 6 phases screenshot-checked in preview (portrait + 1440px desktop).
- No console errors/warnings. Loads correctly at any scroll position.

## Run locally
`python3 -m http.server 4173` in project root → http://localhost:4173
(or the "orbital" config in `.claude/launch.json`).

## Possible next steps
- Deploy to Vercel (static — zero config).
- Real mobile-device pass (layout already responsive at <900px).
- Optional: sound design, more content sections, OG/social image.
