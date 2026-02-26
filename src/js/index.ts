export { createResonanceApp } from './createResonanceApp';
export type { ResonanceConfig, AuthConfig, ResonanceContext } from './createResonanceApp';

export { defineRoute } from './defineRoute';

export { useForm } from './useForm';
export { useResonanceMutation } from './hooks/useResonanceMutation';
export { useEventStream } from './hooks/useEventStream';

export { ResonanceValidationError, ResonanceAuthError } from './client/NetworkAdapter';
export type { NetworkAdapter } from './client/NetworkAdapter';

export type { ResonanceClient } from './client/ResonanceClient';

export type {
  ResonanceEnvelope,
  ResonanceSignal,
  InvalidateSignal,
  RedirectSignal,
  FlashSignal,
  EventSignal,
  ValidationErrors,
} from './types/envelope';

// NOTE: createKubbConfig is exported separately via @jhavenz/resonance/kubb
// to avoid bundling Node.js dependencies (fs, path) in browser code

// Re-export Vite plugin types for consumers who import from main
export type {
  ResonancePluginOptions,
  WayfinderOptions,
  RouterOptions,
  AliasOptions,
} from './vite';
