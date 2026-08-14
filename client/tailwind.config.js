/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Enterprise green accent. Replaces the console-blue used for
        // links, active nav, selected rows and focus rings.
        primary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a', // brand
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#f2f3f3', // page background
          subtle:  '#fafafa', // table header / zebra / hover
          border:  '#d5dbdb', // console-grey hairline
          divider: '#e9ebed', // lighter inner divider
        },
        // Dark chrome for the global top navigation.
        chrome: {
          DEFAULT: '#0f1b2a',
          hover:   '#1b2a3d',
          border:  '#2a3b52',
          text:    '#d5dbdb',
        },
        ink: {
          900: '#16191f', // headings
          700: '#414d5c', // body
          600: '#414d5c', // body (alias for 700, back-compat)
          500: '#5f6b7a', // secondary
          400: '#879596', // muted / placeholder
          300: '#aab7b8',
          200: '#aab7b8', // alias for 300, back-compat
        },
      },
      fontFamily: {
        sans: ['Urbanist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Console containers rely on hairline borders, not elevation.
        card:    '0 1px 1px 0 rgb(0 21 40 / 0.06)',
        panel:   '0 1px 1px 0 rgb(0 21 40 / 0.06)',
        popover: '0 1px 4px 0 rgb(0 21 40 / 0.18)',
        modal:   '0 4px 20px 0 rgb(0 21 40 / 0.22)',
      },
      borderRadius: {
        xl: '0.5rem',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
};
