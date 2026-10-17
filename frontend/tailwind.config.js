/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Graphite neutrals with one muted accent (cyan) and desaturated status colors
        cs: {
          bg: '#101214',
          bg2: '#16181b',
          bg3: '#1c1f23',
          bg4: '#24282d',
          border: '#2b2f35',
          border2: '#3a3f46',
          text: '#e4e6e9',
          text2: '#a4aab2',
          text3: '#757b84',
          cyan: '#7aa7d4',
          red: '#d8665f',
          green: '#6bab7b',
          orange: '#d0914a',
          purple: '#9b93c9',
          yellow: '#c9a94f',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
