# Portfolio Dashboard Style Guide

This project uses a dark neon trading-dashboard visual style. It is built with React, Tailwind utility classes, custom CSS in `src/index.css`, and icons from `lucide-react`.

## Visual Direction

- Overall mood: dark, high-contrast, neon, cockpit-style financial interface.
- Primary feel: slate-black panels, cyan glow, dense dashboard layout, sharp financial-data readability.
- Accent usage: cyan is the default interaction/accent color; emerald, violet, amber, and rose are used for status, categories, and emphasis.
- Shape language: rounded panels and pills, usually `rounded-3xl`, `rounded-[1.75rem]`, or `rounded-[2rem]`.
- Effects: translucent surfaces, soft neon borders, subtle inner highlights, glow shadows, and occasional grid/scanline overlays.

## Core Colors

| Role | Color | Usage |
| --- | --- | --- |
| Page background | `#07111f` | Root fallback background |
| Background top | `#071525` | Top of main page gradient |
| Background middle | `#050b16` | Middle of main page gradient |
| Background bottom | `#020611` | Bottom of main page gradient |
| Main text | `#e2e8f0` | Default readable text |
| Strong text | `#ffffff`, `#f8fafc` | Headings, key values |
| Muted text | `#94a3b8`, `#93a4bd`, `#9fb0c9` | Labels, table headers, secondary copy |
| Panel base | `rgba(5, 12, 27, 0.88)` | Main dark glass panel color |
| Deep panel | `rgba(2, 6, 18, 0.88)` | Inputs, tables, nested panels |
| Border base | `rgba(103, 232, 249, 0.12)` | Neon-tinted low-emphasis borders |

## Accent Palette

| Accent | Color | Tailwind Equivalent | Usage |
| --- | --- | --- | --- |
| Cyan | `#22d3ee` | `cyan-400` | Primary accent, focus, active nav, chart highlights |
| Bright cyan | `#67e8f9` | `cyan-300` | Active text, rings, small highlights |
| Sky | `#38bdf8` | `sky-400` | Core strategy color |
| Emerald | `#22c55e` | `emerald-500` | Positive status, cash, safe values |
| Lime | `#84cc16` | `lime-500` | Live indicators and allocation accents |
| Lime highlight | `#8eea4a` | Custom | Allocation kicker text |
| Violet | `#8b5cf6` | `violet-500` | Options/category accent |
| Violet light | `#a78bfa` | `violet-400` | Violet panel accent |
| Purple light | `#c084fc` | `purple-400` | Mini allocation accent |
| Amber | `#f59e0b` | `amber-500` | Warnings and leveraged ETF accent |
| Orange | `#f97316` | `orange-500` | Speculative strategy accent |
| Rose | `#fb7185` | `rose-400` | Danger and urgent warnings |
| Slate | `#64748b` | `slate-500` | Neutral/other strategy |

## Strategy Colors

Use these exact values when recreating strategy visuals:

```js
const strategyColorMap = {
  Core: '#38bdf8',
  Options: '#8b5cf6',
  Cash: '#22c55e',
  Speculative: '#f97316',
  Hedge: '#06b6d4',
  'Leveraged ETF': '#f59e0b',
  Other: '#64748b',
}
```

## Status Colors

- Good/safe: emerald backgrounds around `bg-emerald-500/10` to `bg-emerald-500/15`, text `text-emerald-200` or `#86efac`.
- Warning: amber backgrounds around `bg-amber-500/10` to `bg-amber-500/15`, text `text-amber-200`, `#fcd34d`, or `#f59e0b`.
- Danger: rose backgrounds around `bg-rose-500/10` to `bg-rose-500/15`, text `text-rose-200`, `#fb7185`, or `#fecdd3`.
- Muted/neutral: slate backgrounds around `rgba(100, 116, 139, 0.12)`, text `#94a3b8`.

## Typography

- Font stack: `Inter, ui-sans-serif, system-ui, sans-serif`.
- Base text color: `#e2e8f0`.
- Labels/kickers: uppercase, small, high letter spacing.
- Common label pattern: `text-xs uppercase tracking-[0.3em] text-slate-400`.
- Tiny metadata labels: `text-[11px] uppercase tracking-[0.24em]` to `tracking-[0.32em]`.
- Main panel headings: white, bold, often italic and uppercase.
- Display values: `text-2xl` or `text-3xl`, `font-semibold`, white or accent color.
- Ticker/financial labels: heavier weight, usually `font-semibold`, `font-bold`, `font-extrabold`, or `font-black`.

## Backgrounds

Main page background:

```css
background:
  radial-gradient(900px 420px at 8% 0%, rgba(6, 182, 212, 0.16), transparent 60%),
  radial-gradient(780px 420px at 88% 18%, rgba(139, 92, 246, 0.14), transparent 60%),
  radial-gradient(620px 360px at 58% 100%, rgba(34, 197, 94, 0.1), transparent 58%),
  linear-gradient(180deg, #071525 0%, #050b16 48%, #020611 100%);
```

Theme overlay:

```css
background:
  linear-gradient(180deg, rgba(8, 20, 36, 0.18), rgba(2, 6, 17, 0.78)),
  radial-gradient(900px 400px at 16% 14%, rgba(34, 211, 238, 0.08), transparent 58%);
```

## Surfaces

Primary panels typically combine:

```txt
rounded-[1.75rem] or rounded-[2rem]
border border-slate-800/90
bg-slate-900/80
ring-1 ring-white/5 or ring-slate-800/60
backdrop-blur-xl
shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)]
```

Nested panels and table shells commonly use:

```txt
rounded-[1.5rem]
border border-slate-800/80
bg-slate-950/55
```

Small strips and compact grouped sections use:

