---
name: Terminal Precision
colors:
  surface: '#0b1612'
  surface-dim: '#0b1612'
  surface-bright: '#303c37'
  surface-container-lowest: '#06100d'
  surface-container-low: '#131e1a'
  surface-container: '#17221e'
  surface-container-high: '#212c28'
  surface-container-highest: '#2c3733'
  on-surface: '#d9e5df'
  on-surface-variant: '#bacbbe'
  inverse-surface: '#d9e5df'
  inverse-on-surface: '#27332e'
  outline: '#859589'
  outline-variant: '#3b4a41'
  surface-tint: '#21e199'
  primary: '#45f6ab'
  on-primary: '#003822'
  primary-container: '#00d991'
  on-primary-container: '#005939'
  inverse-primary: '#006c46'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#ffd3a1'
  on-tertiary: '#472a00'
  tertiary-container: '#ffae3d'
  on-tertiary-container: '#6e4400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#51ffb3'
  primary-fixed-dim: '#21e199'
  on-primary-fixed: '#002112'
  on-primary-fixed-variant: '#005234'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1612'
  on-background: '#d9e5df'
  surface-variant: '#2c3733'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 22px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system embodies high-performance technical assessment: precise, focused, and instrument-grade. Designed for technical interviewers, engineering leaders, and software candidates, the interface projects the authority and focus of an advanced IDE combined with an elite evaluation cockpit.

The visual language merges **Technical Minimalism** with **Instrumental Tactility**:
- Deep obsidian and forest-slate tonal architecture keeps cognitive load minimal during high-pressure coding tasks.
- High-contrast electric emerald indicators convey success, intelligence, and system readiness.
- Dense, rigorous data display emphasizes clarity over ornamentation.
- Subtle inner glows, precise 1px borders, and measured dark-green radial gradients simulate physical hardware displays and high-fidelity code environments.

## Colors

The palette establishes a strict luminance hierarchy optimized for prolonged, glare-free assessment sessions:

### Base Surfaces & Canvas
- **Canvas Base:** `#080E0C` — Deepest void; background behind split-pane editors and workspace frames.
- **Surface Layer 1 (Panels):** `#101B17` — Sidebars, terminal tabs, and file trees.
- **Surface Layer 2 (Elevated):** `#16251F` — Floating cards, code block headers, inspect overlays.
- **Surface Layer 3 (Active/Hover):** `#1D322A` — Hover states for list rows and elevated interactive modules.

### Borders & Separators
- **Structural Borders:** `#263C31` — 1px outer frame outlines and primary dividers.
- **Muted Dividers:** `#1F332A` — Internal row separators, code gutter limits, and sub-panels.

### Accents & Semantics
- **Emerald Accent (Primary):** `#00D991` (Hover: `#05F2A4`, Active: `#00B377`) — Passed unit tests, optimal complexity ratings, primary actions.
- **AI Accent (Secondary):** `#3B82F6` (Light variant: `#60A5FA`, Background: `rgba(59, 130, 246, 0.1)`) — AI co-evaluator prompts, automated feedback, AST insights.
- **Amber Accent (Warning/Pending):** `#F59E0B` (Light variant: `#FBBF24`, Background: `rgba(245, 158, 11, 0.1)`) — Running tests, edge case flags, pending candidate review.
- **Red Accent (Error/Failure):** `#EF4444` (Light variant: `#F87171`, Background: `rgba(239, 68, 68, 0.1)`) — Failed assertions, syntax errors, regressions.

### Text Contrast Tiers
- **High-Emphasis Text:** `#F1F7F4` — Active code, headers, critical metrics.
- **Medium-Emphasis Text:** `#A4B5AC` — Labels, markdown descriptions, parameter names.
- **Muted/Disabled Text:** `#53685E` — Line numbers, inactive breadcrumbs, comment text.

## Typography

The type system creates clear separation between system interface structure and executable logic:

- **Inter (Primary UI):** Powers all platform copy, modal interactions, prompt summaries, and configuration dialogs. Rendered with calibrated negative letter-spacing at display scales for crisp density.
- **JetBrains Mono (Technical Engine):** Applied rigorously to editor buffers, test output runners, diff logs, complexity counters, tags, and tabular scoring metrics.

All monospaced labels utilize explicit uppercase transformations with extended letter-spacing (`0.04em` to `0.06em`) to ensure legibility in high-density environments.

## Layout & Spacing

The layout is built for complex, multi-pane productivity tools:

### Split-Workbench Architecture
- **Desktop (>= 1280px):** Fixed or draggable dual/triple pane grid with zero canvas bleed. Gutters between editor, problem definition, and console execution panels remain strictly locked to `1.5rem`.
- **Tablet (768px - 1279px):** 2-column or tab-swapped layout with collapsible navigation rail.
- **Mobile (< 768px):** Single-column stacked mode with a bottom sheet for execution outputs.

