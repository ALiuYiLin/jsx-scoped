import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

// 注意顺序：jsxScoped 必须先于 react() 执行，
// 因为它需要先在 JSX AST 上注入 scope 属性，再由 react 插件做 JSX 编译。
export default defineConfig({
  plugins: [jsxScoped({ warnMultiScopedImport: true }), react()],
  css: {
    preprocessorOptions: {
      // 展示 vite 原生 preprocessorOptions 也会被 scoped 流水线遵守
      scss: {
        additionalData: '$jsx-scoped-brand: #4f46e5;\n',
      },
    },
  },
})