```css
background: linear-gradient(90deg, rgba(2, 6, 18, 0.92), rgba(8, 18, 35, 0.86));
border: 1px solid rgba(103, 232, 249, 0.12);
border-radius: 1.25rem;
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
```

## Borders, Rings, and Glow

- Default neon border: `rgba(103, 232, 249, 0.12)` to `rgba(103, 232, 249, 0.2)`.
- Active cyan border: `border-cyan-300/70`.
- Subtle white ring: `ring-1 ring-white/5`.
- Accent ring: `ring-cyan-300/10`, `ring-cyan-400/20`, or `ring-cyan-300/40`.
- Default panel shadow: `0 16px 64px -36px rgba(15, 23, 42, 0.75)`.
- Larger panel shadow: `0 20px 80px -40px rgba(15, 23, 42, 0.7)`.
- Header glow: `0 0 80px rgba(6, 182, 212, 0.14)`.
- Focus glow: `0 0 0 1px rgba(34, 211, 238, 0.3), 0 0 22px rgba(34, 211, 238, 0.12)`.

## Navigation

- Nav items are pill buttons with `rounded-3xl`, border, small text, icon plus label, and a 200ms transition.
- Inactive nav: black translucent background, slate text, white low-opacity border.
- Active nav: cyan translucent background, white text, cyan border, cyan ring, and cyan glow.
- Icons come from `lucide-react` and are usually `h-4 w-4`.

Active nav style:

```txt
border-cyan-300/70
bg-cyan-400/10
text-white
shadow-[0_0_24px_rgba(34,211,238,0.28)]
ring-1 ring-cyan-300/40
```

Inactive nav style:

```txt
border-white/10
bg-black/45
text-slate-300
hover:border-cyan-300/35
hover:bg-cyan-400/10
hover:text-white
```

## Buttons and Inputs

Primary action buttons:

```css
background: linear-gradient(135deg, rgba(34, 211, 238, 0.16), rgba(15, 23, 42, 0.88));
border: 1px solid rgba(103, 232, 249, 0.2);
border-radius: 999px;
color: #e5f3ff;
font-weight: 800;
box-shadow: 0 0 24px rgba(34, 211, 238, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05);
transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
```

Hover buttons by increasing the cyan border and moving up slightly:

```css
border-color: rgba(103, 232, 249, 0.46);
transform: translateY(-1px);
```

Danger buttons swap the cyan tint for rose:

```css
background: linear-gradient(135deg, rgba(244, 63, 94, 0.16), rgba(15, 23, 42, 0.88));
border-color: rgba(251, 113, 133, 0.22);
color: #fecdd3;
```

Inputs and selects:

- Dark background: `rgba(2, 6, 18, 0.92)` or `bg-slate-950`.
- Border: slate or low-opacity cyan.
- Text: `text-slate-100`.
- Focus: cyan border and cyan outer glow.
- Common radius: `rounded-3xl`, `rounded-[1.25rem]`, or `rounded-[1.5rem]`.

## Tables

- Tables use fixed layout where possible for stable dashboard columns.
- Header text is small, uppercase, widely tracked, and muted slate.
- Header background: `bg-slate-950/70` or a very dark gradient.
- Body rows have subtle bottom separators using cyan/slate shadow.
- Hover rows use cyan wash and left inset cyan highlight.

Table header color:

```css
color: #9fb0c9;
font-size: 0.68rem;
letter-spacing: 0.16em;
```

Row hover:

```css
background-color: rgba(34, 211, 238, 0.055);
box-shadow: inset 3px 0 0 rgba(34, 211, 238, 0.72), inset 0 -1px 0 rgba(103, 232, 249, 0.08);
```

## Layout Rhythm

- Outer container: `max-w-[1800px]`, centered, with responsive horizontal padding.
- Main content spacing: `space-y-8`.
- Section spacing: usually `space-y-3`, `space-y-4`, or `space-y-6`.
- Dashboard grids use `gap-3` or `gap-4`.
- Panel padding: compact panels `p-4` or `p-5`; larger panels `p-6`.
- Responsive grids rely on Tailwind breakpoints such as `sm:`, `lg:`, and `xl:`.

## Reusable Class Patterns

Primary large panel:

```txt
rounded-[2rem] border border-slate-800/90 bg-slate-900/80 p-6
shadow-[0_20px_80px_-40px_rgba(15,23,42,0.7)]
ring-1 ring-white/5 backdrop-blur-xl
```

Compact panel:

```txt
rounded-[1.75rem] border border-slate-800/90 bg-slate-900/80 p-5
shadow-[0_16px_64px_-36px_rgba(15,23,42,0.75)]
ring-1 ring-slate-800/60 backdrop-blur-xl
```

Pill:

```txt
rounded-3xl bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-300 ring-1 ring-slate-800/40
```

Label:

```txt
text-xs uppercase tracking-[0.3em] text-slate-400
```

Panel title:

```txt
mt-2 text-2xl font-semibold text-white
```

## Motion and Interaction

- Keep interactions subtle and quick.
- Standard transition duration: `160ms` for rows, controls, and buttons.
- Nav transition duration: `200ms`.
- Hover effects should emphasize border, glow, or a slight `translateY(-1px)`.
- Focus states should be visible with cyan border/ring glow.

## Implementation Notes

- Tailwind is the main styling system; custom CSS in `src/index.css` supplies the theme overlays, glow effects, pseudo-elements, and reusable visual treatments.
- `src\App.css` appears to contain leftover starter styles and is not the source of the current dashboard look.
- Icons are from `lucide-react`; keep them simple, stroke-based, and sized consistently.
- Use CSS custom properties such as `--tile-color` and `--strategy-color` for reusable colored rows, tiles, and accents.
