# Product Specification

## Product

**Name:** Net Speed Race
**Current production URL:** `https://netspeedrace.com/`

## Mission

Measure internet connection quality and translate technical network metrics into an experience that ordinary users can understand, compare, remember, and share.

The product should be technically credible without becoming a dry engineering dashboard.

## Positioning

Net Speed Race should not be designed as a clone of a large generic speed-test service.

The intended position is:

> A Japanese network-quality checker that combines real measurements, understandable diagnostics, history/comparison, and a memorable lightweight speed-race experience.

The race is part of the product identity.

## Primary users

1. People who want to know whether their internet connection is "fast enough."
2. People experiencing slow browsing, video, meetings, gaming, or uploads.
3. People comparing Wi-Fi/location/time-of-day conditions.
4. Technical users who want latency/jitter/loaded-latency details without a complex tool.

## Core user loop

1. Open the page.
2. Understand what will be measured.
3. Start the test.
4. Watch live measurement feedback.
5. Experience the speed race.
6. Read the final metrics.
7. Understand practical usage quality.
8. Compare with a previous measurement.
9. Share or re-run under different conditions.

## Current product capabilities

- Download speed.
- Upload speed.
- Idle latency.
- Jitter.
- Download-loaded latency.
- Upload-loaded latency.
- Measurement phase and error states.
- Connection metadata from Cloudflare request context.
- Speed race tied to measured values.
- Practical use-case evaluation.
- Measurement comments that avoid unsupported root-cause claims.
- Browser-local history (up to 30 successful measurements).
- Previous-measurement comparison.
- Browser-generated share image.
- Responsive UI and accessibility accommodations.

## Product principles

### 1. Explain meaning, not only numbers

"320 Mbps" is less useful than explaining what it means for video, meetings, gaming, and large transfers.

### 2. Keep diagnostic claims evidence-based

A browser speed test usually cannot prove that a router, Wi-Fi, ISP, cable, or device is the root cause.

Use wording such as:

- "可能性があります"
- "この測定値では..."
- "別条件で比較すると切り分けやすくなります"

Do not state a cause as fact without evidence.

### 3. Make the measurement itself memorable

The race is not a loading spinner. It converts speed into a playful visual metaphor and gives users something recognizable to remember/share.

### 4. Preserve trust

Animations and scores must remain traceable to actual measured values. Do not fabricate data for dramatic effect.

### 5. Stay lightweight

The site should load quickly even for users who are testing a poor connection. Product delight must not require a heavy payload.

### 6. Preserve privacy by default

Do not collect more information than needed to provide the current feature.

## Non-goals for the current stage

- Full router/Wi-Fi fault diagnosis.
- Replacing professional network monitoring.
- Account/login infrastructure.
- Server-side user profiles.
- Background collection of personal browsing/network history.
- A heavy game engine or realistic 3D racing game.
