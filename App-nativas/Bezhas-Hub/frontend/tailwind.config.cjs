/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Habilitamos el modo oscuro basado en una clase
  theme: {
    extend: {
      colors: {
        // === PALETA LIGHT MODE - Basada en imagen de referencia === //

        // Colores primarios (Violeta/Morado según imagen)
        primary: {
          50: '#F5F3FF',   // Fondo general lavanda muy claro
          100: '#EBE7FF',
          200: '#D9CFFF',
          300: '#C7B7FF',
          400: '#B39FFF',
          500: '#9F87FF',  // Color principal botones y elementos activos
          600: '#8B6FFF',
          700: '#7757FF',
          800: '#6340E8',
          900: '#4F29D0',
        },

        // Rosa pastel para acentos (según imagen)
        accent: {
          50: '#FFF5F7',
          100: '#FFE4E9',
          200: '#FFC4D0',  // Rosa pastel cards
          300: '#FFB6C1',
          400: '#FFA4B3',
          500: '#FF92A5',
          600: '#FF6B88',
          700: '#FF5278',
          800: '#E8446E',
          900: '#D03664',
        },

        // Naranja coral pastel (según imagen)
        orange: {
          50: '#FFF4EE',
          100: '#FFE9DD',
          200: '#FFD3BB',
          300: '#FFB088',  // Naranja cards
          400: '#FF9F6E',
          500: '#FF8E54',
          600: '#FF7D3A',
          700: '#F06020',
          800: '#D04410',
          900: '#B03000',
        },

        // Amarillo pastel (según imagen)
        yellow: {
          50: '#FFFBF0',
          100: '#FFF6DC',
          200: '#FFEDB9',
          300: '#FFE4A3',  // Amarillo cards
          400: '#FFD88C',
          500: '#FFCC70',
          600: '#FFC054',
          700: '#F0A838',
          800: '#D09020',
          900: '#B07810',
        },

        // Verde menta pastel (según imagen)
        green: {
          50: '#F0FFF4',
          100: '#C6F6D5',
          200: '#A8E6CF',  // Verde menta cards
          300: '#94D7BB',
          400: '#7AC9A7',
          500: '#60BB93',
          600: '#46AD7F',
          700: '#2C9F6B',
          800: '#208B57',
          900: '#147743',
        },

        // Azul cielo pastel (según imagen)
        sky: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#C9E6FF',
          300: '#B4D4FF',  // Azul cielo cards
          400: '#A0C4FF',
          500: '#8CB4FF',
          600: '#78A4FF',
          700: '#6494F0',
          800: '#5084E0',
          900: '#3C74D0',
        },

        // Colores para el tema claro (Light Mode principal)
        light: {
          bg: '#F5F3FF',       // Fondo principal lavanda muy claro (según imagen)
          card: '#FFFFFF',     // Cards blanco puro (según imagen)
          hover: '#EBE7FF',    // Hover estado
          border: '#E2E8F0',   // Bordes suaves (según imagen)
          muted: '#F8FAFC',    // Backgrounds secundarios
          surface: '#FFFFFF',  // Superficie blanco puro
          background: '#F5F3FF',
          primary: '#9F87FF',  // Primary color
          'primary-focus': '#8B6FFF',
          secondary: '#FFC4D0',
          text: '#2D3748',     // Texto principal oscuro (según imagen)
          'text-muted': '#718096', // Texto secundario gris (según imagen)
        },

        // Colores de texto específicos
        'text-primary': '#2D3748',
        'text-secondary': '#718096',
        'text-muted': '#A0AEC0',

        // Colores para Dark Mode (mantener compatibilidad)
        dark: {
          background: '#1a1a2e',
          surface: '#1f1f3a',
          primary: '#9c27b0',
          'primary-focus': '#7b1fa2',
          secondary: '#e91e63',
          text: '#ffffff',
          'text-muted': '#a9a9a9',
        },

        // Textos (semánticos)
        text: {
          primary: '#2D3748',
          secondary: '#718096',
          muted: '#A0AEC0',
          accent: '#9F87FF',
          white: '#ffffff',
          dark: '#000000',
        },
      },

      // Backgrounds con gradientes (según imagen)
      backgroundImage: {
        'gradient-light': 'linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 100%)',
        'gradient-primary': 'linear-gradient(135deg, #9F87FF 0%, #8B6FFF 100%)',
        'gradient-card': 'linear-gradient(180deg, #FFFFFF 0%, #F5F3FF 100%)',
        'gradient-hero': 'linear-gradient(135deg, #9F87FF 0%, #B4D4FF 100%)',
        'gradient-accent': 'linear-gradient(135deg, #FFC4D0 0%, #FF92A5 100%)',
        'gradient-orange': 'linear-gradient(135deg, #FFB088 0%, #FF9F6E 100%)',
        'gradient-sky': 'linear-gradient(135deg, #B4D4FF 0%, #A0C4FF 100%)',
      },

      // Shadows suaves para Light Mode (según imagen)
      boxShadow: {
        'soft': '0 2px 8px rgba(159, 135, 255, 0.1)',
        'soft-lg': '0 10px 40px -10px rgba(159, 135, 255, 0.15)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px -2px rgba(159, 135, 255, 0.12)',
        'glow': '0 0 20px rgba(159, 135, 255, 0.15)',
        'button': '0 4px 14px rgba(159, 135, 255, 0.25)',
      },

      // Animaciones suaves
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.6s ease-in-out',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },

      // Espaciado adicional
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },

      // Border radius suaves
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
