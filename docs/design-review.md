# EGA orbital experience — review and implementation

Reviewed and refined locally on 22 September 2026. The existing Three.js experience and local imagery were retained.

## What the initial captures showed

1. **Hero — needed refinement.** The long heading occupied most of the viewport. Earth's atmosphere rendered as a broad blue shell, while a dense, bright starfield competed with the content. [Original capture](01-hero-before.png).
2. **Spacecraft — needed refinement.** Continuous rotation exposed blank array backs. The HUD overlapped the spacecraft, and navigation dimmed to 25% opacity. [Original capture](02-spacecraft-before.png).
3. **Anatomy — needed refinement.** The heading and satellite occupied the same space, and the only way to reveal components was extended scrolling. [Original capture](03-anatomy-before.png).

## Completed journey

1. **Earth hero — verified.** Shorter display heading, original brand message as supporting copy, more deliberate spacing, a thinner atmospheric limb, masked night lighting, and a calmer starfield. [Capture](04-hero-after.png).
2. **Mission and orbital paths — verified.** Stable inclined paths, moving markers, selectable path emphasis, and active chapter navigation. Phone globe placement is calculated from the actual text height to avoid overlap. [Desktop](06-mission-after.png) · [320px phone](08-mobile-mission.png).
3. **Spacecraft — verified.** Stable viewing angle; fine solar-cell detail; physically lit metal; folded insulation geometry; dish supports, structural fasteners, radiator fins, and cabling. Telemetry now has a separate row. Specifications are identified as illustrative rather than a live feed. [Capture](05-spacecraft-after.png).
4. **Anatomy — verified.** Scroll-driven assembly plus a keyboard-operable slider. Labels have ordered columns and leader lines attached to the actual components. All solar arrays fit within the tested phone viewport. [Desktop](07-anatomy-after.png) · [Phone](09-mobile-anatomy.png).
5. **Materials — verified.** Clearer card hierarchy, corrected statistic font sizing, readable alloy lists, and working local images. Unsupported launch-cost and satellite-composition figures were removed. [Capture](10-materials-after.png).
6. **Closing and return — verified.** Earth sits below the closing copy, and Return to Earth restores the hero and moves keyboard focus to the main content. [Capture](11-outro-after.png).

## Interaction and implementation checks

- Desktop browser and phone layouts at 390×844 and 320×720.
- Navigation, active chapter state, mobile menu open/close, and return navigation.
- Orbit selection and deselection; pause/resume control state.
- Assembly slider input and keyboard Home key; reverse assembly transition.
- Both content images loaded; no horizontal overflow at the tested phone widths.
- No browser error/warning logs in the final inspected session.
- `node --check js/main.js`, `node --check js/interface.js`, and `git diff --check` pass.

Motion is frame-rate independent, rendering stops in hidden tabs, device pixel ratio is capped, and unused GSAP scripts are no longer loaded. Repeated fasteners use instancing. Label widths are measured on resize rather than every animation frame.

Reduced-motion preferences are handled in CSS and JavaScript. Navigation loads independently from the scene, with a content fallback if WebGL initialization fails. These fallback branches were reviewed in source; OS reduced-motion switching and an actual WebGL-loss scenario were not simulated. This is a visual/interaction review, not a complete accessibility certification or cross-device performance benchmark. The spacecraft remains a conceptual procedural model, not an engineering-validated simulation.

## Preview

Run from the project root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000. No build step or package installation is required.

## Background refinement

Added three sparse star layers with approximately 1–2.6px point sizes, varying brightness and gentle depth-dependent scroll/pointer parallax. Density scales with viewport area. Stars remain visible between the material cards, and the existing pause/reduced-motion controls apply to their movement.

A locally stored, AI-generated distant galaxy appears during the mission chapter and fades away on the spacecraft approach. Its position adapts on phones to stay above the mission copy. Desktop/mobile appearance, pause/resume, the spacecraft transition, and browser console were checked. The star layers use three draw calls; the galaxy adds one only while visible.
