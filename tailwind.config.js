/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      flex: {
        '2/3': 2 / 3,
      },
      minHeight: {
        8: '2rem',
        16: '4rem',
        24: '6rem',
        32: '8rem',
        48: '12rem',
        64: '16rem',
        96: '24rem',
        128: '32rem',
      },
      minWidth: {
        8: '2rem',
        16: '4rem',
        24: '6rem',
        32: '8rem',
        48: '12rem',
        64: '16rem',
        96: '24rem',
        128: '32rem',
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('daisyui')],
}
