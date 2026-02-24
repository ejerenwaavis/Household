import React from 'react';
import { logError } from '../services/errorService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const errorId = logError(error, {
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
    
    this.setState({ errorId });
    
    // Log to console in development
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-700 dark:text-gray-300">
                We encountered an unexpected error. Our team has been notified.
              </p>
            </div>

            {this.state.errorId && (
              <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Error ID:</strong> {this.state.errorId}
                </p>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded">
                <p className="text-xs text-yellow-800 dark:text-yellow-200 font-mono break-words">
                  {this.state.error?.toString()}
                </p>
              </div>
            )}

            <button
              onClick={this.resetError}
              className="w-full px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded hover:bg-indigo-700 dark:hover:bg-indigo-600 transition"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
