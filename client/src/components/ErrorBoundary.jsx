import React from 'react';

/**
 * Global Error Boundary Component
 * Catches errors in child components and displays error UI
 * Logs errors for debugging and monitoring
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Generate unique error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
      errorId
    }));

    // Log to console for debugging
    console.error('[ErrorBoundary] Error caught:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    console.error('[ErrorBoundary] Error ID:', errorId);

    // Log to Sentry if available
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: { react: errorInfo },
        tags: { errorId }
      });
    }

    // TODO: Send to monitoring service
    // logErrorToService(error, errorInfo, errorId);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-red-200 dark:border-red-900">
            {/* Error Icon */}
            <div className="text-6xl mb-4 text-center">⚠️</div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-4">
              Something Went Wrong
            </h1>

            {/* Error Message */}
            <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
              We encountered an unexpected error. Our team has been notified and we're working to fix it.
            </p>

            {/* Error ID */}
            {this.state.errorId && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Error ID:</span> <code className="font-mono">{this.state.errorId}</code>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Please reference this ID if contacting support.
                </p>
              </div>
            )}

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="text-sm mb-2">
                  <p className="font-bold text-red-700 dark:text-red-300 mb-1">Error Details:</p>
                  <code className="text-xs text-red-600 dark:text-red-400 block overflow-auto max-h-40 whitespace-pre-wrap break-words">
                    {this.state.error.toString()}
                  </code>
                </div>
                {this.state.errorInfo && (
                  <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                    <p className="font-bold text-red-700 dark:text-red-300 mb-1 text-xs">Stack Trace:</p>
                    <code className="text-xs text-red-600 dark:text-red-400 block overflow-auto max-h-40 whitespace-pre-wrap break-words">
                      {this.state.errorInfo.componentStack}
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* Error Count Warning */}
            {this.state.errorCount > 3 && (
              <div className="mb-6 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Multiple errors detected ({this.state.errorCount}). If this continues, try refreshing the page.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Go Home
              </button>
            </div>

            {/* Support Note */}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
              If the problem persists, please contact support or refresh the page.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
