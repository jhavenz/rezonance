import { ResonanceErrorsPanel } from './ResonanceErrorsPanel';
import type { TanStackDevtoolsReactPlugin } from '@tanstack/react-devtools';

// Export all types
export type { ErrorEntry } from './types';

// Export store and hooks
export { ErrorStore, errorStore } from './ErrorStore';
export { useErrorStore, useUnreadErrorCount } from './hooks/useErrorStore';

// Export components (for advanced usage)
export { ResonanceErrorsPanel, type ResonanceErrorsPanelProps } from './ResonanceErrorsPanel';
export { ErrorList } from './components/ErrorList';
export { ErrorDetail } from './components/ErrorDetail';
export { EmptyState } from './components/EmptyState';

/**
 * Create TanStack Devtools plugin for Resonance Errors
 *
 * TanStack devtools automatically handle theme management and pass the
 * resolved theme ('light' or 'dark') to the plugin render function.
 *
 * @example
 * ```tsx
 * import { createErrorsDevtoolsPlugin } from '@jhavenz/resonance/devtools';
 *
 * <TanStackDevtools
 *   plugins={[createErrorsDevtoolsPlugin()]}
 * />
 * ```
 */
export function createErrorsDevtoolsPlugin(): TanStackDevtoolsReactPlugin {
  return {
    id: 'resonance-errors',
    name: 'Resonance Errors',
    // Use function form to receive theme from TanStack devtools
    render: (_el, theme) => <ResonanceErrorsPanel theme={theme} />,
    defaultOpen: false,
  };
}
