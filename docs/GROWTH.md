# Growth, Domain, SEO, and Monetization

This document describes product-growth direction. It is not permission to add trackers, ads, or third-party services without an explicit task.

## Strategic goal

Grow Net Speed Race from a useful single-page tool into a recognizable network-quality utility that can acquire traffic, create repeat usage, and eventually monetize without damaging trust.

The intended funnel is:

```text
search / direct / share
        ↓
     measure
        ↓
 surprise / race
        ↓
 understand result
        ↓
 compare / share
        ↓
      return
        ↓
   monetization
```

## Custom domain

The production custom domain is **`netspeedrace.com`**. Its canonical origin is `https://netspeedrace.com/`, and its Custom Domain is connected to the `speed-checker` Worker.

SEO and sharing must use this canonical origin. The repository, Worker, and other internal identifiers remain `speed-checker` for stability and compatibility.

`www.netspeedrace.com` permanently redirects to the apex hostname. The apex hostname over HTTP permanently redirects to HTTPS, preserving the pathname and query string. The `workers.dev` hostname is disabled after the custom-domain migration, leaving `https://netspeedrace.com/` as the only public canonical URL.

If the public domain changes in the future, update at least:

- canonical URL;
- Open Graph URL;
- sitemap;
- `robots.txt` references if applicable;
- deployment/custom-domain configuration;
- Search Console setup;
- redirects/canonicalization from the previous hostname.

## Traffic strategy

Traffic should come from several mechanisms rather than depending entirely on one keyword.

### 1. Utility intent

People searching for:

- speed test;
- Wi-Fi speed;
- upload speed;
- ping;
- jitter;
- slow internet;
- gaming/meeting quality.

### 2. Problem-solving content

Potential dedicated pages/tools can explain and measure topics such as:

- What is ping?
- What is jitter?
- Why is internet slow at night?
- Is my connection good enough for Web meetings?
- Is my ping good enough for games?
- Loaded latency / bufferbloat.
- Wi-Fi vs wired comparison.

Do not mass-generate thin pages whose only purpose is keyword coverage.

### 3. Shareability

The race and generated share image should make a result recognizable when posted elsewhere.

Future share design can emphasize a memorable result/rank while still displaying the real measurement.

### 4. Retention

Repeat measurement is a stronger product loop than a one-time speed test.

Candidate retention features:

- history chart;
- time-of-day comparison;
- personal best/worst;
- labeled locations/conditions;
- A/B comparison.

## SEO architecture direction

The current application is essentially a single main page.

Future growth may require indexable routes/pages with useful standalone content.

Possible structure:

```text
/
├── speed-test/
├── ping/
├── jitter/
├── bufferbloat/
├── gaming/
├── meeting/
├── wifi-slow/
└── internet-slow-at-night/
```

Do not create these as empty shells. Each route should provide real user value and a clear path to measurement.

## Analytics

Do not add analytics automatically.

When analytics is introduced, define:

- what question the metric answers;
- data retention;
- cookie/consent impact;
- privacy-policy requirements;
- bot filtering;
- event naming.

Useful product events could include:

- test start;
- successful completion;
- error;
- replay;
- share attempt;
- repeat measurement;
- history interaction.

Avoid collecting raw IP or unnecessary identifiers.

## Monetization direction

Monetization should follow traffic and product trust, not precede them.

Candidate revenue sources:

1. contextual/display ads placed away from measurement controls;
2. relevant affiliate links for networking products/services where genuinely useful;
3. sponsorships;
4. later B2B/aggregate-data products only if privacy and licensing are sound.

Do not clutter the measurement flow with ads near the primary action.

## Anonymous aggregate benchmark concept

A future benchmark feature could compare a result to sufficiently aggregated measurements.

This would require a new privacy/product design because current history is browser-local only.

Before implementation, decide:

- consent model;
- exact fields sent;
- aggregation granularity;
- retention;
- abuse/bot handling;
- deletion/privacy policy;
- minimum cohort size before displaying statistics.

Do not begin collecting measurement history server-side merely because the roadmap mentions benchmarking.

## Growth principle

The durable competitive advantage should come from a combination of:

- useful measurements;
- understandable interpretation;
- memorable UX;
- repeat-use history;
- unique first-party aggregate data only when responsibly designed.

Avoid competing solely on "one more Mbps number."
