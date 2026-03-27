import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import Dashboard from './Dashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <Dashboard />;
}
