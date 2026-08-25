# Frontend Agent Guide

Scope: everything under `src/`.

Read the repository-level `AGENTS.md` first. Use this file for frontend-specific constraints.

## Responsibilities

- `components/`: UI rendering and user interaction.
- `hooks/`: lifecycle/state orchestration for speed measurement, connection data, and race animation.
- `lib/`: pure calculations, validation, formatting, evaluation, storage helpers, share-image generation, and race mappings.
- `services/`: calls to Worker APIs and runtime response validation.
- `types/`: domain and boundary types.

Prefer moving deterministic logic out of components and into `lib/` when it improves testability.

## Measurement UI

The application has two different display semantics:

- **Live speed**: deliberately high precision (`toFixed(6)`) for a speedometer-like visual effect.
- **Final speed**: intentionally more readable formatting.

Do not unify these formats unless the task explicitly changes the product behavior.

Measurement phases are meaningful UI states. Avoid changes that accidentally desynchronize:

- latency;
- download;
- upload;
- complete;
- error.

The race currently uses download speed for run duration and upload speed for jump height. See `docs/MEASUREMENT.md` and `docs/UX.md`.

## Race and animation

The race is a core product feature.

The intended visual direction is a lightweight animated horse rather than a heavy video/3D implementation. Preferred approaches:

1. compact SVG poses/frames animated with CSS;
2. small sprite-style assets;
3. CSS `transform`/`opacity` for horizontal movement, body motion, camera movement, and jumping.

Avoid:

- large video assets;
- heavyweight animation frameworks solely for the race;
- continuous React re-render loops for frame animation;
- changing the race into a purely decorative element disconnected from measured values.

Preserve replay behavior and the relationship between measurement phases and race states.

Respect `prefers-reduced-motion` and existing accessibility behavior. If the reduced-motion policy is intentionally changed, document it in `docs/UX.md`.

## Accessibility and responsive UI

- Interactive elements must be keyboard operable.
- Keep useful `aria-live`/status semantics for measurement progress and errors.
- Do not convey quality using color alone.
- Check narrow layouts; the project targets small mobile widths as well as desktop.
- Avoid fixed dimensions that cause overflow at narrow viewport widths.

## Tests

Add or update tests when changing:

- measurement phase behavior;
- speed formatting;
- evaluation thresholds;
- storage behavior;
- race timing/state transitions;
- connection API parsing;
- accessibility-relevant interaction.

Prefer deterministic tests. Avoid assertions that depend on actual internet speed.
