# Mano Frontend Design Skill

Guide Claude to build frontend UI following Mano's established design language. This skill defines the visual principles, component patterns, color tokens, and layout rules. Apply these rules every time you create or modify a frontend component.

Reference mockups live in `designs/app-new-chat.html` and `designs/app-session.html`.

## Tech Stack

- React + TypeScript
- shadcn/ui components
- lucide-react icons (stroke-based, 1.75 stroke-width, 14–16px)
- Tailwind CSS (use the token values below to configure the theme)

## Design Principles

1. **Flat and clean.** Minimal visual weight. No heavy borders, shadows, or ornamental elements.
2. **Borderless by default.** The only structural border is between the sidebar and the main area. All other separation uses background fills (`bg-hover`, `bg-active`) instead of borders. Borders may appear on focus (e.g. input fields) but never at rest.
3. **Compact.** Small paddings, tight spacing. No oversized icons, avatars, or containers. Every pixel should earn its place.
4. **Light and dark mode.** Use CSS custom properties / Tailwind theme tokens. Both modes must be first-class.

## Color Tokens (Zinc-based)

### Light Mode
| Token          | Value     | Usage                            |
|----------------|-----------|----------------------------------|
| `bg`           | `#ffffff` | Page background, main area       |
| `bg-sidebar`   | `#fafafa` | Sidebar background               |
| `bg-input`     | `#ffffff` | Input background on focus        |
| `bg-hover`     | `#f4f4f5` | Hover states, input resting fill |
| `bg-active`    | `#f0f0f1` | Active/selected states           |
| `bg-bubble`    | `#f4f4f5` | User message bubble, code bg     |
| `border`       | `#e4e4e7` | Sidebar border, focused inputs   |
| `border-input` | `#d4d4d8` | Stronger focus ring              |
| `fg`           | `#09090b` | Primary text                     |
| `fg-muted`     | `#71717a` | Secondary text, session items    |
| `fg-faint`     | `#a1a1aa` | Placeholder, timestamps          |
| `fg-on-primary`| `#ffffff` | Text on primary buttons          |
| `primary`      | `#18181b` | Primary button bg                |
| `primary-hover`| `#27272a` | Primary button hover             |

### Dark Mode
| Token          | Value     |
|----------------|-----------|
| `bg`           | `#09090b` |
| `bg-sidebar`   | `#0c0c0e` |
| `bg-input`     | `#09090b` |
| `bg-hover`     | `#18181b` |
| `bg-active`    | `#1c1c1f` |
| `bg-bubble`    | `#18181b` |
| `border`       | `#1e1e22` |
| `border-input` | `#27272a` |
| `fg`           | `#fafafa` |
| `fg-muted`     | `#a1a1aa` |
| `fg-faint`     | `#52525b` |
| `fg-on-primary`| `#09090b` |
| `primary`      | `#fafafa` |
| `primary-hover`| `#e4e4e7` |

## Radii

- Default: `0.625rem` (10px) — buttons, inputs, cards
- Large: `0.875rem` (14px) — chat input box
- Full: `99px` — pills, quick action chips

## Typography

