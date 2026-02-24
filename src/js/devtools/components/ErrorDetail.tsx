import { useEffect } from 'react';
import type { ErrorEntry } from '../types';
import { errorStore } from '../ErrorStore';

interface ErrorDetailProps {
  error: ErrorEntry;
  isDark: boolean;
}

export function ErrorDetail({ error, isDark }: ErrorDetailProps) {
  const isDebugOutput =
    error.html.includes('sf-dump') ||
    error.html.includes('Symfony\\Component\\VarDumper');

  useEffect(() => {
    if (!error.read) {
      errorStore.markRead(error.id);
    }
  }, [error.id, error.read]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const handleClearError = () => {
    errorStore.clearError(error.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isDark
          ? 'border-gray-700 bg-gray-900'
          : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isDebugOutput ? 'bg-blue-500' : 'bg-red-500'
            }`}
          />
          <div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {isDebugOutput ? 'Debug Output' : 'Development Error'}
            </h2>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {formatTimestamp(error.timestamp)}
            </p>
          </div>
        </div>
        <button
          onClick={handleClearError}
          className={`text-xs font-medium px-3 py-1 rounded ${
            isDark
              ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30'
              : 'text-red-600 hover:text-red-700 hover:bg-red-50'
          }`}
        >
          Clear
        </button>
      </div>

      {/* Exception Info (if available) */}
      {error.exception && !isDebugOutput && (
        <div className={`p-4 border-b ${
          isDark
            ? 'bg-red-900/20 border-red-900/50'
            : 'bg-red-50 border-red-100'
        }`}>
          <div className={`text-sm font-medium mb-1 ${
            isDark ? 'text-red-300' : 'text-red-900'
          }`}>
            {error.exception.class}
          </div>
          <div className={`text-sm mb-2 ${
            isDark ? 'text-red-200' : 'text-red-700'
          }`}>
            {error.exception.message}
          </div>
          <div className={`text-xs font-mono ${
            isDark ? 'text-red-300' : 'text-red-600'
          }`}>
            {error.exception.file}:{error.exception.line}
          </div>
        </div>
      )}

      {/* HTML Content in iframe */}
      <div className={`flex-1 overflow-auto ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        {error.html && error.html.trim().length > 0 ? (
          <iframe
            srcDoc={error.html}
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-popups"
            title="Error Details"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <div className={`mb-2 text-xl ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>!</div>
              <div className={`text-sm font-medium mb-1 ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Error Rendering Failed
              </div>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No HTML content available
              </div>
              {error.exception && (
                <div className={`mt-4 p-3 rounded text-left ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <div className={`text-xs font-mono ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    <div className="font-semibold mb-1">
                      {error.exception.class}
                    </div>
                    <div className={`mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {error.exception.message}
                    </div>
                    <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                      {error.exception.file}:{error.exception.line}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
