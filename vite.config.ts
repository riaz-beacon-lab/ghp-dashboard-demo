import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the same build works on any GitHub Pages path (user or project site).
  base: './',
  plugins: [vue(), tailwindcss()],
  define: {
    // Time of this build (i.e. when the site was deployed), shown in the header.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