- Font: system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, Helvetica, Arial, sans-serif`)
- Mono: `"SF Mono", "Fira Code", "Cascadia Code", monospace`
- Base size: 14px
- Logo: 15px, weight 650, letter-spacing -0.02em
- Session items: 13px, color `fg-muted`, single line with text-overflow ellipsis
- Hero title: 22px, weight 650, letter-spacing -0.03em
- Muted subtitles: 14px, color `fg-muted`
- Timestamps: 12px, color `fg-faint`

## Layout

### Overall Structure
```
┌──────────┬──────────────────────────┐
│ Sidebar  │  Main Area               │
│ (260px)  │  (flex: 1)               │
│          │                          │
│          │                          │
│          │                          │
└──────────┴─────────────���────────────┘
```
- Full viewport height (`100vh`), flex row.
- Sidebar: fixed 260px width, `bg-sidebar`, `border-right: 1px solid border`. This is the ONLY structural border.
- Main area: `flex: 1`, `bg`.

### Sidebar
- **Header**: logo (left) + new-chat icon button (right). Padding `16px 14px 10px`.
- **Search**: borderless input with `bg-hover` fill, 32px height, 6px radius. Search icon inside.
- **Session list**: flat, no grouping, no icons. Each item is a single line of text (13px, `fg-muted`). Hover: `bg-hover`. Active: `bg-active` + `fg` + weight 500.
- **Footer**: settings and user profile items. No top border. Icon (15px lucide) + label.

### `/app` — New Chat Page
- Main area centered vertically and horizontally.
- Hero: title + subtitle, stacked, centered.
- Chat input box: max-width 620px, `bg-hover` fill at rest with transparent border. On focus: `bg` fill + `border` color.
- Quick action pills below: `bg-hover` fill, 99px radius, no border.

### `/app/:sessionId` — Session Page
- **Topbar**: 48px height, session title (14px, weight 500) on left, icon buttons (share, more) on right. No borders.
- **Messages area**: scrollable, max-width 720px centered, padding `0 24px`.
- **Bottom input**: same style as new-chat input. No top border.

## Chat Message Patterns

### User Messages
- Right-aligned with `justify-content: flex-end`.
- Bubble: `bg-bubble`, rounded `18px 18px 4px 18px`, padding `10px 16px`.
- Max-width 85% of container.
- 14px text, `fg` color.
- No avatar, no name, no timestamp.

### Agent Messages
- Left-aligned, full width, no indentation.
- **Header line**: small logo square (16px, 4px radius, `fg` bg with "M" in `bg` color, 9px bold) + "Mano" label (13px, weight 600) + timestamp (12px, `fg-faint`). Margin-bottom 6px.
- **Body text**: 14px, line-height 1.65, `fg` color. Paragraphs spaced 8px apart.
- No avatar. No indent on body content.

### Agent Content + Tool Calls (Interleaved)
Agent responses can mix text and tool calls in any order. A single agent message may contain:
```
[content block]  — text paragraph(s)
[tool call]      — collapsed single line
[content block]  — more text
[tool call]      — another collapsed line
[tool call]      — can be consecutive
[content block]  — final summary
```
Each block renders directly below the previous with no extra wrappers.

### Tool Calls
- Collapsed to a **single line**: wrench icon (14px lucide) + tool name (mono, 12px, `fg-muted`) + label/description (12px, `fg-faint`) + chevron-right (12px, `fg-faint`).
- Margin: 10px vertical.
- Clickable (hover changes color to `fg`).
- Do NOT show tool result content by default — keep it collapsed.

### Steps (Optional)
- Compact vertical list, 4px gap.
- Each step: status icon (14px) + label (13px, `fg-muted`).
- Done: `CheckCircle` icon in green (`#22c55e`).
- Running: `Clock` icon in `fg-faint`.

### Inline Code
- Font: mono stack, 12.5px.
- Background: `bg-bubble`, padding `1px 5px`, radius 4px.

## Icon Buttons
- Size: 28px square (default), 30px for input toolbar.
- Radius: 6px.
- No border, transparent background.
- Icon: 16px (default) or 15px (toolbar), stroke-width 1.75.
- Color: `fg-muted`. Hover: `bg-hover` + `fg`.

## Send Button
- 30px square, 8px radius.
- `primary` background, `fg-on-primary` text.
- Icon: arrow-up, 15px, stroke-width 2.
- Disabled state: `opacity: 0.35`.

## Transitions
- Background/color changes: `0.1s` – `0.12s`.
- Border-color: `0.15s`.
- Keep transitions subtle. No transforms, no scale effects.

## Scrollbar
- Width: 3px.
- Track: transparent.
- Thumb: `border` color, 2px radius.

## Anti-Patterns (Do NOT)
- Do not use borders for section separation — use background fills instead.
- Do not add avatars to agent messages.
- Do not indent agent message body under an avatar.
- Do not group sessions by date — keep the list flat.
- Do not show session icons.
- Do not show expanded tool call results by default.
- Do not use heavy shadows or elevation.
- Do not use large border radii on rectangular containers (reserve `99px` only for pills).
