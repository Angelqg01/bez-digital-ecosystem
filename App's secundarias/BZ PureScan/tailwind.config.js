/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,jsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bz-bg': '#101922',
                'bz-surface': '#1a2530',
                'bz-surface-2': '#24303d',
                'bz-primary': '#2b8cee',
                'bz-primary-alt': '#9ecaff',
                'bz-primary-container': '#2196f3',
                'bz-neon': '#39ff14',
                'bz-emerald': '#40e56c',
                'bz-amber': '#f59e0b',
                'bz-text': '#f6f7f8',
                'bz-text-muted': '#94a3b8',
                'bz-border': 'rgba(148, 163, 184, 0.1)',
                'bz-ghost-border': 'rgba(64, 71, 82, 0.15)',
                
                // Scanner Original Design Colors
                "primary": "#2b8cee",
                "background-light": "#f6f7f8",
                "background-dark": "#101922",
                "neon-green": "#39ff14",

                // Storage Original Design Colors (MD3)
                "on-primary-fixed": "#001d36",
                "secondary-container": "#02c953",
                "primary-container": "#2196f3",
                "on-tertiary-fixed-variant": "#6d3900",
                "surface-dim": "#0c1420",
                "error": "#ffb4ab",
                "on-surface-variant": "#bfc7d4",
                "on-secondary": "#003912",
                "surface-container-lowest": "#070e1a",
                "outline": "#89919d",
                "secondary-fixed": "#69ff87",
                "surface-container": "#18202c",
                "surface": "#0c1420",
                "surface-variant": "#2d3542",
                "inverse-on-surface": "#29313e",
                "on-tertiary-fixed": "#2e1500",
                "error-container": "#93000a",
                "primary-fixed": "#d1e4ff",
                "on-secondary-container": "#004d1b",
                "on-secondary-fixed-variant": "#00531e",
                "on-surface": "#dbe3f4",
                "surface-container-high": "#232a37",
                "on-tertiary": "#4d2700",
                "surface-tint": "#9ecaff",
                "tertiary-fixed-dim": "#ffb77b",
                "on-error": "#690005",
                "surface-container-low": "#141c28",
                "on-primary-fixed-variant": "#00497d",
                "secondary-fixed-dim": "#3ce36a",
                "tertiary": "#ffb77b",
                "inverse-surface": "#dbe3f4",
                "tertiary-fixed": "#ffdcc2",
                "on-tertiary-container": "#452200",
                "on-secondary-fixed": "#002108",
                "surface-bright": "#323947",
                "on-background": "#dbe3f4",
                "inverse-primary": "#0061a4",
                "secondary": "#40e56c",
                "surface-container-highest": "#2d3542",
                "background": "#0c1420",
                "on-error-container": "#ffdad6",
                "tertiary-container": "#db7900",
                "on-primary-container": "#002c4f",
                "outline-variant": "#404752",
                "primary-fixed-dim": "#9ecaff",
                "on-primary": "#003258"
            },
            fontFamily: {
                'display': ['Space Grotesk', 'sans-serif'],
                'body': ['Inter', 'sans-serif'],
            },
            fontSize: {
                'display-lg': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.02em' }],
                'headline-lg': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
                'title-lg': ['1.5rem', { lineHeight: '2rem' }],
                'title-md': ['1.25rem', { lineHeight: '1.75rem' }],
                'title-sm': ['1rem', { lineHeight: '1.5rem' }],
                'label-lg': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '700' }],
                'label-md': ['0.75rem', { lineHeight: '1.25rem', fontWeight: '700' }],
                'label-sm': ['0.625rem', { lineHeight: '1rem', fontWeight: '700', letterSpacing: '0.1em' }],
                'body-lg': ['1rem', { lineHeight: '1.5rem' }],
                'body-md': ['0.875rem', { lineHeight: '1.25rem' }],
                'body-sm': ['0.75rem', { lineHeight: '1.25rem' }],
            },
            spacing: {
                '0.5': '0.1rem',    // spacing-1
                '1': '0.2rem',       // spacing-2
                '2': '0.5rem',       // spacing-4
                '3': '0.75rem',      // spacing-5
                '6': '1.5rem',       // spacing-6
                '12': '3rem',        // spacing-16
                '16': '3.5rem',      // spacing-28
            },
            borderRadius: {
                'xs': '0.25rem',
                'sm': '0.375rem',
                'md': '0.5rem',
                'lg': '0.75rem',
                'xl': '1rem',
            },
            backdropBlur: {
                'sm': '10px',
                'md': '20px',
                'lg': '30px',
            },
            boxShadow: {
                'glow': '0 8px 32px rgba(43, 140, 238, 0.3)',
                'glow-neon': '0 8px 32px rgba(57, 255, 20, 0.3)',
                'ambient': '0 20px 40px rgba(0, 0, 0, 0.4)',
                'card': '0 2px 8px rgba(0, 0, 0, 0.2)',
            },
            animation: {
                'scan': 'scan 3s infinite linear',
                'pulse-glow': 'pulse-glow 2s infinite',
            },
            keyframes: {
                'scan': {
                    '0%': { top: '0%' },
                    '100%': { top: '100%' },
                },
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(57, 255, 20, 0.7)' },
                    '50%': { boxShadow: '0 0 0 10px rgba(57, 255, 20, 0)' },
                },
            },
        },
    },
    plugins: [],
}
