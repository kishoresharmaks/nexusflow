import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#E85D2A',
          foreground: '#FFFFFF',
        },
        primary: {
          DEFAULT: '#E85D2A',
          foreground: '#FFFFFF',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#17202A',
        },
        muted: {
          DEFAULT: '#F2F4F7',
          foreground: '#667085',
        },
        destructive: {
          DEFAULT: '#B42318',
          foreground: '#FFFFFF',
        },
        background: '#F7F8FA',
        surface: '#FFFFFF',
        text: {
          primary: '#17202A',
          secondary: '#667085',
        },
        border: '#E4E7EC',
        status: {
          success: '#16803C',
          warning: '#B54708',
          danger: '#B42318',
          info: '#175CD3',
        },
        ring: '#F79009',
      },
      borderRadius: {
        control: '8px',
        card: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
