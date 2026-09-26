import { defineConfig } from 'vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

// 注意顺序：jsxScoped 必须先于 vueJsx()，它要在 JSX 尚未被
// @vue/babel-plugin-jsx 编译成 createVNode 之前注入 scope 属性、
// 改写 *.scoped.* 导入并提取内联 <style scoped>。
export default defineConfig({
  plugins: [jsxScoped({ warnMultiScopedImport: true }), vueJsx()],
  css: {
    preprocessorOptions: {
      scss: {
        // 展示 vite 原生 preprocessorOptions 同样被 scoped 流水线遵守
        additionalData: '$jsx-scoped-brand: #42b883;\n',
      },
    },
  },
})
