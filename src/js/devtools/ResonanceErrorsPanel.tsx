import { useState, useEffect } from 'react';
import { useErrorStore } from './hooks/useErrorStore';
import { ErrorList } from './components/ErrorList';
import { ErrorDetail } from './components/ErrorDetail';
import { EmptyState } from './components/EmptyState';
import type { ErrorEntry } from './types';

export interface ResonanceErrorsPanelProps {
  /**
   * Theme resolved by TanStack devtools
   * This is passed automatically by the devtools framework
   */
  theme: 'light' | 'dark';
}

export function ResonanceErrorsPanel({ theme }: ResonanceErrorsPanelProps) {
  const errors = useErrorStore();
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);
  const isDark = theme === 'dark';

  // Auto-select first error when errors exist and nothing is selected
  useEffect(() => {
    if (errors.length > 0 && !selectedError) {
      setSelectedError(errors[0]);
    }
  }, [errors, selectedError]);

  // Clear selection if selected error was deleted
  useEffect(() => {
    if (selectedError && !errors.find((e) => e.id === selectedError.id)) {
      setSelectedError(null);
    }
  }, [errors, selectedError]);

  return (
    <div className={`flex h-full w-full ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      <ErrorList
        errors={errors}
        selectedId={selectedError?.id}
        onSelect={setSelectedError}
        isDark={isDark}
      />
      <div className="flex-1 h-full overflow-hidden">
        {selectedError ? (
          <ErrorDetail error={selectedError} isDark={isDark} />
        ) : (
          <EmptyState isDark={isDark} />
        )}
      </div>
    </div>
  );
}
