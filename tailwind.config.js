/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // Palette Galerie Mariage
      colors: {
        background: '#FDFAF6',
        gold: '#C9A84C',
        'gold-hover': '#A8873C',
        primary: '#2C2C2C',
        secondary: '#8A7F72',
        overlay: 'rgba(0,0,0,0.85)',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        modal: '16px',
      },
      keyframes: {
        // Slide-up pour la SelectionBar
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        // Fade-in pour le Lightbox
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Shake pour code incorrect
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-6px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(6px)' },
        },
        // Pulsation dorée pour la carte sélectionnée
        goldPulse: {
          '0%, 100%': { boxShadow: '0 0 0 2px #C9A84C' },
          '50%': { boxShadow: '0 0 0 4px #C9A84C88' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.25s ease-out',
        slideDown: 'slideDown 0.25s ease-in',
        fadeIn: 'fadeIn 0.15s ease-out',
        shake: 'shake 0.5s ease-in-out',
        goldPulse: 'goldPulse 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