### Spacing Scale
- `space-xs` (4px): Inline icon-to-text gaps, badge padding.
- `space-sm` (8px): Form input padding, button inner gaps, code block margins.
- `space-md` (12px): Grouped input items, tight card internal margins.
- `space-lg` (16px): Card internal padding, modular element separation.
- `space-xl` (24px): Primary modal padding, section header gaps.

## Elevation & Depth

Visual hierarchy uses physical panel stratification with low-contrast structural outlines rather than heavy atmospheric shadows:

### Depth Stack
1. **Canvas Zero (`#080E0C`):** The structural floor. Inset panels sit directly on this plane.
2. **Surface Low (`#101B17`):** Flanked sidebars and consoles bordered with `1px solid #1F332A`.
3. **Surface Mid (`#16251F`):** Standard assessment cards, candidate code execution modules, and floating toolbar docks.
   - Border: `1px solid #263C31`
   - Shadow: `0 4px 16px -2px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.3)`
4. **Surface High / Modals (`#16251F`):** Critical test evaluation dialogues, command palettes, and AI query outputs.
   - Border: `1px solid #3B82F6` (when AI-focused) or `1px solid #263C31`
   - Shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.65), 0 0 24px -2px rgba(0, 217, 145, 0.08)`

### Lighting & Glows
Ambient shadows use dark emerald and sapphire tints:
- Primary interactive elements (emerald buttons, focused fields) emit a restrained peripheral ring: `0 0 0 1px #00D991, 0 0 12px rgba(0, 217, 145, 0.25)`.
- AI diagnostic components carry a muted blue back-gradient: `radial-gradient(ellipse at top right, rgba(59, 130, 246, 0.08), transparent 70%)`.

## Shapes

The design system maintains strict geometric discipline:

- **Corner Radii:** Set to a baseline of `10px` to `12px` (`roundedness: 2`). Panels, cards, and modal dialogs feel modern and refined without softening into casual bubbly territory.
- **Controls & Small Components:** Buttons, badge indicators, and form inputs utilize `8px` (`0.5rem`) to remain sharp alongside monospaced code.
- **Code Highlights & Inline Badges:** Use a tighter `4px` radius to match line-height metrics within text bodies.
- **Pill Exceptions:** Restricted entirely to test run outcome status pills (`Passed`, `Failed`, `Running`) to distinguish status indicators from clickable actions.

## Components

### Buttons
- **Primary:** Background `#00D991`, text `#080E0C` (JetBrains Mono, 600 weight). Hover: `#05F2A4`. Focus ring: `2px solid rgba(0, 217, 145, 0.5)`.
- **Secondary / Outline:** Background `transparent`, border `1px solid #263C31`, text `#F1F7F4`. Hover: background `#16251F`, border `#00D991`.
- **AI Assist Action:** Background `rgba(59, 130, 246, 0.12)`, border `1px solid rgba(59, 130, 246, 0.35)`, text `#60A5FA`. Hover: background `rgba(59, 130, 246, 0.22)`, border `#3B82F6`.
- **Ghost / Tool:** Background `transparent`, text `#A4B5AC`. Hover: background `#16251F`, text `#F1F7F4`.

### Code Editor & Terminal Consoles
- **Editor Frame:** Surface `#101B17`, outer border `1px solid #263C31`. Active tab line indicator: `2px solid #00D991`.
- **Gutter:** Surface `#080E0C`, text `#53685E`, divider right border `1px solid #1F332A`.
- **Inline Diffs:** Additions use `rgba(0, 217, 145, 0.12)` with `#00D991` text; deletions use `rgba(239, 68, 68, 0.12)` with `#F87171` text.

### Test Result Chips & Badges
- **Pass Badge:** Background `rgba(0, 217, 145, 0.1)`, text `#00D991`, border `1px solid rgba(0, 217, 145, 0.25)`.
- **Fail Badge:** Background `rgba(239, 68, 68, 0.1)`, text `#F87171`, border `1px solid rgba(239, 68, 68, 0.25)`.
- **AI Insight Badge:** Background `rgba(59, 130, 246, 0.1)`, text `#60A5FA`, border `1px solid rgba(59, 130, 246, 0.25)`. Includes sparkle indicator icon.

### Form Inputs & Selectors
- **Input Fields:** Background `#101B17`, border `1px solid #263C31`, text `#F1F7F4`, placeholder `#53685E`. Height `38px`, padding `0 12px`.
- **Focus State:** Border `#00D991`, box-shadow `0 0 0 1px #00D991, 0 0 10px rgba(0, 217, 145, 0.15)`.

### Cards & Assessment Modules
- Surface `#16251F`, border `1px solid #263C31`, border-radius `10px`. 
- Padding: `16px` or `24px`.
- Optional top accent stripe (1px gradient from `#00D991` to `#3B82F6`) for platform benchmark summaries.

### Metric Meters & High-Score Gauges
- Progress track background `#101B17` with `1px solid #1F332A`.
- Fill indicator: smooth solid `#00D991` or stepped segments.
- Sub-metric percentile markers: vertical `1px` lines in `#A4B5AC`.