// Type declarations for optional peer dependencies

declare module '@laravel/vite-plugin-wayfinder' {
  import type { Plugin } from 'vite';

  export interface WayfinderPluginOptions {
    path?: string;
    routes?: boolean;
    actions?: boolean;
  }

  export function wayfinder(options?: WayfinderPluginOptions): Plugin;
}

declare module '@tanstack/router-plugin/vite' {
  import type { Plugin } from 'vite';

  export interface RouterPluginOptions {
    target?: 'react' | 'solid';
    autoCodeSplitting?: boolean;
    routesDirectory?: string;
    generatedRouteTree?: string;
  }

  function tanstackRouter(options?: RouterPluginOptions): Plugin;
  export default tanstackRouter;
}
