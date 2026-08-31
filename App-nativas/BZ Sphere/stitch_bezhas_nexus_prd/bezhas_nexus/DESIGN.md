# Design System Strategy: Cyber-Finance & Glassmorphism

## 1. Overview & Creative North Star: "The Ethereal Vault"
The Creative North Star for this design system is **"The Ethereal Vault."** In the volatile world of Web3 and DeFi, the interface must balance two opposing forces: the high-speed, liquid nature of digital assets and the unshakable solidity of a secure vault. 

We break the "standard dashboard" template by rejecting rigid grids and heavy borders. Instead, we use **intentional asymmetry** and **tonal depth**. The UI is not a flat plane; it is a three-dimensional environment where data modules float in a deep-space vacuum. By overlapping frosted glass elements and using glowing neon accents to guide the eye, we create a signature experience that feels premium, cinematic, and technologically superior to "off-the-shelf" DeFi platforms.

---

## 2. Colors: Depth and Luminance
The palette is built on a foundation of "Midnight" neutrals to allow the neon "Cyber" accents to pop without causing visual fatigue.

*   **Primary (`#c3f5ff`) & Primary Container (`#00e5ff`):** These are your "Electric Blue" pulses. Use them for active states, high-value data points, and primary navigation.
*   **Tertiary (`#ffecad`) & Tertiary Container (`#f4ce00`):** Reserved exclusively for **$BEZ token interactions** and premium "Gold" status indicators. Use sparingly to maintain its high-value "jewelry" feel.
*   **Surface Hierarchy (The Depth Engine):**
    *   **Background (`#10141a`):** The infinite void. 
    *   **Surface Container Low (`#181c22`):** Large structural sections.
    *   **Surface Container High (`#262a31`):** Floating cards and interactive modules.
    *   **Surface Bright (`#353940`):** Hover states and active glass highlights.

### The "No-Line" Rule
**Explicit Instruction:** Prohibit the use of 1px solid borders for sectioning content. Boundaries must be defined solely through background color shifts or the "Ghost Border" fallback (see Elevation). If a container needs to be seen, it must be felt through a change from `surface-container-low` to `surface-container-high`.

### The "Glass & Gradient" Rule
To achieve the "Cyber-Finance" aesthetic, use Glassmorphism for floating modules. 
*   **Formula:** `surface-container-high` + `opacity: 0.6` + `backdrop-filter: blur(20px)`.
*   **Signature Textures:** Apply a linear gradient (45deg) from `primary` to `primary-container` at 15% opacity as a subtle background overlay for hero modules to give them a "powered-on" energy.

---

## 3. Typography: Editorial Authority
We utilize a dual-font strategy to balance high-tech innovation with professional readability.

*   **Display & Headlines (Space Grotesk):** These are your "Architectural" weights. Space Grotesk’s geometric quirks lean into the futuristic theme. Use `display-lg` (3.5rem) for portfolio totals and `headline-md` (1.75rem) for section headers.
*   **Titles & Body (Inter):** Inter provides the "Security" and "Clarity" required for financial data. 
    *   **Title-LG (1.375rem):** For card titles and module names.
    *   **Body-MD (0.875rem):** The workhorse for all DeFi transaction details.
*   **Hierarchy Note:** Use high contrast between `on-surface` (white-blue) and `on-surface-variant` (muted cyan-grey) to create a visual "hush" for secondary information, making the primary financial data scream with clarity.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "Web 2.0." For this design system, depth is environmental.

*   **The Layering Principle:** Stack containers to create hierarchy. A `surface-container-lowest` module nested inside a `surface-container-low` area creates a "recessed" look, perfect for input fields. A `surface-container-highest` module on a `surface` background creates an "elevated" look for urgent alerts.
*   **Ambient Shadows:** For floating glass modules, use a tinted shadow: `box-shadow: 0 20px 40px rgba(0, 218, 243, 0.08)`. This mimics the blue neon light reflecting off the surface.
*   **The "Ghost Border":** For accessibility, use the `outline-variant` token at **15% opacity**. It should be barely visible—a suggestion of an edge rather than a hard stop.
*   **Inner Glow:** To sell the glass effect, apply a 1px inner border (stroke) using `primary` at 10% opacity on the top and left edges only. This simulates light hitting the edge of a glass pane.

---

## 5. Components: Precision Primitives

### Buttons
*   **Primary:** A solid fill of `primary-container` with `on-primary-container` text. Apply a subtle outer glow (`primary-fixed-dim`) on hover.
*   **Secondary (Glass):** No fill. A "Ghost Border" of `primary` at 30% opacity. Text is `primary`.
*   **Tertiary ($BEZ):** A gradient fill of `tertiary` to `tertiary-container`. Use for "Buy/Stake $BEZ" actions only.

### Input Fields
*   **Styling:** Forbid white backgrounds. Use `surface-container-lowest`. 
*   **State:** On focus, the "Ghost Border" becomes 100% `primary` opacity, and the background glows slightly with a 5% `primary` tint.

### Cards & Modules
*   **Rule:** No dividers. Use **Spacing Scale 6 (1.5rem)** to separate content blocks. 
*   **Nesting:** All cards must use `lg` (0.5rem) or `xl` (0.75rem) corner radius to feel sophisticated. Avoid "DEFAULT" sharpness for large modules.

### DeFi Specific: The "Pulse" Chip
*   **Usage:** For live price feeds or active network status. 
*   **Style:** A `surface-container-highest` chip with a 4px circular dot of `primary` that has a breathing animation (opacity 1.0 to 0.4).

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts. For example, a heavy 8-column glass module offset against a 4-column empty space containing a floating decorative gradient.
*   **Do** use `backdrop-blur` generously on modals to keep the user grounded in the "Nexus" environment.
*   **Do** use the Spacing Scale (specifically `8`, `12`, and `16`) to create "Luxury Space"—premium designs need room to breathe.

### Don’t:
*   **Don’t** use pure black (`#000000`) or pure white (`#ffffff`). Use the provided `surface` and `on-surface` tokens to maintain the cinematic color grade.
*   **Don’t** use 1px solid dividers. If you need to separate data in a list, use a background shift to `surface-container-low` on every other row.
*   **Don’t** use "Stock" icons. Icons must be sharp, thin-stroke (1.5px), and use the `outline` color token.