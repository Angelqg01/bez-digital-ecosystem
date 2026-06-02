---
name: Global Compliance Engine
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8f9097'
  outline-variant: '#44474d'
  surface-tint: '#b9c7e4'
  primary: '#b9c7e4'
  on-primary: '#233148'
  primary-container: '#0a192f'
  on-primary-container: '#74829d'
  inverse-primary: '#515f78'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#271500'
  on-tertiary-container: '#b67300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#b9c7e4'
  on-primary-fixed: '#0d1c32'
  on-primary-fixed-variant: '#39475f'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin: 32px
  container-max: 1440px
---

## Brand & Style

The brand personality is rooted in **Operational Excellence** and **Absolute Reliability**. Designed for high-stakes global logistics, the visual language prioritizes precision, speed of comprehension, and a sense of "engineered" quality. The aesthetic is inspired by professional hardware—clean lines, high-contrast functional elements, and a focus on utility over decoration.

The design style is **Corporate / Modern** with a lean toward technical industrialism. It leverages a dark-themed architecture to reduce eye strain for operators managing 24/7 global supply chains. Every interface element is designed to feel like a high-performance instrument: sturdy, responsive, and authoritative.

## Colors

The palette is anchored by **Deep Navy (#0A192F)**, which serves as the bedrock of the UI, conveying the weight of a secure, institutional platform. This is contrasted with a vibrant **Emerald Green (#10B981)** used exclusively for "Go" signals, success states, and cleared customs statuses. **Safety Orange (#F59E0B)** acts as a high-visibility disruptor, reserved for customs alerts, pending inspections, or regulatory warnings.

The neutral scale utilizes cool grays to maintain a technical, "Logitech-style" hardware feel. Text is primarily rendered in high-contrast whites and soft grays to ensure that critical data points are never missed in complex tables.

## Typography

This design system utilizes **Inter** for all applications. It was selected for its exceptional legibility in data-dense environments and its "neutral-technical" character. 

The typographic hierarchy is structured to support rapid scanning. **Label-caps** are used for table headers and metadata descriptions to create a clear distinction from the data itself. **Data-mono** (Inter with tight tracking) is utilized for tracking numbers, container IDs, and HS codes, ensuring that alphanumeric strings are easily readable and distinct from narrative text.

## Layout & Spacing

This design system employs a **Fluid Grid** model based on a 12-column system. The spacing rhythm follows a strict 4px base unit to ensure alignment and density. 

In dashboard views, the layout prioritizes horizontal real estate to accommodate wide data tables and timelines. Content is grouped into logical "modules" with consistent 24px gutters, allowing the eye to jump between distinct operational segments (e.g., "Active Shipments" vs. "Customs Queue") without friction. Margins are generous at 32px to provide "breathing room" against the dark background, preventing the dense information from feeling overwhelming.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** rather than heavy shadows. The background uses a deep, "Void" navy (#020617), while primary workspace containers use a slightly lighter "Surface" navy (#0B1120). 

To mimic the Logitech professional hardware aesthetic, subtle **low-contrast outlines** (1px borders in #1E293B) are used to define card boundaries. When an element requires focus (like a modal or an active shipment card), a very soft, diffused **ambient shadow** is applied with a 10% opacity black tint to "lift" the object off the grid without breaking the clean, flat aesthetic.

## Shapes

The shape language is **Soft (0.25rem)**. This subtle rounding is applied to all buttons, input fields, and status badges. It strikes a balance between the "sharpness" of institutional software and the "comfort" of modern consumer technology. 

Larger containers like cards may use the `rounded-lg` (0.5rem) setting to soften the overall dashboard, but interactive elements remain tighter to maximize screen real estate and maintain a precise, engineered feel.

## Components

### Buttons & Inputs
Buttons feature a subtle top-to-bottom gradient to give them a tactile, "pressable" feel. Primary actions use the Emerald Green to signify movement. Input fields use a dark inset background with a 1px border that glows slightly when focused, mimicking high-end backlit hardware.

### Data-Heavy Cards
Cards are the primary vehicle for shipment details. They utilize a "Header-Body-Footer" structure where the header contains the tracking ID in `label-caps`, the body contains the core logistics data in a 2-column key-value layout, and the footer contains the action buttons (e.g., "Release Docs").

### Status Badges
Status badges are critical for customs clearance. They use high-chroma backgrounds (Emerald or Safety Orange) with black text for maximum contrast. Their shape is a "squircle" (0.25rem radius) to differentiate them from standard rounded buttons.

### Navigation
A persistent side-rail navigation provides a high-level overview of the global network. Icons are stroke-based, 20px, and use a consistent 2px line weight to match the robust feel of the typography.

### Functional Forms
Forms are designed for speed, using top-aligned labels and clear validation states. Error messages leverage the Safety Orange to ensure immediate correction during time-sensitive customs filings.