import { useMutation } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { ResonanceValidationError, type NetworkAdapter } from './client/NetworkAdapter';
import type { ResonanceEnvelope, ValidationErrors } from './types/envelope';

type WayfinderRoute = {
  url: string;
  method: string;
};

type UseFormConfig<TData> = {
  route: () => WayfinderRoute;
  defaultValues?: Partial<TData>;
  transform?: (data: TData) => unknown;
};

type UseFormReturn<TData> = {
  data: TData;
  setData: React.Dispatch<React.SetStateAction<TData>>;
  errors: ValidationErrors;
  processing: boolean;
  submit: (e?: React.FormEvent | FormData | TData) => void;
  reset: () => void;
  clearErrors: () => void;
};

export function useForm<TData extends Record<string, unknown>>(
  config: UseFormConfig<TData>
): UseFormReturn<TData> {
  const { route, defaultValues = {} as TData, transform } = config;
  const { context } = useRouterState();

  const [data, setData] = useState<TData>(defaultValues as TData);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const routeInfo = route();

  const mutation = useMutation({
    mutationKey: ['resonance', routeInfo.url],
    mutationFn: async (payload: unknown): Promise<ResonanceEnvelope<unknown>> => {
      const { networkAdapter } = context as { networkAdapter: NetworkAdapter };

      const url = routeInfo.url.replace(/^\/api/, '');

      return networkAdapter.fetch(url, {
        method: routeInfo.method.toUpperCase(),
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setErrors({});
    },
    onError: (error) => {
      if (error instanceof ResonanceValidationError) {
        setErrors(error.errors);
        return;
      }
      throw error;
    },
  });

  const submit = useCallback(
    (e?: React.FormEvent | FormData | TData) => {
      setErrors({});

      if (e && 'preventDefault' in e) {
        e.preventDefault();
        const formElement = e.target as HTMLFormElement;
        const formData = new FormData(formElement);
        const payload = Object.fromEntries(formData.entries());
        mutation.mutate(transform ? transform(payload as TData) : payload);
        return;
      }

      if (e instanceof FormData) {
        const payload = Object.fromEntries(e.entries());
        mutation.mutate(transform ? transform(payload as TData) : payload);
        return;
      }

      const payload = e ?? data;
      mutation.mutate(transform ? transform(payload) : payload);
    },
    [data, mutation, transform]
  );

  const reset = useCallback(() => {
    setData(defaultValues as TData);
    setErrors({});
  }, [defaultValues]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    data,
    setData,
    errors,
    processing: mutation.isPending,
    submit,
    reset,
    clearErrors,
  };
}
