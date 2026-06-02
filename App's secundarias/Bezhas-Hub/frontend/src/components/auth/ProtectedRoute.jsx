import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Spinner } from '../ui/Spinner';

/**
 * @dev A component to protect routes that require a wallet connection.
 * It checks for a connected address from wagmi.
 * While loading, it shows a spinner. If not connected, it redirects to the homepage.
 */
const ProtectedRoute = () => {
  const { address, isConnecting, isReconnecting } = useAccount();

  // Show a loading spinner while the connection status is being determined
  if (isConnecting || isReconnecting) {
    return (
      <div className="w-full h-screen flex justify-center items-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // If the user is not connected (address is null), redirect them to the home page
  if (!address) {
    return <Navigate to="/" replace />;
  }

  // If the user is connected, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;
