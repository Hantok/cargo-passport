# Design system: deep and weightless

Static HTML, CSS and ES modules. No build. One idea runs through it: the page is a volume with no ground.
Content approaches from depth and settles, free things drift, and the only frame of reference is a planet limb with thin orbit arcs.

## Use it on a page

```html
<link rel="stylesheet" href="../assets/css/tokens.css">   <!-- then base, cosmos, depth, components -->
<script type="module" src="https://ui-sdk.dev/web@0.1.0-beta.4.js"></script>
<script type="module" src="../assets/js/depth.js"></script>   <!-- also reveal.js, evidence.js, figure-host.js -->
```
Copy the `<div class="cosmos" data-cosmos>` and `<div class="cosmos-front" data-cosmos>` blocks from `index.html` unchanged.
Layer order is declared in `tokens.css` (`ui-sdk, base, depth, components`), so page CSS stays unlayered or goes last.

## Tokens (`assets/css/tokens.css`)
- Colour, copied from the app: `--bg #0b1628`, `--frame`, `--card #13233d`, `--line #22385c`, `--hover`, `--fg`, `--soft #ffd3a6`, `--muted #9fb0c8`, `--accent #ff8c1a`, `--found #4fb3ff`, `--gap #ff5a45`, `--none`, `--nohaz`. Status colours always carry a text label.
- Type: `--font` (Segoe UI, system-ui), `--mono`; `--fs-xs` to `--fs-h1` (fluid); `--track-tight`, `--track-label`; `--measure` for line length.
- Space: `--gutter`, `--wrap`, `--space-1` to `--space-6`; `--radius` (14px), `--radius-pill`.
- Depth: `--persp`, `--light-x`, `--light-y`. Motion: `--ease-settle`, `--t-approach`, `--approach-scale`, `--approach-blur`.

## Classes
- Structure: `.scene` (a full-height volume with perspective), `.scene--short`, `.scene__inner`, `.scene__head`, `.numeral` (outlined scene number, floats above the head, `aria-hidden`).
- Surfaces: `.slab` (translucent panel lit from the upper left; highlight and shade slide with the pointer), `.rule`.
- Text: `.eyebrow`, `.lead`, `.muted`, `.small`, `.mono`, `.tag`; `em.warm` for an accent word.
- Actions: `.btn`, `.btn--primary`, `.actions` (button row). Put `data-reveal` on a wrapper, never on a `.btn`.
- Layout helpers used by scenes: `.pair` (two slabs), `.build` (copy plus figure), `.facts` (label and value grid), `.key` (legend), `.rings`.
- Evidence: `.cite`, `.cite--pending`, `ui-popover-content.cite-pop` (built by `evidence.js`, do not write by hand).

## Data attributes (read by the engine, no per-element JS)
- `data-reveal`: approach from depth once, when first seen (scale, blur, opacity; no movement from below). Do not combine with `data-depth` on the same element.
- `data-depth="d"`: distance from the reader. 1 is the content plane, below 1 far, above 1 near. Moves with scroll and pointer, each with its own eased follow.
- `data-drift="px"`: free float, own phase, tiny rotation. `data-turn="deg"`: rotation over the whole scroll. `data-z="px"`: translateZ in the scene perspective.
- Inside `[data-cosmos]` (fixed layers): `data-at="p"` scroll progress where the layer sits at its CSS position, `data-loop="px"` tile period to wrap at.
- Keep body text still. Drift and depth belong on numerals, cards, figures and decoration.
- `data-evidence="id1 id2"`: adds numbered citation markers from `data/evidence.json`; `<ol data-evidence-list>` receives the source list. Until the file loads each element shows `[source pending: ids]`.
- `data-slot="kind: what fact is needed"` on an element whose text is `[fact pending]`: a placeholder for sourced copy. Replace the whole element. ui-sdk writes its own `data-slot` values (no colon) at runtime, so a test reads the HTML source, or matches `[data-slot*=": "]`.

## Custom elements and ui-sdk
- `<figure-host name="instrument">` loads `assets/figures/<name>/figure.{html,css,js}`, calls `mount(root)`, forwards `host.state = {...}` to `set()`, re-dispatches `figure:select` (`detail.id`). `data-state` is `loading`, `missing`, `error` or `ready`; a quiet frame shows until ready. Override the ratio with `--figure-ratio`.
- ui-sdk web components, pinned to `0.1.0-beta.4` and loaded from ui-sdk.dev (no `web.css`; we style the parts). Used: `ui-tabs` (scene 4) and `ui-popover` (citations). Style through state attributes: `[data-selected]`, `[data-open]`, `[data-starting-style]`, `[data-ending-style]`. Without the script the tab panels simply stack.

## Add a scene
1. Copy a `<section class="scene" id="..." aria-labelledby="...">` from `index.html`; add its dot to `.rail`.
2. Inside `.scene__inner`: `.scene__head` with `.numeral`, `.eyebrow`, `h2`, `.lead`, each wrapped in `data-reveal`.
3. Put content in `.slab` panels or a layout helper. Any fact becomes a `data-slot` element or a `data-evidence` citation.
4. Check at 390 px, by keyboard, and with `prefers-reduced-motion`: everything must read and nothing may move.

## Rules
Only `transform` and `opacity` animate continuously, from one requestAnimationFrame loop that stops when the tab is hidden and skips offscreen elements. The one-time approach also eases a small blur. Far and near layers are soft by construction (gradient tiles), not by CSS filters. Text contrast is at least 4.5:1 (muted on bg 8.2, accent on bg 7.8, gap on bg 5.9).
