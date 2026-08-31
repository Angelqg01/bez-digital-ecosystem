# Design System Specification: The Emerald Ledger

## 1. Overview & Creative North Star
**Creative North Star: "The Sovereign Vault"**
This design system moves beyond the "standard dashboard" to create a high-fidelity, editorial DeFi experience. It is built on the concept of **Sovereign Vaults**—where digital assets aren't just rows in a database, but physical-feeling objects protected by layers of obsidian glass and emerald energy. 

The aesthetic rejects "flat" web design in favor of **Tonal Depth**. We achieve a premium, custom feel through intentional asymmetry (e.g., placing high-density transaction data against expansive, breathable headers) and a strict reliance on color-shift boundaries rather than structural lines. The goal is a UI that feels like a high-end physical hardware wallet: silent, authoritative, and impossibly sharp.

---

## 2. Colors & Surface Architecture

### The Palette
The core of the system is the interplay between the deep-space neutrals and the high-energy Emerald (`primary`) and Gold (`secondary`).

*   **Primary (Emerald):** `#42e5b0` (Surface Tint) / `#00c896` (Container). Use for "success" actions and liquidity flows.
*   **Secondary (Gold):** `#ffdb9d` / `#feb700`. Reserved for high-tier status, alerts, or "VIP" transaction types.
*   **Surface Hierarchy:**
    *   `surface_container_lowest`: `#0a0e17` (The deep background)
    *   `surface`: `#0f131c` (The base level for cards)
    *   `surface_container_high`: `#252a34` (For elevated interactive elements)

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** To define space, use background shifts. A card (`surface`) sitting on the main page (`surface_dim`) provides all the definition needed. Lines create visual noise; color transitions create "atmosphere."

### Glass & Gradient Soul
For main CTAs and "Hero" cards, use a **Signature Texture**: A linear gradient from `primary` (#42e5b0) to `primary_container` (#00c896) at a 135° angle. Apply a `backdrop-blur` of 12px to floating overlays to create the "Obsidian Glass" effect.

---

## 3. Typography: The Editorial Contrast

The system uses a dual-type approach to balance human readability with machine precision.

*   **Inter (Sans-Serif):** Used for all UI chrome, headings, and instructional text. It provides the "Professional" weight. 
    *   *Headline-LG (2rem):* Bold, tight letter-spacing (-0.02em) for an authoritative look.
    *   *Body-MD (0.875rem):* Optimized for readability in high-density data environments.
*   **JetBrains Mono (Monospace):** Substituted via the `label` tokens. This is our "Technical Authority."
    *   **Rule:** Every Wallet Address, Transaction Hash, and Token Amount must be rendered in JetBrains Mono. This signals to the user that they are interacting with immutable ledger data.

---

## 4. Elevation & Depth: Tonal Layering

We do not use "Drop Shadows" in the traditional sense. We use **Ambient Luminescence**.

*   **The Layering Principle:** 
    *   Base Layer: `surface_container_lowest`
    *   Content Sections: `surface_container_low`
    *   Interactive Cards: `surface`
*   **Ghost Borders:** If accessibility requires a stroke (e.g., Input fields), use `outline_variant` (#3c4a43) at **20% opacity**. It should be felt, not seen.
*   **The Emerald Glow:** For the "Active" state of any container, apply a 20px outer blur using the `primary` color at 10% opacity. This mimics the "subtle glow" of high-tech hardware.

---

## 5. Components

### Buttons: The Kinetic Trigger
*   **Primary:** Solid `primary_container` with `on_primary_container` text. 16px (`lg`) corner radius.
*   **Secondary:** Ghost style. No background, `outline` stroke at 20% opacity. On hover, background shifts to `surface_container_high`.
*   **Tertiary:** Text-only, using `primary` color, strictly for low-priority utility actions.

### Inputs: The Data Port
*   **Styling:** Background set to `surface_container_lowest`. No border, only a 2px bottom-indicator that lights up in `primary` when focused.
*   **Typography:** Labels use `label-sm` (Space Grotesk/Mono) to feel like technical metadata.

### Cards: The Ledger Unit
*   **Constraint:** Use `rounded-xl` (1.5rem / 24px) for outer containers and `rounded-lg` (1rem / 16px) for inner nested elements.
*   **Layout:** Forbid dividers. Use `spacing-8` (1.75rem) to separate internal content blocks.

### Status Indicators: High-Contrast Signals
*   **Success:** `primary` with a soft glow.
*   **Warning:** `secondary` (Gold).
*   **Error:** `error` (#ffb4ab) on `error_container`.
*   *Note:* Status indicators should always be accompanied by a `label-sm` tag in Monospace.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts. Push the main balance to the left and keep technical metadata (hashes) in a slim, right-aligned column.
*   **Do** lean into `surface_container` variations to group content.
*   **Do** use JetBrains Mono for any value that is "on-chain."

### Don’t
*   **Don't** use `#000000` (Pure Black). It kills the depth of the "Emerald" glow. Use `surface_container_lowest`.
*   **Don't** use standard dividers or 1px lines to separate list items. Use vertical rhythm and subtle background shifts.
*   **Don't** use default Inter for numbers. Numbers are data; data is Monospace.