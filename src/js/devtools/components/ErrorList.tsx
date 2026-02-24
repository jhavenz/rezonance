import type { ErrorEntry } from '../types';
import { errorStore } from '../ErrorStore';

interface ErrorListProps {
  errors: ErrorEntry[];
  selectedId?: string;
  onSelect: (error: ErrorEntry) => void;
  isDark: boolean;
}

export function ErrorList({ errors, selectedId, onSelect, isDark }: ErrorListProps) {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleTimeString();
  };

  const getErrorTitle = (error: ErrorEntry) => {
    if (error.type === 'debug') return 'Debug Output';
    return error.exception?.class || 'Error';
  };

  const getErrorMessage = (error: ErrorEntry) => {
    if (error.type === 'debug') return 'dd() / dump()';
    return error.exception?.message || 'No message';
  };

  return (
    <div className={`flex flex-col h-full border-r w-80 ${
      isDark
        ? 'border-gray-700 bg-gray-800'
        : 'border-gray-200 bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isDark
          ? 'border-gray-700 bg-gray-900'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            Errors & Debug
          </h3>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            ({errors.length})
          </span>
        </div>
        {errors.length > 0 && (
          <button
            onClick={() => errorStore.clear()}
            className={`text-xs font-medium ${
              isDark
                ? 'text-red-400 hover:text-red-300'
                : 'text-red-600 hover:text-red-700'
            }`}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Error List */}
      <div className="flex-1 overflow-y-auto">
        {errors.length === 0 ? (
          <div className={`p-4 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            No errors yet
          </div>
        ) : (
          errors.map((error) => (
            <button
              key={error.id}
              onClick={() => onSelect(error)}
              className={`
                w-full text-left p-3 border-b transition-colors relative
                ${isDark
                  ? 'border-gray-700 hover:bg-gray-700'
                  : 'border-gray-200 hover:bg-gray-100'}
                ${selectedId === error.id
                  ? isDark
                    ? 'bg-blue-900/30 hover:bg-blue-900/40'
                    : 'bg-blue-50 hover:bg-blue-100'
                  : ''}
              `}
            >
              {/* Unread indicator */}
              {!error.read && (
                <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
              )}

              {/* Type badge */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`
                    inline-block px-2 py-0.5 text-xs font-medium rounded
                    ${error.type === 'error'
                      ? isDark
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-red-100 text-red-700'
                      : isDark
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-blue-100 text-blue-700'
                    }
                  `}
                >
                  {error.type === 'error' ? 'Error' : 'Debug'}
                </span>
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {formatTimestamp(error.timestamp)}
                </span>
              </div>

              {/* Title */}
              <div className={`text-sm font-medium truncate mb-1 ${
                isDark ? 'text-gray-100' : 'text-gray-900'
              }`}>
                {getErrorTitle(error)}
              </div>

              {/* Message */}
              <div className={`text-xs truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {getErrorMessage(error)}
              </div>

              {/* File location if available */}
              {error.exception?.file && (
                <div className={`text-xs truncate mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {error.exception.file}:{error.exception.line}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
