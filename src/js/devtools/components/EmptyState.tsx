interface EmptyStateProps {
  isDark: boolean;
}

export function EmptyState({ isDark }: EmptyStateProps) {
  return (
    <div className={`flex items-center justify-center h-full ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="text-center p-8 max-w-md">
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          No Errors or Debug Output
        </h3>
        <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Server errors and dd/dump output will appear here when they occur.
        </p>
        <div className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <p>
            • <span className="font-medium">500+ errors</span> will show with
            full Whoops stack traces
          </p>
          <p>
            • <span className="font-medium">dd/dump output</span> will display
            Symfony VarDumper
          </p>
          <p>
            • <span className="font-medium">Errors persist</span> across page
            reloads (max 50)
          </p>
        </div>
        <div className={`mt-6 p-3 rounded-lg text-left ${
          isDark
            ? 'bg-blue-900/30'
            : 'bg-blue-50'
        }`}>
          <div className={`text-xs font-medium mb-1 ${
            isDark ? 'text-blue-300' : 'text-blue-900'
          }`}>
            Test the error panel
          </div>
          <div className={`text-xs ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
            Visit{' '}
            <a
              href="/demo/errors"
              className={`underline font-medium ${
                isDark ? 'hover:text-blue-100' : 'hover:text-blue-800'
              }`}
            >
              /demo/errors
            </a>{' '}
            to trigger test errors
          </div>
        </div>
      </div>
    </div>
  );
}
