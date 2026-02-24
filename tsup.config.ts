import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    devtools: 'src/devtools/index.tsx',
    kubb: 'src/kubb.ts',
    config: 'src/config/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@tanstack/react-query',
    '@tanstack/react-query-devtools',
    '@tanstack/react-router',
    '@tanstack/react-router-devtools',
    '@tanstack/react-devtools',
    'superjson',
    'ulid',
    'zod',
    'fs',
    'path',
    /^@kubb\//,
  ],
  splitting: true,
  treeshake: true,
  sourcemap: true,
});
