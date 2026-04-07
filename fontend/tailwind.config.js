/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'ebay-blue': '#3665F3',
        'ebay-blue-dark': '#382aef',
        'ebay-red': '#e53238',
        'ebay-yellow': '#f5af02',
        'ebay-green': '#86b817',
        'ebay-dark': '#191919',
        'ebay-gray': '#707070',
        'ebay-light': '#f7f7f7'
      },
    },
  },
  plugins: [],
}
