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
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (
            normalizedId.includes('MediaLightbox')
            || normalizedId.includes('EmojiPicker')
            || normalizedId.includes('MediaAttachmentPreview')
            || normalizedId.includes('MediaActionButtons')
            || normalizedId.includes('SocialOnboardingModal')
            || normalizedId.includes('LiveFlashlightControl')
          ) {
            return 'shared-social';
          }
          if (normalizedId.includes('livekit-client')) {
            return 'vendor-livekit';
          }
          if (normalizedId.includes('/leaflet/')) {
            return 'vendor-leaflet';
          }
          if (normalizedId.includes('node_modules')) {
            return 'vendor';
          }
          if (normalizedId.includes('solid-js')) {
            return 'vendor';
          }
          if (
            normalizedId.includes('/src/components/Phone/')
            || normalizedId.includes('/src/store/')
            || normalizedId.includes('/src/config/')
            || normalizedId.includes('/src/i18n')
            || normalizedId.includes('/src/utils/')
            || normalizedId.includes('/src/types/')
          ) {
            return 'phone-core';
          }
          if (
            normalizedId.includes('/src/')
            && !normalizedId.includes('/src/components/apps/')
          ) {
            return 'app-core';
          }
          if (normalizedId.includes('components/shared') || normalizedId.includes('hooks/')) {
            return 'shared';
          }
          if (normalizedId.includes('components/apps/')) {
            const match = normalizedId.match(/components\/apps\/([^/]+)/);
            if (match) {
              if (match[1] === 'home') {
                return undefined;
              }
              return `app-${match[1]}`;
            }
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@apps': resolve(__dirname, 'src/components/apps'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@store': resolve(__dirname, 'src/store'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@types': resolve(__dirname, 'src/types'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },
  base: './',
});
