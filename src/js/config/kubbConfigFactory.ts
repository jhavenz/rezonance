import { defineConfig, type UserConfig } from '@kubb/core';
import { pluginOas } from '@kubb/plugin-oas';
import { pluginTs } from '@kubb/plugin-ts';
import { pluginZod } from '@kubb/plugin-zod';
import { pluginReactQuery } from '@kubb/plugin-react-query';

export interface KubbConfigOptions {
  /**
   * URL to OpenAPI spec endpoint
   * @default process.env.VITE_APP_URL || process.env.APP_URL + '/docs/api'
   */
  openApiUrl?: string;

  /**
   * Output directory for generated code
   * @default './resources/js/.resonance'
   */
  outputPath?: string;

  /**
   * Custom client import path
   * @default '@jhavenz/resonance/client/kubb-client'
   */
  clientImportPath?: string;

  /**
   * Override default Kubb configuration
   */
  override?: Partial<UserConfig>;
}

export function createKubbConfig(options: KubbConfigOptions = {}): UserConfig {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:8880';
  const openApiUrl = options.openApiUrl || `${appUrl}/docs/api`;
  const outputPath = options.outputPath || './resources/js/.resonance';
  const clientImportPath = options.clientImportPath || '@jhavenz/resonance/client/kubb-client';

  const baseConfig: UserConfig = {
    root: '.',
    input: {
      path: openApiUrl,
    },
    output: {
      path: outputPath,
      clean: false, // Don't wipe folder - preserves routeTree.gen.ts from TanStack Router
    },
    hooks: {
      done: 'node packages/resonance/src/js/scripts/fix-kubb-duplicates.js',
    },
    plugins: [
      pluginOas(),
      pluginTs({
        output: { path: 'types' },
      }),
      pluginZod({
        output: { path: 'zod' },
      }),
      pluginReactQuery({
        output: { path: 'hooks' },
        client: {
          importPath: clientImportPath,
        },
      }),
    ],
  };

  // Allow override of any config
  if (options.override) {
    return defineConfig({
      ...baseConfig,
      ...options.override,
    });
  }

  return defineConfig(baseConfig);
}
