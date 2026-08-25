# Speed Checker — Agent Guide

This file is the repository-level map for coding agents. Keep it concise. Detailed product, architecture, measurement, UX, growth, and roadmap context lives under `docs/`.

## Project purpose

Speed Checker is a Japanese web application that measures internet connection quality using Cloudflare's edge network and presents the result in a way that is technically useful, easy to understand, and memorable.

The product is not intended to win by being "another generic speed test." Its differentiation is the combination of:

- real network measurements;
- explainable quality evaluation;
- a lightweight, playful speed-race visualization;
- history/comparison and sharing;
- privacy-conscious implementation.

Read `docs/index.md` before any non-trivial change.

## Source-of-truth rules

- Current runtime behavior: code and tests.
- Product intent and deliberate UX decisions: `docs/PRODUCT.md`, `docs/UX.md`, and `docs/DECISIONS.md`.
- Measurement semantics and units: `docs/MEASUREMENT.md`.
- Technical boundaries and deployment: `docs/ARCHITECTURE.md`.
- Growth/SEO/monetization direction: `docs/GROWTH.md`.
- Future work: `docs/ROADMAP.md`.

If code and docs conflict, do not silently guess which side is correct. Identify the mismatch and resolve it as part of the task or report it.

The roadmap is context, not authorization. Do not implement unrelated roadmap items unless the task asks for them.

## Product invariants

Preserve these unless the task explicitly changes them:

1. Measurement trust is more important than flashy presentation.
2. Do not claim a root cause (Wi-Fi, router, ISP, congestion, device failure, etc.) unless the available measurements justify it.
3. The race visualization is a core product identity, not disposable decoration.
4. The intended race character is a lightweight animated horse. The current human-style runner representation may be replaced as part of that direction.
5. The live speed readout intentionally uses high precision to create a speedometer-like effect. Do not "clean it up" by rounding it merely because six decimal places look excessive.
6. Final/snapshot result formatting is separate from the live speedometer presentation and may be more human-readable.
7. Keep the application lightweight. Prefer CSS transforms/opacity, compact SVG, or small sprite-style animation over video, 3D engines, or large animation dependencies.
8. Do not expose or persist the client's IP address.
9. Measurement history is currently browser-local. Do not add server-side tracking/storage without an explicit product and privacy decision.
10. A custom domain is planned, but no domain has been selected. Do not invent or hard-code a new production domain.

Production deployment is prohibited unless the user explicitly requests deployment in the current task. Never run npm run deploy, wrangler deploy, npx wrangler deploy, or trigger equivalent VS Code / CI deployment actions autonomously.

## Repository map

- `src/` — React frontend.
  - `components/` — UI components.
  - `hooks/` — measurement and animation orchestration.
  - `lib/` — pure evaluation, formatting, history, sharing, and visualization logic.
  - `services/` — frontend API access and runtime validation.
  - `types/` — frontend domain types.
- `worker/` — Cloudflare Worker API routing and `request.cf` mapping.
- `public/` — static public assets, `robots.txt`, and sitemap.
- `.github/workflows/ci.yml` — CI quality gate.
- `wrangler.jsonc` — Cloudflare Worker/static asset deployment configuration.
- `docs/` — durable repository knowledge.

More-specific instructions apply in `src/AGENTS.md` and `worker/AGENTS.md`.

## Technology baseline

- React 19
- TypeScript
- Vite
- `@cloudflare/speedtest`
- Cloudflare Workers + Workers Static Assets
- Vitest + React Testing Library
- Node.js 24
- npm

Do not change major tooling or add dependencies without a concrete reason.

## Working rules

Before editing:

1. Inspect the relevant implementation and adjacent tests.
2. Read the relevant document(s) from `docs/index.md`.
3. State or infer the smallest coherent change that satisfies the task.
4. Avoid opportunistic refactors that are unrelated to the task.

While editing:

- Keep TypeScript types explicit at system boundaries.
- Prefer pure functions in `src/lib/` for deterministic calculations.
- Keep components focused on presentation and interaction.
- Keep measurement orchestration out of presentation components where practical.
- Preserve responsive behavior down to narrow mobile widths.
- Preserve keyboard and screen-reader behavior.
- Avoid layout-heavy animation loops. Prefer compositor-friendly `transform` and `opacity`.
- Do not update React state every animation frame unless there is a measured reason.
- Treat measurement thresholds, race mappings, and persisted data schemas as behavior: change them deliberately and cover them with tests.
- When changing persisted LocalStorage data, consider backward compatibility or safe invalidation.
- When changing user-facing claims, verify they do not overstate what the measured data proves.

## Validation

For a normal code change, run the same quality gates as CI:

```bash
npm run lint
npm test
npm run build
npm run deploy:dry-run
```

If a command cannot be run, report exactly which command was skipped and why.

For focused work, targeted tests may be run during development, but the full relevant validation should be run before completion when practical.

## Documentation maintenance

Update durable docs only when the change affects durable knowledge:

- architecture/boundaries -> `docs/ARCHITECTURE.md`
- measurement behavior/units/threshold semantics -> `docs/MEASUREMENT.md`
- product intent -> `docs/PRODUCT.md`
- deliberate UI/animation behavior -> `docs/UX.md`
- strategic/growth decisions -> `docs/GROWTH.md`
- accepted decisions -> `docs/DECISIONS.md`
- sequencing/future work -> `docs/ROADMAP.md`

Do not rewrite documentation merely to mirror implementation line-by-line.
