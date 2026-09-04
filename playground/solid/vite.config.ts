import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

// 注意顺序：jsxScoped 必须先于 solid()，它要在 JSX 尚未被编译成
// createElement/template 之前注入 scope 属性并提取内联 <style scoped>。
export default defineConfig({
  plugins: [jsxScoped({ warnMultiScopedImport: true }), solid()],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '$jsx-scoped-brand: #dc2626;\n',
      },
    },
  },
})
