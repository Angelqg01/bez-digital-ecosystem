
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ adminOnly = false }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    // You might want to show a loading spinner here
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // If not authenticated, redirect to the login page (or home page)
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !user?.roles?.includes('ADMIN')) {
    // If it's an admin-only route and the user is not an admin, redirect
    console.warn('Access denied: User is not an admin.');
    return <Navigate to="/" replace />;
  }

  // If authenticated and has the required role (if any), render the child components
  return <Outlet />;
};

export default ProtectedRoute;
