# Front-view production assets v2

This revision removes detached image fragments caused by overlap between rows in the original 3x3 jockey reference sheet.

## Runtime use

Use the WebP files under `public/assets/horse/front/`.

Jockey files are selected by lane and upload rank:

- rank1: large winner smile
- rank2: restrained smile
- rank3: crying / disappointed

The horse remains a smaller, subdued ground-side element.

## Visual sizing guidance

Do not use the intrinsic pixel size as the CSS display size.

For the current front-view layout, reduce the rendered jockey size by roughly 20–25% from the previous implementation and the horse by roughly 10–15%. Keep the user lane only slightly larger than the references if needed for emphasis.

The existing upload jump-height calculation should remain unchanged.

## Important

Do not redraw these assets as inline SVG. These are the approved production visual assets.
