import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { ResonanceContext } from '../createResonanceApp';
import type { ResonanceEnvelope, ValidationErrors } from '../types/envelope';
import { ResonanceValidationError } from '../client/NetworkAdapter';

export type UseResonanceMutationOptions<TData> = {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  onValidationError?: (errors: ValidationErrors) => void;
};

export function useResonanceMutation<TData = unknown, TVariables = unknown>(
  options: UseResonanceMutationOptions<TData>
) {
  const router = useRouter();
  const context = router.options.context as ResonanceContext;
  const { networkAdapter, resonanceClient } = context;

  return useMutation({
    mutationKey: ['resonance', options.url, options.method ?? 'POST'],
    mutationFn: async (variables: TVariables) => {
      const envelope = await networkAdapter.fetch<TData>(options.url, {
        method: options.method ?? 'POST',
        body: JSON.stringify(variables),
      });
      return envelope;
    },
    onSuccess: (envelope: ResonanceEnvelope<TData>) => {
      // ALWAYS process signals first - this is the core of Resonance
      if (envelope?.meta?.signals) {
        resonanceClient.processSignals(envelope.meta.signals);
      }

      // Then call user's onSuccess with just the data
      options.onSuccess?.(envelope.data);
    },
    onError: (error: Error) => {
      if (error instanceof ResonanceValidationError) {
        options.onValidationError?.(error.errors);
        return;
      }
      options.onError?.(error);
    },
  });
}
