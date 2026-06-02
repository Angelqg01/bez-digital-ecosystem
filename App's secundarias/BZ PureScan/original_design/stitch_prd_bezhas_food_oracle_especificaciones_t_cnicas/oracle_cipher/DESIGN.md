```markdown
# The Design System: Editorial Logistics & DeFi Oracle

## 1. Overview & Creative North Star
**The Creative North Star: "The Digital Agronomist"**
This design system moves away from the "busy dashboard" trope of traditional logistics. Instead, it adopts a high-end editorial approach to data. We treat information—whether it’s soil pH levels or DeFi yield rates—as a premium asset. 

The aesthetic is defined by **Atmospheric Depth**. By breaking the rigid 12-column grid with intentional asymmetry, overlapping "glass" modules, and extreme typographic contrast, we create an interface that feels like a futuristic command center. We prioritize breathing room over information density, ensuring that when data appears, it carries the weight of authority.

---

## 2. Colors & Surface Philosophy
The palette is rooted in the deep void of `surface` (#0c1420), providing a high-contrast stage for vibrant action colors.

### The "No-Line" Rule
**Standard 1px borders are strictly prohibited.** Sectioning must be achieved through:
- **Tonal Shifts:** Moving from `surface-container-low` to `surface-container-high`.
- **Negative Space:** Utilizing the Spacing Scale (e.g., `spacing-12` or `spacing-16`) to create natural cognitive breaks.
- **Glassmorphism:** Using `surface-variant` at 40% opacity with a 20px backdrop-blur to define floating modules.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-transparent materials:
- **Base Layer:** `surface` (#0c1420) – The infinite background.
- **Sub-Sections:** `surface-container-low` – Subtle containment for secondary data.
- **Primary Modules:** `surface-container` – The standard for data cards.
- **Active/Floating:** `surface-container-highest` – Reserved for modals or elevated interaction points.

### The "Glass & Gradient" Rule
To inject "soul" into the technical layout, use subtle linear gradients (135°) for primary actions, transitioning from `primary` (#9ecaff) to `primary_container` (#2196f3). Use the `secondary` (#40e56c) "Emerald" for growth-related DeFi metrics and successful logistics statuses.

---

## 3. Typography: The Technical Voice
We utilize a dual-font strategy to balance "High-Tech" with "Utility."

*   **Display & Headlines (Space Grotesk):** This is our "Editorial" voice. Use `display-lg` and `headline-lg` with tight letter-spacing (-0.02em) to create a commanding, architectural feel. This font suggests the precision of code and the scale of global logistics.
*   **Body & Labels (Inter):** This is our "Functional" voice. Inter is used for all data points, small labels, and long-form descriptions. It provides the legibility required for complex DeFi transactions.

**Hierarchy Tip:** Use `label-sm` in all-caps with 0.1em tracking for category headers to create a "Logistics 4.0" metadata aesthetic.

---

## 4. Elevation & Depth
In this system, depth is a functional tool, not a stylistic flourish.

*   **Tonal Layering:** Avoid shadows for static cards. Place a `surface-container-lowest` card inside a `surface-container-low` section to create "recessed" depth.
*   **Ambient Shadows:** For floating elements (like a Web3 wallet connection modal), use a high-spread, low-opacity shadow: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)`.
*   **The Ghost Border Fallback:** If a container lacks sufficient contrast against its background, use a "Ghost Border": `outline-variant` (#404752) at **15% opacity**. It should be felt, not seen.
*   **Glow States:** Interactive elements (charts/active gauges) should utilize a soft outer glow using the `primary` token at 20% opacity to mimic a high-tech illuminated display.

---

## 5. Components

### Buttons
*   **Primary:** Solid gradient (`primary` to `primary_container`). `rounded-md` (0.375rem). Use `on_primary` for text.
*   **Secondary:** Ghost style. Transparent background with a `Ghost Border` and `primary` colored text.
*   **Tertiary:** No container. `label-md` weight text with a trailing 12px chevron.

### Cards & Data Modules
*   **Constraint:** Forbid divider lines. 
*   **Styling:** Use `surface-container` with a `rounded-xl` (0.75rem) corner. 
*   **Header:** Use `title-sm` for the card title, paired with an `emerald` (secondary) pulse icon for "Live" data feeds.

### Input Fields
*   **State:** Background should be `surface-container-lowest`. 
*   **Focus:** Transition the "Ghost Border" from 15% opacity to 100% `primary` color. 
*   **Error:** Use `error` (#ffb4ab) text and a subtle `error_container` background tint.

### Data Visualization (Gauges & Charts)
*   **Line Charts:** Use a 2px stroke of `primary`. Use a vertical gradient fill from `primary` (20% opacity) to transparent.
*   **Gauges:** Semi-circular shapes using `secondary` (Emerald) to represent positive "Food Oracle" health or supply chain efficiency.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts where a large `display-md` headline is balanced by a small, data-rich card.
*   **Do** use backdrop blurs on any element that overlays another to maintain the "Glassmorphism" theme.
*   **Do** lean into the "Dark Mode" by letting the deep navy (`surface`) dominate the visual real estate.

### Don’t:
*   **Don’t** use pure white (#FFFFFF). Always use `on_surface` (#dbe3f4) for text to reduce eye strain and maintain the premium feel.
*   **Don’t** use "Drop Shadows" on standard cards. Stick to tonal layering.
*   **Don’t** use icons as purely decorative elements. Every icon must represent a functional data point or action.
*   **Don’t** use standard grid-based dividers. If you need to separate content, use a 24px vertical gap or a subtle shift in surface color.

---

## 7. Spacing & Rhythm
The system relies on a mathematical 0.1rem-based scale.
*   **Component Internal Padding:** Use `spacing-4` (0.9rem) or `spacing-5` (1.1rem).
*   **Section Gaps:** Use `spacing-16` (3.5rem) to provide the "Editorial" breathing room.
*   **Micro-spacing:** Use `spacing-1` (0.2rem) for label-to-value relationships.

This system is designed to be felt as much as it is seen—an interface that reflects the transparency of the blockchain and the precision of modern agriculture.```