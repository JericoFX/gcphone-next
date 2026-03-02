import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@store': resolve(__dirname, 'src/store'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@types': resolve(__dirname, 'src/types'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    hmr: true,
  },
  base: './',
});
