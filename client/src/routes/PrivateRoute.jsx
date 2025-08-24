import { Navigate } from 'react-router-dom';
import { storage } from '../utils/storage';

function PrivateRoute({ children }) {
  const token = storage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

export default PrivateRoute;

