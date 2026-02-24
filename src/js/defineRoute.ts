import { createFileRoute, type FileRoutesByPath } from '@tanstack/react-router';
import { queryOptions } from '@tanstack/react-query';
import type { NetworkAdapter } from './client/NetworkAdapter';
import type { z } from 'zod';

type WayfinderRoute = {
  url: string;
  method: string;
};

type RouteLoaderConfig<TParams, TSearch, TData> = {
  loader: (params?: Record<string, unknown>) => WayfinderRoute;
  params?: (params: TParams) => Record<string, unknown>;
  search?: z.ZodType<TSearch>;
  component: React.ComponentType;
};

export function defineRoute<TPath extends keyof FileRoutesByPath>(path: TPath) {
  return function <TParams, TSearch, TData>(config: RouteLoaderConfig<TParams, TSearch, TData>) {
    const { loader: loaderFn, params: mapParams, search: searchSchema, component } = config;

    return createFileRoute(path)({
      validateSearch: searchSchema,

      loader: async ({ context, params, search, abortController }) => {
        const { queryClient, networkAdapter } = context as {
          queryClient: ReturnType<typeof import('@tanstack/react-query').QueryClient['prototype']['constructor']>;
          networkAdapter: NetworkAdapter;
        };

        const mappedParams = mapParams ? mapParams(params as TParams) : params;
        const routeInfo = loaderFn(mappedParams);

        let url = routeInfo.url;

        if (search && typeof search === 'object' && Object.keys(search).length > 0) {
          const searchParams = new URLSearchParams();
          Object.entries(search).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              searchParams.set(key, String(value));
            }
          });
          url += `?${searchParams.toString()}`;
        }

        const queryKey = [routeInfo.url, mappedParams, search].filter(Boolean);

        return queryClient.ensureQueryData(
          queryOptions({
            queryKey,
            queryFn: async () => {
              const envelope = await networkAdapter.fetch<TData>(url.replace(/^\/api/, ''), {
                signal: abortController.signal,
              });
              return envelope.data;
            },
          })
        );
      },

      component,
    });
  };
}
