# Architecture

## Overview

Net Speed Race is a React/TypeScript single-page application deployed on Cloudflare Workers with Workers Static Assets.

High-level flow:

```text
Browser
  |
  |-- static application --------------------------+
  |                                                |
  |-- @cloudflare/speedtest measurement traffic    | Cloudflare network
  |                                                |
  +-- GET /api/connection --> Cloudflare Worker ---+
                               |
                               +-- request.cf -> safe connection metadata
```

The public `speed-checker` Worker does not bind an application database. The optional ranking path delegates persistence to the private ranking Worker, which owns D1.

## Frontend

Entry points:

- `src/main.tsx`
- `src/App.tsx`

Major areas:

```text
src/
├── components/   UI and interaction
├── hooks/        measurement/connection/race state orchestration
├── lib/          deterministic calculations and browser utilities
├── services/     Worker API calls and runtime validation
├── types/        domain types
└── test/         test setup
```

### Measurement orchestration

`src/hooks/useSpeedTest.ts` owns the `@cloudflare/speedtest` engine lifecycle and publishes:

- current metrics;
- measurement phase;
- running/error state;
- completed validated result;
- confirmed download speed used to start the race.

The component tree should not directly duplicate the engine lifecycle.

### Race orchestration

`src/hooks/useHorseRaceAnimation.ts` models race states separately from the speed-test engine. The speed test provides measurement phases/values; the race hook translates them into animation state.

Race timing/value mappings belong in small deterministic helpers such as `src/lib/horseVisualization.ts`.

### Ranking boundary

`src/features/ranking/` contains a compile-time ranking boundary. Ranking is enabled by default in production builds and disabled by default in development and test builds. `VITE_RANKING_ENABLED=true` or `VITE_RANKING_ENABLED=false` explicitly overrides that default; when ranking is disabled, it makes no ranking UI or requests. The browser never calculates Net Speed Score or contains its coefficients.

Before the speed-test engine starts, the ranking context is retrieved through `GET /api/ranking/context`, fixing the optional race champion reference for that run. Context failure falls back to the established 700 Mbps / 250 Mbps benchmark and never fails the speed measurement. No ranking network activity occurs after the measurement starts or while it runs.

After measurement completion, Turnstile is loaded and executed only if the user explicitly selects ranking participation; it is never loaded at page load. A successful Turnstile challenge is followed by `POST /api/ranking/entries`. Ranking tickets and results remain memory-only and are not added to LocalStorage.

The public Worker calls the private `netspeedrace-ranking` Worker through the `RANKING_SERVICE` Service Binding. It creates new requests containing only the country and allow-listed ranking payload rather than forwarding the original client request or headers. The private ranking Worker owns D1; the public `speed-checker` Worker does not bind D1 directly.

### Evaluation

`src/lib/measurementEvaluation.ts` converts a completed measurement into:

- practical use-case evaluations;
- cautious explanatory comments.

Keep evaluation rules deterministic and testable.

## Worker

`worker/index.ts` handles Worker routing.

`worker/connectionInfo.ts` converts Cloudflare request metadata into the limited public connection-information shape.

`wrangler.jsonc` configures:

- Worker entry: `worker/index.ts`;
- apex `netspeedrace.com` as the Worker Custom Domain and canonical public hostname over HTTPS;
- `www.netspeedrace.com` as a Cloudflare Redirect Rule target to the apex hostname, not a Worker Custom Domain;
- permanent apex HTTP redirects to HTTPS before API and Static Assets handling;
- disabled `workers.dev` hostname after the custom-domain migration;
- static asset directory: `dist/`;
- SPA fallback;
- Worker-first handling for `/api/*`.

`public/_headers` supplies security headers for static asset responses. It is copied into `dist/` during the Vite build and interpreted by Workers Static Assets rather than served as a downloadable asset. Worker-generated API responses retain their own header policy.

Canonical redirects preserve the request pathname and query string. Local development hostnames are not redirected to production.

## Connection metadata boundary

The Worker may expose selected non-unique network context such as ASN owner, ASN, region/city, colo, and protocol.

It must not expose the client's IP address to the application.

The displayed network organization is ASN ownership information and can differ from a retail ISP/service brand, especially through VPNs, proxies, corporate networks, or upstream carriers.

When available, the connection response also includes Cloudflare's smoothed transport RTT between the browser and Cloudflare Edge (`clientTcpRtt` for TCP or `clientQuicRtt` for QUIC). This is current connection metadata only: it is distinct from the speed-test Ping, is not persisted or shared, and does not drive measurement evaluation or diagnose a network cause.

## Browser storage

Successful measurement history is stored in LocalStorage.

Current design:

- local to the current browser/profile;
- maximum 30 successful measurements;
- each result stores download/upload speed, idle latency, and the optional jitter, download-loaded-latency, upload-loaded-latency, measurement-time timezone offset, and user-provided condition label when available;
- no server/database upload;
- no IP/network name/location/device/browser metadata stored with history.

The condition label is a user-entered memo only; the browser does not infer a connection type, Wi-Fi band, network name, or location. It remains in LocalStorage and is not sent to the Worker or external services. Legacy unlabeled records and labeled records may coexist. When changing the stored schema, handle malformed/stale entries safely; an invalid optional label must not discard an otherwise valid history record.

The measurement-condition selector keeps its current choice in page state. On page load it restores only the valid label from the latest successful history record. Recent labels (up to five, newest-first and deduplicated) are derived from this same history whenever the selector opens; no condition-specific LocalStorage key is used.

Condition-level trends are also derived in the browser from this existing history only. They use up to five most recently used labels and do not create another LocalStorage key or send comparison data to a Worker, external API, analytics, or sharing flow.

## Share image

The share image is generated in the browser using Canvas APIs. It uses the approved race idle-horse assets when available and falls back to an image without horses if they cannot load.

It should not silently include connection metadata or historical records that the user did not intend to share.

Users explicitly choose whether to copy the PNG image, save it, open an X post with generated text, or copy that text. The application does not open an OS-native sharing menu. Images, generated post text, and measurement history remain browser-local unless the user takes one of those explicit actions. The share image and post text use the canonical public URL, `https://netspeedrace.com/`, so sharing from a local or Workers development hostname never exposes a non-production URL.

## Build and deploy

Node.js 24 is the repository baseline.

Normal build:

```bash
npm ci
npm run build
```

Deployment:

```bash
npm run deploy:dry-run
npm run deploy
```

CI runs:

```text
npm ci
npm run lint
npm test
npm run build
npm run deploy:dry-run
```

## Architecture constraints

- Avoid introducing a backend database for a feature that can remain browser-local.
- Avoid third-party network/geolocation APIs unless there is a concrete product need.
- Avoid coupling presentation components to Cloudflare-specific API internals.
- Runtime-validate external/Worker response data.
- Prefer pure functions for scoring, formatting, normalization, and visualization mappings.
- Preserve the ability to serve the application as lightweight static assets plus a narrow Worker API.
