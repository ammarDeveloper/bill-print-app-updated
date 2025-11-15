import { Navigate, useLocation } from 'react-router-dom';
import { useAppState } from '../../state/AppStateProvider.jsx';

const ProtectedRoute = ({ children }) => {
  const { auth } = useAppState();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    // Redirect to login page with return location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
