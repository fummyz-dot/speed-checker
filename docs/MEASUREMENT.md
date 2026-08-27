# Measurement Semantics

## Measurement engine

The frontend uses `@cloudflare/speedtest`.

The current measurement sequence in `src/hooks/useSpeedTest.ts` is:

```ts
[
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 100_000, count: 5, bypassMinDuration: true },
  { type: 'download', bytes: 1_000_000, count: 6 },
  { type: 'download', bytes: 10_000_000, count: 4 },
  { type: 'download', bytes: 25_000_000, count: 2 },
  { type: 'upload', bytes: 100_000, count: 5, bypassMinDuration: true },
  { type: 'upload', bytes: 1_000_000, count: 6 },
  { type: 'upload', bytes: 10_000_000, count: 4 },
  { type: 'upload', bytes: 25_000_000, count: 2 },
]
```

Loaded-latency measurement is enabled for both download and upload.

The Speedtest engine explicitly disables Cloudflare's completion-result aggregation logging (`logAimApiUrl: null`). Direct latency, download, and upload measurement traffic to Cloudflare Edge continues as configured above.

Do not casually adjust the sequence, sizes, counts, or loaded-latency settings based on a single local test. These parameters affect traffic volume, duration, high-speed accuracy, and UX.

## Metrics

The frontend reads:

- download bandwidth;
- upload bandwidth;
- unloaded latency;
- unloaded jitter;
- download-loaded latency;
- upload-loaded latency.

Bandwidth from the library is converted from bits/second to Mbps.

Invalid, negative, non-finite, or otherwise unusable values are normalized/validated before display or persistence.

## Phases

Application phase model:

```text
idle
  -> latency
  -> download
  -> upload
  -> complete

Any active phase may end in:
  -> error
```

The phase model is consumed by both measurement UI and the race experience. Changing phase transitions can therefore be a UX change as well as a measurement change.

## Visibility interruption

During an active `latency`, `download`, or `upload` phase, the run is invalidated when the page becomes hidden or receives `pagehide`. Background tabs, app switches, and screen locks can change browser network, timer, and CPU behavior, so the result is not comparable with a foreground measurement.

The active engine is paused, partial metrics are discarded, and the run enters the normal error state. A late completion callback from that invalidated run is ignored. It never creates a completed result or browser-local history entry. A page becoming hidden after `complete` does not invalidate the already completed measurement.

## Confirmed download value

At the transition to upload, the current download result is captured as the confirmed download speed for race timing.

This allows the race to begin while upload measurement continues instead of waiting for the full test to complete.

If necessary, completion logic provides a fallback confirmed value.

## Live vs final speed formatting

This distinction is deliberate.

### Live display

`formatLiveSpeedDisplay()` uses six decimal places.

Example:

```text
12.814816 Mbps
```

This precision is an **animation/presentation choice**, functioning like a digital speedometer whose digits visibly move during measurement.

Do not round the live display merely for aesthetic simplification unless the product decision changes.

### Final display

`formatFinalSpeedDisplay()` is intentionally more readable:

- under 100 Mbps: one decimal;
- 100 Mbps and above: rounded integer with Japanese locale formatting.

Live precision must not be interpreted as a claim that the underlying consumer-grade measurement is accurate to six decimal places.

## Completed result

The persisted `SpeedMeasurementResult` currently contains:

```ts
{
  id: string
  measuredAt: string
  downloadMbps: number
  uploadMbps: number
  pingMs: number | null
  jitterMs?: number | null
  downloadLoadedLatencyMs?: number | null
  uploadLoadedLatencyMs?: number | null
  timezoneOffsetMinutes?: number | null
  conditionLabel?: string | null
}
```

The optional latency fields, `timezoneOffsetMinutes`, and `conditionLabel` preserve compatibility with existing browser-local history records that do not contain them. `timezoneOffsetMinutes` follows `Date#getTimezoneOffset()` semantics (UTC minus local time) and is recorded from the same measurement timestamp. New completed measurements save the valid jitter, loaded-latency values, the measurement-time offset, and an optional user-provided condition label with browser-local history for future comparison or trend features; they are not sent to a server.

### Measurement condition label

