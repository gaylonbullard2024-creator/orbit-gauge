import Dashboard from './Dashboard';
import { SignupGate } from '@/components/SignupGate';
import { useLeadGate } from '@/hooks/useLeadGate';

export default function Index() {
  const { isUnlocked, unlock, hydrated } = useLeadGate();

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isUnlocked) {
    return <SignupGate onUnlock={unlock} />;
  }

  return <Dashboard />;
}
