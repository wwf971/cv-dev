import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
  rules: [
    // Custom rules if needed
  ],
  shortcuts: {
    // Shortcut for print-only elements
    'print-only': 'hidden print:block',
    // Shortcut for screen-only elements (hidden in print)
    'screen-only': 'block print:hidden',
  },
  safelist: [
    'print:hidden',
    'print:block',
  ],
})