`conditionLabel` is an optional free-form memo supplied by the user, such as a room, connection setup, or tethering condition. It is not inferred from browser or network APIs. Labels are trimmed, limited to 24 characters, and stored only in browser LocalStorage; they are never sent to the Worker, Cloudflare, analytics, or another external service. Legacy records without a label can coexist with labeled records. If the optional label is malformed in stored data, the label is ignored while the valid measurement record remains available.

Before a measurement, the user can set or clear this label. The latest successfully saved measurement supplies the next page-load default; if that newest record has no valid label, the default remains unset even if older records are labeled. Up to five recently used labels are derived from the existing measurement history for one-tap reuse, with no separate condition-label storage key. The selected label is captured when a measurement starts and remains associated with that run through completion.

## Practical evaluation

Current use-case evaluation includes:

- Web/SNS browsing;
- video;
- Web meetings;
- online gaming;
- large file upload.

Thresholds are defined in `src/lib/measurementEvaluation.ts`.

The current evaluation is intentionally conservative and should not be described as a fault diagnosis.

## Race mapping

Current reference run durations:

- standard: 13.5 seconds;
- fast (オグリキャップ): 700 Mbpsをユーザーと同じ走行時間マッピングへ通した値（約10.03秒）。

User run duration:

```text
clamp(18 - 2.8 * log10(max(downloadMbps, 1)), 9.5, 18)
```

Upload speed controls user jump height:

```text
clamp(22 + log10(1 + uploadMbps) * 32, 22, 100)
```

正面ゴール表示では、地方馬は既存の6 Mbps相当、オグリキャップは上り250 Mbps相当を比較基準にする。オグリキャップのjump高さも同じ250 Mbpsを上記式へ通して求める。これらは実測値との比較を分かりやすくするための演出上の基準であり、ネットワーク品質の標準ではない。

These mappings are presentation mappings. They are not network-quality standards.

## Congestion responsiveness

Completed results compare unloaded latency with the download/upload loaded-latency measurements to show how much response time increased while the connection was in use.

The evaluation uses the effective increase below for each direction:

```text
max(0, loaded latency - idle latency)
```

The explainable thresholds are:

```text
0 <= increase <= 20     good
20 < increase <= 100    notice
100 < increase          poor
```

If the idle latency is missing or invalid, the increase cannot be evaluated. A missing direction is omitted from the overall result when the other direction is valid. These values describe this browser/network-path observation and must not be presented as proof of a specific cause.

## History analysis rules

History analysis is for displaying past trends only. It must not average, adjust, or otherwise combine historical values with the current measurement or its evaluation.

Trend representative values use medians. Time-band aggregation uses four local-time bands supplied with an explicit `Date#getTimezoneOffset()`-compatible offset: morning (05:00–10:59), daytime (11:00–16:59), evening (17:00–22:59), and late night (23:00–04:59). Legacy records without an offset use the current browser timezone for their measured date as a fallback.

For each metric, one or two valid samples are a reference value; three or more are a trend. The initial time-band analysis includes download, upload, ping, and loaded-latency increase. It does not include jitter and does not diagnose whether night-time performance is worse.

The result screen also visualizes the most recent 12 browser-local measurements in chronological order: download/upload speed and ping/loaded-latency increase. This graph is historical context only and never changes the current result or its evaluation.

When at least two labeled measurements exist, the result screen also groups the browser-local history by the exact canonical condition label. It shows up to five most recently used conditions and calculates each displayed metric independently using its median: download, upload, idle ping, and the per-measurement loaded-latency increase. Unlabeled and legacy measurements are excluded from this grouping. One or two valid samples are shown as reference values; three or more are shown as a trend. This comparison is descriptive only: time of day and current network conditions can vary, so it does not establish that a condition caused a difference.

## Candidate future: packet loss

Packet loss is not currently implemented.

Do not present a packet-loss value unless it is actually measured through supported infrastructure.

## Measurement change checklist

When changing measurement behavior:

1. Define why the change is needed.
2. Check traffic-volume and test-duration implications.
3. Check low-speed and high-speed behavior.
4. Preserve error handling.
5. Update tests around deterministic logic/state where possible.
6. Update this document when semantics change.
7. Avoid presenting additional numeric precision as additional measurement certainty.
