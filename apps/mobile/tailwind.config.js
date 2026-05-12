/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    './App.tsx',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        'pixelpurl-medium': ['PixelPurl-Medium'],
        'tchaikovsky-medium': ['Tchaikovsky-Medium'],
        'pcsenior-medium': ['PCSenior-Medium'],
        'november-medium': ['November-Medium'],
        'boldpixels-medium': ['BoldPixels-Medium'],
        'manaspace-medium': ['Manaspace-Medium'],
      },
    },
  },
  plugins: [],
};
