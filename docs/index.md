# Net Speed Race Documentation Map

This directory is the durable knowledge base for the project. `AGENTS.md` should stay short and point here rather than becoming a monolithic manual.

## Documents

- [PRODUCT.md](./PRODUCT.md)  
  Product purpose, target users, positioning, core experience, non-goals, and product principles.

- [ARCHITECTURE.md](./ARCHITECTURE.md)  
  Runtime architecture, frontend/Worker boundaries, storage, build/deployment flow, and data paths.

- [MEASUREMENT.md](./MEASUREMENT.md)  
  Speed-test configuration, units, phases, formatting semantics, evaluation inputs, and measurement-change rules.

- [UX.md](./UX.md)  
  Visual/interaction principles, race behavior, intended horse animation, accessibility, responsiveness, and live speedometer behavior.

- [GROWTH.md](./GROWTH.md)  
  Custom-domain, SEO, traffic, analytics, sharing, retention, and monetization direction.

- [ROADMAP.md](./ROADMAP.md)  
  Sequenced future work. This is planning context, not permission to implement unrelated items.

- [DECISIONS.md](./DECISIONS.md)  
  Lightweight decision log for choices that agents should not casually undo.

## Reading guidance

For a task, read only the documents that affect the requested change.

Examples:

- race animation -> `UX.md`, `MEASUREMENT.md`, `DECISIONS.md`
- new quality score -> `MEASUREMENT.md`, `PRODUCT.md`, `DECISIONS.md`
- Worker API field -> `ARCHITECTURE.md`, `DECISIONS.md`
- new SEO page/domain -> `GROWTH.md`, `PRODUCT.md`
- LocalStorage/history -> `ARCHITECTURE.md`, `MEASUREMENT.md`

If a durable decision changes, update the relevant document and add/modify an entry in `DECISIONS.md`.
