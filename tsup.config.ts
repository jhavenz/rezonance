import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/js/index.ts',
    vite: 'src/js/vite/index.ts',
    devtools: 'src/js/devtools/index.tsx',
    kubb: 'src/js/kubb.ts',
    config: 'src/js/config/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@tanstack/react-query',
    '@tanstack/react-router',
    'vite',
    '@vitejs/plugin-react',
    '@tanstack/router-plugin',
    '@laravel/vite-plugin-wayfinder',
    'laravel-vite-plugin',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
