import type { Plugin, UserConfig } from 'vite';
import path from 'path';

// Re-export for convenience
export type { Plugin } from 'vite';

/**
 * Wayfinder plugin configuration
 */
export interface WayfinderOptions {
  /**
   * Enable wayfinder plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Generate route helpers
   * @default true
   */
  routes?: boolean;

  /**
   * Generate action helpers
   * @default true
   */
  actions?: boolean;

  /**
   * Output path for generated wayfinder files
   * @default 'resources/js/.resonance/wayfinder'
   */
  path?: string;
}

/**
 * TanStack Router plugin configuration
 */
export interface RouterOptions {
  /**
   * Enable TanStack Router plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Enable automatic code splitting per route
   * @default true
   */
  autoCodeSplitting?: boolean;

  /**
   * Directory containing route files
   * @default 'resources/js/pages'
   */
  routesDirectory?: string;

  /**
   * Output path for generated route tree
   * @default 'resources/js/.resonance/routeTree.gen.ts'
   */
  generatedRouteTree?: string;
}

/**
 * Alias configuration
 */
export interface AliasOptions {
  /**
   * Path for @ alias (usually resources/js)
   * @default 'resources/js'
   */
  '@'?: string;

  /**
   * Additional custom aliases
   */
  [key: string]: string | undefined;
}

/**
 * Resonance Vite plugin options
 */
export interface ResonancePluginOptions {
  /**
   * Wayfinder configuration for Laravel route/action generation
   * Set to false to disable entirely
   * @default { routes: true, actions: true }
   */
  wayfinder?: WayfinderOptions | false;

  /**
   * TanStack Router configuration for file-based routing
   * Set to false to disable entirely
   * @default { autoCodeSplitting: true }
   */
  router?: RouterOptions | false;

  /**
   * Path alias configuration
   * Set to false to disable all Resonance-managed aliases
   * Set to true for defaults (@ -> resources/js)
   * Pass object to customize
   * @default true
   */
  aliases?: boolean | AliasOptions;

  /**
   * Exclude Kubb CLI packages from Vite's dependency optimization
   * Required to prevent Kubb from being bundled into dev server
   * @default true
   */
  excludeKubbFromOptimize?: boolean;

  /**
   * Additional node modules to treat as external
   * Merged with Resonance defaults: ['fs', 'path', 'fs-extra', 'os', 'crypto', 'stream', 'util']
   * @default []
   */
  nodeExternals?: string[];
}

/**
 * Default node modules to treat as external in browser builds
 */
const DEFAULT_NODE_EXTERNALS = ['fs', 'path', 'fs-extra', 'os', 'crypto', 'stream', 'util'];

/**
 * Kubb packages that must be excluded from Vite optimization
 * These are CLI tools that should not be bundled
 */
const KUBB_PACKAGES = [
  '@kubb/cli',
  '@kubb/core',
  '@kubb/plugin-oas',
  '@kubb/plugin-react-query',
  '@kubb/plugin-ts',
  '@kubb/plugin-zod',
  'npm-run-path',
  'execa',
  'unicorn-magic',
  'fs-extra',
];

/**
 * Create the Resonance Vite plugin configuration
 *
 * This plugin handles:
 * - Wayfinder integration for Laravel route/action generation
 * - TanStack Router integration for file-based routing
 * - Path aliases (@ -> resources/js, etc.)
 * - Kubb CLI exclusion from dependency optimization
 * - Node module externalization for browser builds
 *
 * @example Basic usage
 * ```typescript
 * // vite.config.ts
 * import { resonance } from '@jhavenz/resonance/vite';
 * import laravel from 'laravel-vite-plugin';
 * import react from '@vitejs/plugin-react';
 *
 * export default defineConfig({
 *   plugins: [
 *     laravel({ input: ['resources/js/app.tsx'] }),
 *     resonance(),
 *     react(),
 *   ],
 * });
 * ```
 *
 * @example Custom configuration
 * ```typescript
 * resonance({
 *   wayfinder: { routes: true, actions: false },
 *   router: { autoCodeSplitting: true, routesDirectory: 'src/pages' },
 *   aliases: { '@': 'src', '@components': 'src/components' },
 * })
 * ```
 *
 * @example Disable specific features
 * ```typescript
 * resonance({
 *   wayfinder: false,  // Disable wayfinder entirely
 *   router: false,     // Disable TanStack Router plugin
 *   aliases: false,    // Don't configure any aliases
 * })
 * ```
 */
