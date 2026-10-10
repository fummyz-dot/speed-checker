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

`www.netspeedrace.com` and apex HTTP permanently redirect to the HTTPS apex hostname before API or Static Assets handling. The `workers.dev` hostname is disabled after the custom-domain migration.

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

---

## D-012 — Ranking preview is compile-time gated and score-blind in the browser

**Status:** Superseded by D-013
**Date:** 2026-08-28

The public ranking preview was disabled by default and required an explicit build-time preview flag. It used fixed local fixtures through a service abstraction only; it did not configure a Service Binding, Turnstile, database, or production API call.

The browser must never calculate Net Speed Score or contain its coefficients. It may display score values supplied by the private ranking-service contract. Ranking context is resolved before a measurement, never during it, and is held in memory only. Context failure must preserve the existing 700 Mbps / 250 Mbps race benchmark and never fail the speed measurement.

---

## D-013 — Ranking preview uses the private ranking service and deferred Turnstile

**Status:** Accepted and implemented
**Date:** 2026-09-04

- Frontend ranking remains compile-time gated.
- The browser never calculates Net Speed Score or contains its coefficients.
- The public Worker exposes `GET /api/ranking/context` and `POST /api/ranking/entries`.
- The public Worker calls private `netspeedrace-ranking` through `RANKING_SERVICE`.
- Only country and the allow-listed ranking payload are relayed; the original client request and headers are not forwarded.
- Context resolves before measurement; failure falls back to 700 Mbps / 250 Mbps.
- No ranking network activity occurs during SpeedTest measurement.
- Turnstile loads and executes only after explicit ranking participation.
- Ranking tickets and results remain memory-only and are not added to measurement LocalStorage.
- The private ranking Worker owns persistence and D1.

---

## D-014 — Ranking is enabled by default in production builds

**Status:** Accepted and implemented
**Date:** 2026-09-04

- Ranking is default ON in production builds and default OFF in development and test builds.
- `VITE_RANKING_ENABLED=true` or `VITE_RANKING_ENABLED=false` explicitly overrides the default.
- This prevents forgetting to enable ranking for production deployments.
- It prevents unintended ranking network activity in local development and tests.
- Turnstile remains deferred until explicit ranking participation.
- The private service and deferred Turnstile design in D-013 remains in effect.
- D-014 replaces only the preview gate in D-013.

---

## D-015 — Net Speed Run uses a private score authority and public stateless Run tickets

**Status:** Superseded by D-016
**Date:** 2026-09-08

- The private `netspeedrace-ranking` Worker remains the Net Speed Score authority; the browser and public Worker do not copy its score formula.
- The public Worker maps score tenths with mapping v1: 0 points maps to 25.0 seconds, 850 points maps to 50.0 seconds, and scores at or above 850 clamp to 50.0 seconds.
- The public Worker signs Run tickets with HMAC-SHA256 and the dedicated `RUN_TICKET_HMAC_SECRET`, separate from the private ranking ticket secret.
- Run tickets have a 30-minute TTL, a cryptographically random nonce, and the fixed purpose `net-speed-run`.
- Verification is stateless. Replay is allowed until expiry because the game has no reward, prize, or game ranking.
- Tickets contain the mapped Run time, not raw score, measurements, client IP, connection metadata, or condition labels.
- Run launch is user initiated from the completed-measurement UI and independent of ranking participation.
- The issued ticket is stored only in `sessionStorage`; `/run/` verifies it before passing the verified run time to the game. The ticket remains available until expiry for refresh and retry.
- Production `/run/` starts in a horse-free `BOOT` state and never shows the development title or time selector. Invalid or expired tickets return home; service failure shows a manual recovery path.
- Production `RETRY` reuses the same verified run time, while the second result action returns to the speed test. Raw score and time query values are ignored.

---

## D-016 — Net Speed Run requires successful ranking participation and a consumed handoff

**Status:** Accepted and implemented
**Date:** 2026-09-08

