// Rota protegida que exige login
import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isLoggedIn } from '../utils/auth';

type Props = { children: ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const location = useLocation();
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
