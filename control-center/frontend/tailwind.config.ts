import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bezhas: {
          blue: "#0F172A",
          accent: "#2563EB",
          orange: "#F97316",
          cyan: "#00C2FF",
          purple: "#8B5CF6",
          emerald: "#10B981"
        },
        "outline": "#444657",
        "background": "#080911",
        "tertiary-fixed": "#97f0ff",
        "on-secondary-fixed": "#2d0050",
        "surface-dim": "#080911",
        "surface-container-highest": "#282934",
        "inverse-surface": "#e2e1ef",
        "on-surface": "#f5f6f8",
        "on-secondary-fixed-variant": "#7022b4",
        "primary-fixed-dim": "#bcc2ff",
        "on-tertiary-fixed": "#001f24",
        "surface-container": "#12131c",
        "primary-fixed": "#dfe0ff",
        "primary-container": "#001998",
        "error": "#ffb4ab",
        "inverse-primary": "#bcc2ff",
        "surface": "#080911",
        "tertiary-container": "#004f58",
        "secondary-container": "#323e92",
        "on-tertiary-container": "#97f0ff",
        "on-surface-variant": "#c5c5da",
        "on-secondary": "#ffffff",
        "surface-bright": "#1a1b25",
        "surface-container-low": "#0c0d17",
        "surface-variant": "#1a1b25",
        "surface-tint": "#0d33f2",
        "secondary-fixed-dim": "#e0b6ff",
        "secondary-fixed": "#f3daff",
        "on-tertiary": "#000000",
        "on-primary-fixed-variant": "#0027d4",
        "on-error": "#690005",
        "tertiary": "#22d3ee",
        "on-secondary-container": "#a6b0ff",
        "tertiary-fixed-dim": "#22d3ee",
        "on-background": "#f5f6f8",
        "on-error-container": "#ffdad6",
        "inverse-on-surface": "#080911",
        "outline-variant": "rgba(255, 255, 255, 0.1)",
        "on-primary-fixed": "#000c61",
        "on-tertiary-fixed-variant": "#004f58",
        "error-container": "#93000a",
        "on-primary": "#ffffff",
        "secondary": "#a855f7",
        "surface-container-lowest": "#05060a",
        "surface-container-high": "#1e1f29",
        "on-primary-container": "#dfe0ff",
        "primary": "#0d33f2"
      },
      fontFamily: {
        "headline": ["var(--font-space-grotesk)", "sans-serif"],
        "body": ["var(--font-space-grotesk)", "sans-serif"],
        "label": ["var(--font-space-grotesk)", "sans-serif"]
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'bounce-dot': 'bounce-dot 1.4s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in': 'slide-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 5px rgba(37, 99, 235, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(37, 99, 235, 0.7)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