- Net Speed Run access is issued only as part of a successful `POST /api/ranking/entries` response; standalone `POST /api/run-ticket` issuance is removed.
- The accepted private ranking response's `entry.scoreTenths` is authoritative. The public Worker does not recalculate the score or call the private score endpoint again.
- A Run signing failure does not turn a successful ranking submission into an error; the ranking result remains visible with Run marked unavailable.
- `GO TO RUN!` is shown only in the successful ranking result and stores the ticket in `sessionStorage` only when selected.
- `/run/` consumes the ticket immediately after successful verification. Reload, direct re-entry, and BFCache restoration require a new successful ranking participation.
- In-game `RETRY` reuses the verified run time held in page memory and does not require another ticket.
- Production requires `START RUN` after `READY` so Web Audio starts from an explicit user gesture. Audio failure must not block gameplay.
- `READY` displays the server-verified `runTimeSec` to one decimal place and passes that same value to the game; the browser does not derive time from score.
- Production result actions are「リトライ」and「結果に戻る」. Retry reuses the verified time, while return consumes a separate `sessionStorage` context containing only the source measurement ID and restores its browser-local result without reopening ranking submission.
- Net Speed Run v0.1.3 generates restrained BGM and accepted-jump sound effects with Web Audio only; no external audio asset or preference persistence is used.
- Mounted jockey scenes show a connected waist, white breeches, bent knees, and dark navy boots without changing the existing intro/dismount timing.

---

## D-017 — Completed download result is the race authority

**Status:** Accepted and implemented
**Date:** 2026-09-09

- The `onFinish` result is authoritative for the completed Download value.
- The provisional Download live meter continues through upload from the last `metrics.download` value; this is presentation only and does not re-measure Download.
- The main race starts after completion and derives the user horse duration from `completedResult.downloadMbps`.
- Replay uses the same completed Download value. Top display, race result, history, sharing, and ranking remain aligned to that completed result.

---

## D-018 — Unmatched public paths return a real 404

**Status:** Accepted and implemented
**Date:** 2026-09-09

- The React application is served at `/`; public subpages are file-backed static assets rather than client-side routes.
- Workers Static Assets uses `not_found_handling: "404-page"` and serves the custom `404.html` with HTTP 404 for unmatched public paths.
- `/api/*` remains Worker-first, including the existing JSON response for unknown API routes.

---

## D-019 — Homepage uses a raceboard editorial theme

**Status:** Superseded by D-023
**Date:** 2026-09-17

- The homepage combines a stadium scoreboard and editorial layout, using deep green, off-white, salmon accents, system serif headings, and ruled record sections rather than glowing rounded cards.
- Preserve measurement logic, six-decimal live presentation, completed-result authority, horse assets and animation, race focus behavior, history, and ranking/Run contracts.
- The theme also covers standalone editorial/trust pages, the ranking scoreboard, and the Lab report through shared static-page CSS. Text, SEO, links, source data/charts, and ranking logic are preserved. Run retains its existing design.

---

## D-020 — Social share card and ranking-aware share text

**Status:** Accepted and implemented locally; not deployed
**Date:** 2026-10-06

- The homepage and every indexed static page declare a shared static `og:image` (`/og-image.png`, 1200 × 630; renamed to `/og-image-v2.png` in D-022 and `/og-image-v3.png` in D-023) and `twitter:card` = `summary_large_image`, so links render as a large image card on X and other services. The noindex Run page is excluded.
- The X post text keeps the measured Download/Upload/Ping and adds the call to action 「あなたの回線は何着？」.
- When the user has opted into today's anonymous ranking for the same completed measurement, the post text also includes the rank (with 「同率」 for ties), the day's total runs, and the Net Speed Score. Without participation, no rank is shown. No IP, network name, or condition label is added.
- Per-result dynamic OG images are not implemented; they would require a Worker image-rendering path and are a separate decision.

---

## D-021 — Cloudflare Web Analytics for aggregate site usage

**Status:** Accepted and implemented locally; not deployed
**Date:** 2026-10-10

