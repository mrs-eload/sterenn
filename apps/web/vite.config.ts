import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://mrs-eload.github.io/sterenn/ on GitHub Pages.
  base: '/sterenn/',
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8's rolldown bundler mis-generates init code for MUI's circular
        // ESM modules when they get split across lazy-loaded route chunks: a
        // reference like `style$3` ends up used but never declared, so the app
        // throws "style$3 is not defined" and renders blank in production while
        // working fine in dev (dev serves unbundled native ESM). Inlining every
        // dynamic import into one chunk keeps those circular modules together so
        // init ordering stays correct. Trade-off: no per-route code splitting —
        // revisit once the rolldown codegen bug is fixed upstream (vitejs/vite#22583).
        inlineDynamicImports: true,
      },
    },
  }
})
