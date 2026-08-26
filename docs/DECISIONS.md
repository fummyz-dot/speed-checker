# Decision Log

This is a lightweight record of deliberate choices. Do not casually reverse a decision just because another implementation looks cleaner.

When a decision changes, update the existing entry or add a superseding entry with the date and reason.

---

## D-001 — Cloudflare speed-test stack

**Status:** Accepted  
**Date:** Existing project baseline

Use `@cloudflare/speedtest` for browser measurement and Cloudflare Workers/Static Assets for deployment.

Reason:

- appropriate edge infrastructure for the product;
- keeps the application architecture small;
- already integrated and tested.

Changing measurement/deployment providers is a strategic change.

---

## D-002 — Keep connection-history data browser-local

**Status:** Accepted  
**Date:** Existing project baseline

Successful measurement history is stored in LocalStorage, currently up to 30 entries.

Do not send history to an application database by default.

Reason:

- low operational complexity;
- privacy-conscious baseline;
- no account required.

Anonymous aggregate benchmarking, if pursued later, requires a new explicit decision.

---

## D-003 — Do not expose client IP

**Status:** Accepted  
**Date:** Existing project baseline

The Worker may use Cloudflare request context to provide selected connection metadata, but the application must not return/display/store the user's raw IP address.

---

## D-004 — The speed race is a core product identity

**Status:** Accepted  
**Date:** 2026-08-19

The race is not merely a loading animation. It is intended to make the measurement memorable and visually explain speed.

The preferred direction is to have horses visibly running.

A human/runner representation can be an interim lightweight implementation, but should not be treated as a reason to abandon the original horse-race concept.

---

## D-005 — Horse animation should remain lightweight

**Status:** Accepted  
**Date:** 2026-08-19

Preferred implementation:

- compact SVG multi-pose/frame animation; or
- a small sprite-style asset;
- CSS `transform`/`opacity` for motion.

Avoid heavyweight 3D/game/animation dependencies unless a future requirement justifies them.

Reason:

Users may open the site precisely because their connection is slow or unstable.

---

## D-006 — Six-decimal live speed is intentional

**Status:** Accepted  
**Date:** 2026-08-19

Example live value:

```text
12.814816 Mbps
```

This is deliberately formatted as a rapidly changing digital speedometer effect.

It should not be rounded merely because six decimal places appear excessive.

This is a **display effect**, not a claim of six-decimal measurement accuracy.

Final/snapshot result formatting remains independently optimized for readability.

---

## D-007 — Avoid unsupported fault diagnosis

**Status:** Accepted  
**Date:** Existing project baseline

The site may explain what a measurement suggests, but should not state that Wi-Fi, router, ISP, cable, or hardware is the cause unless evidence supports that conclusion.

Prefer conditional, comparison-oriented guidance.

---

## D-008 — Use loaded latency for responsiveness evaluation

**Status:** Accepted and implemented
**Date:** 2026-08-20

The application compares idle latency with download-loaded and upload-loaded latency to give an explainable, direction-specific responsiveness result.

The result must retain the measured values, use documented thresholds for effective latency increase, and remain `unknown` when the required comparison values are unavailable.

Do not replace this with an opaque score or claim a specific root cause from the measurement.

---

## D-009 — Use netspeedrace.com as the canonical public domain

**Status:** Accepted and implemented
**Date:** 2026-08-27

`netspeedrace.com` is connected as the Custom Domain for the `speed-checker` Worker and is the canonical public origin.

SEO metadata, Open Graph metadata, the sitemap, robots reference, and share destinations use `https://netspeedrace.com/`.

---

## D-010 — AGENTS.md is a map, docs are the durable knowledge base

**Status:** Accepted  
**Date:** 2026-08-19

Keep repository `AGENTS.md` concise.

Put detailed durable knowledge in focused files under `docs/`.

Use nested `AGENTS.md` only where directory-specific constraints are genuinely useful.

---

## D-011 — Public brand is Net Speed Race

**Status:** Accepted and implemented
**Date:** 2026-08-27

The public brand is **Net Speed Race** and its domain is `netspeedrace.com`.

The repository, Cloudflare Worker, LocalStorage key, and other internal identifiers may remain `speed-checker` to preserve stability and compatibility.
