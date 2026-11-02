import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020', cssMinify: true, sourcemap: false, assetsInlineLimit: 8192 },
});
