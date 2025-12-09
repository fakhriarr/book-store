/** @type {import('tailwindcss').Config} */
import daisyui from 'daisyui';
import defaultTheme from 'tailwindcss/defaultTheme'; 

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans], 
      },
      colors: {
        'primary-crm': { 
          DEFAULT: '#6C63FF',     // Ungu utama
          'content': '#FFFFFF', 
        },
        'secondary-crm': { 
          DEFAULT: '#9A8CFF',     // Ungu lembut
          'content': '#FFFFFF', 
        },
        'accent-crm': '#A9B6FF',  // Aksen biru lembut

        // Backgrounds & Borders
        'base-100-crm': '#FFFFFF',  
        'base-200-crm': '#F6F8FE',  
        'base-300-crm': '#E4E7FB',  
        'base-content-crm': '#1E1E2F',

        // Text
        'text-secondary-crm': '#7D7E8D',

        // Status
        'info-crm': '#60A5FA', 
        'success-crm': '#2DD4BF',
        'warning-crm': '#FBBF24',
        'error-crm': '#F87171',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
      },
    ],
  },
};
