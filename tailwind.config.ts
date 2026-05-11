import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#E85D04',   // warm orange — energy, faith
          dark: '#0B2545',      // deep navy — trust
          accent: '#FFB703',    // gold — celebration
          cream: '#FAF6F1',     // soft background
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
