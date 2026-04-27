import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'path';

function appChunkName(id: string) {
  const match = id.replace(/\\/g, '/').match(/components\/apps\/([^/]+)/);
  if (!match || match[1] === 'home') return null;
  return `app-${match[1]}`;
}

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
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 100,
            },
            {
              name: 'shared-social',
              test: (id) => {
                const normalizedId = id.replace(/\\/g, '/');
                return (
                  normalizedId.includes('MediaLightbox')
                  || normalizedId.includes('EmojiPicker')
                  || normalizedId.includes('MediaAttachmentPreview')
                  || normalizedId.includes('MediaActionButtons')
                  || normalizedId.includes('SocialOnboardingModal')
                  || normalizedId.includes('LiveFlashlightControl')
                );
              },
              priority: 90,
            },
            {
              name: 'phone-core',
              test: (id) => {
                const normalizedId = id.replace(/\\/g, '/');
                return (
                  normalizedId.includes('/src/components/Phone/')
                  || normalizedId.includes('/src/store/')
                  || normalizedId.includes('/src/config/')
                  || normalizedId.includes('/src/i18n')
                  || normalizedId.includes('/src/utils/')
                  || normalizedId.includes('/src/types/')
                );
              },
              priority: 80,
            },
            {
              name: 'app-core',
              test: (id) => {
                const normalizedId = id.replace(/\\/g, '/');
                return (
                  normalizedId.includes('/src/')
                  && !normalizedId.includes('/src/components/apps/')
                );
              },
              priority: 70,
            },
            {
              name: (id) => appChunkName(id),
              test: (id) => id.replace(/\\/g, '/').includes('/src/components/apps/'),
              priority: 10,
            },
          ],
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
