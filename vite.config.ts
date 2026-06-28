import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://mrs-eload.github.io/sterenn/ on GitHub Pages.
  base: '/sterenn/',
  resolve: {
    tsconfigPaths: true,
  }
})
