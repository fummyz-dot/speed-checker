# Approved horse gallop assets

These assets are the approved visual basis for the Net Speed Race visualization.

## Production assets

Runtime files live under:

```text
public/assets/horse/
├── horse-user-gallop.webp
├── horse-standard-gallop.webp
├── horse-fast-gallop.webp
├── horse-user-gallop.png
├── horse-standard-gallop.png
├── horse-fast-gallop.png
├── horse-user-idle.webp
├── horse-standard-idle.webp
└── horse-fast-idle.webp
```

Prefer the WebP sprite sheets in production. PNG files are fallback/debug assets.

## Sprite specification

- Frame count: **7**
- Runtime frame size: **160 × 135px**
- Runtime sprite size: **1120 × 135px**
- Layout: 7 equal-width frames in one horizontal row
- Background: transparent
- Intended display width: approximately 60–70px per horse
- User: chestnut/brown horse + teal jockey/saddle cloth
- Standard: bay/chestnut horse + gray jockey
- Fast: gray horse + blue jockey

The generated source contains **7 usable gallop poses**, not 8. Implement the first version with `steps(7)`.
Do not fabricate an eighth frame unless visual review shows that the loop needs it.

## Animation architecture

Keep two motions separate:

1. Sprite frame cycling -> creates the gallop.
2. Course translation -> moves the horse from START to GOAL.

Do not move through the sprite by React state on every frame.
Use CSS sprite animation (`steps(7)`) for the gallop.

Suggested conceptual structure:

```text
race-runner
└── runner-travel        # START -> GOAL
    └── horse-sprite     # background-image, steps(7)
```

For idle/waiting states, either pause the sprite at a suitable frame or use the exported idle WebP.

## Source/reference assets

`horse-gallop-reference-3x7.png` is the approved generated montage.
`horse-*-gallop-master.png` are normalized high-resolution source rows.

These docs assets should not be imported into the runtime bundle.

## Important

Visual identity is already approved. Codex should integrate and animate these assets rather than redraw the horses as SVG.
