import { Navigate, useLocation } from 'react-router-dom';
import { useAppState } from '../../state/AppStateProvider.jsx';

const ProtectedRoute = ({ children }) => {
  const { auth } = useAppState();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;

