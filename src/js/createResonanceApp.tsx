import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { RouterProvider, createRouter, type AnyRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createErrorsDevtoolsPlugin } from './devtools';
import { createResonanceClient, type ResonanceClient } from './client/ResonanceClient';
import { createNetworkAdapter, type NetworkAdapter } from './client/NetworkAdapter';
import { configureClient } from './client/kubb-client';

export type AuthConfig =
  | { driver: 'cookie'; csrfEndpoint?: string }
  | { driver: 'sanctum-token'; tokenStorage?: 'localStorage' | 'memory' };

export type ResonanceConfig = {
  routeTree: AnyRoute;
  auth: AuthConfig;
  baseApiUrl?: string;
  loginUrl?: string;
  devTools?: boolean | {
    enabled: boolean;
    errors?: boolean;
  };
  ui?: {
    loading?: React.ReactNode;
    toaster?: (message: string, variant: 'success' | 'error' | 'info') => void;
  };
};

export type ResonanceContext = {
  queryClient: QueryClient;
  networkAdapter: NetworkAdapter;
  resonanceClient: ResonanceClient;
};

export function createResonanceApp(config: ResonanceConfig) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree: config.routeTree,
    context: {
      queryClient,
      networkAdapter: null as unknown as NetworkAdapter,
      resonanceClient: null as unknown as ResonanceClient,
    } satisfies ResonanceContext,
    defaultPreload: 'intent',
  });

  const networkAdapter = createNetworkAdapter(
    config.auth,
    config.baseApiUrl,
    (to, options) => router.navigate({ to, replace: options?.replace }),
    config.loginUrl
  );

  const resonanceClient = createResonanceClient({
    queryClient,
    router,
    networkAdapter,
    ui: config.ui,
  });

  // Configure kubb-client to process signals for generated hooks
  configureClient({
    baseUrl: config.baseApiUrl ?? '/api',
    getHeaders: () => networkAdapter.getHeaders(),
    signalProcessor: (signals) => resonanceClient.processSignals(signals),
  });

  router.update({
    context: {
      queryClient,
      networkAdapter,
      resonanceClient,
    },
  });

  // Parse devTools config
  const devToolsEnabled = typeof config.devTools === 'boolean'
    ? config.devTools
    : config.devTools?.enabled ?? false;

  const errorsPluginEnabled = typeof config.devTools === 'boolean'
    ? config.devTools
    : config.devTools?.errors ?? true;

  return {
    router,
    queryClient,
    networkAdapter,
    mount: (selector: string) => {
      const container = document.querySelector(selector);
      if (!container) throw new Error(`Mount target "${selector}" not found`);

      // Build plugins array
      const plugins = [];

      // Add errors plugin if enabled
      if (errorsPluginEnabled) {
        plugins.push(createErrorsDevtoolsPlugin());
      }

      // Add other plugins
      plugins.push(
        {
          id: 'react-query',
          name: 'React Query',
          render: (_el: HTMLElement, _theme: 'light' | 'dark') => <ReactQueryDevtoolsPanel />,
          defaultOpen: false,
        },
        {
          id: 'tanstack-router',
          name: 'TanStack Router',
          render: (_el: HTMLElement, _theme: 'light' | 'dark') => <TanStackRouterDevtoolsPanel router={router} />,
          defaultOpen: false,
        }
      );

      createRoot(container).render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            {devToolsEnabled && (
              <TanStackDevtools plugins={plugins} />
            )}
          </QueryClientProvider>
        </StrictMode>
      );
    },
  };
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createResonanceApp>['router'];
  }
}
