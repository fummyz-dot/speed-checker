# UX and Visual Direction

## Overall character

The interface should feel:

- modern;
- restrained;
- technically credible;
- dark and low-noise;
- playful only where play adds comprehension or memorability.

The race is the primary playful element. Do not turn the rest of the product into a game UI without an explicit design decision.

## Information hierarchy

The user should be able to understand the screen in this order:

1. What this site does.
2. Current connection context.
3. Main speed measurement/start state.
4. Race visualization.
5. Detailed metrics.
6. Responsiveness while the connection is in use.
7. Practical interpretation.
8. Previous comparison/share/retry.

Do not bury the primary measurement action under secondary content.

## Measurement condition label

The optional measurement-condition label is a compact, secondary control placed before the primary measurement action. It is user-entered only and may describe a location or connection setup; it must never imply an automatic connection-type detection. The inline editor supports a 24-character label, explicit unset, and up to five recent labels from browser-local history. While editing, measurement start is unavailable to avoid applying an unconfirmed draft; while measuring, the condition cannot be changed.

## Live speedometer effect

During live measurement, high-precision digits such as:

```text
12.814816 Mbps
```

are intentional.

The purpose is kinetic feedback, similar to a digital speedometer. This is not meant to communicate six-decimal scientific accuracy.

When styling this value:

- use stable/tabular numerals where possible;
- avoid horizontal layout jitter;
- keep `Mbps` visually distinct from the rapidly changing number;
- do not round the live value as a "cleanup" unless explicitly requested.

Final results can use simpler formatting.

## Race as product identity

The original product direction is a **horse race** driven by measured network values.

A temporary human/runner representation may be used for lightweight implementation, but the preferred long-term visual is a lightweight animated horse.

The race should remain:

- directly linked to measured download/upload values;
- visually understandable without reading technical documentation;
- lightweight enough that it does not meaningfully burden a slow connection;
- replayable after a completed measurement.

## Existing race lifecycle

The race state machine currently distinguishes:

```text
idle
measuringDownload
warmingUp
running
waitingForAllFinish
transitionToFrontView
groupJumpFrontView
finished
```

Behavioral intent:

- download phase creates anticipation/warm-up;
- when upload begins, confirmed download speed determines race pace;
- runners reach the goal based on their mapped durations;
- after all finish, the camera/front-view transition occurs;
- upload speed contributes to jump height;
- completed results can replay without re-running the network measurement.
- only after the race is finished, a user-initiated CTA links to the detailed measurement results; it must not auto-scroll.

A horse implementation should preserve this lifecycle unless the design task explicitly revises it.

## Preferred horse animation technique

Primary recommendation:

**compact SVG multi-pose animation + CSS/compositor movement**

Suitable implementation patterns:

- 6–8 horse gallop poses switched as frames;
- compact SVG sprite or inline SVG symbols;
- horizontal movement via `transform: translate...`;
- modest vertical body motion;
- optional tail/head motion only if inexpensive.

A small image sprite can also be acceptable.

Avoid by default:

- MP4/WebM race footage;
- large animated GIFs;
- 3D/WebGL engines;
- heavyweight animation libraries introduced solely for the horses.

The site is used specifically when network quality may be poor, so asset weight matters.

## Animation performance

Prefer `transform` and `opacity`.

Avoid repeatedly changing layout properties such as `left`, `width`, or large DOM structures each frame when a transform can achieve the same result.

Avoid driving visual frames through React state at 60 FPS. Let CSS animation or a narrowly scoped animation mechanism handle frame motion.

## Speed-to-motion mapping

Do not map Mbps linearly to leg cadence across the full range; the result becomes absurd at high speeds.

Use clamped or logarithmic mappings, as already done for race duration.

The animation should visibly communicate differences without making 1 Gbps look like a broken animation.

## Reduced motion and accessibility

Preserve a usable experience for users with motion preferences.

- Respect `prefers-reduced-motion`.
- Keep measurement status understandable without relying on animation.
- Keep replay controls keyboard accessible.
- Do not encode quality with color alone.
- Keep error/status announcements accessible.

If the policy for which race motions are reduced changes, document the new behavior.

## Responsive behavior

The product should remain usable from narrow mobile widths through desktop.

For the race:

- avoid clipping horses outside the track;
- preserve visible START/GOAL context;
- ensure labels do not collide with the runners;
- reduce decorative detail before reducing readability.

## Visual asset rules

New horse artwork should:

- match the existing restrained dark/teal design;
- use a small number of assets;
- avoid licensing ambiguity;
- be original or have clearly acceptable commercial-use rights;
- remain legible at mobile size.

Do not add third-party artwork whose redistribution/commercial rights are unclear.
