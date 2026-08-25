# Roadmap

This roadmap captures sequencing and compatibility goals. It is **not** a standing instruction to implement everything listed here.

Status labels:

- **Now** — appropriate next work.
- **Next** — valuable after current foundation.
- **Later** — requires more product/technical validation.
- **Gate** — decision required before implementation.

## Now — documentation and product identity

### Repository knowledge baseline

- [x] Add repository-level agent guidance.
- [x] Split durable context into focused docs.
- [x] Document intentional live six-decimal speedometer behavior.
- [x] Document horse-race direction.

### Lightweight horse animation

Goal: replace/upgrade the runner representation with a real horse-running impression while keeping the site lightweight.

Target:

- 6–8-frame compact SVG or sprite-style gallop;
- CSS/compositor movement;
- preserved race timing/state machine;
- preserved replay/front-view/jump sequence;
- responsive/mobile-safe;
- reduced-motion behavior maintained;
- no heavy animation dependency.

Before implementation, decide the exact visual asset approach.

## Next — explain network quality better

### Congestion resilience / loaded-latency explanation

Use already measured unloaded and loaded latency to show how responsiveness changes under load.

Requirements:

- transparent formula/thresholds;
- separate download/upload loaded effects where useful;
- no unsupported root-cause claim;
- tests for scoring/labels.

### Explainable connection health summary

Combine components such as:

- download;
- upload;
- unloaded latency;
- jitter;
- loaded-latency increase.

Any overall score must expose component results and avoid pretending to be a universal standard.

## Next — repeat-use features

### History trend view

Move beyond "previous result" to useful local trend visualization.

Candidate features:

- chart of recent measurements;
- personal best/worst;
- median/typical result;
- day/night comparison.

Keep history browser-local at this stage.

### User-labeled comparison

Allow labels such as:

- Wi-Fi;
- wired;
- living room;
- bedroom;
- 2.4 GHz;
- 5/6 GHz.

Use user-controlled labels rather than falsely detecting conditions the browser cannot reliably know.

## Gate — custom domain and SEO expansion

Before significant indexable content expansion:

- select custom domain;
- configure production host;
- migrate canonical/OG/sitemap;
- set up search tooling;
- verify redirects/canonical behavior.

Then build a small number of genuinely useful problem-oriented pages.

## Later — packet loss

Add only after confirming:

- supported measurement method;
- TURN/infrastructure requirements;
- operational cost;
- browser compatibility;
- failure/fallback behavior.

Do not fake or infer packet loss from latency.

## Gate/Later — anonymous aggregate benchmarks

Potential value:

- ASN/time-region aggregate comparisons;
- percentile/median comparisons;
- public network-quality trends.

Requires a separate privacy/data design. Current browser-local history should not silently become a server-side dataset.

## Later — monetization

After meaningful traffic exists:

- evaluate non-intrusive ads;
- test relevant affiliate recommendations;
- consider sponsorship;
- consider B2B/aggregate offerings only if first-party data collection has been responsibly established.

Prioritize user trust and measurement usability over short-term ad density.
