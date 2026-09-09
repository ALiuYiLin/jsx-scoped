// https://aliuyilin.github.io/vitepress-react/guide/custom-theme

import type { Theme } from '@10coding/vitepress-react'
import DefaultTheme from '@10coding/vitepress-react/theme'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ router, siteData }) {
    // ...
  }
} satisfies Theme
