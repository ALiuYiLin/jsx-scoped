import jsxScopedVitePlugin from '@10coding/vite-plugin-jsx-scoped'
import { defineConfig } from '@10coding/vitepress-react'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'jsx-scoped',
  description: 'Vue-like scoped styles for JSX/TSX —— babel / postcss / vite 三件套',
  // GitHub Pages 项目页部署在 https://<user>.github.io/jsx-scoped/ 下，
  // base 必须带仓库名前缀，否则 css/js 资源会 404（站内链接自动加此前缀）；
  // 本地 dev/preview 需访问 /jsx-scoped/ 前缀路径
  base: '/jsx-scoped/',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      // { text: '首页', link: '/' },
      { text: '指南', link: '/guide/getting-started' },
      { text: '示例', link: '/examples' },
      { text: 'API 参考', link: '/reference/api' },
      { text: 'GitHub', link: 'https://github.com/ALiuYiLin/jsx-scoped' }
    ],

    sidebar: [
      {
        text: '指南',
        collapsed: false,
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '功能与用法', link: '/guide/usage' },
          { text: '原理', link: '/guide/architecture' },
          { text: '示例', link: '/examples' }
        ]
      },
      {
        text: 'API 参考',
        collapsed: false,
        items: [{ text: 'API', link: '/reference/api' }]
      }
    ],

    // 右侧大纲标题（默认英文 "On this page"）
    outline: {
      label: '页面导航'
    },

    // 编辑本页 → 仓库（默认分支为 master）
    editLink: {
      pattern: 'https://github.com/ALiuYiLin/jsx-scoped/edit/master/docs/:path',
      text: '在 GitHub 上编辑此页面'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ALiuYiLin/jsx-scoped' }
    ],

    // 开启 md 页面 scoped 样式（<style scoped> / *.scoped.* 导入）
    // 需下方 vite.plugins 里的 jsxScopedVitePlugin 提供虚拟 css 的 resolve/load
    markdownScopedCss: true
  },

  vite: {
    plugins: [jsxScopedVitePlugin()]
  }
})
