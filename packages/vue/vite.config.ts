import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        global: 'src/global.ts',
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        chunkFileNames: '_chunks/[name]-[hash].js',
      },
    },
  },
})