- Cloudflare Web Analytics may be enabled for aggregate page views, referrers, browser/OS/device type, country/region, and page performance. Cloudflare states that it does not collect or use visitors' personal data for this product.
- The CSP allows `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com` in `connect-src` for the manual snippet; the automatic injection reports via the same-origin `/cdn-cgi/rum`.
- Measurement results, measurement history, and condition labels are never sent to Web Analytics. No custom events are added.
- Advertising (AdSense) is not implemented at this time. The AdSense account meta tag, `ads.txt`, and privacy policy section 8 are kept for a possible future re-application. Google's ad domains are added to the CSP only after approval.
- The privacy policy section 「7. Analytics」 describes this.

---

## D-022 — Share URL and ranking line wording

**Status:** Accepted and implemented locally; not deployed
**Date:** 2026-10-10

- The X share URL is `https://netspeedrace.com/?s=x` so X fetches a fresh card instead of a stale cached one. Canonical URLs are unchanged.
- The ranking line uses 「スコア」 instead of 「Net Speed Score」 to fit one line. When the day has fewer than 10 runs, the run count is omitted (e.g. 「本日の全国ランキング 2位（スコア 789.9）」), matching the ranking screen, which does not show top-percent figures below 10 runs.
- The static OG image keeps the bottom ~15% as plain background because X overlays the page title there; the race and text sit above it, with larger horses whose lanes match the race (地方馬 / あなた / 無敗の三冠馬).
- X caches card images by URL, so a redesigned OG image gets a new versioned filename (`/og-image-v2.png`) and every page's `og:image` is updated rather than replacing the file in place.
- The ranking card offers a 「順位をXでシェア」 button using the same post text.
- The downloadable share PNG follows the raceboard palette, includes the horse sprite, and adds rank/score only when the user joined today's ranking. It still contains no IP, network, or condition-label data.
- The Run result screen offers an X share link with the result (remaining seconds at CLEAR or meters to GOAL at TIME UP), `#NetSpeedRace`, and the share URL. It never includes the raw score or the mapped Run time.

---

## D-023 — Night race theme replaces the raceboard editorial theme

**Status:** Accepted and implemented locally; not deployed
**Date:** 2026-10-10

- The site uses a floodlit night meeting as its visual identity: deep navy sky (`#0b1431`), grandstand panels (`#142048`), lit dirt course (`#a47a52`), white rail (`#f4f2ea`) and tote-board amber LED (`#ffb020`). It replaces D-019's green-black, salmon accent, serif headings and hairline rules, which read as a generic template.
- On the homepage the race course is the visual centre. The course has a white rail above and below, gate-colour saddle numbers (1 white, 2 black, 3 red) and a goal post. The start button and LED download readout sit beside the headline on desktop and directly under it on phones, so the button is in the first view even with browser chrome (checked at 1366×657 and 360×600); the course follows. The condition memo and connection summary sit under the course.
- The ranking promo names the follow-up mini game (Net Speed Run) so the game is discoverable before measuring. The game itself and its access rules are unchanged.
- Measured numbers use a self-hosted 7-segment font (DSEG7 Classic Bold, SIL OFL 1.1, `public/fonts/`). Units and Japanese text stay in the system Japanese sans-serif. No external font service is used.
- Technical connection details (AS number, Cloudflare colo, protocol, Edge RTT) fold into 「詳しい接続情報」; the provider stays visible. The empty results section is hidden until a measurement starts.
- Arrow glyphs on buttons and links, all-caps eyebrow labels on the homepage, monospace labels and Georgia headings are removed. Feature names that are part of the ranking contract (NET SPEED SCORE, TODAY'S TOP 3, GO TO RUN!) keep their text.
- Static pages, the ranking scoreboard, the share PNG and the OG image (`/og-image-v3.png`) follow the same palette. Page text, SEO metadata, links and Lab source charts are unchanged. Run keeps its own design.
- Measurement logic, six-decimal live readout, race timing, horse assets, focus mode, history, ranking and Run contracts are unchanged.

