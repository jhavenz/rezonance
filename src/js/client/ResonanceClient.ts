import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import type { ResonanceSignal } from '../types/envelope';
import type { NetworkAdapter } from './NetworkAdapter';
import { errorStore } from '../devtools/ErrorStore';

export type ResonanceClient = {
  processSignals: (signals: ResonanceSignal[]) => void;
};

export type ResonanceClientConfig = {
  queryClient: QueryClient;
  router: AnyRouter;
  networkAdapter: NetworkAdapter;
  ui?: {
    toaster?: (message: string, variant: 'success' | 'error' | 'info') => void;
  };
};

export function createResonanceClient(config: ResonanceClientConfig): ResonanceClient {
  const { queryClient, router, networkAdapter, ui } = config;

  const routeNameToPath = (routeName: string): string => {
    const parts = routeName.split('.');
    const method = parts.pop();
    if (method === 'index' || method === 'store') {
      return '/' + parts.join('/');
    }
    return '/' + parts.join('/');
  };

  const handleInvalidate = (scopes: string[]): void => {
    for (const scope of scopes) {
      const path = scope.startsWith('/') ? scope : routeNameToPath(scope);

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          if (typeof key === 'object' && key !== null && 'url' in key) {
            const url = (key as { url: string }).url;
            return url === path || url.startsWith(path + '/');
          }
          if (typeof key === 'string') {
            return key === scope;
          }
          return false;
        },
      });
    }
    router.invalidate();
  };

  const handleRedirect = (to: string, replace?: boolean): void => {
    queueMicrotask(() => {
      router.navigate({ to, replace });
    });
  };

  const handleFlash = (message: string, variant: 'success' | 'error' | 'info'): void => {
    if (ui?.toaster) {
      ui.toaster(message, variant);
    } else {
      window.dispatchEvent(
        new CustomEvent('resonance:flash', {
          detail: { message, variant },
        })
      );
    }
  };

  const handleEvent = (name: string, payload: unknown): void => {
    window.dispatchEvent(
      new CustomEvent(`resonance:${name}`, {
        detail: payload,
      })
    );
  };

  const handleToken = (token: string | null): void => {
    if (networkAdapter.setToken) {
      networkAdapter.setToken(token);
    }
  };

  return {
    processSignals(signals: ResonanceSignal[]): void {
      for (const signal of signals) {
        switch (signal.type) {
          case 'invalidate':
            handleInvalidate(signal.scope);
            break;
          case 'redirect':
            handleRedirect(signal.to, signal.replace);
            break;
          case 'flash':
            handleFlash(signal.message, signal.variant);
            break;
          case 'event':
            handleEvent(signal.name, signal.payload);
            break;
          case 'token':
            handleToken(signal.token);
            break;
          case 'error':
          case 'debug':
            // Add to error store
            errorStore.add({
              type: signal.type,
              html: signal.html,
              exception: (signal as any).exception,
            });

            // Keep toast notification for user awareness
            const isDebugOutput = signal.html.includes('sf-dump') ||
                                  signal.html.includes('Symfony\\Component\\VarDumper');
            if (ui?.toaster) {
              if (isDebugOutput) {
                ui.toaster('Debug output available in devtools', 'info');
              } else {
                ui.toaster('Server error occurred - check devtools', 'error');
              }
            }
            break;
        }
      }
    },
  };
}
