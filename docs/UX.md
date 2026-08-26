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

When a valid label is used, the completed result shows it as compact metadata. The local-history confirmation is shown only after the result is present in the updated browser-local history; a label is never added to sharing output. On narrow mobile screens, the hero's DOM order prioritizes the condition control and primary measurement action before connection information, while desktop keeps connection information first.

After measurement, labeled history can be summarized by condition in the analysis area. Present the median values and metric-specific sample counts without ranking conditions or implying a cause. Labels with one or two valid samples are reference values; three or more are trends. The responsive layout should show a compact table-like comparison on desktop and a two-by-two metric card per condition on narrow screens.

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

オグリキャップは下り 700 Mbps・上り 250 Mbpsを基準とする高速ベンチマークである。レースは常にユーザーの実測値との比較として表示し、速度測定そのものの品質基準や診断とは扱わない。

Race courseはCSSだけで表現するdark navyとcyan/emeraldの控えめなspeed-race stageとし、馬・レース情報の視認性を優先する。横向き・GOAL正面の表示順は既存の各レーン構造を維持し、あなたのlabelは既存accentを保った小さな強調に留める。

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

## Race focus mode

When a user starts a measurement, the existing race component enters a viewport-sized focus mode immediately. This is a presentation mode only: it does not use the Fullscreen API and does not create a second race component, so the active measurement, race state, and timers continue unchanged.

Focus mode is modal-like: the background cannot be scrolled or interacted with, and keyboard focus stays within the race controls. Desktop keeps the always-visible 「縮小」 control and Escape exit; narrow mobile omits both the shrink and expand controls to keep the race header clear, while retaining Escape for hardware keyboards and the details CTA/error exit flow. A mobile replay returns directly to focus mode. After a desktop manual shrink, later measurement phases must not reopen it automatically; the user may choose 「レースを拡大」 while a measurement or completed race is available.

The mode remains open through the front-view goal sequence and finished state. Its explicit exits are replay, desktop shrink, an error return to the normal error UI, or the user selecting 「詳しい測定結果を見る」. The details CTA releases focus mode and moves to the details heading; it must never auto-scroll otherwise. The focused layout is responsive from desktop to narrow mobile, accounts for safe-area insets, and remains available with reduced motion while its focus enter/exit transition is minimized.

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
