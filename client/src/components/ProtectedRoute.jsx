import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  console.log('[ProtectedRoute] Checking access:', { isAuthenticated, userId: user?.userId, hasUser: !!user });

  if (!isAuthenticated) {
    console.warn('[ProtectedRoute] Not authenticated, redirecting to /unauthorized');
    // Redirect to an unauthorized landing page so users understand why.
    return <Navigate to="/unauthorized" replace />;
  }

  // New users who haven't completed onboarding get guided through setup.
  if (user?.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return children ? children : <Outlet />;
}
