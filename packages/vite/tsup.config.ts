import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  external: [
    '@10coding/plugin-jsx-scoped',
    '@10coding/postcss-jsx-scoped',
    '@babel/core',
    'vite',
    'sass',
    'less',
  ],
})
