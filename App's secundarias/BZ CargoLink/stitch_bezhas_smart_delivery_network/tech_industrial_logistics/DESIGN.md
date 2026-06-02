---
name: Tech-Industrial Logistics
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#d7ffc5'
  on-secondary: '#053900'
  secondary-container: '#2ff801'
  on-secondary-container: '#0f6d00'
  tertiary: '#fff3f1'
  on-tertiary: '#650b00'
  tertiary-container: '#ffcec4'
  on-tertiary-container: '#b91e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#79ff5b'
  secondary-fixed-dim: '#2ae500'
  on-secondary-fixed: '#022100'
  on-secondary-fixed-variant: '#095300'
  tertiary-fixed: '#ffdad3'
  tertiary-fixed-dim: '#ffb4a5'
  on-tertiary-fixed: '#3e0400'
  on-tertiary-fixed-variant: '#8e1400'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-mono:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  data-display:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is built on the philosophy of **Logística Tech-Industrial**. It prioritizes operational efficiency and decentralized transparency over decorative elements. The visual direction is a fusion of **Minimalism** and **High-Contrast Brutalism**, designed to evoke the feeling of a professional-grade terminal rather than a consumer delivery app.

The target audience consists of independent couriers, smart-contract auditors, and high-frequency users who value precision and speed. The UI should evoke a sense of "On-chain Authority"—reliable, immutable, and technologically advanced. Visual components are stripped of unnecessary ornamentation to ensure that data—such as route efficiency, gas fees, and reward tallies—remains the primary focus.

## Colors

The palette is optimized for high-glanceability in varied lighting conditions, typical for last-mile delivery environments. The default mode is **Dark**, utilizing a Deep Charcoal base to reduce eye strain and emphasize the luminous action colors.

- **Electric Cyan (#00F0FF):** Used for primary actions, navigation triggers, and active delivery states.
- **Neon Green (#39FF14):** Reserved for "Success" states, smart contract confirmations, and positive reward fluctuations.
- **Pure White (#FFFFFF):** Used exclusively for high-priority typography and icons against the dark background.
- **Deep Charcoal / Surface:** Various shades of grey provide depth without breaking the industrial aesthetic.

Backgrounds should remain flat, while interactive elements leverage the primary colors to create a "glowing" effect against the darkness.

## Typography

The typography system utilizes a dual-font approach to balance technical precision with readability.

**Space Grotesk** is used for headlines, labels, and data points. Its geometric nature provides the "crypto-industrial" feel required for smart contract interaction and logistics tracking. It should be used for all numerical data to emphasize the technical nature of the app.

**Inter** is utilized for body copy and long-form information. Its neutral, systematic design ensures that instructional text and delivery details are legible at a glance, even on small mobile screens.

All labels should utilize uppercase styling and increased letter spacing to mimic industrial equipment labeling.

## Layout & Spacing

The design system follows a strict **Fixed Grid** model for mobile and a **Fluid Column** model for tablet/desktop interfaces. The layout is based on an **8px rhythm**, ensuring all elements align to a technical grid.

- **Margins:** 20px on mobile to provide breathing room against the high-contrast edges.
- **Gutters:** 16px between cards and interactive elements.
- **Density:** Information density is high. Use "Stack" variables to tightly group related technical data (e.g., hash ID and timestamp) while using larger gaps to separate distinct functional blocks (e.g., map view and order details).

Layouts should feel modular, with clear vertical and horizontal lines defining the space, resembling a logistics manifest.

## Elevation & Depth

In this design system, depth is conveyed through **Tonal Layering** and **Luminous Accents** rather than traditional shadows. 

1.  **Base Layer:** The darkest charcoal (#0C0C0C) represents the "ground."
2.  **Surface Layer:** Interactive cards and containers use a slightly lighter grey (#1E1E1E) with **1px solid borders** (#2D2D2D) to define edges.
3.  **Active Elevation:** Instead of lifting an element with a shadow, active elements or "Primary" components utilize a **Subtle Outer Glow** using the primary color (Cyan). The glow should have a 10-15px blur with 30% opacity, making the element appear to "power on."
4.  **Information Overlay:** Use semi-transparent dark blurs (60% opacity) for modal backdrops to maintain the industrial feel without losing sight of the underlying data.

## Shapes

The shape language is "Hardened." To reflect the industrial nature of logistics, the design system utilizes **sharp corners with minimal rounding**.

- **Standard Radius:** 4px (rounded-sm) for buttons, input fields, and cards. This creates a professional, tool-like appearance while avoiding the aggression of 0px corners.
- **Data Containers:** Smaller internal tags or status chips use 2px rounding.
- **Icons:** Icons should be stroke-based (2px weight) with squared-off ends to match the UI corners. 

Avoid large pill shapes or circular buttons, as these lean too far into "consumer-friendly" territory and away from the intended technical-industrial aesthetic.

## Components

**Buttons**
Primary buttons feature a solid Electric Cyan fill with black text. On hover or active state, they emit a cyan glow. Secondary buttons use a ghost style with a 1px cyan border and no fill.

**Chips & Status Indicators**
Smart contract statuses (e.g., *Pending, Executed, Relayed*) must use a "monospaced label" style within a boxed container. Use Neon Green for success/on-chain and Deep Grey for inactive states.

**Input Fields**
Inputs are rectangular with a 1px border. When focused, the border changes to Cyan, and a technical "bracket" icon or label should appear in the corner to indicate active data entry.

**Data Visualization**
Rewards and progress charts should avoid gradients. Use solid blocks of Cyan and Green. Use "Scanline" textures (subtle horizontal lines) over primary data visualization areas to reinforce the tech-industrial theme.

**Cards**
Logistics cards (Orders/Deliveries) should include a "Tech Header" containing a hex code or ID in the top right corner in `label-mono` typography, separated by a thin horizontal divider from the card content.