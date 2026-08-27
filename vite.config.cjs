const { defineConfig } = require('vite');

module.exports = defineConfig({
  root: 'frontend',
  appType: 'mpa',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: process.env.PORT || 3030,
    strictPort: false,
  },
});
