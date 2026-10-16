import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",  // ✅ Un seul chemin
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#ebf4fb',
          100: '#d7e9f7',
          200: '#afd3ef',
          300: '#87bee7',
          400: '#1E88E5',    // Bleu moyen officiel
          500: '#0B5EA8',    // Bleu profond officiel Mwangaza Wetu
          600: '#095191',
          700: '#074277',
          800: '#05335c',
          900: '#03213c',
        },
        mwangaza: {
          blue: '#0B5EA8',
          blueMed: '#1E88E5',
          orange: '#E56A1E',
          amber: '#D4A017',
          beige: '#F8F7F5',
          anthracite: '#2D3748',
          lightGray: '#E5E7EB',
          green: '#16A34A',
        },
        success: '#16A34A',   // Vert nature officiel
        danger:  '#DC2626',   // Rouge officiel
        warning: '#D4A017',   // Or / Ambre officiel
        accent:  '#E56A1E',   // Orange logo officiel
        info:    '#1E88E5',   // Bleu moyen officiel
        'background-light': '#F8F7F5', // Beige clair officiel
        'background-dark': '#0F172A',
      },
      // ... reste identique
    },
  },
  plugins: [forms],
};

export default config;