export function resonance(options: ResonancePluginOptions = {}): Plugin[] {
  const plugins: Plugin[] = [];

  // 1. Wayfinder plugin (if enabled)
  if (options.wayfinder !== false) {
    try {
      // Dynamic import to handle case where wayfinder isn't installed
      const { wayfinder } = require('@laravel/vite-plugin-wayfinder');

      const wayfinderOpts = typeof options.wayfinder === 'object' ? options.wayfinder : {};

      plugins.push(
        wayfinder({
          path: wayfinderOpts.path ?? 'resources/js/.resonance/wayfinder',
          routes: wayfinderOpts.routes ?? true,
          actions: wayfinderOpts.actions ?? true,
        })
      );
    } catch {
      // Wayfinder not installed, skip silently
      // Users who want wayfinder will install @laravel/vite-plugin-wayfinder
    }
  }

  // 2. TanStack Router plugin (if enabled)
  if (options.router !== false) {
    try {
      // Dynamic import to handle case where router plugin isn't installed
      const tanstackRouter = require('@tanstack/router-plugin/vite').default;

      const routerOpts = typeof options.router === 'object' ? options.router : {};

      plugins.push(
        tanstackRouter({
          target: 'react',
          autoCodeSplitting: routerOpts.autoCodeSplitting ?? true,
          routesDirectory: routerOpts.routesDirectory ?? 'resources/js/pages',
          generatedRouteTree: routerOpts.generatedRouteTree ?? 'resources/js/.resonance/routeTree.gen.ts',
        })
      );
    } catch {
      // TanStack Router plugin not installed, skip silently
      // Users who want file-based routing will install @tanstack/router-plugin
    }
  }

  // 3. Resonance configuration plugin (aliases, optimizeDeps, ssr externals)
  plugins.push({
    name: 'resonance:config',
    config(): UserConfig {
      const result: UserConfig = {};

      // Configure path aliases
      if (options.aliases !== false) {
        const aliasConfig: Record<string, string> = {};

        if (options.aliases === true || options.aliases === undefined) {
          // Default: @ -> resources/js
          aliasConfig['@'] = path.resolve(process.cwd(), 'resources/js');
        } else if (typeof options.aliases === 'object') {
          // Custom aliases
          for (const [key, value] of Object.entries(options.aliases)) {
            if (value) {
              aliasConfig[key] = path.resolve(process.cwd(), value);
            }
          }
        }

        if (Object.keys(aliasConfig).length > 0) {
          result.resolve = {
            alias: aliasConfig,
          };
        }
      }

      // Exclude Kubb packages from dependency optimization
      if (options.excludeKubbFromOptimize !== false) {
        result.optimizeDeps = {
          exclude: KUBB_PACKAGES,
        };
      }

      // Configure SSR externals
      result.ssr = {
        external: ['fs-extra'],
      };

      return result;
    },
  });

  // 4. Node externals plugin (prevents bundling Node.js built-ins)
  const nodeExternals = [
    ...DEFAULT_NODE_EXTERNALS,
    ...(options.nodeExternals ?? []),
  ];

  plugins.push({
    name: 'resonance:node-externals',
    resolveId(id) {
      if (nodeExternals.includes(id)) {
        return { id, external: true };
      }
      return null;
    },
  });

  return plugins;
}

// Default export for convenience
export default resonance;
